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

export const config = {
  server: {
    port: parseInt(optionalEnv("PORT", "3000")),
    nodeEnv: optionalEnv("NODE_ENV", "development"),
    isDevelopment: optionalEnv("NODE_ENV", "development") === "development",
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
  },
  rateLimit: {
    windowMs: parseInt(optionalEnv("RATE_LIMIT_WINDOW_MS", "900000")),
    maxGeneral: parseInt(optionalEnv("RATE_LIMIT_MAX_GENERAL", "100")),
    maxCompute: parseInt(optionalEnv("RATE_LIMIT_MAX_COMPUTE", "20")),
  },
} as const;
