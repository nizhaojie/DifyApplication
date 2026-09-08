"""Unit tests for Knowledge Base chunking, database seeding, and FAQ engine matching."""

import os
import pytest
from app.db.session import SessionLocal
from app.modules.cs.crud.crud import count_knowledge_chunks
from app.modules.cs.services.rag.faq_engine import faq_engine
from app.modules.cs.services.rag.kb_engine import kb_engine


@pytest.fixture(scope="module")
def db_session():
    """Yield database session for test execution."""
    session = SessionLocal()
    yield session
    session.close()


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


def test_knowledge_base_seeding_and_search(db_session):
    """Seed local docx materials into knowledge_base table and execute hybrid search."""
    raw_materials_directory = r"c:\new\group-qukewei\docs\raw_materials"
    if os.path.exists(raw_materials_directory):
        inserted_chunk_count = kb_engine.seed_from_local_materials(
            db=db_session,
            raw_materials_dir=raw_materials_directory,
        )
        total_chunks = count_knowledge_chunks(db_session)
        assert total_chunks > 0

        # Search query 1: German dual system B1 requirement
        search_results_german = kb_engine.search(
            db=db_session,
            query="德国双元制 B1语言要求和带薪实习",
            category_filter="business",
            top_k=2,
        )
        assert len(search_results_german) > 0
        assert "中德" in search_results_german[0].title or "德国" in search_results_german[0].content

        # Search query 2: Singapore visa policy
        search_results_singapore = kb_engine.search(
            db=db_session,
            query="新加坡留学签证政策与工签",
            category_filter="policy",
            top_k=2,
        )
        assert len(search_results_singapore) > 0
        assert search_results_singapore[0].source_file is not None
