import secrets
from typing import List
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.core.security import hash_password
from app.models.document import Document
from app.models.document_group import DocumentGroup
from app.models.link import Link
from app.models.user import User
from app.schemas.link import LinkCreate, LinkRead

router = APIRouter(prefix="/links", tags=["links"])


def generate_link_id(length: int = 16) -> str:
    # URL-safe 짧은 ID
    return secrets.token_urlsafe(length)[:length]


@router.post("/", response_model=LinkRead)
def create_link(
    payload: LinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # target validation
    if payload.document_id and payload.group_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose one of document_id or group_id")
    if not payload.document_id and not payload.group_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="document_id or group_id is required")

    doc_id = None
    group_id = None
    if payload.document_id:
        doc = db.get(Document, payload.document_id)
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        doc_id = str(doc.id)
    if payload.group_id:
        group = db.get(DocumentGroup, payload.group_id)
        if not group or group.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
        group_id = str(group.id)

    # 재사용 정책: 동일 document_id/group_id에 활성 링크가 있으면 그걸 반환
    existing = (
        db.query(Link)
        .filter(
            Link.user_id == current_user.id,
            Link.is_active.is_(True),
            Link.document_id == doc_id if doc_id else Link.document_id.is_(None),
            Link.group_id == group_id if group_id else Link.group_id.is_(None),
        )
        .first()
    )
    if existing:
        db.refresh(existing)
        return existing

    link_id = generate_link_id()

    password_hash: str | None = None
    if payload.password:
        password_hash = hash_password(payload.password)
    # TODO: 비밀번호 검증 로직은 공개 챗봇 엔드포인트에서 추가한다.

    link = Link(
        id=link_id,
        user_id=current_user.id,
        document_id=doc_id,
        group_id=group_id,
        title=payload.title,
        expires_at=payload.expires_at or datetime.utcnow() + timedelta(hours=1),
        visibility=payload.visibility or "public",
        password_hash=password_hash,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.get("/", response_model=List[LinkRead])
def list_my_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    links = db.query(Link).filter(Link.user_id == current_user.id).all()
    return links
