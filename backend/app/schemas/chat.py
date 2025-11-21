from pydantic import BaseModel


class ChatRequest(BaseModel):
    link_id: str
    question: str


class ChatResponse(BaseModel):
    answer: str
    # 나중에 참조 문서/청크 정보 넣을 예정
