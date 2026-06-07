-- Migration 010 — Entidade Question (banco de questões) + tentativas
-- Caderno de Erros real (não mais proxy via flashcards).

CREATE TABLE IF NOT EXISTS academic.questions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    subject_id    UUID REFERENCES academic.subjects(id) ON DELETE SET NULL,

    statement     TEXT NOT NULL,                       -- enunciado
    options       JSONB,                               -- [{key:"A", text:"..."}, ...] (null pra V/F ou aberta)
    correct       VARCHAR(20),                         -- "A", "B", ... ou "true"/"false"
    explanation   TEXT,                                -- comentário/gabarito comentado
    kind          VARCHAR(20) DEFAULT 'multiple',      -- multiple | true_false | open
    topic         VARCHAR(255),                        -- tema/assunto (livre)
    banca         VARCHAR(80),                         -- banca examinadora (FGV, CESPE, etc)
    ano           INTEGER,                             -- ano da questão
    source        VARCHAR(255),                        -- prova/concurso/livro
    tags          VARCHAR(500),

    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_questions_user_subject
    ON academic.questions (user_id, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_questions_user_topic
    ON academic.questions (user_id, topic);

CREATE TABLE IF NOT EXISTS academic.question_attempts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id   UUID NOT NULL REFERENCES academic.questions(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    answer        VARCHAR(20),                         -- resposta marcada
    is_correct    BOOLEAN NOT NULL,
    time_seconds  INTEGER,                             -- tempo gasto
    attempted_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_attempts_question
    ON academic.question_attempts (question_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS ix_attempts_user
    ON academic.question_attempts (user_id, attempted_at DESC);

-- FTS para questões
ALTER TABLE academic.questions
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese',
            coalesce(statement, '') || ' ' ||
            coalesce(topic, '') || ' ' ||
            coalesce(tags, '') || ' ' ||
            coalesce(banca, '')
        )
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_questions_search ON academic.questions USING GIN (search_vector);
