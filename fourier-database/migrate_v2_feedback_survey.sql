-- ============================================================
-- MIGRATE v2 — feedback + survey_responses
-- Idempotente: seguro correr varias veces.
--
-- Uso local:
--   psql -d fourier_db -f fourier-database/migrate_v2_feedback_survey.sql
-- ============================================================

-- -------------------------------------------------------
-- ENUMs (ignorar si ya existen)
-- -------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE feedback_category AS ENUM ('bug', 'suggestion', 'question', 'other', 'rating');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE survey_role AS ENUM ('student', 'teacher', 'graduate', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE survey_academic_level AS ENUM ('licenciatura', 'maestria', 'doctorado', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE survey_how_found AS ENUM (
        'search', 'recommendation_peer', 'recommendation_teacher', 'social', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -------------------------------------------------------
-- FEEDBACK
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
    id         TEXT    PRIMARY KEY DEFAULT gen_ulid(),
    user_id    TEXT    REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    category   feedback_category NOT NULL,
    rating     SMALLINT CHECK (rating BETWEEN 1 AND 5),
    message    TEXT,
    email      VARCHAR(320),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user    ON feedback (user_id)   WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_cat     ON feedback (category);

-- -------------------------------------------------------
-- SURVEY RESPONSES
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_responses (
    id                    TEXT PRIMARY KEY DEFAULT gen_ulid(),
    user_id               TEXT REFERENCES users(id) ON DELETE SET NULL,
    ip_address            INET,

    -- Paso 1 — Rol
    role                  survey_role NOT NULL,
    role_other            VARCHAR(100),

    -- Paso 2 — Datos académicos
    academic_level        survey_academic_level NOT NULL,
    academic_level_other  VARCHAR(100),
    institution           VARCHAR(200),
    career                VARCHAR(200),
    country               VARCHAR(100) NOT NULL,

    -- Paso 3 — Experiencia
    how_found             survey_how_found NOT NULL,
    how_found_other       VARCHAR(200),
    purpose               TEXT[] NOT NULL,
    purpose_other         VARCHAR(200),
    features_used         TEXT[] NOT NULL,
    device                TEXT[] NOT NULL,

    -- Paso 4 — Versión anterior
    used_previous         BOOLEAN NOT NULL,
    improvements          TEXT[],
    improvements_other    VARCHAR(200),
    regressions           TEXT,

    -- Paso 5 — Calificaciones
    usefulness_rating     SMALLINT NOT NULL CHECK (usefulness_rating     BETWEEN 1 AND 5),
    ease_of_use_rating    SMALLINT NOT NULL CHECK (ease_of_use_rating    BETWEEN 1 AND 5),
    vs_other_tools_rating SMALLINT NOT NULL CHECK (vs_other_tools_rating BETWEEN 1 AND 5),
    recommend_rating      SMALLINT NOT NULL CHECK (recommend_rating      BETWEEN 1 AND 5),

    -- Paso 6 — Comentarios libres
    bug_description       TEXT,
    general_comments      TEXT,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_user      ON survey_responses (user_id)       WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_created   ON survey_responses (created_at);
CREATE INDEX IF NOT EXISTS idx_survey_role      ON survey_responses (role);
CREATE INDEX IF NOT EXISTS idx_survey_country   ON survey_responses (country);
CREATE INDEX IF NOT EXISTS idx_survey_used_prev ON survey_responses (used_previous);
