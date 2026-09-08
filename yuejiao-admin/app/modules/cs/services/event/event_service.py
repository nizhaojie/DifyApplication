"""Event lecture retrieval and dialogue registration business logic."""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.modules.cs.crud.crud import (
    bulk_create_events,
    create_event_registration,
    get_event_by_id,
    has_user_registered_for_event,
    list_event_registrations_by_contact,
    list_events,
)
from app.modules.cs.models.models import EventLecture
from app.modules.cs.schemas.schemas import (
    EventLectureItem,
    EventRegisterRequest,
    EventRegisterResponse,
)

# Standard seed lecture events
DEFAULT_EVENTS: List[Dict[str, Any]] = [
    {
        "event_name": "2026中德双元制带薪实训与欧标B1签约宣讲会",
        "event_type": "online",
        "description": "特邀德国IHK/HWK合作企业代表，深度解读免学费留学、每月带薪实训津贴、医院及工业巨头岗位匹配，支持现场答疑。",
        "start_time": datetime.now() + timedelta(days=5, hours=14),
        "end_time": datetime.now() + timedelta(days=5, hours=16),
        "location": "腾讯会议室（会议号：888-666-999）",
        "max_participants": 100,
        "current_participants": 42,
        "status": "upcoming",
    },
    {
        "event_name": "新加坡定向培养国际本硕直通车招生官见面会",
        "event_type": "hybrid",
        "description": "直面新加坡名校招生官！详解初中2+2、高中0.5/1+2本科学制，中留服双认证及带薪实习就业机会，提供一对一背景评估。",
        "start_time": datetime.now() + timedelta(days=10, hours=10),
        "end_time": datetime.now() + timedelta(days=10, hours=12),
        "location": "广州市天河区粤教服务大厦3楼国际学术厅 / 线上同步直播",
        "max_participants": 60,
        "current_participants": 28,
        "status": "upcoming",
    },
    {
        "event_name": "大专生弯道超车：1年制名校专升本/本升硕深度规划讲座",
        "event_type": "online",
        "description": "专为大专/本科在读或毕业生定制。解读超短学制名校申请技巧、中留服认证真实案例、海归留学生免税购车与落户政策。",
        "start_time": datetime.now() + timedelta(days=15, hours=19),
        "end_time": datetime.now() + timedelta(days=15, hours=20, minutes=30),
        "location": "粤教官方线上讲堂（微信视频号直播）",
        "max_participants": 200,
        "current_participants": 115,
        "status": "upcoming",
    },
]


class EventLectureService:
    """Service handling seminar exploration and closed-loop signups."""

    @staticmethod
    def ensure_seed_events(db: Session) -> int:
        """Seed initial seminar events into database if missing."""
        return bulk_create_events(db, DEFAULT_EVENTS)

    def list_active_events(
        self, db: Session, status_filter: Optional[str] = None
    ) -> List[EventLectureItem]:
        """Fetch all upcoming or ongoing seminars."""
        self.ensure_seed_events(db)
        event_models = list_events(db, status_filter=status_filter)

        items: List[EventLectureItem] = []
        for model in event_models:
            is_seat_available = True
            if model.max_participants is not None:
                is_seat_available = model.current_participants < model.max_participants

            items.append(
                EventLectureItem(
                    id=model.id,
                    event_name=model.event_name,
                    event_type=model.event_type,
                    description=model.description,
                    start_time=model.start_time,
                    end_time=model.end_time,
                    location=model.location,
                    max_participants=model.max_participants,
                    current_participants=model.current_participants,
                    has_available_seats=is_seat_available,
                    status=model.status,
                )
            )
        return items

    def register(
        self, db: Session, payload: EventRegisterRequest
    ) -> EventRegisterResponse:
        """Process event registration with seat capacity verification and anti-duplication."""
        event_model = get_event_by_id(db, payload.event_id)
        if not event_model:
            return EventRegisterResponse(
                is_success=False,
                event_name="未知活动",
                message=f"未找到编号为 {payload.event_id} 的活动，请确认活动信息后再提交。",
            )

        # 1. Anti-duplicate verification
        is_already_registered = has_user_registered_for_event(
            db=db,
            event_id=payload.event_id,
            contact_info=payload.contact_info.strip(),
        )
        if is_already_registered:
            return EventRegisterResponse(
                is_success=False,
                event_name=event_model.event_name,
                message=(
                    f"您已经成功报名过【{event_model.event_name}】，请勿重复提交。"
                    "我们已记录您的预约信息，顾问老师将在活动前与您联系确认！"
                ),
            )

        # 2. Seat limit verification
        if (
            event_model.max_participants is not None
            and event_model.current_participants >= event_model.max_participants
        ):
            return EventRegisterResponse(
                is_success=False,
                event_name=event_model.event_name,
                message=(
                    f"非常抱歉，【{event_model.event_name}】报名人数已满额。"
                    "您可以关注其他近期场次，或联系人工顾问排队候补！"
                ),
            )

        # 3. Create registration and update participant counter
        registration_record = create_event_registration(
            db=db,
            event_id=payload.event_id,
            customer_name=payload.customer_name.strip(),
            contact_info=payload.contact_info.strip(),
            remark=payload.remark,
        )

        return EventRegisterResponse(
            is_success=True,
            registration_id=registration_record.id,
            event_name=event_model.event_name,
            message=(
                f"恭喜您，【{event_model.event_name}】报名成功！"
                f"活动将于 {event_model.start_time.strftime('%Y年%m月%d日 %H:%M')} 开始，"
                f"地点/链接：{event_model.location}。请保持手机畅通！"
            ),
        )

    def query_user_registrations(
        self, db: Session, contact_info: str
    ) -> List[Dict[str, Any]]:
        """Query active event registrations for a given contact phone/email."""
        records = list_event_registrations_by_contact(db, contact_info=contact_info)
        results = []
        for reg in records:
            event_obj = get_event_by_id(db, reg.event_id)
            results.append(
                {
                    "registration_id": reg.id,
                    "event_id": reg.event_id,
                    "event_name": event_obj.event_name if event_obj else "未知活动",
                    "start_time": (
                        event_obj.start_time.strftime("%Y年%m月%d日 %H:%M")
                        if event_obj and event_obj.start_time
                        else ""
                    ),
                    "location": event_obj.location if event_obj else "",
                    "customer_name": reg.customer_name,
                    "contact_info": reg.contact_info,
                    "status": reg.status,
                    "register_time": (
                        reg.create_time.strftime("%Y-%m-%d %H:%M:%S")
                        if reg.create_time
                        else ""
                    ),
                }
            )
        return results


event_service = EventLectureService()
