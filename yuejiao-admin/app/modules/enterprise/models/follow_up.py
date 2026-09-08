from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CrmFollowUp(Base):
    __tablename__ = "crm_follow_up"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(BigInteger)
    employee_id: Mapped[int] = mapped_column(BigInteger)
    follow_type: Mapped[str | None] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    next_plan: Mapped[str | None] = mapped_column(String(255))
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
