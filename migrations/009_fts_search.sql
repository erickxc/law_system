-- Migration 009 — Full-text search com tsvector em português
-- Sem dependência de extensão extra (unaccent removido — to_tsvector('portuguese') já faz stemming)

-- ── Books ──
ALTER TABLE academic.books
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese',
            coalesce(name, '') || ' ' ||
            coalesce(author, '') || ' ' ||
            coalesce(genre, '')
        )
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_books_search ON academic.books USING GIN (search_vector);

-- ── Notes ──
ALTER TABLE academic.notes
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese',
            coalesce(title, '') || ' ' ||
            coalesce(content_plain, '') || ' ' ||
            coalesce(tags, '')
        )
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_notes_search ON academic.notes USING GIN (search_vector);

-- ── Flashcards ──
ALTER TABLE academic.flashcards
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese',
            coalesce(front, '') || ' ' ||
            coalesce(back, '') || ' ' ||
            coalesce(tags, '')
        )
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_flashcards_search ON academic.flashcards USING GIN (search_vector);

-- ── Highlights ──
ALTER TABLE academic.book_highlights
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese', coalesce(selected_text, ''))
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_highlights_search ON academic.book_highlights USING GIN (search_vector);

-- ── Annotations ──
ALTER TABLE academic.book_annotations
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese', coalesce(note_text, ''))
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_annotations_search ON academic.book_annotations USING GIN (search_vector);

-- ── Subjects ──
ALTER TABLE academic.subjects
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese',
            coalesce(name, '') || ' ' ||
            coalesce(sigla, '')
        )
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_subjects_search ON academic.subjects USING GIN (search_vector);
