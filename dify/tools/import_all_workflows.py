#!/usr/bin/env python
"""在 Dify api 容器内导入 dify/ 根目录全部 14 个工作流 DSL，并发布 + 签发 API Key。

宿主机用法（容器名默认 docker-api-1，可用 DIFY_API_CONTAINER 覆盖）：
    docker cp dify/            $CTR:/tmp/yuejiao-dsl/
    docker cp dify/tools/import_all_workflows.py $CTR:/tmp/import_all.py
    docker exec -i $CTR python /tmp/import_all.py [仅处理的名字前缀...]

与 pf_setup_workflows.py 相同的原理：
- 用 services/app_dsl_service.AppDslService.import_app（yaml-content）导入，
  与控制台「导入 DSL」同路径；按 app.name + mode 复用同名应用（覆盖式刷新草稿图）。
- WorkflowService.publish_workflow 发布（service API 只调已发布版本），
  ApiToken.generate_api_key 签发/复用 service-api Key。
- 可选环境变量 REWRITE_MODEL=<model_name>：把所有 LLM / 问题分类器节点的模型
  统一改写为本地 Ollama 模型（provider=langgenius/ollama/ollama），用于没有
  云端模型凭据的机器做端到端演示。

输出（stdout，单行 JSON）：{ "<yml文件名去.yml>": {"app_id","key","mode","created"}, ... }
单个 DSL 导入/发布失败不中断，记录在结果里（"error" 字段）。
"""
import json
import os
import sys
from pathlib import Path

for _root in ("/app/api", "/app"):
    if os.path.isdir(_root) and os.path.exists(os.path.join(_root, "app_factory.py")):
        sys.path.insert(0, _root)
        break

DSL_DIR = Path("/tmp/yuejiao-dsl")
# 统一模型绑定：缺失/空白/非 tongyi 的 LLM 与分类器节点一律改绑到 tongyi。
# tongyi/qwen3.8-max 等已有 tongyi 绑定保持原样（PF 抽取/研判的高质量模型）。
FALLBACK_PROVIDER = "langgenius/tongyi/tongyi"
FALLBACK_MODEL = "qwen3.5-flash"


def rewrite_models(dsl: dict) -> int:
    """把 LLM / question-classifier 节点的模型统一改绑到 tongyi，返回改写节点数。"""
    changed = 0
    for node in dsl.get("workflow", {}).get("graph", {}).get("nodes", []):
        data = node.get("data", {})
        if data.get("type") in ("llm", "question-classifier"):
            m = data.get("model")
            provider = m.get("provider") if isinstance(m, dict) else None
            name = m.get("name") if isinstance(m, dict) else None
            if provider == FALLBACK_PROVIDER and name:
                continue  # 已正确绑定 tongyi（含 qwen3.8-max），不动
            params = m.get("completion_params", {}) if isinstance(m, dict) and isinstance(m.get("completion_params"), dict) else {}
            data["model"] = {
                "provider": FALLBACK_PROVIDER,
                "name": FALLBACK_MODEL,
                "mode": "chat",
                "completion_params": params,
            }
            changed += 1
    return changed


def main() -> int:
    import yaml
    from app_factory import create_app
    from extensions.ext_database import db
    from models.account import Account, TenantAccountJoin, TenantAccountRole
    from models.model import App, ApiToken
    from services.app_dsl_service import AppDslService, ImportStatus
    from services.workflow_service import WorkflowService
    from sqlalchemy import select
    from sqlalchemy.orm import Session

    prefixes = sys.argv[1:]
    dsl_files = sorted(DSL_DIR.glob("*.yml"))
    if prefixes:
        dsl_files = [f for f in dsl_files if any(p in f.stem for p in prefixes)]
    if not dsl_files:
        print("ERROR: no DSL files matched", file=sys.stderr)
        return 1

    wsgi, app = create_app()
    out: dict[str, dict] = {}
    with app.app_context():
        with Session(db.engine, expire_on_commit=False) as session:
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
            tenant_id = str(account.current_tenant_id)
            svc = AppDslService(session)

            for dsl_path in dsl_files:
                name = dsl_path.stem
                rec: dict = {}
                try:
                    raw = dsl_path.read_text(encoding="utf-8")
                    dsl = yaml.safe_load(raw)
                    mode = dsl.get("app", {}).get("mode", "workflow")
                    n = rewrite_models(dsl)
                    if n:
                        raw = yaml.safe_dump(dsl, allow_unicode=True, sort_keys=False, width=10**9)
                    rec["rewritten_nodes"] = n

                    existing = session.execute(
                        select(App).where(
                            App.tenant_id == tenant_id,
                            App.name == name,
                            App.mode == mode,
                        ).limit(1)
                    ).scalars().first()
                    result = svc.import_app(
                        account=account,
                        import_mode="yaml-content",
                        yaml_content=raw,
                        name=name,
                        app_id=(str(existing.id) if existing else None),
                    )
                    if result.status == ImportStatus.FAILED:
                        raise RuntimeError(f"import failed: {result.error}")
                    if result.status == ImportStatus.PENDING:
                        result = svc.confirm_import(import_id=result.id, account=account)
                        if result.status == ImportStatus.FAILED:
                            raise RuntimeError(f"confirm failed: {result.error}")
                    session.commit()

                    app_obj = session.get(App, str(result.app_id))
                    published = WorkflowService(session).publish_workflow(
                        session=session, app_model=app_obj, account=account
                    )
                    app_obj.workflow_id = published.id
                    app_obj.updated_by = account.id
                    session.commit()

                    tok = session.execute(
                        select(ApiToken)
                        .where(ApiToken.app_id == str(app_obj.id), ApiToken.type == "app")
                        .order_by(ApiToken.created_at.desc())
                        .limit(1)
                    ).scalars().first()
                    if tok:
                        key = tok.token
                    else:
                        key = ApiToken.generate_api_key("app-", 24, session=session)
                        t = ApiToken()
                        t.app_id = str(app_obj.id)
                        t.tenant_id = tenant_id
                        t.token = key
                        t.type = "app"
                        session.add(t)
                        session.commit()

                    rec.update(app_id=str(app_obj.id), key=key, mode=mode,
                               created=existing is None, error="")
                except Exception as exc:  # 单个失败不中断，继续导后面的
                    session.rollback()
                    rec["error"] = str(exc)[:300]
                out[name] = rec

    print(json.dumps(out, ensure_ascii=False))
    failed = [k for k, v in out.items() if v.get("error")]
    return 1 if len(failed) == len(out) else 0


if __name__ == "__main__":
    sys.exit(main())
