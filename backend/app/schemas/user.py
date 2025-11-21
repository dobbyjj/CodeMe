from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    id: str
    email: EmailStr
    name: str | None = None
    provider: str
    created_at: datetime

    class Config:
        from_attributes = True
