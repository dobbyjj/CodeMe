import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List

import httpx
from azure.storage.blob import ContainerClient
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.core.config import settings
from app.models.document import Document, DocumentStatus
from app.models.user import User
from app.schemas.document import DocumentIndexCallback, DocumentRead
from app.services.blob_storage import (
    delete_blob,
    download_blob,
    get_blob_container_client,
    upload_blob,
)

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
    safe_name = Path(file.filename or "upload.bin").name
    doc_id = uuid.uuid4()
    blob_path = f"{current_user.id}/{doc_id}/original/{safe_name}"

    try:
        file.file.seek(0, os.SEEK_END)
        size_bytes = file.file.tell()
        file.file.seek(0)
    except Exception:
        size_bytes = None

    if settings.max_upload_size_mb and size_bytes is not None:
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if size_bytes > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large (>{settings.max_upload_size_mb}MB)",
            )

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
        try:
            container.delete_blob(blob_path, delete_snapshots="include")
        except Exception:
            pass
        db.rollback()
        raise

    db.refresh(document)
    return document


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    container: ContainerClient = Depends(get_blob_container_client),
):
    doc = db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        chunks = download_blob(container, doc.blob_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    content_type = doc.mime_type or "application/octet-stream"
    headers = {"Content-Disposition": f'attachment; filename="{doc.original_file_name}"'}
    return StreamingResponse(chunks, media_type=content_type, headers=headers)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    container: ContainerClient = Depends(get_blob_container_client),
):
    doc = db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        delete_blob(container, doc.blob_path)
    except RuntimeError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to delete blob")

    db.delete(doc)
    db.commit()
    return None


@router.post("/callback/index", response_model=DocumentRead)
def indexing_callback(
    payload: DocumentIndexCallback,
    db: Session = Depends(get_db),
    x_n8n_token: str | None = Header(default=None, alias="X-N8N-Token"),
):
    if settings.n8n_callback_token and x_n8n_token != settings.n8n_callback_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid callback token")

    doc = db.get(Document, payload.document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if payload.status not in {DocumentStatus.PROCESSED, DocumentStatus.FAILED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status for callback")

    doc.status = payload.status
    doc.chunk_count = payload.chunk_count or 0
    doc.last_indexed_at = datetime.utcnow()
    doc.error_message = payload.error_message

    db.commit()
    db.refresh(doc)
    return doc


@router.post("/{document_id}/index", response_model=DocumentRead)
async def trigger_index_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if doc.status == DocumentStatus.PROCESSING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Document is already processing")

    doc.status = DocumentStatus.PROCESSING
    doc.last_indexed_at = None
    doc.error_message = None
    if doc.chunk_count is None:
        doc.chunk_count = 0

    db.commit()
    db.refresh(doc)

    if settings.n8n_index_webhook_url:

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(settings.n8n_index_webhook_url, json=payload)
                resp.raise_for_status()
        except Exception as exc:
            doc.status = DocumentStatus.FAILED
            doc.error_message = f"n8n trigger failed: {exc}"
            db.commit()
            db.refresh(doc)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to trigger indexing")
    else:
        doc.status = DocumentStatus.PROCESSED
        doc.last_indexed_at = datetime.utcnow()
        db.commit()
        db.refresh(doc)

    return doc
