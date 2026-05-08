import { Router, Request, Response } from "express";

export const surveyRouter = Router();

const VALID_ROLES = ["student", "teacher", "graduate", "other"];
const VALID_LEVELS = ["licenciatura", "maestria", "doctorado", "other"];
const VALID_PURPOSES = ["problem", "learning", "teaching", "exploration", "other"];
const VALID_FEATURES = ["trigonometric", "half_range", "complex", "dft", "none"];
const VALID_DEVICES = ["phone", "computer"];

surveyRouter.post("/", (req: Request, res: Response): void => {
  const { role, purpose, featuresUsed, device, usefulnessRating, easeOfUseRating,
          vsOtherToolsRating, recommendRating } = req.body as Record<string, unknown>;

  if (!VALID_ROLES.includes(role as string)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  if (!VALID_PURPOSES.includes(purpose as string)) {
    res.status(400).json({ error: "Invalid purpose" });
    return;
  }
  if (!Array.isArray(featuresUsed) || !featuresUsed.every((f) => VALID_FEATURES.includes(f as string))) {
    res.status(400).json({ error: "Invalid featuresUsed" });
    return;
  }
  if (!VALID_DEVICES.includes(device as string)) {
    res.status(400).json({ error: "Invalid device" });
    return;
  }
  for (const field of [usefulnessRating, easeOfUseRating, vsOtherToolsRating, recommendRating]) {
    if (typeof field !== "number" || field < 1 || field > 5) {
      res.status(400).json({ error: "Ratings must be 1–5" });
      return;
    }
  }

  // DB persistence added in a later iteration
  res.status(201).json({ message: "Survey received" });
});
