# -*- coding: utf-8 -*-
"""Generate enterprise Dify DSL with two knowledge bases + HTTP tools."""
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings

OUT = Path(settings.dify_yml_dir) / "enterprise" / "企业智能助手.yml"
API = "http://host.docker.internal:8001/api/v1/enterprise"


def edge(eid, src, tgt, src_type, tgt_type, handle="source"):
    return f"""      - id: {eid}
        type: custom
        source: {src}
        sourceHandle: {handle}
        target: {tgt}
        targetHandle: target
        zIndex: 0
        data: {{isInIteration: false, isInLoop: false, sourceType: {src_type}, targetType: {tgt_type}}}
"""


def node_box(nid, title, ntype, x, y, extra, h=90):
    return f"""      - id: {nid}
        type: custom
        width: 244
        height: {h}
        position: {{x: {x}, y: {y}}}
        positionAbsolute: {{x: {x}, y: {y}}}
        selected: false
        sourcePosition: right
        targetPosition: left
        data:
          type: {ntype}
          title: {title}
          selected: false
{extra}
"""


def http_post(nid, title, path, x, y, body_key="text"):
    extra = f"""          desc: POST {path}
          method: post
          url: {API}{path}
          authorization: {{type: no-auth, config: null}}
          headers: "Content-Type:application/json\\nX-Employee-Id:{{{{#start.employee_id#}}}}"
          params: ''
          body:
            type: json
            data: "{{\\"{body_key}\\": \\"{{{{#sys.query#}}}}\\"}}"
          ssl_verify: true
          retry_config: {{enabled: true, max_retries: 2, retry_interval: 1000}}
          timeout: {{connect: 10, max_connect_timeout: 10, read: 60, max_read_timeout: 60, write: 30, max_write_timeout: 30}}
          variables: []
"""
    return node_box(nid, title, "http-request", x, y, extra, 118)


def http_get(nid, title, path, x, y):
    extra = f"""          desc: GET {path}
          method: get
          url: {API}{path}
          authorization: {{type: no-auth, config: null}}
          headers: "X-Employee-Id:{{{{#start.employee_id#}}}}"
          params: ''
          body: {{type: none, data: []}}
          ssl_verify: true
          retry_config: {{enabled: true, max_retries: 2, retry_interval: 1000}}
          timeout: {{connect: 10, max_connect_timeout: 10, read: 60, max_read_timeout: 60, write: 30, max_write_timeout: 30}}
          variables: []
"""
    return node_box(nid, title, "http-request", x, y, extra, 118)


def kr(nid, title, desc, x, y):
    extra = f"""          desc: {desc}
          dataset_ids: []
          query_variable_selector: [start, sys.query]
          retrieval_mode: multiple
          metadata_filtering_mode: disabled
          multiple_retrieval_config:
            reranking_enable: false
            reranking_mode: weighted_score
            score_threshold: null
            top_k: 8
            weights:
              keyword_setting: {{keyword_weight: 0.5}}
              vector_setting: {{embedding_model_name: '', embedding_provider_name: '', vector_weight: 0.5}}
              weight_type: customized
"""
    return node_box(nid, title, "knowledge-retrieval", x, y, extra, 92)


def llm(nid, title, sys_prompt, user_prompt, x, y, context=False, ctx_from="kb_docs"):
    ctx = (
        f"          context:\n            enabled: true\n            variable_selector: [{ctx_from}, result]\n"
        if context
        else "          context: {enabled: false, variable_selector: []}\n"
    )
    extra = f"""          model: {{provider: '', name: '', mode: chat, completion_params: {{temperature: 0.2}}}}
          prompt_template:
            - role: system
              text: |-
{sys_prompt}
            - role: user
              text: "{user_prompt}"
{ctx}          vision: {{enabled: false}}
          variables: []
"""
    return node_box(nid, title, "llm", x, y, extra)


