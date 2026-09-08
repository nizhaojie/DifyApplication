from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CrmLead(Base):
    __tablename__ = "crm_lead"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    customer_name: Mapped[str] = mapped_column(String(64))
    contact_info: Mapped[str | None] = mapped_column(String(128))
    gender: Mapped[str] = mapped_column(String(8), default="U")
    age: Mapped[int | None] = mapped_column()
    education_level: Mapped[str | None] = mapped_column(String(64))
    intended_country: Mapped[str | None] = mapped_column(String(128))
    intended_major: Mapped[str | None] = mapped_column(String(128))
    background_info: Mapped[str | None] = mapped_column(Text)
    customer_profile_id: Mapped[int | None] = mapped_column(BigInteger)
    source_channel: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="new")
    owner_employee_id: Mapped[int] = mapped_column(BigInteger)
    last_contact_time: Mapped[object | None] = mapped_column(DateTime)
    lost_reason: Mapped[str | None] = mapped_column(String(255))
    remark: Mapped[str | None] = mapped_column(Text)
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
    update_time: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
