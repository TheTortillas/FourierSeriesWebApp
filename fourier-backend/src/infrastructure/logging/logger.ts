import pino from "pino";
import { config } from "../../config/env";

/**
 * Application-wide logger (Pino).
 *
 * Development  → pino-pretty: human-readable, colorized, timestamps
 * Production   → newline-delimited JSON → pipe to any log aggregator
 *
 * Log level is controlled via the LOG_LEVEL env var (default: debug / info).
 */
export const logger = pino(
  { level: config.logging.level },
  config.server.isDevelopment
    ? pino.transport({
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
      })
    : undefined,
);
