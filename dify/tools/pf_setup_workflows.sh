#!/usr/bin/env bash
# 导入 pf-extract / pf-narrate 两个工作流 + 签发 API Key + 写入项目 .env
#
# 用法：  bash dify/tools/pf_setup_workflows.sh
# 前置：  docker compose up（Dify 全栈在跑），容器名默认 docker-api-1。
# 可逆：  在 Dify 控制台删除对应应用即可；重复运行会复用同名应用、只新增 Key。
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CTR="${DIFY_API_CONTAINER:-docker-api-1}"

for f in "$DIR/../pf_extract_workflow.yml" "$DIR/../pf_narrate_workflow.yml" "$DIR/pf_setup_workflows.py"; do
  [ -f "$f" ] || { echo "missing $f" >&2; exit 1; }
done

echo ">> copying DSL + setup script into $CTR:/tmp/"
docker cp "$DIR/../pf_extract_workflow.yml" "$CTR:/tmp/pf-extract-workflow.yml"
docker cp "$DIR/../pf_narrate_workflow.yml" "$CTR:/tmp/pf-narrate-workflow.yml"
docker cp "$DIR/pf_setup_workflows.py"  "$CTR:/tmp/setup_workflows.py"

echo ">> importing workflows + minting keys (in-container, real AppDslService)"
JSON="$(docker exec -i "$CTR" python /tmp/setup_workflows.py)"
# stdout 掩码（全值只写入 .env，不在终端全文回显）
SETUP_JSON="$JSON" python3 - <<'PY'
import json, os
d = json.loads(os.environ["SETUP_JSON"])
for k, v in d.items():
    key = v["key"]
    print(f'{k}: app_id={v["app_id"]} key={key[:8]}…{key[-4:]} created={v["created"]}')
PY

# 写入项目根 .env（ROOT = 脚本目录上两级 = 仓库根）
ENV_FILE="$DIR/../../.env"
SETUP_JSON="$JSON" python3 - "$ENV_FILE" <<'PY'
import json, os, sys, pathlib
env_path = pathlib.Path(sys.argv[1])
data = json.loads(os.environ["SETUP_JSON"])
lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
def setkv(k, v):
    for i, l in enumerate(lines):
        if l.startswith(k + "="):
            lines[i] = f"{k}={v}"; return
    lines.append(f"{k}={v}")
setkv("DIFY_API_BASE", "http://localhost/v1")
setkv("DIFY_EXTRACT_API_KEY", data["extract"]["key"])
setkv("DIFY_NARRATE_API_KEY", data["narrate"]["key"])
env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f">> wrote {env_path}")
PY
