from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    """开放注册仅面向学生端；员工/管理员账号由管理员在系统管理中创建。"""

    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=64)
    real_name: str = Field(min_length=1, max_length=64)
    contact_info: str | None = Field(default=None, max_length=128)


class UpdateMeIn(BaseModel):
    real_name: str | None = Field(default=None, min_length=1, max_length=64)
    department: str | None = Field(default=None, max_length=128)
    contact_info: str | None = Field(default=None, max_length=128)
    avatar_url: str | None = Field(default=None, max_length=512)


class ChangePasswordIn(BaseModel):
    old_password: str = Field(min_length=1, max_length=64)
    new_password: str = Field(min_length=6, max_length=64)
