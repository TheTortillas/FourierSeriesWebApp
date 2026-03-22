import { db } from "../database/db";
import type {
  IHistoryRepository,
  HistoryRecord,
  CalculationType,
} from "../../domain/interfaces/repositories/IHistoryRepository";

export class HistoryRepository implements IHistoryRepository {
  async create(input: {
    userId: string;
    type: CalculationType;
    input: Record<string, unknown>;
    executionMs?: number;
  }): Promise<HistoryRecord> {
    const result = await db.query(
      `INSERT INTO calculation_history
         (user_id, type, input, execution_ms)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         user_id as "userId",
         type,
         input,
         is_favorite as "isFavorite",
         favorite_name as "favoriteName",
         execution_ms as "executionMs",
         created_at as "createdAt"`,
      [
        input.userId,
        input.type,
        JSON.stringify(input.input),
        input.executionMs ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async findByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<HistoryRecord[]> {
    const result = await db.query(
      `SELECT
         id,
         user_id as "userId",
         type,
         input,
         is_favorite as "isFavorite",
         favorite_name as "favoriteName",
         execution_ms as "executionMs",
         created_at as "createdAt"
       FROM calculation_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return result.rows;
  }

  async findById(id: string): Promise<HistoryRecord | null> {
    const result = await db.query(
      `SELECT
         id,
         user_id as "userId",
         type,
         input,
         is_favorite as "isFavorite",
         favorite_name as "favoriteName",
         execution_ms as "executionMs",
         created_at as "createdAt"
       FROM calculation_history
       WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async toggleFavorite(
    id: string,
    userId: string,
    name?: string,
  ): Promise<HistoryRecord> {
    const result = await db.query(
      `UPDATE calculation_history
       SET
         is_favorite = NOT is_favorite,
         favorite_name = CASE
           WHEN NOT is_favorite THEN $3
           ELSE NULL
         END
       WHERE id = $1 AND user_id = $2
       RETURNING
         id,
         user_id as "userId",
         type,
         input,
         is_favorite as "isFavorite",
         favorite_name as "favoriteName",
         execution_ms as "executionMs",
         created_at as "createdAt"`,
      [id, userId, name ?? null],
    );
    if (!result.rows[0]) {
      throw new Error("History entry not found");
    }
    return result.rows[0]!;
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await db.query(
      `DELETE FROM calculation_history WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new Error("History entry not found");
    }
  }

  async countByUser(userId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM calculation_history WHERE user_id = $1`,
      [userId],
    );
    return parseInt(result.rows[0]?.count ?? "0");
  }

  async findAll(
    limit: number,
    offset: number,
    filters?: { userId?: string; type?: string },
  ): Promise<HistoryRecord[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters?.userId) {
      conditions.push(`user_id = $${paramIdx++}`);
      params.push(filters.userId);
    }
    if (filters?.type) {
      conditions.push(`type = $${paramIdx++}`);
      params.push(filters.type);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const result = await db.query(
      `SELECT
       id,
       user_id as "userId",
       type,
       input,
       is_favorite as "isFavorite",
       favorite_name as "favoriteName",
       execution_ms as "executionMs",
       created_at as "createdAt"
     FROM calculation_history
     ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params,
    );
    return result.rows;
  }

  async countAll(filters?: {
    userId?: string;
    type?: string;
  }): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters?.userId) {
      conditions.push(`user_id = $${paramIdx++}`);
      params.push(filters.userId);
    }
    if (filters?.type) {
      conditions.push(`type = $${paramIdx++}`);
      params.push(filters.type);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query(
      `SELECT COUNT(*) as count FROM calculation_history ${where}`,
      params,
    );
    return parseInt(result.rows[0]?.count ?? "0");
  }
}
