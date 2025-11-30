import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import httpx
from azure.storage.blob import ContainerClient
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel

from app.api.v1.deps import get_current_user, get_db
from app.core.config import settings
from app.models.document import Document, DocumentStatus
from app.models.document_group import DocumentGroup
from app.models.user import User
from app.schemas.document import DocumentIndexCallback, DocumentRead
from app.services.blob_storage import (
    delete_blob,
    download_blob,
    get_blob_container_client,
    upload_blob,
)

router = APIRouter(prefix="/documents", tags=["documents"])
logger = logging.getLogger(__name__)


class DocumentMoveGroup(BaseModel):
    group_id: UUID | None = None


def delete_from_search_index(document: Document) -> None:
    """Best-effort delete of all chunks belonging to the document from Azure AI Search."""
    if not settings.azure_search_endpoint or not settings.azure_search_admin_key or not settings.azure_search_index_name:
        logger.warning("Azure Search config missing, skipping index delete for %s", document.id)
        return

    search_url = (
        f"{settings.azure_search_endpoint}/indexes/{settings.azure_search_index_name}"
        "/docs/search?api-version=2023-11-01"
    )
    headers = {
        "Content-Type": "application/json",
        "api-key": settings.azure_search_admin_key,
    }
    filter_expr = f"document_id eq '{document.id}'"
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(search_url, headers=headers, json={"filter": filter_expr, "select": "id", "top": 1000})
            resp.raise_for_status()
            data = resp.json()
            ids = [doc.get("id") for doc in data.get("value", []) if doc.get("id")]
            if not ids:
                return
            delete_url = (
                f"{settings.azure_search_endpoint}/indexes/{settings.azure_search_index_name}"
                "/docs/index?api-version=2023-11-01"
            )
            payload = {"value": [{"@search.action": "delete", "id": doc_id} for doc_id in ids]}
            resp2 = client.post(delete_url, headers=headers, json=payload)
            resp2.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to delete search documents for %s: %s", document.id, exc)


def update_search_group(document: Document, group_id: Optional[UUID]) -> None:
    """Best-effort update of group_id for all indexed chunks of the document."""
    if not settings.azure_search_endpoint or not settings.azure_search_admin_key or not settings.azure_search_index_name:
        logger.warning("Azure Search config missing, skipping index update for %s", document.id)
        return

    search_url = (
        f"{settings.azure_search_endpoint}/indexes/{settings.azure_search_index_name}"
        "/docs/search?api-version=2023-11-01"
    )
    headers = {
        "Content-Type": "application/json",
        "api-key": settings.azure_search_admin_key,
    }
    filter_expr = f"document_id eq '{document.id}'"
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(search_url, headers=headers, json={"filter": filter_expr, "select": "id", "top": 1000})
            resp.raise_for_status()
            data = resp.json()
            ids = [doc.get("id") for doc in data.get("value", []) if doc.get("id")]
            if not ids:
                return
            update_url = (
                f"{settings.azure_search_endpoint}/indexes/{settings.azure_search_index_name}"
                "/docs/index?api-version=2023-11-01"
            )
            payload = {
                "value": [
                    {
                        "@search.action": "merge",
                        "id": doc_id,
                        "group_id": str(group_id) if group_id else None,
                    }
                    for doc_id in ids
                ]
            }
            resp2 = client.post(update_url, headers=headers, json=payload)
            resp2.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to update search group for %s: %s", document.id, exc)


def delete_document_internal(db: Session, current_user: User, document: Document, container: ContainerClient) -> None:
    """
    Delete a document: blob, search index, DB row. No HTTPExceptions raised here.
    """
    try:
        delete_blob(container, document.blob_path)
    except RuntimeError:
        logger.warning("Failed to delete blob for document %s", document.id)

    delete_from_search_index(document)

    db.delete(document)
    db.commit()


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
    group_id: UUID | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    container: ContainerClient = Depends(get_blob_container_client),
):
    safe_name = Path(file.filename or "upload.bin").name
    doc_id = uuid.uuid4()
    blob_path = f"{current_user.id}/{doc_id}/original/{safe_name}"

    if group_id:
        group = db.get(DocumentGroup, group_id)
        if not group or group.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid group_id")

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
        group_id=group_id,
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

    delete_document_internal(db, current_user, doc, container)
    return None


@router.patch("/{document_id}/group", response_model=DocumentRead)
def move_document_group(
    document_id: UUID,
    payload: DocumentMoveGroup,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc.group_id = payload.group_id
    db.commit()
    db.refresh(doc)

    # 인덱싱된 문서의 group_id도 업데이트 (best-effort)
    update_search_group(doc, payload.group_id)
    return doc


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
        # n8n에서 전체 문서 정보를 사용할 수 있도록 직렬화한 payload 전달
        doc_out = DocumentRead.model_validate(doc)
        payload = doc_out.model_dump(mode="json")
        payload.setdefault("document_id", str(doc.id))

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(settings.n8n_index_webhook_url, json=payload)
                resp.raise_for_status()
        except Exception as exc:
            # n8n 응답/예외를 최대한 남겨서 원인 파악을 돕는다.
            resp_text = None
            if isinstance(exc, httpx.HTTPStatusError):
                resp_text = exc.response.text
            doc.status = DocumentStatus.FAILED
            doc.error_message = f"n8n trigger failed: {exc} {resp_text or ''}".strip()
            db.commit()
            db.refresh(doc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to trigger indexing",
            )
    else:
        doc.status = DocumentStatus.PROCESSED
        doc.last_indexed_at = datetime.utcnow()
        db.commit()
        db.refresh(doc)

    return doc
