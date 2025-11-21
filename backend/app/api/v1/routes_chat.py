from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.models.link import Link
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/", response_model=ChatResponse)
def ask_via_link(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.get(Link, payload.link_id)
    if not link or not link.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found",
        )

    # TODO: 여기서 userId/documentId 기반으로 AI Search + LLM 호출
    # 지금은 임시 응답
    answer = f"(stub) You asked: {payload.question}"

    return ChatResponse(answer=answer)
