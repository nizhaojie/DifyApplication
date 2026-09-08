"""Knowledge base text chunking, database ingestion, and hybrid retrieval engine."""

import os
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Any, Dict, List, Optional, Set
from sqlalchemy.orm import Session
from app.modules.cs.crud.crud import (
    bulk_create_knowledge_chunks,
    count_knowledge_chunks,
    list_knowledge_chunks,
)
from app.modules.cs.models.models import KnowledgeBase
from app.modules.cs.schemas.schemas import KnowledgeChunkResult


class KnowledgeBaseEngine:
    """RAG document ingestion and hybrid text retrieval engine."""

    @staticmethod
    def extract_text_from_docx(file_path: str) -> str:
        """Extract plain text paragraphs from a .docx file without external dependencies."""
        if not os.path.exists(file_path):
            return ""
        try:
            with zipfile.ZipFile(file_path) as docx_zip:
                xml_content = docx_zip.read("word/document.xml")
                root_element = ET.fromstring(xml_content)
                namespaces = {
                    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                }
                extracted_paragraphs = []
                for paragraph_node in root_element.iterfind(".//w:p", namespaces):
                    text_pieces = [
                        text_node.text
                        for text_node in paragraph_node.iterfind(
                            ".//w:t", namespaces
                        )
                        if text_node.text
                    ]
                    if text_pieces:
                        extracted_paragraphs.append("".join(text_pieces).strip())
                return "\n".join([p for p in extracted_paragraphs if p])
        except Exception:
            return ""

    @staticmethod
    def chunk_document(
        full_text: str,
        source_title: str,
        category: str,
        source_file_name: str,
        chunk_size: int = 400,
        overlap_size: int = 80,
    ) -> List[Dict[str, Any]]:
        """Slice document text into semantic or overlapping chunks."""
        paragraphs = [p.strip() for p in full_text.splitlines() if p.strip()]
        chunks: List[Dict[str, Any]] = []

        current_segment = []
        current_length = 0
        chunk_index = 0

        for paragraph in paragraphs:
            current_segment.append(paragraph)
            current_length += len(paragraph)

            if current_length >= chunk_size:
                combined_content = "\n".join(current_segment)
                chunks.append(
                    {
                        "category": category,
                        "title": f"{source_title} (第{chunk_index + 1}段)",
                        "content": combined_content,
                        "source_file": source_file_name,
                        "chunk_index": chunk_index,
                        "status": 1,
                    }
                )
                chunk_index += 1
                if len(current_segment) > 1:
                    current_segment = [current_segment[-1]]
                    current_length = len(current_segment[0])
                else:
                    current_segment = []
                    current_length = 0

        if current_segment:
            combined_content = "\n".join(current_segment)
            chunks.append(
                {
                    "category": category,
                    "title": f"{source_title} (第{chunk_index + 1}段)",
                    "content": combined_content,
                    "source_file": source_file_name,
                    "chunk_index": chunk_index,
                    "status": 1,
                }
            )

        return chunks

    def seed_from_local_materials(
        self, db: Session, raw_materials_dir: str
    ) -> int:
        """Parse core documents in raw_materials and persist chunks to database."""
        document_registry = [
            {
                "subpath": os.path.join("公司信息", "企业信息.docx"),
                "category": "company_info",
                "title": "粤教服务企业信息与组织架构",
            },
            {
                "subpath": os.path.join("公司业务", "中德精英人才共建计划.docx"),
                "category": "business",
                "title": "中德精英人才共建计划（德国双元制）",
            },
            {
                "subpath": os.path.join("公司业务", "新加坡国际本硕升学计划.docx"),
                "category": "business",
                "title": "新加坡国际本硕升学与定向培养计划",
            },
            {
                "subpath": os.path.join("留学政策", "德国留学政策指南.docx"),
                "category": "policy",
                "title": "德国留学与最新签证工作许可政策指南",
            },
            {
                "subpath": os.path.join("留学政策", "新加坡留学政策指南.docx"),
                "category": "policy",
                "title": "新加坡留学与移民就业政策指南",
            },
        ]

        total_chunks: List[Dict[str, Any]] = []

        for doc_entry in document_registry:
            file_absolute_path = os.path.join(
                raw_materials_dir, doc_entry["subpath"]
            )
            if os.path.exists(file_absolute_path):
                extracted_text = self.extract_text_from_docx(file_absolute_path)
                if extracted_text:
                    document_chunks = self.chunk_document(
                        full_text=extracted_text,
                        source_title=doc_entry["title"],
                        category=doc_entry["category"],
                        source_file_name=os.path.basename(file_absolute_path),
                    )
                    total_chunks.extend(document_chunks)

        if total_chunks:
            return bulk_create_knowledge_chunks(db, total_chunks)
        return 0

    @staticmethod
    def _extract_search_terms(query_string: str) -> List[str]:
        """Extract multi-granularity tokens (words, bi-grams, tri-grams) from query."""
        cleaned_query = re.sub(r"[\s\W_]+", "", query_string)
        terms: List[str] = []

        # Alphanumeric tokens (e.g. B1, IELTS, 2+2)
        alphanumeric_tokens = re.findall(r"[a-zA-Z0-9\+\-\.]+", query_string)
        terms.extend(alphanumeric_tokens)

        # Chinese characters
        chinese_chars = "".join(re.findall(r"[\u4e00-\u9fa5]+", cleaned_query))
        if chinese_chars:
            # Add 2-grams
            if len(chinese_chars) >= 2:
                for i in range(len(chinese_chars) - 1):
                    terms.append(chinese_chars[i : i + 2])
            # Add 3-grams
            if len(chinese_chars) >= 3:
                for i in range(len(chinese_chars) - 2):
                    terms.append(chinese_chars[i : i + 3])
            # Add 4-grams (e.g. 国际本科, 双元制)
            if len(chinese_chars) >= 4:
                for i in range(len(chinese_chars) - 3):
                    terms.append(chinese_chars[i : i + 4])

        return list(dict.fromkeys(terms))  # Deduplicate preserving order

    def _calculate_keyword_score(
        self, search_terms: List[str], chunk_title: str, chunk_content: str
    ) -> float:
        """Compute keyword occurrence relevance score with title weight boost."""
        score = 0.0
        normalized_title = chunk_title.lower()
        normalized_content = chunk_content.lower()

        for term in search_terms:
            term_clean = term.strip().lower()
            if not term_clean or len(term_clean) < 2:
                continue

            # Weight by term length
            length_factor = 1.0 if len(term_clean) == 2 else 1.5

            if term_clean in normalized_title:
                score += 3.0 * length_factor

            occurrences = normalized_content.count(term_clean)
            if occurrences > 0:
                score += min(3.0, 0.4 * occurrences * length_factor)

        return score

    def search(
        self,
        db: Session,
        query: str,
        category_filter: Optional[str] = None,
        top_k: int = 3,
    ) -> List[KnowledgeChunkResult]:
        """Perform hybrid keyword relevance search over database knowledge base chunks."""
        search_terms = self._extract_search_terms(query)
        if not search_terms:
            search_terms = [query.strip()]

        candidates = list_knowledge_chunks(db, category_filter=category_filter)
        if not candidates:
            return []

        scored_results: List[KnowledgeChunkResult] = []

        for candidate in candidates:
            score = self._calculate_keyword_score(
                search_terms=search_terms,
                chunk_title=candidate.title,
                chunk_content=candidate.content,
            )
            if score > 0.0:
                scored_results.append(
                    KnowledgeChunkResult(
                        chunk_id=candidate.id,
                        category=candidate.category,
                        title=candidate.title,
                        content=candidate.content,
                        source_file=candidate.source_file,
                        relevance_score=round(score, 3),
                    )
                )

        scored_results.sort(key=lambda item: item.relevance_score, reverse=True)
        return scored_results[:top_k]


kb_engine = KnowledgeBaseEngine()
