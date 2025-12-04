import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
 
from app.core.config import settings
from app.api.v1 import routes_health, routes_auth, routes_documents, routes_links, routes_chat
from app.api.v1 import chat_rag, search_vector
from app.api.v1 import routes_document_groups
from app.api.v1.routes_dashboard import router as dashboard_router
 
app = FastAPI(title="CODEME Backend", version="0.1.0")
 
# CORS 설정
origins = settings.backend_cors_origins or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
# API 라우터 등록
app.include_router(routes_health.router, prefix="/api/v1")
app.include_router(routes_auth.router, prefix="/api/v1")
app.include_router(routes_documents.router, prefix="/api/v1")
app.include_router(routes_document_groups.router, prefix="/api/v1")
app.include_router(routes_links.router, prefix="/api/v1")
app.include_router(routes_chat.router, prefix="/api/v1")
app.include_router(search_vector.router)
app.include_router(chat_rag.router)
app.include_router(dashboard_router, prefix="/api/v1")
 
# ==========================================
# 👇 [핵심] 프론트엔드 통합 설정 (자동 배포용) 👇
# ==========================================
 
# 1. 현재 파일(main.py)의 위치를 기준으로 static 폴더 찾기
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
 
# 2. static 폴더가 존재하면(GitHub Actions가 만들었으면) 연결
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")
 
# 3. API가 아닌 모든 요청은 React(index.html)로 보내기 (SPA 라우팅)
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    # API 요청은 위에서 먼저 처리됨
    # 파일 요청인 경우 (예: robots.txt, favicon.ico)
    file_path = os.path.join(STATIC_DIR, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    # 그 외 모든 경로는 index.html 반환
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Frontend not built. Please wait for GitHub Actions deployment."}