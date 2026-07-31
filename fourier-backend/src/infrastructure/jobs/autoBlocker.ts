/**
 * autoBlocker — worker de detección automática de IPs abusivas
 *
 * Se ejecuta cada IP_BLOCKER_INTERVAL_MS (por defecto 5 minutos) y analiza
 * el audit_log buscando IPs con patrones de abuso. Cuando una IP supera los
 * umbrales configura un bloqueo temporal en ip_blocks via blockIp().
 *
 * Umbrales por defecto (ajustables en .env):
 *   - Nivel 1 (short ban):  ≥ 200 bloqueos por rate-limit en los últimos 15 min → ban 2 h
 *   - Nivel 2 (long ban):   ≥ 500 bloqueos por rate-limit en la última hora    → ban 24 h
 *
 * El worker es "fire and forget": se llama con startAutoBlocker() al arrancar
 * la app y corre indefinidamente con setInterval. Si falla en una iteración
 * loguea el error y espera el siguiente tick sin morir.
 *
 * Por qué los umbrales son tan altos:
 *   Los rate-limiters ya cortan el tráfico legítimo mucho antes. Un usuario
 *   humano detrás de NAT nunca acumula 200 bloqueos en 15 min — eso requiere
 *   un script automatizado. El auto-bloqueo añade la capa defensiva solo para
 *   abuso claro, evitando falsos positivos sobre IPs compartidas.
 */

import { db } from "../database/db";
import { logger } from "../logging/logger";
import { blockIp, unblockIp, purgeCacheExpired } from "../../api/middlewares/ipBlocklist";
import { config } from "../../config/env";

// ── Configuración ─────────────────────────────────────────────────────────────

const INTERVAL_MS      = config.ipBlocklist?.autoBlockerIntervalMs ?? 5 * 60_000;

// Nivel 1: muchos bloqueos en poco tiempo (ráfaga de bot)
const SHORT_WINDOW_MIN = config.ipBlocklist?.shortWindowMin  ?? 15;
const SHORT_THRESHOLD  = config.ipBlocklist?.shortThreshold  ?? 200;
const SHORT_BAN_H      = config.ipBlocklist?.shortBanHours   ?? 2;

// Nivel 2: abuso sostenido durante más tiempo
const LONG_WINDOW_MIN  = config.ipBlocklist?.longWindowMin   ?? 60;
const LONG_THRESHOLD   = config.ipBlocklist?.longThreshold   ?? 500;
const LONG_BAN_H       = config.ipBlocklist?.longBanHours    ?? 24;

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60_000);
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** IPs que superaron el umbral de nivel 2 (abuso sostenido). */
async function findLongBanCandidates(): Promise<string[]> {
  const result = await db.query<{ ip_address: string }>(
    `SELECT ip_address::text
     FROM audit_log
     WHERE action = 'rate_limit_blocked'
       AND ip_address IS NOT NULL
       AND created_at >= NOW() - ($1 || ' minutes')::interval
     GROUP BY ip_address
     HAVING COUNT(*) >= $2`,
    [LONG_WINDOW_MIN, LONG_THRESHOLD],
  );
  return result.rows.map((r) => r.ip_address);
}

/** IPs que superaron el umbral de nivel 1 (ráfaga corta). */
async function findShortBanCandidates(): Promise<string[]> {
  const result = await db.query<{ ip_address: string }>(
    `SELECT ip_address::text
     FROM audit_log
     WHERE action = 'rate_limit_blocked'
       AND ip_address IS NOT NULL
       AND created_at >= NOW() - ($1 || ' minutes')::interval
     GROUP BY ip_address
     HAVING COUNT(*) >= $2`,
    [SHORT_WINDOW_MIN, SHORT_THRESHOLD],
  );
  return result.rows.map((r) => r.ip_address);
}

