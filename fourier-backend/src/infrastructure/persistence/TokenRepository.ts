import { db } from "../database/db";
import type {
  ITokenRepository,
  RefreshTokenRecord,
} from "../../domain/interfaces/repositories/ITokenRepository";

export class TokenRepository implements ITokenRepository {
  async createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const result = await db.query<RefreshTokenRecord>(
      `INSERT INTO user_refresh_tokens
         (user_id, token_hash, family_id, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.userId,
        input.tokenHash,
        input.familyId,
        input.ipAddress ?? null,
        input.userAgent ?? null,
        input.expiresAt,
      ],
    );
    return result.rows[0]!;
  }

  async findRefreshToken(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    const result = await db.query<RefreshTokenRecord>(
      `SELECT * FROM user_refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async rotateRefreshToken(
    oldId: string,
    newTokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshTokenRecord> {
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const old = await client.query<RefreshTokenRecord>(
        `SELECT * FROM user_refresh_tokens WHERE id = $1`,
        [oldId],
      );
      const oldToken = old.rows[0]!;

      const newToken = await client.query<RefreshTokenRecord>(
        `INSERT INTO user_refresh_tokens
           (user_id, token_hash, family_id, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [oldToken.userId, newTokenHash, oldToken.familyId, expiresAt],
      );

      await client.query(
        `UPDATE user_refresh_tokens
         SET revoked_at = NOW(), replaced_by = $1
         WHERE id = $2`,
        [newToken.rows[0]!.id, oldId],
      );

      await client.query("COMMIT");
      return newToken.rows[0]!;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    await db.query(
      `UPDATE user_refresh_tokens
       SET revoked_at = NOW()
       WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId],
    );
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await db.query(
      `UPDATE user_refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  async createEmailToken(input: {
    userId: string;
    tokenHash: string;
    purpose: string;
    expiresAt: Date;
  }): Promise<void> {
    await db.query(
      `INSERT INTO user_email_tokens (user_id, token_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [input.userId, input.tokenHash, input.purpose, input.expiresAt],
    );
  }

  async findEmailToken(
    tokenHash: string,
    purpose: string,
  ): Promise<{
    id: string;
    userId: string;
    usedAt: Date | null;
    expiresAt: Date;
  } | null> {
    const result = await db.query(
      `SELECT id, user_id as "userId", used_at as "usedAt", expires_at as "expiresAt"
       FROM user_email_tokens
       WHERE token_hash = $1 AND purpose = $2`,
      [tokenHash, purpose],
    );
    return result.rows[0] ?? null;
  }

  async markEmailTokenUsed(id: string): Promise<void> {
    await db.query(
      `UPDATE user_email_tokens SET used_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async createPasswordReset(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await db.query(
      `INSERT INTO user_password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [input.userId, input.tokenHash, input.expiresAt],
    );
  }

  async findPasswordReset(
    tokenHash: string,
  ): Promise<{
    id: string;
    userId: string;
    usedAt: Date | null;
    expiresAt: Date;
  } | null> {
    const result = await db.query(
      `SELECT id, user_id as "userId", used_at as "usedAt", expires_at as "expiresAt"
       FROM user_password_resets
       WHERE token_hash = $1`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async markPasswordResetUsed(id: string): Promise<void> {
    await db.query(
      `UPDATE user_password_resets SET used_at = NOW() WHERE id = $1`,
      [id],
    );
  }
}
