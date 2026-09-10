# -*- coding: utf-8 -*-
"""Smoke the Dify-backed enterprise chat path. Never prints secrets."""

import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8002"


def call(method: str, path: str, body=None, token=None, timeout=120):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, {"raw": raw[:400]}


def preview(text: str, n: int = 180) -> str:
    compact = " ".join(str(text or "").split())
    return compact[:n]


status, login = call("POST", "/api/v1/auth/login", {"username": "emp01", "password": "123456"})
token = (login.get("data") or {}).get("token")
assert login.get("code") == 200 and token, login

st, health = call("GET", "/health")
print(f"[INFO] health={health}")

st, flag = call("GET", "/api/v1/enterprise/chat-status", token=token)
print(f"[INFO] chat-status={flag.get('data')}")
assert flag.get("code") == 200 and (flag.get("data") or {}).get("dify_enabled") is True, flag

cases = [
    ("知识库-简称", "公司简称是什么？", "kb", "粤教服务"),
    ("工具-待办", "我今天有什么待办？", "local", None),
    ("工具-录入", "王五 13900139000 想咨询英国本科", "dify", None),
]
conversation_id = None
for title, query, expect_source, expect_text in cases:
    st, payload = call(
        "POST",
        "/api/v1/enterprise/chat",
        {"query": query, "conversation_id": conversation_id},
        token=token,
    )
    data = payload.get("data") or {}
    conversation_id = data.get("conversation_id") or conversation_id
    source = data.get("source")
    reply = data.get("reply") or payload.get("message") or ""
    ok_source = source == expect_source
    ok_text = True if expect_text is None else expect_text in str(reply)
    flag_name = "PASS" if payload.get("code") == 200 and ok_source and ok_text else "FAIL"
    print(
        f"[{flag_name}] {title} source={source} fallback={bool(data.get('dify_fallback'))} "
        f"reply={preview(reply)}"
    )
    if data.get("dify_fallback"):
        print("  fallback_reason=", preview(data.get("dify_fallback"), 240))
    if flag_name == "FAIL":
        raise SystemExit(payload)

print("ALL_DIFY_OK")
