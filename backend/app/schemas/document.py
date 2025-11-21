from datetime import datetime
from pydantic import BaseModel

from app.models.document import DocumentStatus


class DocumentRead(BaseModel):
    id: str
    title: str | None = None
    original_file_name: str
    mime_type: str | None = None
    size_bytes: int | None = None
    blob_path: str
    source: str
    status: DocumentStatus
    chunk_count: int | None = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
