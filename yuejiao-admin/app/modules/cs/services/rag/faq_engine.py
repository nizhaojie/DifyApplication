"""FAQ fast matching engine with string similarity and keyword scoring."""

import logging
import os
import re
from typing import List, Optional, Set

from pydantic import BaseModel

from app.core.config import get_app_settings
from app.modules.cs.schemas.schemas import FaqMatchResult

logger = logging.getLogger(__name__)


class FaqItem(BaseModel):
    """Single question-answer pair from static FAQ repository."""

    question: str
    answer: str
    category: str = "faq"


class FaqEngine:
    """In-memory high-speed FAQ matcher with sub-millisecond response."""

    def __init__(self, faq_file_path: Optional[str] = None):
        self._faq_items: List[FaqItem] = []
        if faq_file_path and os.path.exists(faq_file_path):
            self.load_faqs_from_file(faq_file_path)
        elif faq_file_path:
            logger.warning(
                "FAQ 素材文件不存在：%s（KB_RAW_MATERIALS_DIR 未配置或路径错误），"
                "FAQ 引擎已加载 0 条，/cs/faq/match 与 /cs/faqs 将返回空目录。",
                faq_file_path,
            )

    @property
    def total_count(self) -> int:
        """Total loaded FAQ pairs."""
        return len(self._faq_items)

    def load_faqs_from_file(self, file_path: str) -> int:
        """Parse 36 FAQ items from tab-delimited text file."""
        self._faq_items.clear()
        with open(file_path, "r", encoding="utf-8") as file_handle:
            for line in file_handle:
                line_cleaned = line.strip()
                if not line_cleaned or "\t" not in line_cleaned:
                    continue
                parts = line_cleaned.split("\t", 1)
                question_text = parts[0].strip()
                answer_text = parts[1].strip()
                self._faq_items.append(
                    FaqItem(question=question_text, answer=answer_text)
                )
        return len(self._faq_items)

    def load_faq_items(self, faq_list: List[FaqItem]) -> None:
        """Directly set FAQ items."""
        self._faq_items = faq_list

    @staticmethod
    def _normalize_text(input_text: str) -> str:
        """Lowercase, remove punctuation and spaces for robust matching."""
        return re.sub(r"[\s\W_]+", "", input_text.lower())

    @staticmethod
    def _extract_bigrams(text_value: str) -> Set[str]:
        if len(text_value) <= 1:
            return {text_value} if text_value else set()
        return {text_value[i : i + 2] for i in range(len(text_value) - 1)}

    @classmethod
    def _calculate_similarity(
        cls, query_string: str, candidate_question: str
    ) -> float:
        """Compute character-level bi-gram, recall, and semantic overlap similarity."""
        normalized_query = cls._normalize_text(query_string)
        normalized_candidate = cls._normalize_text(candidate_question)

        if not normalized_query or not normalized_candidate:
            return 0.0

        # Exact match
        if normalized_query == normalized_candidate:
            return 1.0

        # Substring containment
        if normalized_candidate in normalized_query:
            length_ratio = len(normalized_candidate) / len(normalized_query)
            return max(0.85, 0.75 + 0.25 * length_ratio)

        if normalized_query in normalized_candidate:
            length_ratio = len(normalized_query) / len(normalized_candidate)
            return max(0.75, 0.65 + 0.35 * length_ratio)

        # Character set overlap
        query_chars = set(normalized_query)
        candidate_chars = set(normalized_candidate)

        common_chars = query_chars.intersection(candidate_chars)
        if not common_chars:
            return 0.0

        char_recall = len(common_chars) / len(candidate_chars)
        char_precision = len(common_chars) / len(query_chars)
        char_f1 = (
            (2 * char_precision * char_recall) / (char_precision + char_recall)
            if (char_precision + char_recall) > 0
            else 0.0
        )

        # Bigram overlap
        query_bigrams = cls._extract_bigrams(normalized_query)
        candidate_bigrams = cls._extract_bigrams(normalized_candidate)

        common_bigrams = query_bigrams.intersection(candidate_bigrams)
        bigram_recall = (
            len(common_bigrams) / len(candidate_bigrams) if candidate_bigrams else 0.0
        )

        if char_recall >= 0.85 and bigram_recall >= 0.35:
            return max(0.80, 0.70 + 0.30 * bigram_recall)

        combined_score = 0.4 * char_f1 + 0.6 * bigram_recall
        return round(combined_score, 4)

    @classmethod
    def _calculate_answer_boost(
        cls, query_string: str, candidate_answer: str, question_score: float
    ) -> float:
        """Boost score ONLY when query mentions specific entities like bank accounts."""
        normalized_query = cls._normalize_text(query_string)
        normalized_answer = cls._normalize_text(candidate_answer)

        specific_faq_signals = ["对公", "银行", "账户", "账号", "开户行", "退费"]
        has_signal = any(sig in normalized_query for sig in specific_faq_signals)

        if not has_signal and question_score < 0.3:
            return 0.0

        query_bigrams = cls._extract_bigrams(normalized_query)
        matched_bigrams = [
            bg for bg in query_bigrams if bg in normalized_answer
        ]

        if has_signal and len(matched_bigrams) >= 2:
            return 0.80
        elif question_score >= 0.3 and len(matched_bigrams) >= 3:
            return 0.65
        return 0.0

    def match(
        self, user_question: str, confidence_threshold: float = 0.55
    ) -> FaqMatchResult:
        """Match user query against FAQ repository using dual question-answer scoring."""
        if not self._faq_items:
            return FaqMatchResult(
                is_matched=False,
                confidence_score=0.0,
            )

        best_faq: Optional[FaqItem] = None
        highest_score = 0.0

        for candidate in self._faq_items:
            q_score = self._calculate_similarity(user_question, candidate.question)
            a_boost = self._calculate_answer_boost(
                user_question, candidate.answer, q_score
            )
            final_score = max(q_score, a_boost)

            if final_score > highest_score:
                highest_score = final_score
                best_faq = candidate

        if highest_score >= confidence_threshold and best_faq:
            return FaqMatchResult(
                is_matched=True,
                standard_question=best_faq.question,
                answer=best_faq.answer,
                confidence_score=round(highest_score, 4),
            )

        return FaqMatchResult(
            is_matched=False,
            standard_question=best_faq.question if best_faq else None,
            answer=None,
            confidence_score=round(highest_score, 4),
        )

    def list_all_faqs(self) -> List[FaqItem]:
        """Return all in-memory FAQ pairs."""
        return list(self._faq_items)


def _default_faq_path() -> Optional[str]:
    """FAQ 素材路径由 KB_RAW_MATERIALS_DIR 配置（<dir>/公司信息/问答对文本版.txt）。"""
    configured = get_app_settings().kb_raw_materials_dir
    if not configured:
        return None
    return os.path.join(configured, "公司信息", "问答对文本版.txt")


# Default singleton instance
faq_engine = FaqEngine(_default_faq_path())
