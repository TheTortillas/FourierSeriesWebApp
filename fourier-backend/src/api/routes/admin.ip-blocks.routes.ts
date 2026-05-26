/**
 * Rutas admin para el IP blocklist
 *
 * Todas protegidas por authenticate + requireAdmin (aplicado en adminRouter).
 *
 * GET    /api/admin/ip-blocks          — lista paginada con filtros
 * GET    /api/admin/ip-blocks/active   — solo los activos ahora mismo
 * POST   /api/admin/ip-blocks          — bloquear una IP manualmente
 * DELETE /api/admin/ip-blocks/:ip      — desbloquear una IP
 */

import { Router, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { blockIp, unblockIp } from "../middlewares/ipBlocklist";
import { db } from "../../infrastructure/database/db";
import { auditRepository } from "../../infrastructure/container";

export const ipBlocksRouter = Router();

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface IpBlockRow {
  id: string;
  ip_address: string;
  reason: string;
  blocked_by: "auto" | "admin";
  blocked_until: string | null;
  admin_user_id: string | null;
  created_at: string;
  released_at: string | null;
  released_by: "expired" | "admin" | null;
  is_active: boolean;
}

// ── GET /api/admin/ip-blocks ──────────────────────────────────────────────────

/**
 * @openapi
 * /api/admin/ip-blocks:
 *   get:
 *     summary: Listar historial del IP blocklist
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: ip
 *         schema: { type: string }
 *         description: Filtrar por IP exacta
 *       - in: query
 *         name: activeOnly
 *         schema: { type: boolean }
 *         description: Solo bloqueos activos en este momento
 *       - in: query
 *         name: blockedBy
 *         schema: { type: string, enum: [auto, admin] }
 *     responses:
 *       200:
 *         description: Lista paginada de registros
 */
ipBlocksRouter.get(
  "/",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const limit      = Math.min(parseInt(String(req.query["limit"]  ?? "50")), 200);
      const offset     = parseInt(String(req.query["offset"] ?? "0"));
      const ip         = req.query["ip"]         ? String(req.query["ip"])         : null;
      const blockedBy  = req.query["blockedBy"]  ? String(req.query["blockedBy"])  : null;
      const activeOnly = req.query["activeOnly"] === "true";

      const conditions: string[] = [];
      const params: unknown[]    = [];
      let p = 1;

      if (ip) {
        conditions.push(`ip_address = $${p++}::inet`);
        params.push(ip);
      }
      if (blockedBy && ["auto", "admin"].includes(blockedBy)) {
        conditions.push(`blocked_by = $${p++}`);
        params.push(blockedBy);
      }
      if (activeOnly) {
        conditions.push(
          `released_at IS NULL AND (blocked_until IS NULL OR blocked_until > NOW())`,
        );
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [dataResult, countResult] = await Promise.all([
        db.query<IpBlockRow>(
          `SELECT
             id,
             ip_address::text,
             reason,
             blocked_by,
             blocked_until,
             admin_user_id,
             created_at,
             released_at,
             released_by,
             (released_at IS NULL AND (blocked_until IS NULL OR blocked_until > NOW())) AS is_active
           FROM ip_blocks
           ${where}
           ORDER BY created_at DESC
           LIMIT $${p} OFFSET $${p + 1}`,
          [...params, limit, offset],
        ),
        db.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM ip_blocks ${where}`,
          params,
        ),
      ]);

      res.json({
        total:   countResult.rows[0]?.total ?? 0,
        limit,
        offset,
        entries: dataResult.rows,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/admin/ip-blocks/active ──────────────────────────────────────────

/**
 * @openapi
 * /api/admin/ip-blocks/active:
 *   get:
 *     summary: IPs bloqueadas en este momento
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de bloqueos activos
 */
ipBlocksRouter.get(
  "/active",
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await db.query<IpBlockRow>(
        `SELECT
           id,
           ip_address::text,
           reason,
           blocked_by,
           blocked_until,
           admin_user_id,
           created_at,
           released_at,
           released_by,
           TRUE AS is_active
         FROM ip_blocks_active
         ORDER BY created_at DESC`,
      );

      res.json({ entries: result.rows, total: result.rowCount ?? 0 });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/admin/ip-blocks — bloqueo manual ────────────────────────────────

/**
 * @openapi
 * /api/admin/ip-blocks:
 *   post:
 *     summary: Bloquear una IP manualmente
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ip, reason]
 *             properties:
 *               ip:
 *                 type: string
 *                 example: "45.65.200.6"
 *               reason:
 *                 type: string
 *                 example: "Abuso manual detectado en logs"
 *               durationHours:
 *                 type: number
 *                 description: Duración en horas. Omitir para bloqueo permanente.
 *                 example: 48
 *     responses:
 *       201:
 *         description: IP bloqueada
 *       409:
 *         description: La IP ya tiene un bloqueo activo
 *       400:
 *         description: Parámetros inválidos
 */
ipBlocksRouter.post(
  "/",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { ip, reason, durationHours } = req.body as {
        ip: string;
        reason: string;
        durationHours?: number;
      };

      if (!ip || !reason) {
        res.status(400).json({ error: "ip and reason are required" });
        return;
      }

      if (reason.trim().length < 5) {
        res.status(400).json({ error: "reason must be at least 5 characters" });
        return;
      }

      const blockedUntil = durationHours
        ? new Date(Date.now() + durationHours * 60 * 60_000)
        : null; // null = permanente

      const record = await blockIp({
        ip,
        reason: reason.trim(),
        blockedBy: "admin",
        blockedUntil,
        adminUserId: req.user!.id,
      });

      if (!record) {
        res.status(409).json({ error: "This IP already has an active block" });
        return;
      }

      // Auditar la acción del admin
      await auditRepository.log({
        userId: req.user!.id,
        action: "ip_blocked",
        metadata: {
          ip,
          reason: reason.trim(),
          durationHours: durationHours ?? null,
          blockedUntil: blockedUntil?.toISOString() ?? null,
        },
      });

      res.status(201).json({ message: "IP blocked successfully", block: record });
    } catch (err) {
      next(err);
    }
  },
);

// ── DELETE /api/admin/ip-blocks/:ip — desbloqueo manual ──────────────────────

/**
 * @openapi
 * /api/admin/ip-blocks/{ip}:
 *   delete:
 *     summary: Desbloquear una IP
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ip
 *         required: true
 *         schema: { type: string }
 *         description: La IP a desbloquear (puede tener puntos, se pasa URL-encoded)
 *     responses:
 *       200:
 *         description: IP desbloqueada
 *       404:
 *         description: No hay bloqueo activo para esa IP
 */
ipBlocksRouter.delete(
  "/:ip",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ip = decodeURIComponent(req.params["ip"] as string);

      if (!ip) {
        res.status(400).json({ error: "IP is required" });
        return;
      }

      const released = await unblockIp(ip, "admin");

      if (!released) {
        res.status(404).json({ error: "No active block found for this IP" });
        return;
      }

      await auditRepository.log({
        userId: req.user!.id,
        action: "ip_unblocked",
        metadata: { ip },
      });

      res.json({ message: "IP unblocked successfully" });
    } catch (err) {
      next(err);
    }
  },
);
