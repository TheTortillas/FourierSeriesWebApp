import { Request, Response, NextFunction } from "express";
import { config } from "../../config/env";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err.stack);

  if (config.server.isDevelopment) {
    res.status(500).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
}
