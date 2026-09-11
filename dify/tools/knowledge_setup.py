#!/usr/bin/env python
"""按 dify/knowledge/manifest.yml 初始化 Dify 知识库并绑定到工作流。

容器内运行（由 dev_up.sh / 手工 docker cp + exec 触发）：
    python /tmp/knowledge_setup.py

职责：
1) 铸造/复用 type='dataset' 的知识库 Service API Key（与控制台"知识库 API"同源）。
2) 按 manifest 创建/复用知识库（economy 关键词索引，不依赖嵌入模型），
   上传 manifest.files 指定的知识文档（按文档名幂等，已存在跳过）。
3) 对 manifest.bind 声明的工作流：把 DSL 里所有 knowledge-retrieval 节点的
   dataset_ids 重写为新知识库真实 ID（占位符方案——DSL 里的旧 ID 属于创建它的
   实例，换实例必然失效），覆盖式导入并发布。

输出（stdout，单行 JSON）：
    {"datasets": {...}, "bound": [...], "skipped": [...]}
"""
import json
import os
import sys
import time
from pathlib import Path

for _root in ("/app/api", "/app"):
    if os.path.isdir(_root) and os.path.exists(os.path.join(_root, "app_factory.py")):
        sys.path.insert(0, _root)
        break

KB_DIR = Path("/tmp/yuejiao-kb")
DSL_DIR = Path("/tmp/yuejiao-dsl")
API_BASE = "http://localhost:5001/v1"


