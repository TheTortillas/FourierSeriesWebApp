import rateLimit from "express-rate-limit";
import { config } from "../../config/env";
import { logger } from "../../infrastructure/logging/logger";
import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./authenticate";

type RequestLike = {
  path: string;
  method?: string;
  originalUrl?: string;
  ip?: string;
  headers?: Record<string, unknown>;
  user?: { id?: string };
};

type RateLimitBucket = "compute" | "parse" | "auth";

type RateLimitMetricsSnapshot = {
  startedAt: string;
  requestsByBucket: Record<RateLimitBucket, number>;
  blockedByBucket: Record<RateLimitBucket, number>;
  requestsByEndpoint: Record<string, number>;
  blockedByEndpoint: Record<string, number>;
  blockedByLimiter: Record<string, number>;
  ratios: Record<RateLimitBucket, number>;
};

const metrics: Omit<RateLimitMetricsSnapshot, "ratios"> = {
  startedAt: new Date().toISOString(),
  requestsByBucket: {
    compute: 0,
    parse: 0,
    auth: 0,
  },
  blockedByBucket: {
    compute: 0,
    parse: 0,
    auth: 0,
  },
  requestsByEndpoint: {},
  blockedByEndpoint: {},
  blockedByLimiter: {},
};

function incrementCounter(store: Record<string, number>, key: string): void {
  store[key] = (store[key] ?? 0) + 1;
}

function normalizeEndpoint(req: RequestLike): string {
  const url = req.originalUrl ?? req.path ?? "unknown";
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

function recordRequest(bucket: RateLimitBucket, req: RequestLike): void {
  metrics.requestsByBucket[bucket] += 1;
  incrementCounter(metrics.requestsByEndpoint, normalizeEndpoint(req));
}

function recordBlocked(
  bucket: RateLimitBucket,
  limiter: string,
  req: RequestLike,
): void {
  metrics.blockedByBucket[bucket] += 1;
  incrementCounter(metrics.blockedByLimiter, limiter);
  incrementCounter(metrics.blockedByEndpoint, normalizeEndpoint(req));
}

function logRateLimitEvent(
  bucket: RateLimitBucket,
  limiter: string,
  req: RequestLike,
  retryAfter: number,
): void {
  const identity = req.user?.id
    ? `user:${req.user.id}`
    : `ip:${req.ip ?? "unknown"}`;

  logger.warn(
    {
      event: "rate_limit_blocked",
      bucket,
      limiter,
      method: req.method ?? "UNKNOWN",
      endpoint: normalizeEndpoint(req),
      identity,
      retryAfterSeconds: retryAfter,
    },
    "Rate limit exceeded",
  );
}

function rateLimitHandler(
  bucket: RateLimitBucket,
  limiter: string,
  message: string,
) {
  return (req: RequestLike, res: Response): void => {
    const seconds = retryAfterSeconds(res);
    recordBlocked(bucket, limiter, req);
    logRateLimitEvent(bucket, limiter, req, seconds);
    res.status(429).json({
      error: message,
      retryAfterSeconds: seconds,
      retryAfterMinutes: Math.ceil(seconds / 60),
    });
  };
}

export function trackRateLimitRequests(bucket: RateLimitBucket) {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): void => {
    recordRequest(bucket, req as RequestLike);
    next();
  };
}

export function getRateLimitMetricsSnapshot(): RateLimitMetricsSnapshot {
  const requestsByBucket = { ...metrics.requestsByBucket };
  const blockedByBucket = { ...metrics.blockedByBucket };

  const ratio = (blocked: number, total: number): number => {
    if (total <= 0) return 0;
    return Number(((blocked / total) * 100).toFixed(3));
  };

  return {
    startedAt: metrics.startedAt,
    requestsByBucket,
    blockedByBucket,
    requestsByEndpoint: { ...metrics.requestsByEndpoint },
    blockedByEndpoint: { ...metrics.blockedByEndpoint },
    blockedByLimiter: { ...metrics.blockedByLimiter },
    ratios: {
      compute: ratio(blockedByBucket.compute, requestsByBucket.compute),
      parse: ratio(blockedByBucket.parse, requestsByBucket.parse),
      auth: ratio(blockedByBucket.auth, requestsByBucket.auth),
    },
  };
}

function isAuthenticated(req: RequestLike): boolean {
  return Boolean(req.user?.id);
}

function hasDedicatedLimiter(path: string): boolean {
  return (
    path.startsWith("/api/fourier") ||
    path.startsWith("/api/simplify") ||
    path.startsWith("/api/transforms") ||
    path.startsWith("/api/dft") ||
    path.startsWith("/api/parse") ||
    path.startsWith("/api/auth")
  );
}

function retryAfterSeconds(res: {
  getHeader: (name: string) => string | number | readonly string[] | undefined;
}): number {
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
  skip: (req) => hasDedicatedLimiter(req.path),
  handler: rateLimitHandler(
    "auth",
    "general",
    "Too many requests, please try again later.",
  ),
});

export const computeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: (req) => {
    if (isAuthenticated(req as RequestLike)) {
      return config.rateLimit.maxComputeAuthenticated;
    }
    return config.rateLimit.maxCompute;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    "compute",
    "compute",
    "Too many computation requests, please try again later.",
  ),
});

export const parseBurstLimiter = rateLimit({
  windowMs: config.rateLimit.parseBurstWindowMs,
  max: (req) => {
    if (isAuthenticated(req as RequestLike)) {
      return config.rateLimit.maxParseBurstAuthenticated;
    }
    return config.rateLimit.maxParseBurstAnonymous;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    "parse",
    "parse_burst",
    "Too many parse requests in a short burst. Please keep typing and retry in a few seconds.",
  ),
});

export const parseSustainedLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: (req) => {
    if (isAuthenticated(req as RequestLike)) {
      return config.rateLimit.maxParseAuthenticated;
    }
    return config.rateLimit.maxParseAnonymous;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    "parse",
    "parse_sustained",
    "Too many parse requests, please try again later.",
  ),
});

export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxAuth,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    "auth",
    "auth",
    "Too many authentication requests, please try again later.",
  ),
});

export const authSignInLimiter = rateLimit({
  windowMs: config.rateLimit.authSignInWindowMs,
  max: config.rateLimit.maxAuthSignIn,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    "auth",
    "auth_signin",
    "Too many sign-in attempts, please try again later.",
  ),
});

export const authRecoveryLimiter = rateLimit({
  windowMs: config.rateLimit.authSignInWindowMs,
  max: config.rateLimit.maxAuthRecovery,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    "auth",
    "auth_recovery",
    "Too many recovery or verification requests, please try again later.",
  ),
});

// 10 submissions per hour per IP — strict because it's a public unauthenticated endpoint
export const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: RequestLike, res: Response): void => {
    res.status(429).json({
      error: "Too many feedback submissions. Please try again later.",
    });
  },
});
