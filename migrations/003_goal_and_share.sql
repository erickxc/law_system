-- Migration 003 — Meta diária e compartilhamento de matérias
-- Idempotente

ALTER TABLE core.users
    ADD COLUMN IF NOT EXISTS daily_goal_minutes INTEGER NOT NULL DEFAULT 30;

ALTER TABLE academic.subjects
    ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_share_token
    ON academic.subjects(share_token)
    WHERE share_token IS NOT NULL;
