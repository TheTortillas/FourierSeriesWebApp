import { Router } from "express";
import { optionalAuth, type AuthenticatedRequest } from "../middlewares/authenticate";
import { FeedbackRepository } from "../../infrastructure/persistence/FeedbackRepository";

export const feedbackRouter = Router();

const repo = new FeedbackRepository();

const VALID_CATEGORIES = ["bug", "suggestion", "question", "other", "rating"];

feedbackRouter.post("/", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { category, rating, message, email } = req.body as Record<string, unknown>;

  if (!category || !VALID_CATEGORIES.includes(category as string)) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }
  if (rating !== undefined && (typeof rating !== "number" || rating < 1 || rating > 5)) {
    res.status(400).json({ error: "Rating must be 1–5" });
    return;
  }
  if (message !== undefined && (typeof message !== "string" || message.length > 2000)) {
    res.status(400).json({ error: "Message too long" });
    return;
  }
  if (email !== undefined && (typeof email !== "string" || email.length > 320)) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  try {
    await repo.create({
      userId:    req.user?.id,
      ipAddress: req.ip ?? undefined,
      category:  category as string,
      rating:    typeof rating === "number" ? rating : undefined,
      message:   typeof message === "string" ? message.trim() || undefined : undefined,
      email:     typeof email   === "string" ? email.trim()   || undefined : undefined,
    });
    res.status(201).json({ message: "Feedback received" });
  } catch {
    res.status(500).json({ error: "Failed to save feedback" });
  }
});
