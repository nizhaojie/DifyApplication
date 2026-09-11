#!/usr/bin/env bash
# 一键启动：Dify 就绪 → 导入全部工作流 → 初始化知识库并绑定 → 启动后端/前端
#
# 用法：  bash scripts/dev_up.sh
# 前提：  Docker 在跑；Dify compose 目录默认 /home/Theodore/docker/dify/docker（可用 DIFY_COMPOSE_DIR 覆盖）。
# 可逆：  工作流/知识库均按名复用，重复执行只刷新草稿与补缺文档。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CTR="${DIFY_API_CONTAINER:-docker-api-1}"
COMPOSE_DIR="${DIFY_COMPOSE_DIR:-$HOME/docker/dify/docker}"

say() { printf '\033[36m[dev_up]\033[0m %s\n' "$*"; }

# 1) Dify 栈：未在跑则 compose up，然后等 API 健康
if ! docker inspect -f '{{.State.Status}}' "$CTR" 2>/dev/null | grep -q running; then
  say "启动 Dify compose 栈：$COMPOSE_DIR"
  (cd "$COMPOSE_DIR" && docker compose up -d)
fi
say "等待 Dify API 健康…"
for i in $(seq 1 60); do
  H=$(docker inspect -f '{{.State.Health.Status}}' "$CTR" 2>/dev/null || echo na)
  [ "$H" = "healthy" ] && break
  [ "$i" = 60 ] && { echo "ERROR: Dify API 未就绪" >&2; exit 1; }
  sleep 2
done
say "Dify API healthy"

# 2) 导入全部工作流 + 发布 + 签发 Key（幂等，按名复用）
say "导入全部工作流 DSL…"
docker cp "$ROOT/dify"  "$CTR:/tmp/yuejiao-dsl"  > /dev/null
docker cp "$ROOT/dify/tools/import_all_workflows.py" "$CTR:/tmp/import_all.py" > /dev/null
docker exec -i "$CTR" python /tmp/import_all.py | tail -n 1 | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('  工作流:', ', '.join(f'{k}({\"新\" if v.get(\"created\") else \"复用\"})' for k, v in d.items()))"

# 3) 知识库初始化 + 绑定（幂等：按知识库名/文档名复用）
say "初始化知识库并绑定工作流…"
docker exec "$CTR" mkdir -p /tmp/yuejiao-kb
docker cp "$ROOT/dify/knowledge/." "$CTR:/tmp/yuejiao-kb/" > /dev/null
docker cp "$ROOT/dify/tools/knowledge_setup.py" "$CTR:/tmp/knowledge_setup.py" > /dev/null
docker exec -i "$CTR" python /tmp/knowledge_setup.py > /dev/null
docker exec "$CTR" cat /tmp/kb_result.json 2>/dev/null | tail -n 1 | python3 -c "
import sys, json
d = json.load(sys.stdin)
for name, v in d['datasets'].items(): print(f\"  知识库: {name}({'新建' if v['created'] else '复用'}) id={v['id'][:8]}\")
for b in d['bound']: print(f\"  绑定: {b['workflow']} ← {b['dataset']} (重写 {b['patched_nodes']} 个节点)\")
for s in d['skipped']: print(f'  跳过: {s}')"

# 4) 后端：.env 缺失时从仓库根复制；未监听则启动
if [ ! -f "$ROOT/yuejiao-admin/.env" ] && [ -f "$ROOT/.env" ]; then cp "$ROOT/.env" "$ROOT/yuejiao-admin/.env"; fi
if ! curl -s -m 3 http://127.0.0.1:8002/health > /dev/null 2>&1; then
  say "启动后端 :8002"
  (cd "$ROOT/yuejiao-admin" && setsid nohup .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8002 > /tmp/uvicorn.log 2>&1 < /dev/null &)
  for i in $(seq 1 20); do sleep 1; curl -s -m 3 http://127.0.0.1:8002/health > /dev/null 2>&1 && break; done
fi
curl -s -m 3 http://127.0.0.1:8002/health > /dev/null && say "后端 OK  http://127.0.0.1:8002"

# 5) 前端：未监听则启动
if ! curl -s -m 3 -o /dev/null http://127.0.0.1:5174 2>/dev/null; then
  say "启动前端 :5174"
  (cd "$ROOT/yuejiao-web/react-frontend" && setsid nohup npm run dev > /tmp/vite-dev.log 2>&1 < /dev/null &)
  for i in $(seq 1 20); do sleep 1; curl -s -m 3 -o /dev/null http://127.0.0.1:5174 2>/dev/null && break; done
fi
curl -s -m 3 -o /dev/null http://127.0.0.1:5174 && say "前端 OK  http://127.0.0.1:5174"

say "全部就绪 ✓"
