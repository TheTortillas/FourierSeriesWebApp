import { Request, Response, NextFunction } from "express";
import { config } from "../../config/env";
import { logger } from "../../infrastructure/logging/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err }, "Unhandled error");

  if (config.server.isDevelopment) {
    res.status(500).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
}
