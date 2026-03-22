import { db } from "../database/db";
import type {
  IUserRepository,
  CreateUserInput,
  UserRecord,
} from "../../domain/interfaces/repositories/IUserRepository";

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<UserRecord | null> {
    const result = await db.query(
      `SELECT u.id, u.person_id as "personId", u.email,
            u.email_verified as "emailVerified",
            u.password_hash as "passwordHash",
            u.role, u.tier,
            u.is_active as "isActive",
            u.created_at as "createdAt",
            u.updated_at as "updatedAt",
            u.last_login_at as "lastLoginAt",
            u.deleted_at as "deletedAt",
            p.first_name as "firstName",
            p.last_name as "lastName"
     FROM users u
     JOIN persons p ON p.id = u.person_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await db.query(
      `SELECT u.id, u.person_id as "personId", u.email,
            u.email_verified as "emailVerified",
            u.password_hash as "passwordHash",
            u.role, u.tier,
            u.is_active as "isActive",
            u.created_at as "createdAt",
            u.updated_at as "updatedAt",
            u.last_login_at as "lastLoginAt",
            u.deleted_at as "deletedAt",
            p.first_name as "firstName",
            p.last_name as "lastName"
     FROM users u
     JOIN persons p ON p.id = u.person_id
     WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findByGoogleId(googleId: string): Promise<UserRecord | null> {
    const result = await db.query<UserRecord>(
      `SELECT u.id, u.person_id as "personId", u.email,
            u.email_verified as "emailVerified",
            u.password_hash as "passwordHash",
            u.role, u.tier,
            u.is_active as "isActive",
            u.created_at as "createdAt",
            u.updated_at as "updatedAt",
            u.last_login_at as "lastLoginAt",
            u.deleted_at as "deletedAt",
            p.first_name as "firstName",
            p.last_name as "lastName"
      FROM users u
      JOIN persons p ON p.id = u.person_id
      JOIN user_auth_providers ap ON ap.user_id = u.id
      WHERE ap.provider = 'google' AND ap.provider_id = $1 AND u.deleted_at IS NULL`,
      [googleId],
    );
    return result.rows[0] ?? null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const personResult = await client.query(
        `INSERT INTO persons (first_name, last_name)
         VALUES ($1, $2) RETURNING id`,
        [input.firstName, input.lastName],
      );
      const personId = personResult.rows[0].id;

      const userResult = await client.query(
        `INSERT INTO users (person_id, email, email_verified, password_hash)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          personId,
          input.email,
          input.provider === "google",
          input.passwordHash ?? null,
        ],
      );
      const user = userResult.rows[0];

      if (input.provider) {
        await client.query(
          `INSERT INTO user_auth_providers (user_id, provider, provider_id)
           VALUES ($1, $2, $3)`,
          [user.id, input.provider, input.providerId ?? null],
        );
      }

      await client.query("COMMIT");

      return {
        ...user,
        firstName: input.firstName,
        lastName: input.lastName,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [
      id,
    ]);
  }

  async updateTier(id: string, tier: "free" | "premium"): Promise<void> {
    await db.query(`UPDATE users SET tier = $1 WHERE id = $2`, [tier, id]);
  }

  async softDelete(id: string): Promise<void> {
    await db.query(
      `UPDATE users SET deleted_at = NOW(), is_active = FALSE WHERE id = $1`,
      [id],
    );
  }

  async linkGoogleAccount(userId: string, googleId: string): Promise<void> {
    await db.query(
      `INSERT INTO user_auth_providers (user_id, provider, provider_id)
       VALUES ($1, 'google', $2)
       ON CONFLICT (user_id, provider) DO UPDATE SET provider_id = $2`,
      [userId, googleId],
    );
  }

  async hasProvider(
    userId: string,
    provider: "email" | "google",
  ): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM user_auth_providers
       WHERE user_id = $1 AND provider = $2`,
      [userId, provider],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async hardDeleteUnverified(id: string): Promise<void> {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM user_email_tokens WHERE user_id = $1`, [
        id,
      ]);
      await client.query(`DELETE FROM user_refresh_tokens WHERE user_id = $1`, [
        id,
      ]);
      await client.query(`DELETE FROM user_auth_providers WHERE user_id = $1`, [
        id,
      ]);
      const personResult = await client.query(
        `SELECT person_id FROM users WHERE id = $1`,
        [id],
      );
      await client.query(`DELETE FROM users WHERE id = $1`, [id]);
      if (personResult.rows[0]) {
        await client.query(`DELETE FROM persons WHERE id = $1`, [
          personResult.rows[0].person_id,
        ]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getWeeklyCount(userId: string): Promise<number> {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const result = await db.query(
      `INSERT INTO user_calculation_counters (user_id, week_start, count)
     VALUES ($1, $2, 0)
     ON CONFLICT (user_id) DO UPDATE
       SET week_start = CASE
         WHEN user_calculation_counters.week_start < $2
         THEN $2
         ELSE user_calculation_counters.week_start
       END,
       count = CASE
         WHEN user_calculation_counters.week_start < $2
         THEN 0
         ELSE user_calculation_counters.count
       END
     RETURNING count, week_start`,
      [userId, weekStart.toISOString().split("T")[0]],
    );
    return result.rows[0]?.count ?? 0;
  }

  async incrementWeeklyCount(userId: string): Promise<void> {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    await db.query(
      `INSERT INTO user_calculation_counters (user_id, week_start, count)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id) DO UPDATE
       SET count = user_calculation_counters.count + 1,
           updated_at = NOW()`,
      [userId, weekStart.toISOString().split("T")[0]],
    );
  }

  async getAnonymousWeeklyCount(ip: string): Promise<number> {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const result = await db.query(
      `INSERT INTO anonymous_calculation_counters (ip_address, week_start, count)
     VALUES ($1, $2, 0)
     ON CONFLICT (ip_address) DO UPDATE
       SET week_start = CASE
         WHEN anonymous_calculation_counters.week_start < $2
         THEN $2
         ELSE anonymous_calculation_counters.week_start
       END,
       count = CASE
         WHEN anonymous_calculation_counters.week_start < $2
         THEN 0
         ELSE anonymous_calculation_counters.count
       END
     RETURNING count`,
      [ip, weekStart.toISOString().split("T")[0]],
    );
    return result.rows[0]?.count ?? 0;
  }

  async incrementAnonymousCount(ip: string): Promise<void> {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    await db.query(
      `INSERT INTO anonymous_calculation_counters (ip_address, week_start, count)
     VALUES ($1, $2, 1)
     ON CONFLICT (ip_address) DO UPDATE
       SET count = anonymous_calculation_counters.count + 1,
           updated_at = NOW()`,
      [ip, weekStart.toISOString().split("T")[0]],
    );
  }
  async findAll(
    limit: number,
    offset: number,
    filters?: { role?: string; tier?: string; isActive?: boolean },
  ): Promise<UserRecord[]> {
    const conditions: string[] = ["u.deleted_at IS NULL"];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters?.role) {
      conditions.push(`u.role = $${paramIdx++}`);
      params.push(filters.role);
    }
    if (filters?.tier) {
      conditions.push(`u.tier = $${paramIdx++}`);
      params.push(filters.tier);
    }
    if (filters?.isActive !== undefined) {
      conditions.push(`u.is_active = $${paramIdx++}`);
      params.push(filters.isActive);
    }

    params.push(limit, offset);

    const result = await db.query(
      `SELECT u.id, u.person_id as "personId", u.email,
            u.email_verified as "emailVerified",
            u.role, u.tier,
            u.is_active as "isActive",
            u.created_at as "createdAt",
            u.updated_at as "updatedAt",
            u.last_login_at as "lastLoginAt",
            u.deleted_at as "deletedAt",
            p.first_name as "firstName",
            p.last_name as "lastName"
     FROM users u
     JOIN persons p ON p.id = u.person_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY u.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params,
    );
    return result.rows;
  }

  async countAll(filters?: {
    role?: string;
    tier?: string;
    isActive?: boolean;
  }): Promise<number> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters?.role) {
      conditions.push(`role = $${paramIdx++}`);
      params.push(filters.role);
    }
    if (filters?.tier) {
      conditions.push(`tier = $${paramIdx++}`);
      params.push(filters.tier);
    }
    if (filters?.isActive !== undefined) {
      conditions.push(`is_active = $${paramIdx++}`);
      params.push(filters.isActive);
    }

    const result = await db.query(
      `SELECT COUNT(*) as count FROM users WHERE ${conditions.join(" AND ")}`,
      params,
    );
    return parseInt(result.rows[0]?.count ?? "0");
  }

  async activate(id: string): Promise<void> {
    await db.query(
      `UPDATE users SET is_active = TRUE, deleted_at = NULL WHERE id = $1`,
      [id],
    );
  }
}