def ans(nid, title, src, x, y):
    extra = f"          answer: '{{{{#{src}.text#}}}}'\n          variables: []\n"
    return node_box(nid, title, "answer", x, y, extra, 80)


def indent_prompt(text: str) -> str:
    return "\n".join("                " + line if line else "                " for line in text.splitlines())


http_llm = "你是粤教企业助手。只根据接口 JSON 用中文回复员工。失败就说明原因。不要编造接口没有的字段。"

parts = []
parts.append("""app:
  description: |-
    粤教企业智能助手（员工端）。业务走 FastAPI；知识库必须建两个：
    1) 企业信息+公司新人指南；2) 常见问答对。
    导入后为分类器和全部 LLM 选择已配置模型；两个知识检索节点分别绑定上述两个库。
    HTTP 默认 http://host.docker.internal:8001 （Docker 里不要用 127.0.0.1）。
  icon: 💼
  icon_background: '#FDECEC'
  icon_type: emoji
  mode: advanced-chat
  name: 粤教-企业智能助手
  use_icon_as_answer_icon: false
dependencies: []
kind: app
version: 0.7.0
workflow:
  conversation_variables: []
  environment_variables: []
  features:
    file_upload:
      enabled: false
    opening_statement: 你好，我是粤教企业助手。可以口述录入客户、查跟进、批请假、交日报；问公司简称、入职办公、IT 故障我会查知识库，没有的内容不编。
    retriever_resource:
      enabled: true
    sensitive_word_avoidance:
      enabled: false
    speech_to_text:
      enabled: false
    suggested_questions:
      - 公司简称是什么？
      - 打印机在几楼？坏了找谁？
      - 张三 13800138000 想咨询美国硕士
      - 查一下李四最近跟进记录
      - 同意张三的请假
      - 我今天有什么待办？
    suggested_questions_after_answer:
      enabled: false
    text_to_speech:
      enabled: false
      language: ''
      voice: ''
  graph:
    viewport:
      x: 0
      y: 0
      zoom: 0.45
    edges:
""")

# edges
specs = [
    ("start-clf", "start", "classifier", "start", "question-classifier"),
    ("clf-entry", "classifier", "http_entry", "question-classifier", "http-request", "class_lead_entry"),
    ("clf-query", "classifier", "http_query", "question-classifier", "http-request", "class_lead_query"),
    ("clf-update", "classifier", "http_update", "question-classifier", "http-request", "class_lead_update"),
    ("clf-daily", "classifier", "http_daily", "question-classifier", "http-request", "class_daily"),
    ("clf-nl2sql", "classifier", "http_nl2sql", "question-classifier", "http-request", "class_nl2sql"),
    ("clf-cmd", "classifier", "http_cmd", "question-classifier", "http-request", "class_command"),
    ("clf-brief", "classifier", "http_brief", "question-classifier", "http-request", "class_brief"),
    ("clf-org", "classifier", "http_org", "question-classifier", "http-request", "class_org"),
    ("clf-dailyq", "classifier", "http_dailyq", "question-classifier", "http-request", "class_daily_query"),
    ("clf-ticket", "classifier", "http_ticket", "question-classifier", "http-request", "class_ticket"),
    ("clf-docs", "classifier", "kb_docs", "question-classifier", "knowledge-retrieval", "class_docs"),
    ("clf-faq", "classifier", "kb_faq", "question-classifier", "knowledge-retrieval", "class_faq"),
    ("clf-help", "classifier", "llm_help", "question-classifier", "llm", "class_help"),
]
for item in specs:
    if len(item) == 5:
        parts.append(edge(*item))
    else:
        parts.append(edge(*item[:5], handle=item[5]))

