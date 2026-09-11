#!/usr/bin/env bash
# Dify 控制台自动化：登录 → 上传安装 ollama 插件 → 配置模型凭据
set -euo pipefail
BASE=http://localhost/console/api
# 控制台账号从环境变量注入，不要把真实凭据写进仓库
EMAIL=${EMAIL:-}
PASSWORD=${PASSWORD:-}

# 新版控制台登录要求 RSA(PKCS1) 加密后的密码
curl -s -m 10 "$BASE/rsa-public-key" | python3 -c 'import sys,json;open("/tmp/dify_pub.pem","w").write(json.load(sys.stdin)["public_key"])'
ENC=$(printf '%s' "$PASSWORD" | openssl pkeyutl -encrypt -pubin -inkey /tmp/dify_pub.pem -pkeyopt rsa_padding_mode:pkcs1 | base64 -w0)
LOGIN_RESP=$(curl -s -m 10 -X POST "$BASE/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$ENC\",\"remember_me\":true}")
echo "login: $(echo "$LOGIN_RESP" | head -c 120)"
TOKEN=$(echo "$LOGIN_RESP" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["access_token"] if "data" in d else d.get("access_token",""))')
echo "token_len=${#TOKEN}"
AUTH="Authorization: Bearer $TOKEN"

if [ -f /tmp/ollama.difypkg ]; then
  UP=$(curl -s -m 60 -X POST "$BASE/workspaces/current/plugin/upload/file" -H "$AUTH" -F "file=@/tmp/ollama.difypkg")
  echo "upload: $(echo "$UP" | head -c 300)"
  IID=$(echo "$UP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("install_id",""))' 2>/dev/null || true)
  UID2=$(echo "$UP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("plugin_unique_identifier",""))' 2>/dev/null || true)
  echo "install_id=$IID uid=$UID2"
  if [ -n "$IID" ]; then
    curl -s -m 15 -X POST "$BASE/workspaces/current/plugin/upload/confirm" -H "$AUTH" \
      -H "Content-Type: application/json" -d "{\"install_id\":\"$IID\",\"plugin_unique_identifier\":\"$UID2\"}" | head -c 200; echo
    sleep 12
  fi
fi

echo "=== installed plugins ==="
curl -s -m 15 "$BASE/workspaces/current/plugin/list?page=1&page_size=50" -H "$AUTH" \
  | python3 -c 'import sys,json
d=json.load(sys.stdin)["plugins"]
for p in d: print(p["plugin_id"], p.get("version"))'

echo "=== configure ollama credentials ==="
curl -s -m 15 -X POST "$BASE/workspaces/current/model-providers/langgenius/ollama/ollama" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"credentials":{"base_url":"http://172.17.0.1:11434","mode":"chat"}}' | head -c 300; echo

echo "=== verify provider ==="
curl -s -m 15 "$BASE/workspaces/current/model-providers/langgenius/ollama/ollama" -H "$AUTH" | head -c 400; echo
