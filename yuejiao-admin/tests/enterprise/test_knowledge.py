from app.modules.enterprise.services.knowledge import answer, company_card, is_empty_kb_reply, looks_like_knowledge


def test_short_name_faq():
    hit = answer("公司简称是什么？")
    assert hit is not None
    assert hit["intent"] == "faq"
    assert "粤教服务" in hit["reply"]


def test_transfer_faq():
    hit = answer("2024年3月粤教服务划转至哪家公司？")
    assert hit is not None
    assert "粤教国际" in hit["reply"]


def test_printer_guide():
    hit = answer("打印机在几楼？坏了找谁？")
    assert hit is not None
    assert "3" in hit["reply"] or "8010" in hit["reply"] or "打印" in hit["reply"]


def test_lead_is_not_knowledge():
    assert looks_like_knowledge("张三 13800138000 想咨询美国硕士") is False
    assert answer("张三 13800138000 想咨询美国硕士") is None


def test_dify_empty_reply_detected():
    assert is_empty_kb_reply("当前企业信息/新人指南知识库里没有关于公司简称的内容。")


def test_company_intro():
    hit = answer("公司简介是什么？")
    assert hit is not None
    assert "粤教服务" in hit["reply"]


def test_company_card():
    card = company_card()
    assert card["short_name"] == "粤教服务"
    assert card["phone"].startswith("020")
