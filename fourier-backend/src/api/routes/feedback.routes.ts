import { Router, Request, Response } from "express";

export const feedbackRouter = Router();

const VALID_CATEGORIES = ["bug", "suggestion", "question", "other", "rating"];

feedbackRouter.post("/", (req: Request, res: Response): void => {
  const { category, rating, message, email } = req.body as {
    category?: unknown;
    rating?: unknown;
    message?: unknown;
    email?: unknown;
  };

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

  // DB persistence added in a later iteration
  res.status(201).json({ message: "Feedback received" });
});
