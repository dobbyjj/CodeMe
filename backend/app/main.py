from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1 import routes_health, routes_auth, routes_documents, routes_links, routes_chat
from app.api.v1 import chat_rag, search_vector
from app.api.v1 import routes_document_groups
from app.api.v1.routes_dashboard import router as dashboard_router


app = FastAPI(title="CODEME Backend", version="0.1.0")

# CORS 설정 (개발용으로 널널하게 허용)
origins = settings.backend_cors_origins or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# v1 라우터 등록
app.include_router(routes_health.router, prefix="/api/v1")
app.include_router(routes_auth.router, prefix="/api/v1")
app.include_router(routes_documents.router, prefix="/api/v1")
app.include_router(routes_document_groups.router, prefix="/api/v1")
app.include_router(routes_links.router, prefix="/api/v1")
app.include_router(routes_chat.router, prefix="/api/v1")
app.include_router(search_vector.router)
app.include_router(chat_rag.router)
app.include_router(dashboard_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "CODEME backend running"}
