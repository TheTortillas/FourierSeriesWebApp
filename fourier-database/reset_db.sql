-- ============================================================
-- RESET: Vacía todas las tablas manteniendo el schema
-- Solo para uso en desarrollo local
-- ============================================================
TRUNCATE TABLE
  audit_log,
  feedback,
  survey_responses,
  user_calculation_counters,
  anonymous_calculation_counters,
  calculation_events,
  calculations,
  user_recovery_emails,
  user_password_resets,
  user_email_tokens,
  user_refresh_tokens,
  user_auth_providers,
  users,
  persons
RESTART IDENTITY CASCADE;

-- ============================================================
-- sudo -u postgres psql -d fourier_db -f fourier-database/reset_db.sql
-- ============================================================
