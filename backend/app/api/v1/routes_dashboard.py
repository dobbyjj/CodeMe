from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.models.user import User
from app.models.document import Document
from app.models.document_group import DocumentGroup
from app.models.link import Link
from app.models.qa_log import QALog
from app.models.qa_keyword import QAKetword

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owner_id = current_user.id

    owner_logs_subq = (
        db.query(QALog)
        .outerjoin(Document, QALog.document_id == Document.id)
        .outerjoin(Link, QALog.link_id == Link.id)
        .filter(
            (Document.user_id == owner_id) | (Link.user_id == owner_id)
        )
        .subquery()
    )

    keyword_rows = (
        db.query(
            QAKetword.keyword,
            func.count().label("cnt"),
        )
        .join(owner_logs_subq, owner_logs_subq.c.id == QAKetword.qa_log_id)
        .group_by(QAKetword.keyword)
        .order_by(func.count().desc())
        .limit(50)
        .all()
    )
    keywords = [{"keyword": kw, "count": cnt} for kw, cnt in keyword_rows]

    recent_rows = (
        db.query(
            owner_logs_subq.c.id,
            owner_logs_subq.c.question,
            owner_logs_subq.c.created_at,
        )
        .order_by(owner_logs_subq.c.created_at.desc())
        .limit(10)
        .all()
    )
    recent_questions = [
        {
            "id": str(row.id),
            "question": row.question,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in recent_rows
    ]

    doc_rows = (
        db.query(Document)
        .filter(Document.user_id == owner_id)
        .order_by(Document.created_at.desc())
        .limit(5)
        .all()
    )
    recent_documents = [
        {
            "id": str(doc.id),
            "title": doc.title or doc.original_file_name,
            "original_file_name": doc.original_file_name,
            "mime_type": doc.mime_type,
            "status": doc.status.value if hasattr(doc.status, "value") else str(doc.status),
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "group_id": str(doc.group_id) if doc.group_id else None,
        }
        for doc in doc_rows
    ]

    thirty_days_ago = datetime.utcnow().date() - timedelta(days=29)
    chat_day_rows = (
        db.query(
            func.date(owner_logs_subq.c.created_at).label("day"),
            func.count().label("count"),
        )
        .filter(owner_logs_subq.c.created_at >= thirty_days_ago)
        .group_by(func.date(owner_logs_subq.c.created_at))
        .order_by(func.date(owner_logs_subq.c.created_at))
        .all()
    )
    daily_counts = [{"date": row.day.isoformat(), "count": row.count} for row in chat_day_rows]

    fail_rows = (
        db.query(
            owner_logs_subq.c.normalized_question,
            func.count().label("fail_count"),
            func.max(owner_logs_subq.c.created_at).label("last_asked_at"),
            func.min(owner_logs_subq.c.question).label("sample_question"),
        )
        .filter(owner_logs_subq.c.status == "NO_ANSWER")
        .group_by(owner_logs_subq.c.normalized_question)
        .order_by(func.count().desc())
        .limit(20)
        .all()
    )
    failed_questions = [
        {
            "normalized_question": row.normalized_question,
            "sample_question": row.normalized_question or row.sample_question,
            "fail_count": row.fail_count,
            "last_asked_at": row.last_asked_at.isoformat() if row.last_asked_at else None,
        }
        for row in fail_rows
    ]

    return {
        "keywords": keywords,
        "recent_questions": recent_questions,
        "recent_documents": recent_documents,
        "daily_counts": daily_counts,
        "failed_questions": failed_questions,
    }
