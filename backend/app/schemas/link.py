from datetime import datetime
from pydantic import BaseModel


class LinkCreate(BaseModel):
    document_id: str
    title: str | None = None
    expires_at: datetime | None = None


class LinkRead(BaseModel):
    id: str
    document_id: str
    title: str | None = None
    is_active: bool
    expires_at: datetime | None = None
    created_at: datetime
    access_count: int

    class Config:
        from_attributes = True
