import rateLimit from "express-rate-limit";
import { config } from "../../config/env";

function retryAfterSeconds(res: { getHeader: (name: string) => string | number | readonly string[] | undefined }): number {
  const reset = res.getHeader("RateLimit-Reset");
  if (!reset) return Math.ceil(config.rateLimit.windowMs / 1000);
  const resetSec = Number(reset);
  return Math.max(0, resetSec - Math.ceil(Date.now() / 1000));
}

export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxGeneral,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const seconds = retryAfterSeconds(res);
    res.status(429).json({
      error: "Too many requests, please try again later.",
      retryAfterSeconds: seconds,
      retryAfterMinutes: Math.ceil(seconds / 60),
    });
  },
});

export const computeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxCompute,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const seconds = retryAfterSeconds(res);
    res.status(429).json({
      error: "Too many computation requests, please try again later.",
      retryAfterSeconds: seconds,
      retryAfterMinutes: Math.ceil(seconds / 60),
    });
  },
});

export const parseLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxParse,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const seconds = retryAfterSeconds(res);
    res.status(429).json({
      error: "Too many parse requests, please try again later.",
      retryAfterSeconds: seconds,
      retryAfterMinutes: Math.ceil(seconds / 60),
    });
  },
});
