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
from datetime import timezone

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
        now_utc = datetime.utcnow().replace(tzinfo=None)
        expires_at = existing.expires_at
        not_expired = expires_at is None or expires_at.replace(tzinfo=None) > now_utc
        if not_expired:
            db.refresh(existing)
            return existing
        # 만료된 기존 링크는 비활성화하고 새로 발급
        existing.is_active = False
        db.add(existing)
        db.commit()

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


@router.get("/{link_id}/info")
def link_info(
    link_id: str,
    db: Session = Depends(get_db),
):
    """
    공개 링크 메타 정보 제공 (인증 없이 사용)
    """
    link = db.get(Link, link_id)
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")

    now = datetime.utcnow().replace(tzinfo=None)
    is_expired = link.expires_at and link.expires_at.replace(tzinfo=None) <= now
    if not link.is_active or is_expired:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link expired")

    owner = db.get(User, link.user_id)
    folder_name = None
    title = None

    if link.group_id:
        group = db.get(DocumentGroup, link.group_id)
        folder_name = group.name if group else None
    if link.document_id:
        doc = db.get(Document, link.document_id)
        if doc:
            title = doc.title or doc.original_file_name

    return {
        "link_id": link.id,
        "user_name": owner.name if owner else "",
        "folder_name": folder_name,
        "title": title,
        "is_active": True,
    }
