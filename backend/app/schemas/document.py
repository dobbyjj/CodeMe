from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from app.models.document import DocumentStatus


class DocumentRead(BaseModel):
    # ORM Document model serializer
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    original_file_name: str
    mime_type: str | None = None
    size_bytes: int | None = None
    blob_path: str
    source: str
    status: DocumentStatus
    chunk_count: int
    last_indexed_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class DocumentIndexCallback(BaseModel):
    document_id: UUID = Field(..., description="documents.id (UUID)")
    status: DocumentStatus
    chunk_count: int | None = Field(default=None, description="Number of processed chunks")
    error_message: str | None = Field(default=None, description="Error message when indexing fails")
