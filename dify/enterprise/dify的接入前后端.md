# 粤教-企业智能助手 · Dify 接入前后端

应用：`粤教-企业智能助手`（对话流 / Chatflow）  
App ID：`2c44aa34-c2e3-4eaf-b154-0d77f325d2d4`  
编排：http://localhost/app/2c44aa34-c2e3-4eaf-b154-0d77f325d2d4/workflow  
访问点：http://localhost/app/2c44aa34-c2e3-4eaf-b154-0d77f325d2d4/develop

密钥只放本机 `.env`，**不要写进本文件、不要提交仓库、不要写进 Obsidian**。

## 链路（已经接好）

```
浏览器 企业助手页 :5174
  → POST /api/v1/enterprise/chat   （带 JWT）
    → FastAPI :8002
      → Dify POST /v1/chat-messages （Bearer app-...）
        → 分类器分流
          → HTTP 节点调 FastAPI /api/v1/enterprise/tools/*  （host.docker.internal:8002）
          → 或知识库检索
        → LLM 组织成口语句
      ← answer + conversation_id
  ← { code:200, data:{ reply, conversation_id, source:"dify" } }
```

前端不直连 Dify。Key 只在后端。

| 层 | 地址 | 作用 |
|---|---|---|
| 前端 | `yuejiao-web/react-frontend`，开发口 `http://127.0.0.1:5174/enterprise` | 对话 UI，登录后打 FastAPI |
| 后端 | `group-qkw/yuejiao-admin`，`0.0.0.0:8002` | 代理 Dify；给 Dify HTTP 节点当工具 |
| Dify | Docker，浏览器 `http://localhost` | 分类、知识库、组织回复 |

没配 `DIFY_ENTERPRISE_API_KEY` 时，`/chat` 走本地口语解析（`source=local`），演示不会断。配了 Key 但 Dify 报错时，同样回退本地，响应里会带 `dify_fallback`。

---

## 接入流程（按这个点）

### 1. Dify 侧：发布 + 访问点

1. 打开工作室，确认应用名是 **粤教-企业智能助手**，类型是 **CHATFLOW**。
2. 画布改完必须点右上角 **发布**。访问点只打已发布版本。
3. 左栏点 **访问点**：
   - API 服务器：本机是 `http://localhost/v1`
   - **API 密钥**：新建一把，复制 `app-` 开头的值。
4. 不要把这个 Key 贴到前端、文档、聊天记录。

导入 DSL 时用 `dify/企业智能助手.yml`（所有 DSL 已统一在 `dify/` 根目录），知识库绑定见 `dify/enterprise/README.md`。

### 2. 后端 `.env`

文件：`group-qkw/yuejiao-admin/.env`（对照 `.env.example`）

```
APP_HOST=0.0.0.0
APP_PORT=8002
DEBUG=true

CORS_ORIGINS=http://127.0.0.1:5174,http://localhost:5174

DIFY_BASE_URL=http://localhost/v1
DIFY_ENTERPRISE_API_KEY=app-这里粘访问点复制的值
DIFY_TOOL_TOKEN=
```

- `DEBUG=true` 且 `DIFY_TOOL_TOKEN` 为空：Dify HTTP 节点可以不带 JWT 调用工具接口（开发态）。
- 后端必须绑 `0.0.0.0:8002`。只绑 `127.0.0.1` 时，Docker 里的 `host.docker.internal` 往往打不进来。

启动：

```powershell
cd C:\Users\Windows\Desktop\粤教\group-qkw\yuejiao-admin
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

改完 `.env` 必须重启进程，`settings` 启动时读一次。

本机冒烟：

```powershell
.\.venv\Scripts\python.exe scripts\smoke_dify_chat.py
```

成功应看到 `source=dify` 和 `ALL_DIFY_OK`。

### 3. 前端 `.env`

文件：`yuejiao-web/react-frontend/.env`

```
VITE_API_BASE=http://127.0.0.1:8002
```

```powershell
cd C:\Users\Windows\Desktop\粤教\group-qkw\yuejiao-web\react-frontend
npm run dev
```

浏览器：

1. http://127.0.0.1:5174/login
2. 演示账号 `emp01` / `123456`
3. 进入 **企业助手**
4. 页头应显示 **已接 Dify 对话流**
5. 试一句「公司简称是什么？」「我今天有什么待办？」

对话超时已加到 120 秒（分类器 + HTTP + LLM 比本地解析慢）。公司简称、打印机这类知识问句走后端本地检索，秒回，不经过 Dify。

### 4. 画布 HTTP 节点（给 Dify 调后端）

已发布图里的地址必须是：

`http://host.docker.internal:8002/api/v1/enterprise/...`

| 意图 | 方法 | 路径 |
|---|---|---|
| 录入客户 | POST | `/tools/lead-from-text` |
| 查询客户 | POST | `/tools/lead-query` |
| 改状态 | POST | `/tools/lead-update` |
| 交日报 | POST | `/tools/daily-from-text` |
| NL2SQL | POST | `/tools/nl2sql` |
| 批假 / 指令 | POST | `/tools/command` |
| 今日待办 | GET | `/brief` |
| 组织架构 | GET | `/orgs` |
| 查阅日报 | GET | `/dailies` |
| 投诉查询/结案 | POST | `/tools/ticket-from-text` |
| 学生业务综管 | GET | `/ops` |
| 学生助手假接口 | GET/POST | `/student-bridge` `/student-bridge/leave` `/student-bridge/ticket` |

请求头带 `X-Employee-Id:{{#start.employee_id#}}`。后端聊天代理会把当前登录员工 id 放进 Dify `inputs.employee_id`。

鉴权选 **无 / no-auth**（开发态靠 `DEBUG=true`）。不要在节点里写 JWT。

