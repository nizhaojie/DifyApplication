from pydantic import BaseModel, Field

USERNAME_PATTERN = r"^[A-Za-z0-9_.-]+$"


class RoleCreate(BaseModel):
    role_code: str = Field(min_length=2, max_length=32, pattern=r"^[A-Za-z][A-Za-z0-9_]*$")
    role_name: str = Field(min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=255)


class RoleUpdate(BaseModel):
    role_name: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=255)
    status: int | None = Field(default=None, ge=0, le=1)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=USERNAME_PATTERN)
    password: str = Field(min_length=6, max_length=64)
    real_name: str = Field(min_length=1, max_length=64)
    role_id: int
    department: str | None = Field(default=None, max_length=128)
    contact_info: str | None = Field(default=None, max_length=128)


class UserUpdate(BaseModel):
    real_name: str | None = Field(default=None, min_length=1, max_length=64)
    role_id: int | None = None
    department: str | None = Field(default=None, max_length=128)
    contact_info: str | None = Field(default=None, max_length=128)
    status: str | None = Field(default=None, pattern="^(normal|disabled)$")


class UserResetPassword(BaseModel):
    new_password: str = Field(min_length=6, max_length=64)
