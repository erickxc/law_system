-- Migration 002 — Calendar, schedule e difficulty no flashcard
-- Idempotente — pode rodar várias vezes

-- 1. Flashcard: adicionar dificuldade
ALTER TABLE academic.flashcards
    ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) NOT NULL DEFAULT 'medium';

-- 2. Calendar events
CREATE TABLE IF NOT EXISTS academic.calendar_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    event_type   VARCHAR(20) NOT NULL DEFAULT 'outro',
    start_at     TIMESTAMP NOT NULL,
    end_at       TIMESTAMP,
    all_day      BOOLEAN NOT NULL DEFAULT FALSE,
    subject_id   UUID REFERENCES academic.subjects(id) ON DELETE SET NULL,
    color        VARCHAR(20),
    completed    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start
    ON academic.calendar_events(user_id, start_at);

-- 3. Class schedule (quadro de aulas recorrente)
CREATE TABLE IF NOT EXISTS academic.class_schedules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    subject_id    UUID REFERENCES academic.subjects(id) ON DELETE SET NULL,
    subject_name  VARCHAR(255),
    day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time    VARCHAR(5) NOT NULL,
    end_time      VARCHAR(5) NOT NULL,
    location      VARCHAR(255),
    teacher_name  VARCHAR(255),
    color         VARCHAR(20),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_class_schedules_user_day
    ON academic.class_schedules(user_id, day_of_week);