---

## 接入必须注意

### 网络

- Dify 在 Docker 里，**禁止**把 HTTP 节点写成 `127.0.0.1` 或 `localhost`（那是容器自己，不是你的 FastAPI）。
- 正确主机名：`host.docker.internal`，端口 **8002**（不要写成 8000）。
- FastAPI 要 `--host 0.0.0.0 --port 8002`。
- 从容器自测：`docker exec dify-api-1 python -c "import urllib.request; print(urllib.request.urlopen('http://host.docker.internal:8002/health').read())"`

### SSRF（Dify 1.15+）

HTTP 节点会走 `ssrf_proxy`。本机已放行：

- `SSRF_PROXY_ALLOW_PRIVATE_DOMAINS=host.docker.internal`
- `SSRF_PROXY_ALLOW_PRIVATE_IPS` 含常见私网段

若节点报 SSRF / 403，先看 Dify `docker/.env` 这两项，改完要重建 `ssrf_proxy`。不要改 compose。

Squid 默认读超时约 **5 秒**。工具接口应很快；NL2SQL 或库慢时节点会断。优先把后端查快点，而不是先关 SSRF。

### 鉴权

| 谁调谁 | 怎么认 |
|---|---|
| 前端 → FastAPI `/chat` | 登录 JWT（`get_current_user`） |
| FastAPI → Dify `/v1/chat-messages` | `Authorization: Bearer <访问点 API Key>` |
| Dify HTTP 节点 → FastAPI `/tools/*` | 开发：`DEBUG=true` + `X-Employee-Id`；上线：填 `DIFY_TOOL_TOKEN`，节点加 `X-Dify-Token`，再把 `DEBUG` 关掉 |

`DEBUG=false` 且没配 `DIFY_TOOL_TOKEN` 时，HTTP 节点会 401，分类到业务分支后看起来像「Dify 没做事」。

### 发布与模型

- 画布保存 ≠ 访问点生效，**必须发布**。
- 分类器和全部 LLM 要选本机已配模型（常用通义 / deepseek-v3）。
- 知识检索节点导入后要手动绑两个库（企业信息+新人指南 / 常见问答对）。ID 不要写进 DSL。
- 「公司简称是什么？」必须进 **常见问答对** 那条。若分到企业信息库，会答「库里没有」。后端已加本地知识库快路径，这一句不再等分类器；画布分类描述也已写死「简称禁止走企业信息库」。重新发布后 Dify 自己也能答。
- DeepSeek 的 `<think>` 推理段后端会剥掉再给前端；画布 LLM 仍建议关掉思维链展示。
- 应用未发布、Key 无效、模型额度 429，后端都会回退本地解析。看响应 `source` 和 `dify_fallback`，或 Dify 左栏 **日志**。

### 前端

- 只配 `VITE_API_BASE`，不要把 Dify Key 放进 Vite。
- 多轮对话靠 `conversation_id` 往返，同时写入 `chat_session` / `chat_message`。自称（「我是某某」）再问「我是谁」走后端记忆，不走账号短路。点「新对话」才清空。
- 页头绿标「已接 Dify 对话流」来自 `GET /api/v1/enterprise/chat-status`，只说明 Key 已配，不保证这一句一定走了知识库。看气泡上的 `Dify` / `本地`。

### 密钥与红线

- `DIFY_ENTERPRISE_API_KEY`、`DIFY_TOOL_TOKEN`、数据库口令只在 `.env`。
- 本文件、README、金库只写「去访问点复制」，不写真实 Key。
- 访问点可以随时作废旧 Key、再生成一把，然后改 `.env` 重启后端。

---

## 怎么确认已经接上

1. `GET http://127.0.0.1:8002/health` 返回 `ok`。
2. 登录后 `GET /api/v1/enterprise/chat-status` 里 `dify_enabled=true`。
3. `POST /api/v1/enterprise/chat` 问「我今天有什么待办？」，`data.source` 为 `dify`。
4. 企业助手页头为绿色「已接 Dify 对话流」，气泡带 `Dify`。
5. Dify 左栏 **日志** 出现对应会话；业务句会打到 FastAPI `/tools/*`。

试一句：

| 问 | 期望 |
|---|---|
| 公司简称是什么？ | 后端知识库快路径，答「粤教服务」，气泡标「知识库」 |
| 打印机在几楼？坏了找谁？ | 新人指南（本地快路径或知识库1） |
| 张三 13800238000 想咨询美国硕士 | HTTP 录入，右侧客户表多一行 |
| 我今天有什么待办？ | HTTP `/brief` |
| 有哪些待处理投诉？ | HTTP 学生业务综管（假接口） |
| 把张三的投诉标成已解决 | HTTP 结案 + 假通知 |

---

## 本机文件对照

| 文件 | 作用 |
|---|---|
| `yuejiao-admin/.env` | Dify Key、DEBUG、库连接 |
| `yuejiao-admin/app/integrations/dify/client.py` | 调 `/v1/chat-messages` |
| `yuejiao-admin/app/modules/enterprise/api/router.py` | `/chat` 代理 + `/tools/*` |
| `yuejiao-admin/app/core/deps.py` | `get_actor` 给 Dify HTTP 用 |
| `yuejiao-admin/app/modules/enterprise/services/knowledge.py` | 公司简称等知识问句的本地秒回检索 |
| `yuejiao-web/react-frontend/src/api/enterprise.ts` | 前端聊天（120s 超时） |
| `yuejiao-web/react-frontend/src/pages/EnterprisePage.tsx` | 企业助手页 |
| `dify/企业智能助手.yml` | 可再导入的 DSL |
| `scripts/smoke_dify_chat.py` | 本机 Dify 冒烟 |
