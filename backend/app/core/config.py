from pathlib import Path
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]  # backend/
REPO_ROOT = Path(__file__).resolve().parents[3]  # project root


class Settings(BaseSettings):
    # Basic
    project_name: str = "CodeMe"
    api_v1_str: str = "/api/v1"
    environment: str = "local"

    # CORS
    backend_cors_origins: List[str] = []

    # Database
    database_url: str

    # JWT
    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Google OAuth
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: Optional[str] = None
    google_auth_base_url: str = "https://accounts.google.com/o/oauth2/v2/auth"
    google_token_url: str = "https://oauth2.googleapis.com/token"
    google_userinfo_url: str = "https://openidconnect.googleapis.com/v1/userinfo"

    # Azure Blob Storage
    azure_storage_connection_string: Optional[str] = None
    azure_blob_container: str = "user-docs"
    max_upload_size_mb: int = 20

    # Azure OpenAI
    azure_openai_endpoint: Optional[str] = None
    azure_openai_api_key: Optional[str] = None
    azure_openai_embed_deployment: Optional[str] = None

    # Azure AI Search
    azure_search_endpoint: Optional[str] = None
    azure_search_admin_key: Optional[str] = None
    azure_search_index_name: Optional[str] = None

    # n8n callbacks
    fastapi_callback_url: Optional[str] = None
    n8n_callback_token: Optional[str] = None
    n8n_index_webhook_url: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=[
            str(BASE_DIR / ".env"),  # backend/.env
            str(REPO_ROOT / ".env"),  # repo root .env
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def secret_key(self) -> str:
        # Backward compatibility with code expecting settings.secret_key
        return self.jwt_secret_key


settings = Settings()
