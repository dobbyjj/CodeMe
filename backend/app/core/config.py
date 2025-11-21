from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # PostgreSQL 연결 문자열 (.env의 DATABASE_URL로 덮어쓰기 가능)
    database_url: str = Field(
        default="postgresql+psycopg2://codeme:codeme_pw@localhost:5432/codeme_db",
        env="DATABASE_URL",
    )

    # JWT 관련
    secret_key: str = Field(default="CHANGE_ME_SECRET_KEY", env="SECRET_KEY")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
