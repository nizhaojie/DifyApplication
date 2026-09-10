# group-qukewei

Private code repo for team Group_QuKewei

## 目录

- `yuejiao-admin/` —— 粤教管理后台（FastAPI）：客服Agent / 企业助手 / **客户研判(profile)** / 智能报告
- `yuejiao-web/` —— 粤教前端（React 19 + Vite + TS + Radix UI）
- `dify/` —— Dify 工作流 DSL 与工具（含 `dsl/pf_extract_workflow.yml`、`dsl/pf_narrate_workflow.yml`）
- `公用/` —— 公共资料（SQL 表设计、需求原文）

## 客户研判（PF）模块

已并入 `yuejiao-admin/app/modules/profile/`（原独立项目 customer-profiling 移植）：

- 接口：`POST /api/v1/profile/assess`（文本/PDF/Excel/结构化 profile，JWT 鉴权）、`GET /api/v1/profile/profiles`、`GET /api/v1/profile/profiles/{id}`
- Dify：`pf-extract` / `pf-narrate` 两个工作流，独立 Key（admin `.env` 的 `DIFY_EXTRACT_API_KEY` / `DIFY_NARRATE_API_KEY`）；不可达时按 `PF_LLM_FALLBACK` 兜底（heuristic/off）
- 建表：`scripts/init_db.py`（MySQL）+ 规则 seed：`scripts/seed_profile_rules.py`
- 回归：`tests/profile/run_golden_set.py`（黄金集 20 条，移植前实测 100%）