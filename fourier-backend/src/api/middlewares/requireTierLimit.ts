import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./authenticate";
import { userRepository } from "../../infrastructure/container";
import { config } from "../../config/env";

function nextWeekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 7);
  return d;
}

export async function requireTierLimit(
  req: AuthenticatedRequest,
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

    next();
    return;
  }

  const tier = req.user.tier;
  const limit =
    tier === "premium" ? config.calcLimits.premium : config.calcLimits.free;

  if (limit === -1) {
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

  next();
}

export async function incrementCalculationCount(
  userIdOrIp: string,
  isAnonymous = false,
): Promise<void> {
  if (isAnonymous) {
    await userRepository.incrementAnonymousCount(userIdOrIp);
  } else {
    await userRepository.incrementWeeklyCount(userIdOrIp);
  }
}
