#!/usr/bin/env python
"""在 Dify api 容器内导入 pf-extract / pf-narrate 两个工作流并签发 API Key。

运行方式（宿主机，见同目录 setup_workflows.sh）：
    docker cp extract_workflow.yml docker-api-1:/tmp/pf-extract-workflow.yml
    docker cp narrate_workflow.yml docker-api-1:/tmp/pf-narrate-workflow.yml
    docker cp setup_workflows.py  docker-api-1:/tmp/setup_workflows.py
    docker exec -i docker-api-1 python /tmp/setup_workflows.py

原理：
- 用真实 services/app_dsl_service.AppDslService.import_app 导入 DSL（yaml-content），
  与控制台「导入 DSL」完全同路径，schema/表写入正确。
- 用 controllers/console/apikey.py 同款 ApiToken.generate_api_key("app-", 24) + INSERT
  签发 workflow 应用的 service-api key；token 明文存储、精确匹配校验，故直接 INSERT 即生效。
- 按 app.name 复用：已存在同名 workflow 应用则复用其 app_id，避免重复建应用。
- version: 0.7.0 = CURRENT_APP_DSL_VERSION，导入即 COMPLETED，无需 confirm 步骤。

输出（stdout，单行 JSON）：
    {"extract":{"app_id":"...","key":"app-...","created":true},
     "narrate":{"app_id":"...","key":"app-...","created":true}}

注：本脚本会向 Dify 数据库写入应用与 API Key（租户内部、可逆：在 Dify 控制台删除应用即可）。
"""
import json
import os
import sys
from pathlib import Path

# 容器内 /tmp 跑时，把 Dify 代码根加入 sys.path（python script.py 默认只把脚本目录入路径）
for _root in ("/app/api", "/app"):
    if os.path.isdir(_root) and os.path.exists(os.path.join(_root, "app_factory.py")):
        sys.path.insert(0, _root)
        break

EXTRACT_DSL = Path("/tmp/pf-extract-workflow.yml")
NARRATE_DSL = Path("/tmp/pf-narrate-workflow.yml")

APPS = [
    ("pf-extract", EXTRACT_DSL),
    ("pf-narrate", NARRATE_DSL),
]


def main() -> int:
    from app_factory import create_app
    from extensions.ext_database import db
    from models.account import Account, TenantAccountJoin, TenantAccountRole
    from models.model import App, AppMode
    from services.app_dsl_service import AppDslService, ImportStatus
    from sqlalchemy import select
    from sqlalchemy.orm import Session

    wsgi, app = create_app()
    out: dict[str, dict] = {}
    with app.app_context():
        with Session(db.engine, expire_on_commit=False) as session:
            # 1) 取租户 owner 账号，设 current_tenant（import_app 依赖它）
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
            for name, dsl_path in APPS:
                if not dsl_path.exists():
                    print(f"ERROR: DSL not found: {dsl_path}", file=sys.stderr)
                    return 1
                yaml_content = dsl_path.read_text(encoding="utf-8")

                # 2) 按名复用：已存在同名 workflow 应用则用 app_id 覆盖式导入（刷新草稿图），
                #    否则新建。这样每次运行都把最新 DSL 同步进草稿，再发布。
                existing = session.execute(
                    select(App).where(
                        App.tenant_id == tenant_id,
                        App.name == name,
                        App.mode == AppMode.WORKFLOW.value,
                    ).limit(1)
                ).scalars().first()
                result = svc.import_app(
                    account=account,
                    import_mode="yaml-content",
                    yaml_content=yaml_content,
                    name=name,
                    app_id=(str(existing.id) if existing else None),
                )
                if result.status == ImportStatus.FAILED:
                    session.rollback()
                    print(f"ERROR: import {name} failed: {result.error}", file=sys.stderr)
                    return 1
                if result.status == ImportStatus.PENDING:
                    # 版本不匹配时才需要 confirm；0.7.0 正常不会走到
                    result = svc.confirm_import(import_id=result.id, account=account)
                    if result.status == ImportStatus.FAILED:
                        session.rollback()
                        print(f"ERROR: confirm {name} failed: {result.error}", file=sys.stderr)
                        return 1
                session.commit()
                app_id = str(result.app_id)
                created = existing is None

                # 3) 发布工作流：/v1/workflows/run 需要已发布版本（导入的是草稿）。
                #    publish_workflow 会校验模型引用 + 凭据（经 plugin_daemon），通过即说明
                #    tongyi/qwen3.8-max 默认凭据可自动解析。
                from services.workflow_service import WorkflowService
                app_obj = session.get(App, app_id)
                published = WorkflowService(session).publish_workflow(
                    session=session, app_model=app_obj, account=account
                )
                # publish_workflow 创建已发布版本后，靠 app_published_workflow_was_updated
                # 信号写 app.workflow_id；该信号用请求级 db.session，脚本里无 request 上下文
                # 不会提交。这里直接在本 session 设置 workflow_id 指向已发布版本。
                app_obj.workflow_id = published.id
                app_obj.updated_by = account.id
                session.commit()

                # 4) 签发 API Key（与控制台 POST /apps/<id>/api-keys 同款逻辑）。
                #    已存在则复用，避免重复运行签发多把 Key。
                from models.model import ApiToken
                existing_tok = session.execute(
                    select(ApiToken)
                    .where(ApiToken.app_id == app_id, ApiToken.type == "app")
                    .order_by(ApiToken.created_at.desc())
                    .limit(1)
                ).scalars().first()
                if existing_tok:
                    key = existing_tok.token
                else:
                    key = ApiToken.generate_api_key("app-", 24, session=session)
                    tok = ApiToken()
                    tok.app_id = app_id
                    tok.tenant_id = tenant_id
                    tok.token = key
                    tok.type = "app"  # ApiTokenType.APP
                    session.add(tok)
                    session.commit()

                out[name.removeprefix("pf-")] = {
                    "app_id": app_id,
                    "key": key,
                    "created": created,
                }

    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
