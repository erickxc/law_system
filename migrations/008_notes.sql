-- Migration 008 — Editor acadêmico: notas (resumos, fichamentos, manuscritos)
-- kind: 'text' (rich text HTML), 'handwriting' (SVG/PNG), 'hybrid' (texto + canvas embutido)

CREATE TABLE IF NOT EXISTS academic.notes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    subject_id    UUID REFERENCES academic.subjects(id) ON DELETE SET NULL,
    book_id       UUID REFERENCES academic.books(id) ON DELETE SET NULL,

    title         VARCHAR(255) NOT NULL,
    kind          VARCHAR(20) NOT NULL DEFAULT 'text',   -- text | handwriting | hybrid
    content_html  TEXT,                                  -- HTML rico (sanitizado)
    content_plain TEXT,                                  -- versão plain (busca + OCR)
    canvas_svg    TEXT,                                  -- SVG do canvas manuscrito
    canvas_png    TEXT,                                  -- PNG base64 fallback
    tags          VARCHAR(500),                          -- vírgula-separado

    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_notes_user_updated
    ON academic.notes (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_notes_subject
    ON academic.notes (subject_id, updated_at DESC) WHERE subject_id IS NOT NULL;
