from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # PostgreSQL
    database_url: str = Field(
        default="postgresql+psycopg2://codeme:codeme_pw@localhost:5432/codeme_db",
        env="DATABASE_URL",
    )

    # JWT
    secret_key: str = Field(default="CHANGE_ME_SECRET_KEY", env="SECRET_KEY")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Google OAuth
    google_client_id: str = Field(default="", env="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(default="", env="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(
        default="http://localhost:9000/api/v1/auth/google/callback",
        env="GOOGLE_REDIRECT_URI",
    )

    google_auth_base_url: str = "https://accounts.google.com/o/oauth2/v2/auth"
    google_token_url: str = "https://oauth2.googleapis.com/token"
    google_userinfo_url: str = "https://openidconnect.googleapis.com/v1/userinfo"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()