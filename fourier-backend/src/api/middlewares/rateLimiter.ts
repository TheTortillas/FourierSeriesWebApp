import rateLimit from "express-rate-limit";
import { config } from "../../config/env";

export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxGeneral,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later.",
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000 / 60),
  },
});

export const computeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxCompute,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many computation requests, please try again later.",
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000 / 60),
  },
});
