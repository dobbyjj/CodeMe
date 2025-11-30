from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator


class LinkCreate(BaseModel):
    document_id: str | None = None
    group_id: str | None = None
    title: str | None = None
    expires_at: datetime | None = None
    visibility: Literal["public", "private"] | None = "public"
    password: Optional[str] = None  # password_hash는 서버에서 해시 저장

    @model_validator(mode="after")
    def validate_target(self):
        if not self.document_id and not self.group_id:
            raise ValueError("Either document_id or group_id is required")
        if self.document_id and self.group_id:
            raise ValueError("Provide only one of document_id or group_id")
        return self


class LinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str | UUID | None = None
    group_id: str | UUID | None = None
    title: str | None = None
    is_active: bool
    expires_at: datetime | None = None
    created_at: datetime
    access_count: int
    visibility: Literal["public", "private"]
