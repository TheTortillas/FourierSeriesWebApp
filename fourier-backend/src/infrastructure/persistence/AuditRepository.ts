import { db } from "../database/db";
import type {
  IAuditRepository,
  AuditLogInput,
  AuditAction,
  AuditFilters,
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

  async findAll(limit = 100, offset = 0, filters?: AuditFilters): Promise<AuditLogInput[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (filters?.action)        { conditions.push(`action = $${p++}`);                                        params.push(filters.action); }
    if (filters?.userId)        { conditions.push(`user_id = $${p++}`);                                       params.push(filters.userId); }
    if (filters?.ip)            { conditions.push(`ip_address = $${p++}::inet`);                              params.push(filters.ip); }
    if (filters?.anonymousOnly) { conditions.push(`user_id IS NULL`); }
    if (filters?.dateFrom)      { conditions.push(`created_at >= $${p++}`);                                   params.push(filters.dateFrom); }
    if (filters?.dateTo)        { conditions.push(`created_at < $${p++}::date + '1 day'::interval`);          params.push(filters.dateTo); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const result = await db.query(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${p++} OFFSET $${p}`,
      params,
    );
    return result.rows.map(mapRow);
  }

  async countAll(filters?: AuditFilters): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (filters?.action)        { conditions.push(`action = $${p++}`);                                        params.push(filters.action); }
    if (filters?.userId)        { conditions.push(`user_id = $${p++}`);                                       params.push(filters.userId); }
    if (filters?.ip)            { conditions.push(`ip_address = $${p++}::inet`);                              params.push(filters.ip); }
    if (filters?.anonymousOnly) { conditions.push(`user_id IS NULL`); }
    if (filters?.dateFrom)      { conditions.push(`created_at >= $${p++}`);                                   params.push(filters.dateFrom); }
    if (filters?.dateTo)        { conditions.push(`created_at < $${p++}::date + '1 day'::interval`);          params.push(filters.dateTo); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await db.query(`SELECT COUNT(*) FROM audit_log ${where}`, params);
    return parseInt(result.rows[0].count, 10);
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
