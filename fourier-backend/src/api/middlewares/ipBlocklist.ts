/**
 * IP Blocklist middleware
 *
 * Consulta la tabla ip_blocks antes de que el request llegue a los
 * rate-limiters o a cualquier lógica de negocio. Si la IP está suspendida
 * responde 403 inmediatamente; de lo contrario deja pasar con next().
 *
 * Cache en memoria con TTL configurable (por defecto 60 s) para no golpear
 * la DB en cada request. El cache se invalida entrada por entrada cuando el
 * admin desbloquea una IP vía el endpoint correspondiente, por lo que el
 * tiempo efectivo de propagación es ≤ CACHE_TTL_MS en el peor caso.
 *
 * Diseño de seguridad:
 *  - Solo bloquea IPs con blocked_until > NOW() o blocked_until IS NULL.
 *  - Si la DB falla, el middleware deja pasar (fail-open) para no tirar el
 *    servicio por un problema de infraestructura.
 *  - Los errores de DB se loguean pero nunca propagan al cliente.
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "../../infrastructure/database/db";
import { logger } from "../../infrastructure/logging/logger";
import { config } from "../../config/env";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface IpBlockEntry {
  id: string;
  ip_address: string;
  reason: string;
  blocked_by: "auto" | "admin";
  blocked_until: Date | null;
  created_at: Date;
}

interface CacheEntry {
  blocked: boolean;
  record: IpBlockEntry | null;
  cachedAt: number; // Date.now()
}

// ── Cache en memoria ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = config.ipBlocklist?.cacheTtlMs ?? 60_000;
const cache = new Map<string, CacheEntry>();

/** Normaliza una IP a string canónico para usarla como clave de cache. */
function normalizeIp(ip: string): string {
  // Express ya normaliza req.ip, pero por si acaso limpiamos espacios
  return ip.trim().toLowerCase();
}

/**
 * Invalida una entrada del cache. Se llama desde los endpoints admin cuando
 * bloquean o desbloquean una IP para que el cambio surta efecto de inmediato
 * sin esperar el TTL.
 */
export function invalidateCacheEntry(ip: string): void {
  cache.delete(normalizeIp(ip));
}

/** Purga entradas expiradas del cache (lo llama el autoBlocker periódicamente). */
export function purgeCacheExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

// ── Consulta a la DB ──────────────────────────────────────────────────────────

async function queryBlockStatus(ip: string): Promise<IpBlockEntry | null> {
  const result = await db.query<IpBlockEntry>(
    `SELECT id, ip_address::text, reason, blocked_by, blocked_until, created_at
     FROM ip_blocks
     WHERE ip_address = $1::inet
       AND released_at IS NULL
       AND (blocked_until IS NULL OR blocked_until > NOW())
     ORDER BY created_at DESC
     LIMIT 1`,
    [ip],
  );
  return result.rows[0] ?? null;
}

async function isIpBlocked(ip: string): Promise<IpBlockEntry | null> {
  const key = normalizeIp(ip);
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.record;
  }

  try {
    const record = await queryBlockStatus(ip);
    cache.set(key, { blocked: record !== null, record, cachedAt: now });
    return record;
  } catch (err) {
    // Fail-open: si la DB no responde no bloqueamos al usuario
    logger.error({ err, ip }, "ipBlocklist: DB query failed, failing open");
    return null;
  }
}

// ── Middleware principal ──────────────────────────────────────────────────────

export async function ipBlocklistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const ip = req.ip ?? req.socket?.remoteAddress;

  // Sin IP no podemos evaluar nada — dejamos pasar
  if (!ip) {
    next();
    return;
  }

  const block = await isIpBlocked(ip);

  if (!block) {
    next();
    return;
  }

  const retryAfter =
    block.blocked_until
      ? Math.max(0, Math.ceil((block.blocked_until.getTime() - Date.now()) / 1000))
      : null;

  logger.warn(
    {
      event: "ip_block_enforced",
      ip,
      blockId: block.id,
      blockedBy: block.blocked_by,
      blockedUntil: block.blocked_until,
      reason: block.reason,
    },
    "Request blocked by IP blocklist",
  );

  res.status(403).json({
    error: "Your IP has been temporarily suspended due to excessive requests.",
    ...(retryAfter !== null && {
      retryAfterSeconds: retryAfter,
      retryAfterMinutes: Math.ceil(retryAfter / 60),
    }),
  });
}

// ── Helpers para el autoBlocker y las rutas admin ─────────────────────────────

/**
 * Registra un bloqueo nuevo en la DB.
 * Si ya existe un bloqueo activo para esa IP, no crea un duplicado.
 * Devuelve el registro creado, o null si ya existía uno activo.
 */
export async function blockIp(params: {
  ip: string;
  reason: string;
  blockedBy: "auto" | "admin";
  blockedUntil: Date | null;   // null = permanente
  adminUserId?: string;
}): Promise<IpBlockEntry | null> {
  // Evitar duplicar bloqueos activos para la misma IP
  const existing = await queryBlockStatus(params.ip);
  if (existing) {
    return null; // ya está bloqueada
  }

  const result = await db.query<IpBlockEntry>(
    `INSERT INTO ip_blocks (ip_address, reason, blocked_by, blocked_until, admin_user_id)
     VALUES ($1::inet, $2, $3, $4, $5)
     RETURNING id, ip_address::text, reason, blocked_by, blocked_until, created_at`,
    [
      params.ip,
      params.reason,
      params.blockedBy,
      params.blockedUntil,
      params.adminUserId ?? null,
    ],
  );

  const record = result.rows[0];
  if (record) {
    invalidateCacheEntry(params.ip);
  }
  return record ?? null;
}

/**
 * Libera un bloqueo activo.
 * Devuelve true si se liberó algún registro, false si no había nada activo.
 */
export async function unblockIp(
  ip: string,
  releasedBy: "expired" | "admin",
): Promise<boolean> {
  const result = await db.query(
    `UPDATE ip_blocks
     SET released_at = NOW(), released_by = $2
     WHERE ip_address = $1::inet
       AND released_at IS NULL
       AND (blocked_until IS NULL OR blocked_until > NOW())`,
    [ip, releasedBy],
  );

  invalidateCacheEntry(ip);
  return (result.rowCount ?? 0) > 0;
}
