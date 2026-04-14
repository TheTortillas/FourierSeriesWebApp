import rateLimit from "express-rate-limit";
import { config } from "../../config/env";

type RequestLike = {
  path: string;
  user?: { id?: string };
};

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
  max: (req) => {
    if (isAuthenticated(req as RequestLike)) {
      return config.rateLimit.maxComputeAuthenticated;
    }
    return config.rateLimit.maxCompute;
  },
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
  handler: (_req, res) => {
    const seconds = retryAfterSeconds(res);
    res.status(429).json({
      error:
        "Too many parse requests in a short burst. Please keep typing and retry in a few seconds.",
      retryAfterSeconds: seconds,
      retryAfterMinutes: Math.ceil(seconds / 60),
    });
  },
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
  handler: (_req, res) => {
    const seconds = retryAfterSeconds(res);
    res.status(429).json({
      error: "Too many parse requests, please try again later.",
      retryAfterSeconds: seconds,
      retryAfterMinutes: Math.ceil(seconds / 60),
    });
  },
});

export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxAuth,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const seconds = retryAfterSeconds(res);
    res.status(429).json({
      error: "Too many authentication requests, please try again later.",
      retryAfterSeconds: seconds,
      retryAfterMinutes: Math.ceil(seconds / 60),
    });
  },
});

export const authSignInLimiter = rateLimit({
  windowMs: config.rateLimit.authSignInWindowMs,
  max: config.rateLimit.maxAuthSignIn,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const seconds = retryAfterSeconds(res);
    res.status(429).json({
      error: "Too many sign-in attempts, please try again later.",
      retryAfterSeconds: seconds,
      retryAfterMinutes: Math.ceil(seconds / 60),
    });
  },
});

export const authRecoveryLimiter = rateLimit({
  windowMs: config.rateLimit.authSignInWindowMs,
  max: config.rateLimit.maxAuthRecovery,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const seconds = retryAfterSeconds(res);
    res.status(429).json({
      error:
        "Too many recovery or verification requests, please try again later.",
      retryAfterSeconds: seconds,
      retryAfterMinutes: Math.ceil(seconds / 60),
    });
  },
});
