-- Migration v3: store email hash on account deletion to prevent same-week re-registration
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_email_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_users_deleted_email_hash
  ON users (deleted_email_hash)
  WHERE deleted_email_hash IS NOT NULL;
