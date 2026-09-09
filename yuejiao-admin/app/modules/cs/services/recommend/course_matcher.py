"""Intelligent course matching and study program recommendation engine."""

from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cs.crud.crud import (
    bulk_create_course_projects,
    list_course_projects,
)
from app.modules.cs.models.models import CourseProject
from app.modules.cs.schemas.schemas import (
    CourseProjectItem,
    CourseRecommendRequest,
    CourseRecommendResponse,
)

# Standard educational seed programs
DEFAULT_COURSE_PROJECTS: List[Dict[str, Any]] = [
    {
        "project_name": "中德精英人才共建计划（德国双元制职业教育）",
        "category": "双元制教育",
        "description": "中德校企深度合作，学生在德国职业学校与企业两处受训。企业与政府共担培训费用，每月向培训生发放薪资津贴，毕业考取德国IHK/HWK职业证书，工作满2年可申请德国永居。",
        "target_audience": "高中、职高、中专或大专毕业生，年龄18-35岁，具有一定学习动手能力",
        "price": 0.00,
        "duration": "2至3.5年（带薪实训）",
        "tags": ["德国", "双元制", "免学费", "带薪实训", "医疗机械电子汽车", "永居绿卡"],
        "status": 1,
    },
    {
        "project_name": "新加坡2+2定向培养国际本科直通班",
        "category": "国际本硕",
        "description": "针对初中起点的国际化升学通道。前2年在国内培养基地学习综合课程，后2年赴新加坡公费带薪实习并直升本科，毕业获世界综合排名前200-500名大学学位，中留服认证。",
        "target_audience": "应往届初中毕业生",
        "price": 300000.00,
        "duration": "4年（国内2年 + 新加坡2年）",
        "tags": ["新加坡", "初中起点", "国际本科", "中留服认证", "可本硕连读"],
        "status": 1,
    },
    {
        "project_name": "新加坡0.5/1+2定向培养国际本科班",
        "category": "国际本硕",
        "description": "高中及中职起点的快速本科学位方案。国内0.5至1年预科，第2年前往新加坡带薪实训（津贴6000-8000/月），第3年直升本科毕业，受中国教育部留学服务中心正式认证。",
        "target_audience": "高二在读、应往届高中毕业生、中专及中职同等学历",
        "price": 250000.00,
        "duration": "2.5至3年（国内0.5/1年 + 新加坡2年）",
        "tags": ["新加坡", "高中起点", "国际本科", "带薪实习", "学制短", "中留服认证"],
        "status": 1,
    },
    {
        "project_name": "新加坡1年制专升本 / 本升硕弯道超车精英计划",
        "category": "学历提升",
        "description": "专为大专生与本科生定制的超短学制名校学历提升项目。专升本只需1-1.5年，本升硕仅需1年，享受海归留学生落户、免税购车及创业补贴等全套海归待遇。",
        "target_audience": "应往届全日制/非全日制大专毕业生、本科毕业生",
        "price": 120000.00,
        "duration": "1至1.5年",
        "tags": ["新加坡", "专升本", "本升硕", "超短学制", "中留服认证", "高性价比"],
        "status": 1,
    },
    {
        "project_name": "新加坡6+6酒店运营与9+6航空运营高薪大专就业班",
        "category": "工学交替就业",
        "description": "无需雅思/托福等语言成绩门槛。6至9个月理论学习后安排6个月带薪实习（薪资6000-8000元/月），实习结束100%推荐就业，起薪达15000元人民币/月以上。",
        "target_audience": "职高、中专、中职、技校全国范围毕业生，年满17周岁",
        "price": 68000.00,
        "duration": "1年（理论学习 + 6个月带薪实习）",
        "tags": ["新加坡", "高薪就业", "无语言门槛", "酒店管理", "航空运营", "100%推荐就业"],
        "status": 1,
    },
]


