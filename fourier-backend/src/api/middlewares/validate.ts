import { Request, Response, NextFunction } from "express";
import type { PiecewiseFourierInput } from "../../domain/types/fourier.types";
import { sanitizeSegments } from "./sanitize";

export function validateFourierInput(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const body = req.body as Partial<PiecewiseFourierInput>;

  if (
    !body.segments ||
    !Array.isArray(body.segments) ||
    body.segments.length === 0
  ) {
    res
      .status(400)
      .json({ error: "segments is required and must be a non-empty array" });
    return;
  }

  for (const segment of body.segments) {
    if (!segment.expression || !segment.from || !segment.to) {
      res.status(400).json({
        error: "Each segment must have expression, from, and to fields",
      });
      return;
    }
  }

  if (!body.seriesType) {
    res.status(400).json({ error: "seriesType is required" });
    return;
  }

  if (body.intVar && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(body.intVar)) {
    res.status(400).json({ error: "intVar must be a valid variable name" });
    return;
  }

  const sanitizeCheck = sanitizeSegments(body.segments);
  if (!sanitizeCheck.valid) {
    res.status(400).json({ error: sanitizeCheck.error });
    return;
  }

  next();
}
