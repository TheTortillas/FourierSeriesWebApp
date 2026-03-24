import { db } from "../database/db";
import type {
  IAuditRepository,
  AuditLogInput,
  AuditAction,
} from "../../domain/interfaces/repositories/IAuditRepository";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): AuditLogInput {
  return {
    id:         row.id,
    userId:     row.user_id,
    action:     row.action,
    targetType: row.target_type,
    targetId:   row.target_id,
    metadata:   row.metadata,
    ipAddress:  row.ip_address,
    createdAt:  row.created_at,
  };
}

export class AuditRepository implements IAuditRepository {
  async log(input: AuditLogInput): Promise<void> {
    await db.query(
      `INSERT INTO audit_log
         (user_id, action, target_type, target_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.userId ?? null,
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.ipAddress ?? null,
      ],
    );
  }

  async findByUser(userId: string, limit = 50): Promise<AuditLogInput[]> {
    const result = await db.query(
      `SELECT * FROM audit_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map(mapRow);
  }

  async findAll(limit = 100, offset = 0): Promise<AuditLogInput[]> {
    const result = await db.query(
      `SELECT * FROM audit_log
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows.map(mapRow);
  }

  async clearByAction(
    action: AuditAction,
    olderThanDays: number,
  ): Promise<number> {
    const result = await db.query(
      `DELETE FROM audit_log
       WHERE action = $1
         AND created_at < NOW() - INTERVAL '1 day' * $2`,
      [action, olderThanDays],
    );
    return result.rowCount ?? 0;
  }
}
