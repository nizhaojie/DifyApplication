from sqlalchemy import BigInteger, DateTime, String, SmallInteger, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysOrganization(Base):
    __tablename__ = "sys_organization"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    org_name: Mapped[str] = mapped_column(String(128))
    parent_id: Mapped[int | None] = mapped_column(BigInteger)
    org_level: Mapped[int] = mapped_column(SmallInteger, default=1)
    manager_id: Mapped[int | None] = mapped_column(BigInteger)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[int] = mapped_column(SmallInteger, default=1)
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
    update_time: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
