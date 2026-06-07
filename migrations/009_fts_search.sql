-- Migration 009 — Full-text search com tsvector em português
-- Indexes GIN pra busca rápida em livros, notas, flashcards, grifos, anotações.

-- Extensão pra unaccent (busca sem acento)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── Books: nome + autor + gênero ──
ALTER TABLE academic.books
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese',
            unaccent(coalesce(name, '')) || ' ' ||
            unaccent(coalesce(author, '')) || ' ' ||
            unaccent(coalesce(genre, ''))
        )
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_books_search ON academic.books USING GIN (search_vector);

-- ── Notes: title + content_plain + tags ──
ALTER TABLE academic.notes
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese',
            unaccent(coalesce(title, '')) || ' ' ||
            unaccent(coalesce(content_plain, '')) || ' ' ||
            unaccent(coalesce(tags, ''))
        )
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_notes_search ON academic.notes USING GIN (search_vector);

-- ── Flashcards: front + back + tags ──
ALTER TABLE academic.flashcards
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese',
            unaccent(coalesce(front, '')) || ' ' ||
            unaccent(coalesce(back, '')) || ' ' ||
            unaccent(coalesce(tags, ''))
        )
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_flashcards_search ON academic.flashcards USING GIN (search_vector);

-- ── Highlights: selected_text ──
ALTER TABLE academic.book_highlights
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese', unaccent(coalesce(selected_text, '')))
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_highlights_search ON academic.book_highlights USING GIN (search_vector);

-- ── Annotations: note_text ──
ALTER TABLE academic.book_annotations
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese', unaccent(coalesce(note_text, '')))
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_annotations_search ON academic.book_annotations USING GIN (search_vector);

-- ── Subjects: name + sigla ──
ALTER TABLE academic.subjects
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese',
            unaccent(coalesce(name, '')) || ' ' ||
            unaccent(coalesce(sigla, ''))
        )
    ) STORED;
CREATE INDEX IF NOT EXISTS ix_subjects_search ON academic.subjects USING GIN (search_vector);
