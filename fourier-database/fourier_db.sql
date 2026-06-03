-- ============================================================
-- FOURIER CALCULATOR - SCHEMA v2
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ULID generator (mismo del ecommerce)
CREATE OR REPLACE FUNCTION gen_ulid() RETURNS TEXT AS $$
DECLARE
    timestamp_ms  BIGINT;
    encoding      TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    result        TEXT := '';
    rand_bytes    BYTEA;
    i             INT;
    val           INT;
BEGIN
    timestamp_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
    FOR i IN REVERSE 9..0 LOOP
        val := timestamp_ms % 32;
        result := substr(encoding, val + 1, 1) || result;
        timestamp_ms := timestamp_ms / 32;
    END LOOP;
    rand_bytes := gen_random_bytes(16);
    FOR i IN 0..15 LOOP
        val := get_byte(rand_bytes, i) % 32;
        result := result || substr(encoding, val + 1, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- -------------------------------------------------------
-- ENUMS
-- -------------------------------------------------------
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_tier AS ENUM ('free', 'premium');

CREATE TYPE auth_provider AS ENUM ('email', 'google');

CREATE TYPE calculation_type AS ENUM (
    'trigonometric',
    'half_range',
    'complex',
    'fourier_transform',
    'inverse_fourier_transform',
    'dft_signal',
    'dft_function',
    'dft_epicycles'
);

CREATE TYPE feedback_category AS ENUM ('bug', 'suggestion', 'question', 'other', 'rating');

CREATE TYPE survey_role AS ENUM ('student', 'teacher', 'graduate', 'other');
CREATE TYPE survey_academic_level AS ENUM ('licenciatura', 'maestria', 'doctorado', 'other');
CREATE TYPE survey_how_found AS ENUM (
    'search', 'recommendation_peer', 'recommendation_teacher', 'social', 'other'
);

CREATE TYPE audit_action AS ENUM (
    'login',
    'logout',
    'register',
    'password_change',
    'google_linked',
    'google_unlinked',
    'account_recovery_initiated',
    'account_recovery_completed',
    'calculation_performed',
    'calculation_failed',
    'transform_performed',
    'transform_failed',
    'user_deactivated',
    'user_activated',
    'tier_changed',
    'audit_log_cleared',
    'rate_limit_blocked'
);

-- -------------------------------------------------------
-- PERSONS
-- -------------------------------------------------------
CREATE TABLE persons (
    id          TEXT PRIMARY KEY DEFAULT gen_ulid(),
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- USERS
-- -------------------------------------------------------
CREATE TABLE users (
    id              TEXT PRIMARY KEY DEFAULT gen_ulid(),
    person_id       TEXT NOT NULL REFERENCES persons(id),
    email           VARCHAR(320) NOT NULL,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash   TEXT,
    role            user_role NOT NULL DEFAULT 'user',
    tier            user_tier NOT NULL DEFAULT 'free',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    deleted_at          TIMESTAMPTZ,
    deleted_email_hash  TEXT,
    CONSTRAINT users_email_unique  UNIQUE (email),
    CONSTRAINT users_person_unique UNIQUE (person_id)
);

CREATE INDEX idx_users_email               ON users (email);
CREATE INDEX idx_users_active              ON users (is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role                ON users (role);
CREATE INDEX idx_users_tier                ON users (tier);
CREATE INDEX idx_users_deleted_email_hash  ON users (deleted_email_hash) WHERE deleted_email_hash IS NOT NULL;

-- -------------------------------------------------------
-- USER AUTH PROVIDERS
-- Permite vincular múltiples métodos de auth a una cuenta
-- -------------------------------------------------------
CREATE TABLE user_auth_providers (
    id           TEXT PRIMARY KEY DEFAULT gen_ulid(),
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider     auth_provider NOT NULL,
    provider_id  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_auth_providers_unique UNIQUE (user_id, provider),
    CONSTRAINT user_auth_providers_google_id UNIQUE (provider, provider_id)
);

CREATE INDEX idx_user_auth_providers_user ON user_auth_providers (user_id);

-- -------------------------------------------------------
-- USER REFRESH TOKENS
-- Mismo patrón que ecommerce: family_id + reuse detection
-- -------------------------------------------------------
CREATE TABLE user_refresh_tokens (
    id           TEXT PRIMARY KEY DEFAULT gen_ulid(),
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL,
    family_id    TEXT NOT NULL,
    ip_address   INET,
    user_agent   TEXT,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at   TIMESTAMPTZ,
    replaced_by  TEXT REFERENCES user_refresh_tokens(id),
    CONSTRAINT user_refresh_tokens_token_unique UNIQUE (token_hash)
);

CREATE INDEX idx_user_refresh_tokens_user   ON user_refresh_tokens (user_id);
CREATE INDEX idx_user_refresh_tokens_family ON user_refresh_tokens (family_id);

-- -------------------------------------------------------
-- USER EMAIL TOKENS
-- purpose: 'email_verification' | 'recovery_email_verification'
-- -------------------------------------------------------
CREATE TABLE user_email_tokens (
    id          TEXT PRIMARY KEY DEFAULT gen_ulid(),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    purpose     VARCHAR(50) NOT NULL DEFAULT 'email_verification',
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_email_tokens_unique UNIQUE (token_hash)
);

-- -------------------------------------------------------
-- USER PASSWORD RESETS
-- -------------------------------------------------------
CREATE TABLE user_password_resets (
    id          TEXT PRIMARY KEY DEFAULT gen_ulid(),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_password_resets_unique UNIQUE (token_hash)
);

-- -------------------------------------------------------
-- USER RECOVERY EMAILS
-- Solo email secundario, sin OTP
-- -------------------------------------------------------
CREATE TABLE user_recovery_emails (
    id           TEXT PRIMARY KEY DEFAULT gen_ulid(),
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email        VARCHAR(320) NOT NULL,
    is_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_recovery_emails_user_unique  UNIQUE (user_id),
    CONSTRAINT user_recovery_emails_email_unique UNIQUE (email)
);

-- -------------------------------------------------------
-- CALCULATIONS  (tabla canónica — una fila por input único)
-- Almacena el input pero no el resultado (recalculable).
-- La deduplicación se hace por input_hash (SHA-256 del input
-- normalizado + tipo de cálculo), evitando guardar el mismo
-- JSON miles de veces cuando múltiples usuarios calculan lo mismo.
-- -------------------------------------------------------
CREATE TABLE calculations (
    id         TEXT PRIMARY KEY DEFAULT gen_ulid(),
    input_hash TEXT NOT NULL UNIQUE,
    type       calculation_type NOT NULL,
    input      JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- CALCULATION_EVENTS  (evento por usuario/IP × cálculo)
-- Una fila por par (cálculo, usuario) o (cálculo, ip).
-- Si el mismo usuario recalcula la misma función, solo se
-- incrementa `count` y se actualiza `last_calculated_at`.
-- Los favoritos viven aquí: son propios de cada usuario.
-- -------------------------------------------------------
CREATE TABLE calculation_events (
    id                  TEXT PRIMARY KEY DEFAULT gen_ulid(),
    calculation_id      TEXT NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
    user_id             TEXT REFERENCES users(id) ON DELETE CASCADE,
    ip_address          INET,
    first_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_calculated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    count               INTEGER NOT NULL DEFAULT 1,
    is_favorite         BOOLEAN NOT NULL DEFAULT FALSE,
    favorite_name       VARCHAR(100),
    execution_ms        INTEGER,
    CONSTRAINT chk_event_owner CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL)
);

-- -------------------------------------------------------
-- ANONYMOUS CALCULATION COUNTERS
-- Contador semanal para límite de cálculos por IP
-- -------------------------------------------------------  
CREATE TABLE anonymous_calculation_counters (
    ip_address   INET PRIMARY KEY,
    week_start   DATE NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de calculations
CREATE INDEX idx_calc_hash ON calculations (input_hash);
CREATE INDEX idx_calc_type ON calculations (type);

-- Índices de calculation_events
-- Unique parciales: manejan NULLs correctamente en PostgreSQL
CREATE UNIQUE INDEX uq_event_user ON calculation_events (calculation_id, user_id)
    WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_event_ip   ON calculation_events (calculation_id, ip_address)
    WHERE user_id IS NULL AND ip_address IS NOT NULL;

CREATE INDEX idx_event_user_date ON calculation_events (user_id, last_calculated_at DESC)
    WHERE user_id IS NOT NULL;
CREATE INDEX idx_event_fav       ON calculation_events (user_id)
    WHERE is_favorite = TRUE;
CREATE INDEX idx_event_calc      ON calculation_events (calculation_id);
CREATE INDEX idx_event_ip        ON calculation_events (ip_address)
    WHERE ip_address IS NOT NULL;

-- -------------------------------------------------------
-- USER CALCULATION COUNTERS
-- Contador semanal para límite de cálculos por tier
-- -------------------------------------------------------
CREATE TABLE user_calculation_counters (
    user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    week_start   DATE NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- AUDIT LOG
-- Inmutable. Sin CASCADE deliberadamente.
-- -------------------------------------------------------
CREATE TABLE audit_log (
    id          TEXT PRIMARY KEY DEFAULT gen_ulid(),
    user_id     TEXT REFERENCES users(id),
    action      audit_action NOT NULL,
    target_type VARCHAR(50),
    target_id   TEXT,
    metadata    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user    ON audit_log (user_id);
CREATE INDEX idx_audit_log_action  ON audit_log (action);
CREATE INDEX idx_audit_log_created ON audit_log (created_at);

-- -------------------------------------------------------
-- FEEDBACK
-- Recoge el micro-modal y la página /feedback.
-- message es requerido excepto cuando category = 'rating'.
-- -------------------------------------------------------
CREATE TABLE feedback (
    id         TEXT    PRIMARY KEY DEFAULT gen_ulid(),
    user_id    TEXT    REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    category   feedback_category NOT NULL,
    rating     SMALLINT CHECK (rating BETWEEN 1 AND 5),
    message    TEXT,
    email      VARCHAR(320),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_user    ON feedback (user_id)   WHERE user_id IS NOT NULL;
CREATE INDEX idx_feedback_created ON feedback (created_at);
CREATE INDEX idx_feedback_cat     ON feedback (category);

-- -------------------------------------------------------
-- SURVEY RESPONSES
-- Una fila por envío de la encuesta demográfica.
-- Los campos de arrays usan TEXT[] para compatibilidad
-- con múltiples valores (purpose, features, device…).
-- Los campos de pasos 4 y 6 son opcionales/nullable.
-- -------------------------------------------------------
CREATE TABLE survey_responses (
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

CREATE INDEX idx_survey_user      ON survey_responses (user_id)       WHERE user_id IS NOT NULL;
CREATE INDEX idx_survey_created   ON survey_responses (created_at);
CREATE INDEX idx_survey_role      ON survey_responses (role);
CREATE INDEX idx_survey_country   ON survey_responses (country);
CREATE INDEX idx_survey_used_prev ON survey_responses (used_previous);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_persons_updated_at
    BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/* Resetear contador al inicio de nueva semana */
CREATE OR REPLACE FUNCTION reset_weekly_counter()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.week_start != OLD.week_start THEN
        NEW.count = 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reset_weekly_counter
    BEFORE UPDATE ON user_calculation_counters
    FOR EACH ROW EXECUTE FUNCTION reset_weekly_counter();