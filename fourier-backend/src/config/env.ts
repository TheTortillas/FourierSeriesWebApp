import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

// Computed once so logging config can reference it without a circular dependency
const isDevelopment = optionalEnv("NODE_ENV", "development") === "development";

export const config = {
  server: {
    port: parseInt(optionalEnv("PORT", "3000")),
    nodeEnv: optionalEnv("NODE_ENV", "development"),
    isDevelopment,
  },
  logging: {
    /** Accepted values: trace | debug | info | warn | error | fatal */
    level: optionalEnv("LOG_LEVEL", isDevelopment ? "debug" : "info"),
  },
  maxima: {
    timeoutMs: parseInt(optionalEnv("MAXIMA_TIMEOUT_MS", "15000")),
    transformsTimeoutMs: parseInt(
      optionalEnv("MAXIMA_TRANSFORMS_TIMEOUT_MS", "60000"),
    ),
    scriptsPath: optionalEnv("MAXIMA_SCRIPTS_PATH", "src/scripts/maxima"),
  },
  cache: {
    maxSize: parseInt(optionalEnv("CACHE_MAX_SIZE", "500")),
    ttlDays: parseInt(optionalEnv("CACHE_TTL_DAYS", "7")),
  },
  redis: {
    enabled: optionalEnv("REDIS_ENABLED", "false") === "true",
    url: optionalEnv("REDIS_URL", "redis://localhost:6379"),
  },
  rateLimit: {
    windowMs: parseInt(optionalEnv("RATE_LIMIT_WINDOW_MS", "900000")),
    maxGeneral: parseInt(optionalEnv("RATE_LIMIT_MAX_GENERAL", "100")),
    maxCompute: parseInt(optionalEnv("RATE_LIMIT_MAX_COMPUTE", "20")),
    maxParse: parseInt(optionalEnv("RATE_LIMIT_MAX_PARSE", "200")),
    maxComputeAuthenticated: parseInt(
      optionalEnv("RATE_LIMIT_MAX_COMPUTE_AUTH", "120"),
    ),
    parseBurstWindowMs: parseInt(
      optionalEnv("RATE_LIMIT_PARSE_BURST_WINDOW_MS", "60000"),
    ),
    maxParseBurstAnonymous: parseInt(
      optionalEnv("RATE_LIMIT_MAX_PARSE_BURST_ANON", "120"),
    ),
    maxParseBurstAuthenticated: parseInt(
      optionalEnv("RATE_LIMIT_MAX_PARSE_BURST_AUTH", "240"),
    ),
    maxParseAnonymous: parseInt(
      optionalEnv("RATE_LIMIT_MAX_PARSE_ANON", "400"),
    ),
    maxParseAuthenticated: parseInt(
      optionalEnv("RATE_LIMIT_MAX_PARSE_AUTH", "1500"),
    ),
    maxAuth: parseInt(optionalEnv("RATE_LIMIT_MAX_AUTH", "200")),
    authSignInWindowMs: parseInt(
      optionalEnv("RATE_LIMIT_AUTH_SIGNIN_WINDOW_MS", "900000"),
    ),
    maxAuthSignIn: parseInt(optionalEnv("RATE_LIMIT_MAX_AUTH_SIGNIN", "30")),
    maxAuthRecovery: parseInt(
      optionalEnv("RATE_LIMIT_MAX_AUTH_RECOVERY", "40"),
    ),
  },
  database: {
    url: requireEnv("DATABASE_URL"),
  },
  jwt: {
    accessSecret: requireEnv("JWT_ACCESS_SECRET"),
    refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
    accessExpiresIn: optionalEnv("JWT_ACCESS_EXPIRES_IN", "15m"),
    refreshExpiresIn: optionalEnv("JWT_REFRESH_EXPIRES_IN", "30d"),
  },
  google: {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
  },
  calcLimits: {
    anonymous: parseInt(optionalEnv("CALC_LIMIT_ANONYMOUS", "10")),
    free: parseInt(optionalEnv("CALC_LIMIT_FREE", "50")),
    premium: parseInt(optionalEnv("CALC_LIMIT_PREMIUM", "-1")),
  },
  email: {
    host: optionalEnv("SMTP_HOST", "smtp.ionos.com"),
    port: parseInt(optionalEnv("SMTP_PORT", "587")),
    secure: optionalEnv("SMTP_SECURE", "false") === "true",
    user: requireEnv("SMTP_USER"),
    pass: requireEnv("SMTP_PASS"),
    from: requireEnv("SMTP_FROM"),
  },
  app: {
    url: optionalEnv("APP_URL", "http://localhost:3000"),
    frontendUrl: optionalEnv("FRONTEND_URL", "http://localhost:4200"),
    frontendDefaultLang: optionalEnv("FRONTEND_DEFAULT_LANG", "es"),
  },
  cors: {
    allowedOrigins: optionalEnv("ALLOWED_ORIGINS", "http://localhost:4200")
      .split(",")
      .map((o) => o.trim()),
  },
} as const;
