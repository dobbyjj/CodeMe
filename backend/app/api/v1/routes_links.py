import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.models.document import Document
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
    doc = db.get(Document, payload.document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    link_id = generate_link_id()
    link = Link(
        id=link_id,
        user_id=current_user.id,
        document_id=doc.id,
        title=payload.title,
        expires_at=payload.expires_at,
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
