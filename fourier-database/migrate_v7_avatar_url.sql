-- ============================================================
-- Migration v7: Avatar URL
-- Añade avatar_url a la tabla users para guardar la foto de
-- perfil de Google. Para usuarios de email queda NULL y el
-- frontend muestra un avatar con iniciales.
-- La URL se actualiza en cada login con Google, por lo que
-- siempre refleja la foto actual del usuario.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
