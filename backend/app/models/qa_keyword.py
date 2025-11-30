from sqlalchemy import Column, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.core.db import Base


class QAKetword(Base):  # keeping name to match instruction spelling
    __tablename__ = "qa_keywords"

    qa_log_id = Column(UUID(as_uuid=True), ForeignKey("qa_logs.id", ondelete="CASCADE"), primary_key=True)
    keyword = Column(Text, primary_key=True)
