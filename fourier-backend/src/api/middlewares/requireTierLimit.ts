import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./authenticate";
import { userRepository } from "../../infrastructure/container";
import { config } from "../../config/env";

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
