from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.api.v1.search_vector import embed_query, vector_search
from app.api.v1.chat_rag import call_chat_model
from app.models.link import Link
from app.models.qa_log import QALog
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/", response_model=ChatResponse)
async def ask_via_link(
    payload: ChatRequest,
    db: Session = Depends(get_db),
):
    link = db.get(Link, payload.link_id)
    if not link or not link.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found",
        )

    # 만료 여부 확인 (없으면 무시)
    if link.expires_at and link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link expired")

    # TODO: visibility가 "private"인 경우 인증/비밀번호 검증 추가
    # TODO: password_hash 검증 로직 추가 (payload에 password 받는 구조 설계 필요)

    # RAG 파이프라인: 링크가 가리키는 단일 문서만 대상으로 검색
    query_vec = await embed_query(payload.question)
    search_result = await vector_search(
        query_vector=query_vec,
        user_id=link.user_id,
        group_id=link.group_id,
        document_id=link.document_id if not link.group_id else None,
        top_k=5,
    )

    answer = await call_chat_model(payload.question, search_result.hits)

    # 링크 메타데이터 업데이트
    link.access_count += 1
    link.last_accessed_at = datetime.now(timezone.utc)

    # QA 로그 적재 (토큰/latency는 미수집)
    qa_log = QALog(
        user_id=link.user_id,
        document_id=link.document_id,
        link_id=link.id,
        question=payload.question,
        answer=answer,
    )
    db.add(qa_log)
    db.commit()

    return ChatResponse(answer=answer)
