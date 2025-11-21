-- UUID 생성용 확장
-- 나중에 FastAPI에서 SQLAlchemy 쓸 때는 .env 파일에 아래와 같이 DATABASE_URL 설정
-- DATABASE_URL=postgresql+psycopg2://codeme:codeme_pw@localhost:5432/codeme_db


CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 문서 상태 enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
    CREATE TYPE document_status AS ENUM ('uploaded', 'processing', 'processed', 'failed');
  END IF;
END$$;

-- users 테이블
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(100),
    provider        VARCHAR(50) NOT NULL DEFAULT 'local',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

-- documents 테이블
CREATE TABLE IF NOT EXISTS documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               VARCHAR(255),
    original_file_name  VARCHAR(255) NOT NULL,
    mime_type           VARCHAR(100),
    size_bytes          BIGINT,
    blob_path           TEXT NOT NULL,
    source              VARCHAR(50) NOT NULL DEFAULT 'upload',
    status              document_status NOT NULL DEFAULT 'uploaded',
    chunk_count         INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_indexed_at     TIMESTAMPTZ,
    error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id_created_at
    ON documents (user_id, created_at DESC);

-- links 테이블
CREATE TABLE IF NOT EXISTS links (
    id               VARCHAR(64) PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    title            VARCHAR(255),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,
    access_count     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_links_user_id ON links (user_id);

-- qa_logs 테이블 (질문/답변 로그)
CREATE TABLE IF NOT EXISTS qa_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id         UUID REFERENCES documents(id) ON DELETE SET NULL,
    link_id             VARCHAR(64) REFERENCES links(id) ON DELETE SET NULL,
    question            TEXT NOT NULL,
    answer              TEXT NOT NULL,
    model               VARCHAR(100),
    prompt_tokens       INTEGER,
    completion_tokens   INTEGER,
    latency_ms          INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_logs_user_id_created_at
    ON qa_logs (user_id, created_at DESC);
