from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, ConfigDict
from app.models.document import DocumentStatus


class DocumentRead(BaseModel):
    # ORM 객체(Document)를 그대로 넣어도 필드 매핑되도록
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    original_file_name: str
    mime_type: str | None = None
    size_bytes: int | None = None
    blob_path: str
    source: str
    status: DocumentStatus  # 또는 str 로 바꾸고 싶으면 str
    chunk_count: int
    last_indexed_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime      # 🔹 여기를 str → datetime
    updated_at: datetime      # 🔹 여기도 str → datetime
