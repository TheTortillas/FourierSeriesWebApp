-- ============================================================
-- Migration v6: Execution log
-- Reemplaza el contador acumulado (ce.count) como fuente de
-- verdad para métricas temporales. Cada fila representa una
-- ejecución real con su timestamp exacto, permitiendo queries
-- de tendencia precisas (por día, semana, tipo, actor, etc.).
--
-- La tabla calculation_events conserva su columna `count` para
-- consultas de tipo "¿cuántas veces ejecutó este usuario este
-- cálculo?" — ambas fuentes coexisten sin conflicto.
-- ============================================================

CREATE TABLE IF NOT EXISTS execution_log (
  id          BIGSERIAL    PRIMARY KEY,
  event_id    TEXT         NOT NULL REFERENCES calculation_events(id) ON DELETE CASCADE,
  executed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índice principal: queries de tendencia filtradas por rango de fechas.
CREATE INDEX IF NOT EXISTS idx_execution_log_executed_at
  ON execution_log (executed_at);

-- Índice secundario: JOIN rápido desde execution_log hacia calculation_events.
CREATE INDEX IF NOT EXISTS idx_execution_log_event_id
  ON execution_log (event_id);

-- ── Backfill histórico ────────────────────────────────────────────────────────
-- Reconstruye el log a partir del contador acumulado existente.
-- Para cada evento con count = N, inserta N filas con timestamps
-- distribuidos uniformemente entre first_calculated_at y last_calculated_at.
-- Esto no es perfectamente preciso pero es la mejor aproximación posible
-- con los datos actuales y produce tendencias coherentes con el historial.
INSERT INTO execution_log (event_id, executed_at)
SELECT
  ce.id AS event_id,
  ce.first_calculated_at + (
    (ce.last_calculated_at - ce.first_calculated_at)
    * (generate_series(1, ce.count) - 1)::float
    / GREATEST(ce.count - 1, 1)
  ) AS executed_at
FROM calculation_events ce
WHERE ce.count > 0;
