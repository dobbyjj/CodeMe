from fastapi import FastAPI

from app.api.v1 import routes_health, routes_auth, routes_documents, routes_links, routes_chat
from app.api.v1 import search_vector  # 파일 위치에 맞게 수정



app = FastAPI(title="CODEME Backend", version="0.1.0")

# v1 라우터 등록
app.include_router(search_vector.router)
app.include_router(routes_health.router, prefix="/api/v1")
app.include_router(routes_auth.router, prefix="/api/v1")
app.include_router(routes_documents.router, prefix="/api/v1")
app.include_router(routes_links.router, prefix="/api/v1")
app.include_router(routes_chat.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "CODEME backend running"}