class CourseRecommendationService:
    """Course recommendation service based on rule scoring and budget filtering."""

    @staticmethod
    async def ensure_seed_courses(db: AsyncSession) -> int:
        """Seed default course projects into database if not present."""
        return await bulk_create_course_projects(db, DEFAULT_COURSE_PROJECTS)

    @staticmethod
    def _matches_education_level(
        target_audience: Optional[str], education_level: Optional[str]
    ) -> bool:
        """Check if user education level matches target audience criteria."""
        if not education_level or not target_audience:
            return True

        normalized_level = education_level.strip().lower()
        audience_text = target_audience.lower()

        level_alias_map = {
            "初中": ["初中"],
            "中专": ["中专", "中职", "职高", "技校"],
            "职高": ["中专", "中职", "职高", "技校"],
            "中职": ["中专", "中职", "职高", "技校"],
            "技校": ["中专", "中职", "职高", "技校"],
            "高中": ["高中", "中专", "高二"],
            "大专": ["大专", "专科"],
            "专科": ["大专", "专科"],
            "本科": ["本科"],
        }

        search_tokens = level_alias_map.get(normalized_level, [normalized_level])
        for token in search_tokens:
            if token in audience_text:
                return True
        return False

    @staticmethod
    def _matches_country(
        tags: Optional[List[str]],
        project_name: str,
        target_country: Optional[str],
    ) -> bool:
        """Check if project country matches user country preference."""
        if not target_country:
            return True

        normalized_country = target_country.strip().lower()
        combined_text = (project_name + " " + " ".join(tags or [])).lower()

        if "德" in normalized_country:
            return "德" in combined_text
        if "新" in normalized_country:
            return "新加坡" in combined_text or "新" in combined_text
        return normalized_country in combined_text

    async def recommend(
        self, db: AsyncSession, criteria: CourseRecommendRequest
    ) -> CourseRecommendResponse:
        """Score, filter, and rank course projects matching customer profile."""
        await self.ensure_seed_courses(db)
        all_courses = await list_course_projects(db, is_active_only=True)

        if not all_courses:
            return CourseRecommendResponse(
                is_matched=False,
                match_count=0,
                recommended_courses=[],
                recommendation_rationale="当前暂无上架课程项目。",
                follow_up_suggestion="请联系专属顾问获取最新定制课程。",
            )

        # Check if user profile is entirely underspecified
        has_any_criteria = any(
            [
                criteria.education_level,
                criteria.target_country,
                criteria.budget_max,
                criteria.interest_keyword,
            ]
        )

        candidate_scores: List[tuple[CourseProject, float, str]] = []

        for course in all_courses:
            score = 0.0
            reason_parts: List[str] = []

            # 1. Country match
            is_country_matched = self._matches_country(
                tags=course.tags,
                project_name=course.project_name,
                target_country=criteria.target_country,
            )
            if criteria.target_country:
                if is_country_matched:
                    score += 4.0
                    reason_parts.append(f"精准符合您意向的国家【{criteria.target_country}】")
                else:
                    continue  # Strict country filter if specified

            # 2. Education level match
            is_education_matched = self._matches_education_level(
                target_audience=course.target_audience,
                education_level=criteria.education_level,
            )
            if criteria.education_level:
                if is_education_matched:
                    score += 5.0
                    reason_parts.append(f"适合您目前的【{criteria.education_level}】学历起点")
                else:
                    # Downgrade score if education does not align
                    score -= 3.0

            # 3. Budget match
            if criteria.budget_max is not None:
                course_price = float(course.price or 0.0)
                if course_price == 0.0:
                    score += 3.5
                    reason_parts.append("项目免收培训学费且享有实训津贴，零经济负担")
                elif course_price <= criteria.budget_max:
                    score += 3.0
                    reason_parts.append(f"学费预算在您的期望范围内（约 {course_price:,.0f} 元）")
                else:
                    # Exceeds budget
                    score -= 4.0

            # 4. Interest keyword match
            if criteria.interest_keyword:
                keyword = criteria.interest_keyword.lower()
                combined_meta = (
                    course.project_name
                    + " "
                    + (course.description or "")
                    + " "
                    + " ".join(course.tags or [])
                ).lower()
                if keyword in combined_meta:
                    score += 3.0
                    reason_parts.append(f"涵盖您感兴趣的【{criteria.interest_keyword}】方向")

            # Default base score if unconstrained
            if not has_any_criteria:
                score += 1.0
                reason_parts.append("粤教服务热门推荐高口碑项目")

            if score > 0.0:
                summary_reason = "；".join(reason_parts) if reason_parts else "匹配推荐项目"
                candidate_scores.append((course, score, summary_reason))

        candidate_scores.sort(key=lambda item: item[1], reverse=True)
        top_candidates = candidate_scores[: criteria.recommend_limit]

        if not top_candidates:
            return CourseRecommendResponse(
                is_matched=False,
                match_count=0,
                recommended_courses=[],
                recommendation_rationale="未找到完全符合所有限制条件的课程，建议适当放宽预算或国家条件。",
                follow_up_suggestion="您可以告诉我您更看重学制短还是预算低，我为您做灵活匹配！",
            )

        recommended_items: List[CourseProjectItem] = [
            CourseProjectItem(
                id=item[0].id,
                project_name=item[0].project_name,
                category=item[0].category,
                description=item[0].description,
                target_audience=item[0].target_audience,
                price=float(item[0].price) if item[0].price is not None else 0.0,
                duration=item[0].duration,
                tags=item[0].tags or [],
                status=item[0].status,
            )
            for item in top_candidates
        ]

        # Synthesize rationale
        rationale_lines = [
            f"{i + 1}. 【{cand[0].project_name}】：{cand[2]}"
            for i, cand in enumerate(top_candidates)
        ]
        full_rationale = "\n".join(rationale_lines)

        follow_up = None
        if not criteria.target_country:
            follow_up = "小贴士：如果您有明确意向国家（如德国免学费实训 或 新加坡本硕双认证），告诉我后推荐会更精准哦！"

        return CourseRecommendResponse(
            is_matched=True,
            match_count=len(recommended_items),
            recommended_courses=recommended_items,
            recommendation_rationale=full_rationale,
            follow_up_suggestion=follow_up,
        )


course_matcher = CourseRecommendationService()
