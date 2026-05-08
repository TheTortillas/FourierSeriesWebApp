import { db } from "../database/db";

export interface FeedbackInput {
  userId?:    string;
  ipAddress?: string;
  category:   string;
  rating?:    number;
  message?:   string;
  email?:     string;
}

export class FeedbackRepository {
  async create(input: FeedbackInput): Promise<string> {
    const result = await db.query<{ id: string }>(
      `INSERT INTO feedback (user_id, ip_address, category, rating, message, email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.userId    ?? null,
        input.ipAddress ?? null,
        input.category,
        input.rating    ?? null,
        input.message   ?? null,
        input.email     ?? null,
      ],
    );
    return result.rows[0].id;
  }
}