def main() -> int:
    import httpx
    import yaml
    from app_factory import create_app
    from extensions.ext_database import db
    from models.account import Account, TenantAccountJoin, TenantAccountRole
    from models.model import ApiToken, App, AppMode
    from services.app_dsl_service import AppDslService, ImportStatus
    from services.workflow_service import WorkflowService
    from sqlalchemy import select, func
    from sqlalchemy.orm import Session

    manifest_path = KB_DIR / "manifest.yml"
    if not manifest_path.exists():
        print(f"ERROR: manifest not found: {manifest_path}", file=sys.stderr)
        return 1
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
    datasets_spec = manifest.get("datasets") or []
    if not datasets_spec:
        print(json.dumps({"datasets": {}, "bound": [], "skipped": ["manifest 无 datasets"]}))
        return 0

    wsgi, app = create_app()
    result: dict = {"datasets": {}, "bound": [], "skipped": []}
    with app.app_context():
        with Session(db.engine, expire_on_commit=False) as session:
            # 1) 租户 owner + dataset 类型 API Key（复用则不重铸）
            row = session.execute(
                select(Account, TenantAccountJoin).where(
                    TenantAccountJoin.account_id == Account.id,
                    TenantAccountJoin.role == TenantAccountRole.OWNER.value,
                ).limit(1)
            ).first()
            if not row:
                print("ERROR: no owner account/tenant found", file=sys.stderr)
                return 1
            account, join = row
            account.set_tenant_id_with_session(str(join.tenant_id), session=session)
            tenant_id = str(join.tenant_id)

            ds_token = session.execute(
                select(ApiToken).where(ApiToken.type == "dataset", ApiToken.tenant_id == tenant_id)
                .order_by(ApiToken.created_at.desc()).limit(1)
            ).scalars().first()
            if ds_token:
                ds_key = ds_token.token
            else:
                ds_key = ApiToken.generate_api_key("dataset-", 24, session=session)
                tok = ApiToken()
                tok.tenant_id = tenant_id
                tok.token = ds_key
                tok.type = "dataset"  # ApiTokenType.DATASET
                session.add(tok)
                session.commit()

            headers = {"Authorization": f"Bearer {ds_key}", "Content-Type": "application/json"}
            dataset_id_by_name: dict[str, str] = {}

            def api_call(method: str, path: str, **kwargs):
                """Dify 1.17 对 api_tokens 有 Redis 缓存：刚铸造的 key 首次调用可能 401，退避重试。"""
                last_err: Exception | None = None
                for attempt in range(5):
                    try:
                        with httpx.Client(timeout=60, base_url=API_BASE) as api:
                            r = api.request(method, path, headers=headers, **kwargs)
                        if r.status_code != 401:
                            return r
                        last_err = httpx.HTTPStatusError(f"401 on {path}", request=r.request, response=r)
                    except httpx.HTTPError as e:
                        last_err = e
                    time.sleep(2 * (attempt + 1))
                raise last_err  # type: ignore[misc]

            # 2) 创建/复用知识库 + 上传文档（按文档名幂等）
            for spec in datasets_spec:
                name = spec["name"]
                exist = api_call("GET", "/datasets?page=1&limit=100")
                exist.raise_for_status()
                found = next((d for d in exist.json().get("data", []) if d.get("name") == name), None)
                if found:
                    ds_id = found["id"]
                    result["datasets"][name] = {"id": ds_id, "created": False}
                else:
                    r = api_call("POST", "/datasets", json={
                        "name": name,
                        "indexing_technique": spec.get("indexing_technique", "economy"),
                    })
                    r.raise_for_status()
                    ds_id = r.json()["id"]
                    result["datasets"][name] = {"id": ds_id, "created": True}
                dataset_id_by_name[name] = ds_id

                docs = api_call("GET", f"/datasets/{ds_id}/documents?limit=100")
                docs.raise_for_status()
                have = {d.get("name") for d in docs.json().get("data", [])}
                for rel in spec.get("files", []):
                    path = KB_DIR / rel
                    if not path.exists():
                        result["skipped"].append(f"文件缺失: {rel}")
                        continue
                    if path.name in have:
                        continue
                    r = api_call("POST", f"/datasets/{ds_id}/document/create-by-text", json={
                        "name": path.name,
                        "text": path.read_text(encoding="utf-8"),
                        "indexing_technique": spec.get("indexing_technique", "economy"),
                        "process_rule": {"mode": "automatic"},
                    })
                    r.raise_for_status()

                # 绑定：bind 声明在 dataset 条目内
                for bind in spec.get("bind") or []:
                    app_name = bind["workflow"]
                    src = DSL_DIR / f"{app_name}.yml"
                    if not src.exists():
                        result["skipped"].append(f"绑定跳过: {app_name} (DSL 缺失: {src})")
                        continue
                    dsl = yaml.safe_load(src.read_text(encoding="utf-8"))
                    patched = 0
                    for node in (dsl.get("workflow", {}).get("graph", {}).get("nodes") or []):
                        data = node.get("data") or {}
                        if data.get("type") == "knowledge-retrieval" or "dataset_ids" in data:
                            data["dataset_ids"] = [ds_id]
                            patched += 1
                    staged = Path("/tmp") / f"{app_name}.yml"
                    staged.write_text(yaml.safe_dump(dsl, allow_unicode=True, sort_keys=False), encoding="utf-8")

                    existing = session.execute(
                        select(App).where(App.tenant_id == tenant_id, App.name == app_name,
                                          App.mode == AppMode.WORKFLOW.value).limit(1)
                    ).scalars().first()
                    yaml_content = staged.read_text(encoding="utf-8")
                    svc_result = AppDslService(session).import_app(
                        account=account, import_mode="yaml-content", yaml_content=yaml_content,
                        name=app_name, app_id=(str(existing.id) if existing else None),
                    )
                    if svc_result.status == ImportStatus.FAILED:
                        session.rollback()
                        result["skipped"].append(f"导入失败: {app_name}: {svc_result.error}")
                        continue
                    session.commit()
                    app_obj = session.get(App, str(svc_result.app_id))
                    published = WorkflowService(session).publish_workflow(session=session, app_model=app_obj, account=account)
                    app_obj.workflow_id = published.id
                    session.commit()
                    result["bound"].append({"workflow": app_name, "dataset": name, "patched_nodes": patched})

    # stdout 可能被 Dify 启动日志污染，结果落文件供调用方读取
    Path("/tmp/kb_result.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
