from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.api.v1.search_vector import embed_query, vector_search
from app.api.v1.chat_rag import call_chat_model, _looks_no_answer
from app.core.question_normalizer import normalize_question_semantic
from app.models.link import Link
from app.models.qa_log import QALog
from app.models.document_group import DocumentGroup
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

    persona_prompt = None
    if link.group_id:
        group = db.get(DocumentGroup, link.group_id)
        if group:
            persona_prompt = group.persona_prompt

    # RAG 파이프라인: 링크가 가리키는 단일 문서만 대상으로 검색 (또는 그룹 단위)
    query_vec = await embed_query(payload.question)
    search_result = await vector_search(
        query_vector=query_vec,
        user_id=link.user_id,
        group_id=link.group_id,
        document_id=link.document_id if not link.group_id else None,
        top_k=5,
    )

    status_str = "SUCCESS"
    if len(search_result.hits) == 0:
        status_str = "NO_ANSWER"

    answer = await call_chat_model(payload.question, search_result.hits, persona_prompt)
    if status_str == "SUCCESS" and _looks_no_answer(answer):
        status_str = "NO_ANSWER"

    # 링크 메타데이터 업데이트
    link.access_count += 1
    link.last_accessed_at = datetime.now(timezone.utc)

    # QA 로그 적재 (토큰/latency는 미수집)
    try:
        normalized = await normalize_question_semantic(payload.question)
        qa_log = QALog(
            user_id=link.user_id,
            document_id=link.document_id,
            link_id=link.id,
            question=payload.question,
            answer=answer,
            status=status_str,
            normalized_question=normalized,
        )
        db.add(qa_log)
        db.commit()
    except Exception:
        db.rollback()

    return ChatResponse(answer=answer)
