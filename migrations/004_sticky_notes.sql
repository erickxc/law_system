-- Migration 004 — Sticky notes (etiquetas posicionadas no PDF)
-- Idempotente

ALTER TABLE academic.book_annotations
    ADD COLUMN IF NOT EXISTS tag    VARCHAR(20),
    ADD COLUMN IF NOT EXISTS x_pct  DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS y_pct  DOUBLE PRECISION;
