import { Router } from "express";
import { optionalAuth, type AuthenticatedRequest } from "../middlewares/authenticate";
import { SurveyRepository } from "../../infrastructure/persistence/SurveyRepository";

export const surveyRouter = Router();

const repo = new SurveyRepository();

const VALID_ROLES        = ["student", "teacher", "graduate", "other"];
const VALID_LEVELS       = ["licenciatura", "maestria", "doctorado", "other"];
const VALID_HOW_FOUND    = ["search", "recommendation_peer", "recommendation_teacher", "social", "other"];
const VALID_PURPOSES     = ["problem", "learning", "teaching", "exploration", "other"];
const VALID_FEATURES     = [
  "trigonometric", "half_range", "complex",
  "fourier_transform", "inverse_fourier_transform",
  "dft_signal", "dft_function", "dft_epicycles", "none",
];
const VALID_DEVICES      = ["phone", "computer"];
const VALID_IMPROVEMENTS = ["ui", "features", "speed", "results_clarity", "other"];

function isStringArray(val: unknown, valid: string[]): val is string[] {
  return Array.isArray(val) && val.length > 0 && val.every((v) => valid.includes(v as string));
}

surveyRouter.post("/", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;

  // ── Validaciones ────────────────────────────────────────────────────────────
  if (!VALID_ROLES.includes(b.role as string)) {
    res.status(400).json({ error: "Invalid role" }); return;
  }
  if (b.role === "other" && typeof b.roleOther !== "string") {
    res.status(400).json({ error: "roleOther required" }); return;
  }
  if (!VALID_LEVELS.includes(b.academicLevel as string)) {
    res.status(400).json({ error: "Invalid academicLevel" }); return;
  }
  if (typeof b.country !== "string" || !b.country.trim()) {
    res.status(400).json({ error: "country required" }); return;
  }
  if (!VALID_HOW_FOUND.includes(b.howFound as string)) {
    res.status(400).json({ error: "Invalid howFound" }); return;
  }
  if (!isStringArray(b.purpose, VALID_PURPOSES)) {
    res.status(400).json({ error: "Invalid purpose" }); return;
  }
  if (!isStringArray(b.featuresUsed, VALID_FEATURES)) {
    res.status(400).json({ error: "Invalid featuresUsed" }); return;
  }
  if (!isStringArray(b.device, VALID_DEVICES)) {
    res.status(400).json({ error: "Invalid device" }); return;
  }
  if (typeof b.usedPrevious !== "boolean") {
    res.status(400).json({ error: "Invalid usedPrevious" }); return;
  }
  if (b.improvements !== undefined && !isStringArray(b.improvements, VALID_IMPROVEMENTS)) {
    res.status(400).json({ error: "Invalid improvements" }); return;
  }
  for (const [key, val] of Object.entries({
    usefulnessRating: b.usefulnessRating,
    easeOfUseRating:  b.easeOfUseRating,
    vsOtherToolsRating: b.vsOtherToolsRating,
    recommendRating:  b.recommendRating,
  })) {
    if (typeof val !== "number" || val < 1 || val > 5) {
      res.status(400).json({ error: `Invalid ${key}` }); return;
    }
  }

  // ── Persistencia ────────────────────────────────────────────────────────────
  try {
    await repo.create({
      userId:              req.user?.id,
      ipAddress:           req.ip ?? undefined,
      role:                b.role as string,
      roleOther:           typeof b.roleOther === "string" ? b.roleOther.trim() || undefined : undefined,
      academicLevel:       b.academicLevel as string,
      academicLevelOther:  typeof b.academicLevelOther === "string" ? b.academicLevelOther.trim() || undefined : undefined,
      institution:         typeof b.institution === "string" ? b.institution.trim() || undefined : undefined,
      career:              typeof b.career === "string" ? b.career.trim() || undefined : undefined,
      country:             (b.country as string).trim(),
      howFound:            b.howFound as string,
      howFoundOther:       typeof b.howFoundOther === "string" ? b.howFoundOther.trim() || undefined : undefined,
      purpose:             b.purpose as string[],
      purposeOther:        typeof b.purposeOther === "string" ? b.purposeOther.trim() || undefined : undefined,
      featuresUsed:        b.featuresUsed as string[],
      device:              b.device as string[],
      usedPrevious:        b.usedPrevious as boolean,
      improvements:        b.improvements as string[] | undefined,
      improvementsOther:   typeof b.improvementsOther === "string" ? b.improvementsOther.trim() || undefined : undefined,
      regressions:         typeof b.regressions === "string" ? b.regressions.trim() || undefined : undefined,
      usefulnessRating:    b.usefulnessRating as number,
      easeOfUseRating:     b.easeOfUseRating as number,
      vsOtherToolsRating:  b.vsOtherToolsRating as number,
      recommendRating:     b.recommendRating as number,
      bugDescription:      typeof b.bugDescription === "string" ? b.bugDescription.trim() || undefined : undefined,
      generalComments:     typeof b.generalComments === "string" ? b.generalComments.trim() || undefined : undefined,
    });
    res.status(201).json({ message: "Survey received" });
  } catch {
    res.status(500).json({ error: "Failed to save survey" });
  }
});
