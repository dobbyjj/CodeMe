-- UUID 생성용 확장
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 문서 상태 enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
    CREATE TYPE document_status AS ENUM ('uploaded', 'processing', 'processed', 'failed');
  END IF;
END$$;

------------------------------------------------------------
-- users
------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(100),
    provider        VARCHAR(50) NOT NULL DEFAULT 'local',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

------------------------------------------------------------
-- document_groups (문서 그룹: 이력서/일상 등)
------------------------------------------------------------
CREATE TABLE document_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_groups_user_id
    ON document_groups(user_id);

------------------------------------------------------------
-- documents
------------------------------------------------------------
CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id            UUID REFERENCES document_groups(id) ON DELETE SET NULL,
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

CREATE INDEX idx_documents_user_id_created_at
    ON documents (user_id, created_at DESC);

CREATE INDEX idx_documents_group_id
    ON documents (group_id);

------------------------------------------------------------
-- links (공유 링크)
------------------------------------------------------------
CREATE TABLE links (
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

CREATE INDEX idx_links_user_id
    ON links (user_id);

------------------------------------------------------------
-- qa_logs (질문/답변 로그)
------------------------------------------------------------
CREATE TABLE qa_logs (
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
    -- RAG 상태: SUCCESS / NO_ANSWER / ERROR
    status              VARCHAR(20) NOT NULL DEFAULT 'SUCCESS'
                        CHECK (status IN ('SUCCESS', 'NO_ANSWER', 'ERROR')),
    -- 유사 질문 묶기를 위한 정규화된 질문 문자열
    normalized_question TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qa_logs_user_id_created_at
    ON qa_logs (user_id, created_at DESC);

CREATE INDEX idx_qa_logs_status
    ON qa_logs (status);

CREATE INDEX idx_qa_logs_normalized_question
    ON qa_logs (normalized_question);

------------------------------------------------------------
-- (선택) qa_keywords: 질문에서 뽑은 키워드들
------------------------------------------------------------
CREATE TABLE qa_keywords (
    qa_log_id UUID REFERENCES qa_logs(id) ON DELETE CASCADE,
    keyword   TEXT NOT NULL,
    PRIMARY KEY (qa_log_id, keyword)
);

CREATE INDEX idx_qa_keywords_keyword
    ON qa_keywords(keyword);
