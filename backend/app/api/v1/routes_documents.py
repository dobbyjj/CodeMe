import os
import uuid
from pathlib import Path
from typing import List

from azure.storage.blob import ContainerClient
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.core.config import settings
from app.models.document import Document, DocumentStatus
from app.models.user import User
from app.schemas.document import DocumentRead
from app.services.blob_storage import get_blob_container_client, upload_blob

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/", response_model=List[DocumentRead])
def list_my_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return docs


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    container: ContainerClient = Depends(get_blob_container_client),
):
    """
    사용자별 Blob 업로드 + documents 메타데이터 기록
    """
    safe_name = Path(file.filename or "upload.bin").name
    doc_id = uuid.uuid4()
    blob_path = f"{current_user.id}/{doc_id}/original/{safe_name}"

    # 파일 크기 계산
    try:
        file.file.seek(0, os.SEEK_END)
        size_bytes = file.file.tell()
        file.file.seek(0)
    except Exception:
        size_bytes = None

    # 업로드 제한 검사
    if settings.max_upload_size_mb and size_bytes is not None:
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if size_bytes > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large (>{settings.max_upload_size_mb}MB)",
            )

    # Blob 업로드
    try:
        upload_blob(container, blob_path, file.file, content_type=file.content_type)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    document = Document(
        id=doc_id,
        user_id=current_user.id,
        title=title or safe_name,
        original_file_name=safe_name,
        mime_type=file.content_type,
        size_bytes=size_bytes,
        blob_path=blob_path,
        source="upload",
        status=DocumentStatus.UPLOADED,
    )

    db.add(document)
    try:
        db.commit()
    except Exception:
        # DB 실패 시 업로드 롤백 시도
        try:
            container.delete_blob(blob_path, delete_snapshots="include")
        except Exception:
            pass
        db.rollback()
        raise

    db.refresh(document)
    return document
