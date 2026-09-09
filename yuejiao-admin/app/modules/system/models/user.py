from sqlalchemy import BigInteger, DateTime, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysRole(Base):
    __tablename__ = "sys_role"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    role_code: Mapped[str] = mapped_column(String(32), unique=True)
    role_name: Mapped[str] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[int] = mapped_column(default=1, server_default=text("1"))
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
    update_time: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class SysUser(Base):
    __tablename__ = "sys_user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    real_name: Mapped[str] = mapped_column(String(64))
    user_type: Mapped[str] = mapped_column(String(32))
    role_id: Mapped[int | None] = mapped_column(BigInteger)
    department: Mapped[str | None] = mapped_column(String(128))
    contact_info: Mapped[str | None] = mapped_column(String(128))
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(32), default="normal", server_default=text("'normal'"))
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
    update_time: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
