import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./authenticate";
import { userRepository } from "../../infrastructure/container";
import { config } from "../../config/env";

export interface QuotaRequest extends AuthenticatedRequest {
  quota?: {
    limit: number;
    isAnonymous: boolean;
    identifier: string; // userId or IP
  };
}

function nextWeekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 7);
  return d;
}

export async function requireTierLimit(
  req: QuotaRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    const ip = req.ip ?? "0.0.0.0";
    const limit = config.calcLimits.anonymous;
    const count = await userRepository.getAnonymousWeeklyCount(ip);

    if (count >= limit) {
      res.status(429).json({
        error: "Weekly calculation limit reached",
        message: `Anonymous users can make ${limit} calculations per week. Create a free account for more.`,
        limit,
        current: count,
        resetsAt: nextWeekStart().toISOString(),
        retryAfterSeconds: Math.ceil((nextWeekStart().getTime() - Date.now()) / 1000),
        registerAvailable: true,
      });
      return;
    }

    req.quota = { limit, isAnonymous: true, identifier: ip };
    next();
    return;
  }

  const tier = req.user.tier;
  const limit =
    tier === "premium" ? config.calcLimits.premium : config.calcLimits.free;

  if (limit === -1) {
    req.quota = { limit: -1, isAnonymous: false, identifier: req.user.id };
    next();
    return;
  }

  const count = await userRepository.getWeeklyCount(req.user.id);

  if (count >= limit) {
    res.status(429).json({
      error: "Weekly calculation limit reached",
      message: `Your ${tier} plan allows ${limit} calculations per week`,
      limit,
      current: count,
      resetsAt: nextWeekStart().toISOString(),
      retryAfterSeconds: Math.ceil((nextWeekStart().getTime() - Date.now()) / 1000),
      upgradeAvailable: tier === "free",
    });
    return;
  }

  req.quota = { limit, isAnonymous: false, identifier: req.user.id };
  next();
}

export async function tryConsumeQuota(
  req: QuotaRequest,
): Promise<{ allowed: boolean }> {
  const quota = req.quota;
  if (!quota) return { allowed: true };
  if (quota.limit === -1) return { allowed: true };

  if (quota.isAnonymous) {
    return userRepository.tryIncrementAnonymousCount(quota.identifier, quota.limit);
  }
  return userRepository.tryIncrementWeeklyCount(quota.identifier, quota.limit);
}