/** IPs bloqueadas cuyo blocked_until ya venció — para marcarlas como liberadas. */
async function findExpiredBlocks(): Promise<string[]> {
  const result = await db.query<{ ip_address: string }>(
    `SELECT DISTINCT ip_address::text
     FROM ip_blocks
     WHERE released_at IS NULL
       AND blocked_until IS NOT NULL
       AND blocked_until <= NOW()`,
  );
  return result.rows.map((r) => r.ip_address);
}

// ── Iteración principal ───────────────────────────────────────────────────────

async function runBlockerTick(): Promise<void> {
  // 1. Liberar bloqueos expirados
  const expired = await findExpiredBlocks();
  for (const ip of expired) {
    try {
      const released = await unblockIp(ip, "expired");
      if (released) {
        logger.info({ event: "ip_auto_released", ip }, "IP block expired, released");
      }
    } catch (err) {
      logger.error({ err, ip }, "autoBlocker: failed to release expired block");
    }
  }

  // 2. Detectar candidatos a ban largo (nivel 2) — tiene prioridad
  const longCandidates = await findLongBanCandidates();
  const longSet = new Set(longCandidates);

  for (const ip of longCandidates) {
    try {
      const record = await blockIp({
        ip,
        reason: `auto: ≥${LONG_THRESHOLD} rate_limit_blocked in ${LONG_WINDOW_MIN} min`,
        blockedBy: "auto",
        blockedUntil: hoursFromNow(LONG_BAN_H),
      });
      if (record) {
        logger.warn(
          { event: "ip_auto_blocked", ip, level: 2, banHours: LONG_BAN_H },
          "IP auto-blocked (level 2 — sustained abuse)",
        );
      }
    } catch (err) {
      logger.error({ err, ip }, "autoBlocker: failed to block IP (level 2)");
    }
  }

  // 3. Detectar candidatos a ban corto (nivel 1) — solo si no cayeron en nivel 2
  const shortCandidates = await findShortBanCandidates();

  for (const ip of shortCandidates) {
    if (longSet.has(ip)) continue; // ya fue procesada con ban más largo

    try {
      const record = await blockIp({
        ip,
        reason: `auto: ≥${SHORT_THRESHOLD} rate_limit_blocked in ${SHORT_WINDOW_MIN} min`,
        blockedBy: "auto",
        blockedUntil: hoursFromNow(SHORT_BAN_H),
      });
      if (record) {
        logger.warn(
          { event: "ip_auto_blocked", ip, level: 1, banHours: SHORT_BAN_H },
          "IP auto-blocked (level 1 — burst abuse)",
        );
      }
    } catch (err) {
      logger.error({ err, ip }, "autoBlocker: failed to block IP (level 1)");
    }
  }

  // 4. Purgar entradas viejas del cache en memoria del middleware
  purgeCacheExpired();
}

// ── Arranque ──────────────────────────────────────────────────────────────────

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startAutoBlocker(): void {
  if (intervalHandle) return; // ya corriendo

  logger.info(
    {
      intervalMs: INTERVAL_MS,
      shortBan: { windowMin: SHORT_WINDOW_MIN, threshold: SHORT_THRESHOLD, banHours: SHORT_BAN_H },
      longBan:  { windowMin: LONG_WINDOW_MIN,  threshold: LONG_THRESHOLD,  banHours: LONG_BAN_H  },
    },
    "autoBlocker started",
  );

  // Primera ejecución inmediata al arrancar (evalúa el estado actual de la DB)
  runBlockerTick().catch((err) =>
    logger.error({ err }, "autoBlocker: initial tick failed"),
  );

  intervalHandle = setInterval(() => {
    runBlockerTick().catch((err) =>
      logger.error({ err }, "autoBlocker: tick failed"),
    );
  }, INTERVAL_MS);

  // Evitar que el interval mantenga vivo el proceso si todo lo demás terminó
  if (intervalHandle.unref) intervalHandle.unref();
}

export function stopAutoBlocker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info("autoBlocker stopped");
  }
}
