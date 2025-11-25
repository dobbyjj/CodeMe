from enum import Enum as PyEnum
import uuid

from sqlalchemy import (
    Column,
    String,
    DateTime,
    BigInteger,
    Text,
    Enum as SAEnum,
    Integer,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.db import Base


class DocumentStatus(str, PyEnum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class Document(Base):
    __tablename__ = "documents"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(255), nullable=True)
    original_file_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=True)
    size_bytes = Column(BigInteger, nullable=True)
    blob_path = Column(Text, nullable=False)
    source = Column(String(50), nullable=False, default="upload")

    status = Column(
        SAEnum(
            DocumentStatus,
            name="document_status",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=DocumentStatus.UPLOADED,
    )

    chunk_count = Column(Integer, nullable=True, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_indexed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
