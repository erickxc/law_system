-- Migration 005 — Metas múltiplas (daily/weekly/monthly × minutes/cards/questions/pages)
ALTER TABLE core.users
    ADD COLUMN IF NOT EXISTS goals JSONB;
