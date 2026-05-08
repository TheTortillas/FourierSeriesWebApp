import { db } from "../database/db";
import { computeInputHash } from "./inputHash";
import type {
  IHistoryRepository,
  HistoryRecord,
  CalculationType,
} from "../../domain/interfaces/repositories/IHistoryRepository";

// ─── Columnas comunes ────────────────────────────────────────────────────────
// Reutilizadas en todos los SELECT para mantener consistencia.

const EVENT_COLS = `
  ce.id,
  ce.user_id              AS "userId",
  ce.ip_address           AS "ipAddress",
  c.type,
  c.input,
  ce.is_favorite          AS "isFavorite",
  ce.favorite_name        AS "favoriteName",
  ce.execution_ms         AS "executionMs",
  ce.count,
  ce.first_calculated_at  AS "firstCalculatedAt",
  ce.last_calculated_at   AS "createdAt"
`;

const EVENT_JOIN = `
  FROM calculation_events ce
  JOIN calculations c ON c.id = ce.calculation_id
`;

// ─── Filtros para admin ──────────────────────────────────────────────────────

function buildHistoryConditions(filters?: {
  userId?: string;
  type?: string;
  anonymousOnly?: boolean;
  favoritesOnly?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  minExecutionMs?: number;
}): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (filters?.userId)        { conditions.push(`ce.user_id = $${p++}`);                                    params.push(filters.userId); }
  if (filters?.type)          { conditions.push(`c.type = $${p++}`);                                        params.push(filters.type); }
  if (filters?.anonymousOnly) { conditions.push(`ce.user_id IS NULL`); }
  if (filters?.favoritesOnly) { conditions.push(`ce.is_favorite = TRUE`); }
  if (filters?.dateFrom)      { conditions.push(`ce.last_calculated_at >= $${p++}`);                        params.push(filters.dateFrom); }
  if (filters?.dateTo)        { conditions.push(`ce.last_calculated_at < $${p++}::date + '1 day'::interval`); params.push(filters.dateTo); }
  if (filters?.minExecutionMs !== undefined) { conditions.push(`ce.execution_ms >= $${p++}`);               params.push(filters.minExecutionMs); }

  return { conditions, params };
}

// ─── Repositorio ─────────────────────────────────────────────────────────────

export class HistoryRepository implements IHistoryRepository {
  /**
   * Registra un cálculo usando upsert en dos tablas:
   *   1. calculations      → una fila por input único (deduplicado globalmente)
   *   2. calculation_events → una fila por (cálculo × usuario/IP), con contador
   *
   * Si el mismo usuario recalcula la misma función, solo se incrementa
   * `count` y se actualiza `last_calculated_at`.
   */
  async create(input: {
    userId?: string;
    ipAddress?: string;
    type: CalculationType;
    input: Record<string, unknown>;
    executionMs?: number;
  }): Promise<HistoryRecord> {
    const hash = computeInputHash(input.type, input.input);

    // ── Paso 1: Upsert en tabla canónica ────────────────────────────────────
    // DO UPDATE SET con un campo igual a sí mismo es el truco estándar de
    // PostgreSQL para obtener el id de la fila existente via RETURNING.
    const calcResult = await db.query<{ id: string }>(
      `INSERT INTO calculations (input_hash, type, input)
       VALUES ($1, $2, $3)
       ON CONFLICT (input_hash) DO UPDATE
         SET input_hash = EXCLUDED.input_hash
       RETURNING id`,
      [hash, input.type, JSON.stringify(input.input)],
    );
    const calcId = calcResult.rows[0]!.id;

    // ── Paso 2: Upsert en tabla de eventos (por usuario o por IP) ───────────
    // RETURNING en INSERT no soporta JOIN, así que recuperamos las columnas
    // del evento directamente y completamos type+input desde el paso 1.
    const EVENT_RETURNING = `
      RETURNING
        id,
        user_id             AS "userId",
        ip_address          AS "ipAddress",
        is_favorite         AS "isFavorite",
        favorite_name       AS "favoriteName",
        execution_ms        AS "executionMs",
        count,
        first_calculated_at AS "firstCalculatedAt",
        last_calculated_at  AS "createdAt"
    `;

    let eventRow: Record<string, unknown>;

    if (input.userId) {
      const r = await db.query(
        `INSERT INTO calculation_events (calculation_id, user_id, execution_ms)
         VALUES ($1, $2, $3)
         ON CONFLICT (calculation_id, user_id) WHERE user_id IS NOT NULL
         DO UPDATE SET
           count              = calculation_events.count + 1,
           last_calculated_at = NOW(),
           execution_ms       = EXCLUDED.execution_ms
         ${EVENT_RETURNING}`,
        [calcId, input.userId, input.executionMs ?? null],
      );
      eventRow = r.rows[0]!;
    } else {
      const r = await db.query(
        `INSERT INTO calculation_events (calculation_id, ip_address, execution_ms)
         VALUES ($1, $2, $3)
         ON CONFLICT (calculation_id, ip_address)
           WHERE user_id IS NULL AND ip_address IS NOT NULL
         DO UPDATE SET
           count              = calculation_events.count + 1,
           last_calculated_at = NOW(),
           execution_ms       = EXCLUDED.execution_ms
         ${EVENT_RETURNING}`,
        [calcId, input.ipAddress ?? null, input.executionMs ?? null],
      );
      eventRow = r.rows[0]!;
    }

    // Completamos con type e input que ya tenemos del paso 1.
    return { ...eventRow, type: input.type, input: input.input } as HistoryRecord;
  }

