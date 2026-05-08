import { Router, Request, Response } from "express";

export const surveyRouter = Router();

const VALID_ROLES = ["student", "teacher", "graduate", "other"];
const VALID_PURPOSES = ["problem", "learning", "teaching", "exploration", "other"];
const VALID_FEATURES = [
  "trigonometric", "half_range", "complex",
  "fourier_transform", "inverse_fourier_transform",
  "dft_signal", "dft_function", "dft_epicycles", "none",
];
const VALID_DEVICES = ["phone", "computer"];
const VALID_IMPROVEMENTS = ["ui", "features", "speed", "results_clarity", "other"];

surveyRouter.post("/", (req: Request, res: Response): void => {
  const { role, purpose, featuresUsed, device, usedPrevious, improvements,
          usefulnessRating, easeOfUseRating, vsOtherToolsRating, recommendRating
        } = req.body as Record<string, unknown>;

  if (!VALID_ROLES.includes(role as string)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  if (!Array.isArray(purpose) || purpose.length === 0 || !purpose.every((p) => VALID_PURPOSES.includes(p as string))) {
    res.status(400).json({ error: "Invalid purpose" });
    return;
  }
  if (!Array.isArray(featuresUsed) || featuresUsed.length === 0 || !featuresUsed.every((f) => VALID_FEATURES.includes(f as string))) {
    res.status(400).json({ error: "Invalid featuresUsed" });
    return;
  }
  if (!Array.isArray(device) || device.length === 0 || !device.every((d) => VALID_DEVICES.includes(d as string))) {
    res.status(400).json({ error: "Invalid device" });
    return;
  }
  if (typeof usedPrevious !== "boolean") {
    res.status(400).json({ error: "Invalid usedPrevious" });
    return;
  }
  if (improvements !== undefined) {
    if (!Array.isArray(improvements) || !improvements.every((i) => VALID_IMPROVEMENTS.includes(i as string))) {
      res.status(400).json({ error: "Invalid improvements" });
      return;
    }
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
