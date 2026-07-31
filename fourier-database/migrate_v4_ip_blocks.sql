-- ============================================================
-- Migration v4: IP blocklist dinámica
-- Añade la tabla ip_blocks para suspensiones temporales y
-- permanentes de IPs abusivas, administrable desde el panel
-- de admin y con auto-bloqueo por detección de patrones en
-- audit_log.
-- ============================================================

-- Nuevos valores de audit_action para trazabilidad de bloqueos
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ip_blocked';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ip_unblocked';

-- -------------------------------------------------------
-- Tabla principal
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS ip_blocks (
    id            TEXT        PRIMARY KEY DEFAULT gen_ulid(),

    -- La IP a bloquear (IPv4 o IPv6)
    ip_address    INET        NOT NULL,

    -- Razón legible: 'auto: 200+ rate_limit_blocked in 15min' | texto del admin
    reason        TEXT        NOT NULL,

    -- 'auto' = detectado por el worker | 'admin' = acción manual
    blocked_by    VARCHAR(10) NOT NULL CHECK (blocked_by IN ('auto', 'admin')),

    -- NULL = permanente (solo admins pueden crear bloqueos permanentes)
    -- El worker siempre crea bloqueos con duración definida
    blocked_until TIMESTAMPTZ,

    -- El admin que lo creó (NULL si fue auto)
    admin_user_id TEXT        REFERENCES users(id) ON DELETE SET NULL,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Cuándo se liberó la IP (NULL = sigue bloqueada)
    released_at   TIMESTAMPTZ,
    -- 'expired' (venció blocked_until) | 'admin' (desbloqueado manual) | NULL
    released_by   VARCHAR(10) CHECK (released_by IN ('expired', 'admin'))
);

-- Índice principal: el middleware solo consulta bloques activos por IP
-- Partial index — solo incluye filas sin released_at, las más frecuentes
CREATE INDEX IF NOT EXISTS idx_ip_blocks_active
    ON ip_blocks (ip_address)
    WHERE released_at IS NULL;

-- Índice para el panel admin (listar todos, filtrar por estado/fecha)
CREATE INDEX IF NOT EXISTS idx_ip_blocks_created
    ON ip_blocks (created_at DESC);

-- Índice para el worker: encontrar IPs ya bloqueadas y evitar duplicados
CREATE INDEX IF NOT EXISTS idx_ip_blocks_ip_released
    ON ip_blocks (ip_address, released_at);

-- -------------------------------------------------------
-- Vista de conveniencia: bloques activos ahora mismo
-- -------------------------------------------------------
CREATE OR REPLACE VIEW ip_blocks_active AS
SELECT *
FROM ip_blocks
WHERE released_at IS NULL
  AND (blocked_until IS NULL OR blocked_until > NOW());

COMMENT ON TABLE ip_blocks IS
    'Suspensiones de IP: auto-detectadas por el worker de audit_log o creadas manualmente por admins. Los bloqueos automáticos siempre tienen duración definida (blocked_until). Los permanentes (blocked_until NULL) solo los puede crear un admin.';
