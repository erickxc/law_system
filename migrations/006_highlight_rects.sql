-- Migration 006 — Highlights com coordenadas (rects) pra desenhar overlay sobre o texto
ALTER TABLE academic.book_highlights
    ADD COLUMN IF NOT EXISTS rects JSONB;
