from __future__ import annotations

from typing import List, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime

from app.api.v1.deps import get_current_user, get_db
from app.api.v1.search_vector import (
    embed_query,
    vector_search,
    VectorSearchResponse,
    SearchHit,
)
from app.core.config import settings
from app.models.qa_log import QALog
from app.models.user import User
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    group_id: Optional[UUID] = None
    top_k: int = 5


class ChatSource(BaseModel):
    id: str
    title: Optional[str] = None
    original_file_name: Optional[str] = None
    chunk_id: Optional[int] = None
    score: float


class ChatResponse(BaseModel):
    question: str
    answer: str
    sources: List[ChatSource]


class ChatLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    id: UUID
    question: str
    answer: str
    created_at: datetime | None = None

    @field_validator("id", mode="before")
    def stringify_uuid(cls, v):
        return str(v)


# Ensure Pydantic builds type adapters before FastAPI uses them
ChatLogRead.model_rebuild()


async def call_chat_model(question: str, hits: List[SearchHit]) -> str:
    """Call Azure OpenAI chat with RAG prompt."""
    context_parts = []
    for i, h in enumerate(hits, start=1):
        title = h.title or h.original_file_name or h.id
        content = h.content or ""
        context_parts.append(f"[doc#{i} | {title}]\n{content}")
    context_text = "\n\n".join(context_parts) if context_parts else "No relevant documents were found for this user."

    system_msg = (
        "You are an AI assistant that answers the user's questions based ONLY on the provided documents. "
        "If the documents do not contain enough information, say you are not sure. "
        "Answer in Korean, be concise but clear."
    )
    user_msg = f"User question:\n{question}\n\nRelevant documents:\n{context_text}"

    if not settings.azure_openai_endpoint or not settings.azure_openai_api_key or not settings.azure_openai_chat_deployment:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Azure OpenAI chat configuration is missing. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_CHAT_DEPLOYMENT.",
        )

    url = (
        f"{settings.azure_openai_endpoint.rstrip('/')}/openai/deployments/"
        f"{settings.azure_openai_chat_deployment}/chat/completions"
        f"?api-version={settings.azure_openai_api_version or '2024-02-15-preview'}"
    )

    headers = {
        "api-key": settings.azure_openai_api_key,
        "Content-Type": "application/json",
    }

    payload = {
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.2,
        "max_tokens": 512,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=headers, json=payload)

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Azure OpenAI chat error: {resp.status_code} {resp.text}",
        )

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Invalid chat response: {e}",
        )


@router.post("/rag", response_model=ChatResponse)
async def chat_with_rag(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """RAG chat: embed query, vector search, call chat model."""
    query_vec = await embed_query(payload.question)

    search_result: VectorSearchResponse = await vector_search(
        query_vector=query_vec,
        user_id=current_user.id,
        group_id=payload.group_id,
        document_id=None,
        top_k=payload.top_k,
    )

    answer = await call_chat_model(payload.question, search_result.hits)

    sources: List[ChatSource] = [
        ChatSource(
            id=h.id,
            title=h.title,
            original_file_name=h.original_file_name,
            chunk_id=h.chunk_id,
            score=h.score,
        )
        for h in search_result.hits
    ]

    # QA 로그 저장 (best-effort)
    try:
        qa_log = QALog(
            user_id=current_user.id,
            document_id=None,
            link_id=None,
            question=payload.question,
            answer=answer,
        )
        db.add(qa_log)
        db.commit()
    except Exception:
        db.rollback()

    return ChatResponse(question=payload.question, answer=answer, sources=sources)


@router.get("/logs", response_model=List[ChatLogRead])
def list_chat_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = (
        db.query(QALog)
        .filter(QALog.user_id == current_user.id)
        .order_by(QALog.created_at.asc())
        .all()
    )
    return logs


@router.delete("/logs", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(QALog).filter(QALog.user_id == current_user.id).delete()
    db.commit()
