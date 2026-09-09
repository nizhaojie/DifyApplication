# 粤教 · 企业智能助手后端

目录：`group-qkw/yuejiao-admin`  
表以 `公用/表/db_init.sql` 为准，不改教育服务原件。

Dify 想、FastAPI 做、MySQL 记。前端走 `POST /api/v1/enterprise/chat`；没配 Dify Key 时用本地口语解析，演示链路也能走通。

接入步骤与注意点：`../dify/enterprise/dify的接入前后端.md`。

## 启动

```powershell
cd C:\Users\Windows\Desktop\粤教\group-qkw\yuejiao-admin
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

在 `.env` 里填 MySQL 密码和库名，**不要把真实密码提交进仓库**。

```powershell
# 建库后执行完整脚本（路径按本机）
# mysql -u root -p yuejiao < ..\公用\表\db_init.sql
# mysql -u root -p yuejiao < .\scripts\seed_enterprise_demo.sql

uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

打开 http://127.0.0.1:8001/docs

演示账号：`emp01` / `123456`（李顾问）。Dify 在 Docker 里调本机，请用 `http://host.docker.internal:8001`，不要写 `127.0.0.1`。

## 核心接口

| 用途 | 方法 | 路径 |
|---|---|---|
| 登录 | POST | `/api/v1/auth/login` |
| 对话（前端） | POST | `/api/v1/enterprise/chat` |
| 今日待办 | GET | `/api/v1/enterprise/brief` |
| 口述录入客户 | POST | `/api/v1/enterprise/leads` body.`text` |
| 客户列表 | GET | `/api/v1/enterprise/leads` |
| 改状态 | PUT | `/api/v1/enterprise/leads/{id}/status` |
| 口述日报 | POST | `/api/v1/enterprise/dailies` |
| 请假审批 | POST | `/api/v1/enterprise/leaves/{id}/approve` |
| NL2SQL | POST | `/api/v1/enterprise/nl2sql` |
| 一句话指令 | POST | `/api/v1/enterprise/tools/command` |

返回信封：`{code, message, data, total}`，成功 `code=200`。

Dify HTTP 节点请打 `/api/v1/enterprise/tools/*`。导入说明见 `../dify/enterprise/README.md`。
