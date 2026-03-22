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
    res.status(401).json({ error: "Unauthorized" });
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

export async function incrementCalculationCount(userId: string): Promise<void> {
  await userRepository.incrementWeeklyCount(userId);
}
