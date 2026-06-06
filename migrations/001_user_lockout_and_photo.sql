-- Aplicar UMA VEZ no Neon (via SQL Editor)
-- Adiciona colunas de lockout e foto de perfil, garante CASCADE nas FKs

-- 1. User: lockout + photo
ALTER TABLE core.users
    ADD COLUMN IF NOT EXISTS photo_url            TEXT,
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until         TIMESTAMPTZ;

-- 2. Garantir CASCADE nas FKs que apontam pra core.users
-- (drop + recreate — necessário porque ALTER CONSTRAINT não muda ON DELETE)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            tc.table_schema, tc.table_name, tc.constraint_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON rc.unique_constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = 'core'
          AND ccu.table_name = 'users'
          AND rc.delete_rule != 'CASCADE'
          AND tc.table_name IN (
              'subjects', 'study_sessions', 'books', 'book_annotations',
              'book_highlights', 'flashcards', 'flashcard_reviews', 'payments'
          )
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT %I',
            r.table_schema, r.table_name, r.constraint_name
        );
        EXECUTE format(
            'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES core.users(id) ON DELETE CASCADE',
            r.table_schema, r.table_name, r.constraint_name, r.column_name
        );
    END LOOP;
END $$;
