-- ============================================================
-- Migration v5: User engagement flags
-- Añade has_done_survey y has_done_feedback a la tabla users
-- para poder determinar en el servidor si un usuario ya contestó
-- la encuesta demográfica o el modal de feedback, y así dejar
-- de mostrárselos en cualquier dispositivo/navegador que use.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS has_done_survey   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_done_feedback BOOLEAN NOT NULL DEFAULT FALSE;

-- Marcar como completados a los usuarios que ya tienen registros
-- en las tablas correspondientes (reconcilia datos históricos).
UPDATE users u
SET has_done_survey = TRUE
WHERE EXISTS (
  SELECT 1 FROM survey_responses sr WHERE sr.user_id = u.id
);

UPDATE users u
SET has_done_feedback = TRUE
WHERE EXISTS (
  SELECT 1 FROM feedback f WHERE f.user_id = u.id
);