  async findByUser(
    userId: string,
    limit: number,
    offset: number,
    favoritesOnly = false,
  ): Promise<HistoryRecord[]> {
    const result = await db.query(
      `SELECT ${EVENT_COLS}
       ${EVENT_JOIN}
       WHERE ce.user_id = $1
         ${favoritesOnly ? "AND ce.is_favorite = TRUE" : ""}
       ORDER BY ce.last_calculated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return result.rows;
  }

  async findById(id: string): Promise<HistoryRecord | null> {
    const result = await db.query(
      `SELECT ${EVENT_COLS}
       ${EVENT_JOIN}
       WHERE ce.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async toggleFavorite(
    id: string,
    userId: string,
    name?: string,
  ): Promise<HistoryRecord> {
    // Actualiza solo el evento; luego re-lee con JOIN para devolver el record completo.
    const updated = await db.query<{ isFavorite: boolean }>(
      `UPDATE calculation_events
       SET
         is_favorite  = NOT is_favorite,
         favorite_name = CASE
           WHEN NOT is_favorite THEN $3
           ELSE NULL
         END
       WHERE id = $1 AND user_id = $2
       RETURNING is_favorite AS "isFavorite"`,
      [id, userId, name ?? null],
    );
    if (!updated.rows[0]) throw new Error("History entry not found");

    const result = await db.query(
      `SELECT ${EVENT_COLS}
       ${EVENT_JOIN}
       WHERE ce.id = $1`,
      [id],
    );
    return result.rows[0]!;
  }

  async renameFavorite(
    id: string,
    userId: string,
    name: string | undefined,
  ): Promise<HistoryRecord> {
    const updated = await db.query<{ rowCount: number }>(
      `UPDATE calculation_events
       SET favorite_name = $3
       WHERE id = $1 AND user_id = $2 AND is_favorite = TRUE`,
      [id, userId, name ?? null],
    );
    if ((updated.rowCount ?? 0) === 0) throw new Error("History entry not found");

    const result = await db.query(
      `SELECT ${EVENT_COLS}
       ${EVENT_JOIN}
       WHERE ce.id = $1`,
      [id],
    );
    return result.rows[0]!;
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await db.query(
      `DELETE FROM calculation_events WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if ((result.rowCount ?? 0) === 0) throw new Error("History entry not found");
    // La fila en `calculations` se conserva intencionalmente:
    // es un registro canónico compartido que puede tener otros eventos.
  }

  async countByUser(userId: string, favoritesOnly = false): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) AS count
       FROM calculation_events
       WHERE user_id = $1
         ${favoritesOnly ? "AND is_favorite = TRUE" : ""}`,
      [userId],
    );
    return parseInt(result.rows[0]?.count ?? "0");
  }

  async findAll(
    limit: number,
    offset: number,
    filters?: {
      userId?: string;
      type?: string;
      anonymousOnly?: boolean;
      favoritesOnly?: boolean;
      dateFrom?: Date;
      dateTo?: Date;
      minExecutionMs?: number;
    },
  ): Promise<HistoryRecord[]> {
    const { conditions, params } = buildHistoryConditions(filters);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    let p = params.length + 1;
    params.push(limit, offset);

    const result = await db.query(
      `SELECT ${EVENT_COLS}
       ${EVENT_JOIN}
       ${where}
       ORDER BY ce.last_calculated_at DESC
       LIMIT $${p++} OFFSET $${p}`,
      params,
    );
    return result.rows;
  }

  async countAll(filters?: {
    userId?: string;
    type?: string;
    anonymousOnly?: boolean;
    favoritesOnly?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    minExecutionMs?: number;
  }): Promise<number> {
    const { conditions, params } = buildHistoryConditions(filters);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query(
      `SELECT COUNT(*) AS count
       ${EVENT_JOIN}
       ${where}`,
      params,
    );
    return parseInt(result.rows[0]?.count ?? "0");
  }
}