http_llms = [
    ("http_entry", "llm_entry"),
    ("http_query", "llm_query"),
    ("http_update", "llm_update"),
    ("http_daily", "llm_daily"),
    ("http_nl2sql", "llm_nl2sql"),
    ("http_cmd", "llm_cmd"),
    ("http_brief", "llm_brief"),
    ("http_org", "llm_org"),
    ("http_dailyq", "llm_dailyq"),
    ("http_ticket", "llm_ticket"),
]
for src, tgt in http_llms:
    parts.append(edge(f"{src}-{tgt}", src, tgt, "http-request", "llm"))
    parts.append(edge(f"{tgt}-ans", tgt, tgt.replace("llm_", "ans_"), "llm", "answer"))

parts.append(edge("kb_docs-llm", "kb_docs", "llm_docs", "knowledge-retrieval", "llm"))
parts.append(edge("llm_docs-ans", "llm_docs", "ans_docs", "llm", "answer"))
parts.append(edge("kb_faq-llm", "kb_faq", "llm_faq", "knowledge-retrieval", "llm"))
parts.append(edge("llm_faq-ans", "llm_faq", "ans_faq", "llm", "answer"))
parts.append(edge("llm_help-ans", "llm_help", "ans_help", "llm", "answer"))

parts.append("    nodes:\n")

# start + classifier
parts.append(node_box(
    "start",
    "开始",
    "start",
    80,
    720,
    """          desc: 对话流自带 sys.query。employee_id 对应后端员工主键。
          variables:
            - label: employee_id
              variable: employee_id
              type: text-input
              required: false
              max_length: 16
              default: '1'
              options: []
""",
))

parts.append(node_box(
    "classifier",
    "企业助手意图",
    "question-classifier",
    380,
    620,
    """          desc: 只分类，不直接回答。知识问答要拆到两个库。
          query_variable_selector: [start, sys.query]
          instructions: |-
            根据员工原话只分到下面一类。不要回答问题。
            硬性规则：含「简称」「公司叫什么」「粤教叫什么」必须分到「常见问答对」，禁止分到「企业信息与新人指南」。
            录入：新客户、电话、想咨询、帮我记下。
            查询客户：查客户、列表、看看谁。
            更新状态：已签约、已流失、改成某状态。
            交日报：我的日报、今天干了、明天计划（提交）。
            查库：跟进记录、用自然语言查表。
            指令：同意/拒绝请假；把投诉标成已解决。
            待办：今天有什么、待审批。
            组织架构：部门树、谁负责（查接口，不是知识库）。
            查阅日报：管理层看别人日报、按人汇总。
            投诉工单：学生投诉、工单进度、结案。
            企业信息/新人指南：入职、打印机、健身房、IT故障、会议室、工牌、办公系统网址、事业部介绍长文。问简称不要走这里。
            问答对：公司简称、划转哪家、主营有哪些、学费、报名账号、德国B1、新加坡2+2这类标准FAQ。
            其他：闲聊或问你能做什么。
          topics: []
          classes:
            - {id: class_lead_entry, name: 意向客户录入}
            - {id: class_lead_query, name: 查询意向客户}
            - {id: class_lead_update, name: 更新客户状态}
            - {id: class_daily, name: 口述提交日报}
            - {id: class_nl2sql, name: 自然语言查库}
            - {id: class_command, name: 审批或业务指令}
            - {id: class_brief, name: 今日待办}
            - {id: class_org, name: 组织架构查询}
            - {id: class_daily_query, name: 管理查阅日报}
            - {id: class_ticket, name: 投诉工单跟进}
            - {id: class_docs, name: 企业信息与新人指南}
            - {id: class_faq, name: 常见问答对}
            - {id: class_help, name: 其他}
          model: {provider: '', name: '', mode: chat, completion_params: {temperature: 0.1}}
          vision: {enabled: false}
""",
    280,
))

ys = list(range(40, 40 + 10 * 140, 140))
http_defs = [
    ("http_entry", "录入客户", "/tools/lead-from-text", "text"),
    ("http_query", "查询客户", "/tools/lead-query", "text"),
    ("http_update", "更新状态", "/tools/lead-update", "text"),
    ("http_daily", "提交日报", "/tools/daily-from-text", "text"),
    ("http_nl2sql", "NL2SQL", "/tools/nl2sql", "query"),
    ("http_cmd", "执行指令", "/tools/command", "text"),
]
for i, (nid, title, path, key) in enumerate(http_defs):
    parts.append(http_post(nid, title, path, 700, ys[i], key))

