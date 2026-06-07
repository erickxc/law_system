-- Migration 007 — Event sourcing simplificado: registra cada interação do aluno
-- com conteúdo (leitura, grifo, anotação, flashcard, revisão, sessão).
-- Base pra Timeline + IPA + Radar de Lacunas + Caderno de Erros.

CREATE TABLE IF NOT EXISTS academic.learning_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,

    -- Tipo do evento: leitura, grifo, anotacao, etiqueta, flashcard_criado,
    -- revisao, sessao_iniciada, sessao_concluida, questao_acerto, questao_erro
    event_type    VARCHAR(40) NOT NULL,

    -- A entidade relacionada (book, highlight, annotation, flashcard, session, subject)
    entity_type   VARCHAR(30),
    entity_id     UUID,

    -- Contexto: matéria envolvida, página do livro, score (acerto/erro), etc
    subject_id    UUID REFERENCES academic.subjects(id) ON DELETE SET NULL,
    page_number   INTEGER,
    score         INTEGER,           -- 0..5 (review confidence) ou null
    meta          JSONB,             -- payload livre (label, color, etc)

    occurred_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_learning_events_user_time
    ON academic.learning_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_learning_events_user_type
    ON academic.learning_events (user_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_learning_events_subject
    ON academic.learning_events (subject_id, occurred_at DESC) WHERE subject_id IS NOT NULL;
