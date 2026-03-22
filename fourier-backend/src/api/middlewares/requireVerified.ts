import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./authenticate";
import { userRepository } from "../../infrastructure/container";

export async function requireVerified(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next();
    return;
  }

  const user = await userRepository.findById(req.user.id);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  if (!user.emailVerified) {
    res.status(403).json({
      error: "Email not verified",
      message: "Please verify your email before making calculations",
      canResend: true,
    });
    return;
  }

  next();
}
