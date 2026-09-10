"""Unit tests for FAQ engine loading, file-based FAQ pairs, and matching."""

import pytest
from app.modules.cs.services.rag.faq_engine import FaqEngine, faq_engine


def test_faq_engine_full_load():
    """Verify all 36 standard FAQ pairs are successfully loaded."""
    assert faq_engine.total_count == 36


def test_faq_high_frequency_queries():
    """Verify precision matching on core high-frequency questions."""
    # Query 1: Company abbreviation
    result_company = faq_engine.match("请问你们公司简称叫什么？", confidence_threshold=0.6)
    assert result_company.is_matched is True
    assert "粤教服务" in result_company.answer

    # Query 2: Public payment bank account
    result_payment = faq_engine.match("缴费对公银行账户是多少？", confidence_threshold=0.6)
    assert result_payment.is_matched is True
    assert "9550889900011455492" in result_payment.answer
    assert "广发银行" in result_payment.answer

    # Query 3: German dual system subsidy
    result_german = faq_engine.match("德国双元制培训费用和津贴怎么算？", confidence_threshold=0.6)
    assert result_german.is_matched is True
    assert "企业和国家共同承担" in result_german.answer

    # Query 4: Singapore top-up bachelor & master duration
    result_singapore = faq_engine.match("专升本和本升硕要读几年？", confidence_threshold=0.6)
    assert result_singapore.is_matched is True
    assert "1.5年" in result_singapore.answer or "1 - 1.5年" in result_singapore.answer


def test_faq_engine_loads_and_matches_from_local_file(tmp_path):
    """Verify FAQ pairs written to a local TSV file are loaded and can be matched."""
    faq_file = tmp_path / "faq.txt"
    faq_file.write_text(
        "\n".join(
            [
                "请问你们公司简称什么？\t我们公司简称是粤教服务。",
                "对公缴费银行账户是多少？\t对公账户为广发银行9550889900011455492。",
                "德国双元制培训费用怎么算？\t培训费用由企业和国家共同承担。",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    # Load the FAQ pairs from the temporary file
    file_engine = FaqEngine(str(faq_file))
    assert file_engine.total_count == 3

    # Match query 1: company abbreviation loaded from the file
    result_company = file_engine.match("请问你们公司简称什么？", confidence_threshold=0.6)
    assert result_company.is_matched is True
    assert "粤教服务" in result_company.answer

    # Match query 2: public payment bank account loaded from the file
    result_payment = file_engine.match("对公缴费银行账户是多少？", confidence_threshold=0.6)
    assert result_payment.is_matched is True
    assert "9550889900011455492" in result_payment.answer
