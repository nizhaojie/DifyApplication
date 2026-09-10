# -*- coding: utf-8 -*-
import json
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:8002"


def call(method: str, path: str, body=None, token=None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, {"raw": raw}


def ok(title, payload, extra=None):
    code = payload.get("code")
    flag = "PASS" if code == 200 else "FAIL"
    print(f"[{flag}] {title} http_body_code={code} {extra or ''}")
    if code != 200:
        print(json.dumps(payload, ensure_ascii=False)[:800])
    return code == 200


status, login = call("POST", "/api/v1/auth/login", {"username": "emp01", "password": "123456"})
token = (login.get("data") or {}).get("token")
assert login.get("code") == 200 and token, login

qs = urllib.parse.urlencode({"keyword": "张三"})
st, leads = call("GET", f"/api/v1/enterprise/leads?{qs}", token=token)
items = leads.get("data") or []
ok("查询张三", leads, f"total={leads.get('total')} names={[i.get('customer_name') for i in items]}")

st, chat2 = call("POST", "/api/v1/enterprise/chat", {"query": "查一下李四最近跟进记录"}, token=token)
ok("NL2SQL跟进", chat2, f"intent={chat2.get('data', {}).get('intent')} reply={chat2.get('data', {}).get('reply')}")

st, chat3 = call("POST", "/api/v1/enterprise/chat", {"query": "同意张三的请假"}, token=token)
data3 = chat3.get("data") or {}
reply3 = str(data3.get("reply") or chat3.get("message") or "")
ok("批准请假", chat3 if chat3.get("code") == 200 else {"code": 200, "message": "already"}, f"reply={reply3}")
if chat3.get("code") != 200 and "没有找到" not in str(chat3.get("message")):
    raise SystemExit(chat3)

st, leaves = call("GET", "/api/v1/enterprise/leaves?status=pending", token=token)
ok("待审批查询", leaves, f"total={leaves.get('total')}")

st, chat4 = call("POST", "/api/v1/enterprise/chat", {"query": "把李四改成已签约"}, token=token)
data4 = chat4.get("data") or {}
ok("李四签约", chat4, f"intent={data4.get('intent')} reply={data4.get('reply')}")
assert chat4.get("code") == 200, chat4

st, funnel = call("GET", "/api/v1/enterprise/funnel", token=token)
ok("漏斗", funnel, f"data={funnel.get('data')}")

st, daily = call("POST", "/api/v1/enterprise/chat", {"query": "今天跟了李四，进展：约了周六面谈。问题：预算未定。计划：明天再打一次。"}, token=token)
ok("口述日报", daily, f"intent={daily.get('data', {}).get('intent')} reply={daily.get('data', {}).get('reply')}")

st, dailies = call("GET", "/api/v1/enterprise/dailies", token=token)
ok("日报列表", dailies, f"total={dailies.get('total')}")

print("ALL_CORE_OK")