parts.append(http_get("http_brief", "今日待办", "/brief", 700, ys[6]))
parts.append(http_get("http_org", "组织架构", "/orgs", 700, ys[7]))
parts.append(http_get("http_dailyq", "查阅日报", "/dailies", 700, ys[8]))
parts.append(http_post("http_ticket", "投诉工单", "/tools/ticket-from-text", 700, ys[9], "text"))

parts.append(kr("kb_docs", "检索企业信息与新人指南", "导入后绑定知识库1：01-企业信息.md + 02-公司新人指南.md", 700, 1480))
parts.append(kr("kb_faq", "检索常见问答对", "导入后绑定知识库2：03-常见问答对.md", 700, 1620))

llm_pairs = [
    ("llm_entry", "复述录入", "http_entry", 40),
    ("llm_query", "复述查询", "http_query", 180),
    ("llm_update", "复述状态", "http_update", 320),
    ("llm_daily", "复述日报", "http_daily", 460),
    ("llm_nl2sql", "复述查库", "http_nl2sql", 600),
    ("llm_cmd", "复述指令", "http_cmd", 740),
    ("llm_brief", "复述待办", "http_brief", 880),
    ("llm_org", "复述组织", "http_org", 1020),
    ("llm_dailyq", "复述日报查阅", "http_dailyq", 1160),
    ("llm_ticket", "复述工单", "http_ticket", 1300),
]
for nid, title, src, y in llm_pairs:
    parts.append(llm(nid, title, indent_prompt(http_llm), "{{#" + src + ".body#}}", 1020, y))
    parts.append(ans(nid.replace("llm_", "ans_"), "回答-" + title[-2:], nid, 1340, y))

docs_sys = indent_prompt(
    "你是粤教企业助手。根据《企业信息》《公司新人指南》回答入职、办公、IT、地址、事业部等问题。\n"
    "《企业信息》写明：广东省教育服务有限公司，简称「粤教服务」。员工问简称/公司叫什么时，"
    "只要 context 出现「简称」或「粤教服务」就直接答，不要说库里没有。\n"
    "<context>\n{{#context#}}\n</context>\n"
    "有依据就具体回答并点出章节。context 完全对不上才说：当前企业信息/新人指南知识库里没有。"
    "不要编造分机号或价格。"
)
faq_sys = indent_prompt(
    "你是粤教企业助手。只根据「常见问答对」知识库回答。优先复述对应的答。\n"
    "<context>\n{{#context#}}\n</context>\n"
    "对不上就说：问答对里没有这条。不要编学费或账号。"
)
help_sys = indent_prompt(
    "你是粤教企业助手。说明你能：录入/查询/改客户、日报、批请假、查组织、查工单；"
    "公司简称和项目 FAQ 走问答对库；入职办公走企业信息+新人指南库。给三个可复制例句。"
)

parts.append(llm("llm_docs", "回答企业信息与新人指南", docs_sys, "{{#sys.query#}}", 1020, 1480, True, "kb_docs"))
parts.append(ans("ans_docs", "回答-制度", "llm_docs", 1340, 1480))
parts.append(llm("llm_faq", "回答问答对", faq_sys, "{{#sys.query#}}", 1020, 1620, True, "kb_faq"))
parts.append(ans("ans_faq", "回答-FAQ", "llm_faq", 1340, 1620))
parts.append(llm("llm_help", "能力说明", help_sys, "{{#sys.query#}}", 700, 1760))
parts.append(ans("ans_help", "回答-说明", "llm_help", 1020, 1760))

OUT.write_text("".join(parts), encoding="utf-8")
print("wrote", OUT, "bytes", OUT.stat().st_size)
