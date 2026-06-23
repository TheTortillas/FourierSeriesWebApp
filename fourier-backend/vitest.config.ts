import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**'],
    // Each Maxima call can take several seconds; allow 90s per test
    testTimeout: 90_000,
    hookTimeout: 30_000,
    // Dummy values so config/env.ts doesn't throw on requireEnv —
    // transform tests never touch the DB, JWT or SMTP.
    env: {
      DATABASE_URL:        'postgres://test:test@localhost:5432/test',
      JWT_ACCESS_SECRET:   'test-jwt-access-secret',
      JWT_REFRESH_SECRET:  'test-jwt-refresh-secret',
      GOOGLE_CLIENT_ID:    'test-google-client-id',
      GOOGLE_CLIENT_SECRET:'test-google-client-secret',
      SMTP_USER:           'test@test.com',
      SMTP_PASS:           'test-pass',
      SMTP_FROM:           'test@test.com',
    },
  },
});
