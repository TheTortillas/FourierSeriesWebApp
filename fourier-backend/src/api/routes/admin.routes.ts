import { Router, Response, NextFunction } from "express";
import {
  userRepository,
  historyRepository,
  auditRepository,
  systemRepository,
} from "../../infrastructure/container";
import { db } from "../../infrastructure/database/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";
import type { AuthenticatedRequest } from "../middlewares/authenticate";
import type {
  AuditAction,
  AuditFilters,
} from "../../domain/interfaces/repositories/IAuditRepository";
import { ipBlocksRouter } from "./admin.ip-blocks.routes";

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

// IP blocklist — /api/admin/ip-blocks
adminRouter.use("/ip-blocks", ipBlocksRouter);

/**
 * @openapi
 * /api/admin/rate-limit/metrics:
 *   get:
 *     summary: Métricas de rate limiting desde audit_log (sobrevive reinicios)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: windowHours
 *         schema: { type: integer, default: 24 }
 *         description: Ventana de tiempo en horas para agregar datos (1-720)
 *     responses:
 *       200:
 *         description: Métricas de bloqueos por bucket, limiter, endpoint e IP
 */

/**
 * @openapi
 * /api/admin/system/stats:
 *   get:
 *     summary: Obtener estadísticas de almacenamiento del sistema
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tamaño de la DB, tablas principales y disco
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 database:
 *                   type: object
 *                   properties:
 *                     totalSize: { type: string, example: "8192 kB" }
 *                     tables:
 *                       type: object
 *                       properties:
 *                         calculations:        { type: string, example: "24 kB" }
 *                         calculation_events:  { type: string, example: "40 kB" }
 *                         audit_log:           { type: string, example: "16 kB" }
 *                         user_refresh_tokens: { type: string, example: "8192 bytes" }
 *                 disk:
 *                   type: object
 *                   properties:
 *                     total:       { type: string, example: "931.51 GB" }
 *                     used:        { type: string, example: "120.34 GB" }
 *                     free:        { type: string, example: "811.17 GB" }
 *                     usedPercent: { type: integer, example: 13 }
 */
adminRouter.get(
  "/rate-limit/metrics",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Ventana de tiempo configurable — default 24h, máximo 720h (30 días)
      const windowHours = Math.min(
        Math.max(1, parseInt(String(req.query["windowHours"] ?? "24")) || 24),
        720,
      );
      const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

      // Todas las queries en paralelo contra audit_log
      const [bucketRes, limiterRes, endpointRes, ipRes] = await Promise.all([
        // Bloqueados por bucket
        db.query<{ bucket: string; blocked: number }>(
          `SELECT metadata->>'bucket' AS bucket, COUNT(*)::int AS blocked
           FROM audit_log
           WHERE action = 'rate_limit_blocked'
             AND created_at >= $1
             AND metadata->>'bucket' IS NOT NULL
           GROUP BY metadata->>'bucket'`,
          [windowStart],
        ),
        // Bloqueados por limiter
        db.query<{ limiter: string; blocked: number }>(
          `SELECT metadata->>'limiter' AS limiter, COUNT(*)::int AS blocked
           FROM audit_log
           WHERE action = 'rate_limit_blocked'
             AND created_at >= $1
             AND metadata->>'limiter' IS NOT NULL
           GROUP BY metadata->>'limiter'
           ORDER BY blocked DESC`,
          [windowStart],
        ),
        // Bloqueados por endpoint (top 20)
        db.query<{ endpoint: string; blocked: number }>(
          `SELECT metadata->>'endpoint' AS endpoint, COUNT(*)::int AS blocked
           FROM audit_log
           WHERE action = 'rate_limit_blocked'
             AND created_at >= $1
             AND metadata->>'endpoint' IS NOT NULL
           GROUP BY metadata->>'endpoint'
           ORDER BY blocked DESC
           LIMIT 20`,
          [windowStart],
        ),
        // Bloqueados por IP (top 20)
        db.query<{ ip: string; blocked: number }>(
          `SELECT ip_address::text AS ip, COUNT(*)::int AS blocked
           FROM audit_log
           WHERE action = 'rate_limit_blocked'
             AND created_at >= $1
             AND ip_address IS NOT NULL
           GROUP BY ip_address
           ORDER BY blocked DESC
           LIMIT 20`,
          [windowStart],
        ),
      ]);

      // Construir blockedByBucket con los 3 buckets siempre presentes.
      // 'general' se acumula dentro de 'auth' porque ambos cubren tráfico
      // no clasificado como compute ni parse (bots, swagger scanners, etc.).
      const buckets: Record<string, number> = { compute: 0, parse: 0, auth: 0 };
      for (const row of bucketRes.rows) {
        if (row.bucket === 'general') {
          buckets['auth'] += row.blocked;
        } else if (row.bucket in buckets) {
          buckets[row.bucket] += row.blocked;
        }
      }

      const blockedByLimiter: Record<string, number> = {};
      for (const row of limiterRes.rows) blockedByLimiter[row.limiter] = row.blocked;

      const blockedByEndpoint: Record<string, number> = {};
      for (const row of endpointRes.rows) blockedByEndpoint[row.endpoint] = row.blocked;

      const blockedByIp: Record<string, number> = {};
      for (const row of ipRes.rows) blockedByIp[row.ip] = row.blocked;

      const totalBlocked = Object.values(buckets).reduce((a, b) => a + b, 0);

      res.json({
        windowHours,
        windowStart: windowStart.toISOString(),
        totalBlocked,
        blockedByBucket: buckets,
        blockedByLimiter,
        blockedByEndpoint,
        blockedByIp,
      });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/rate-limit/history",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const limit  = Math.min(parseInt(String(req.query["limit"]  ?? "50")), 200);
      const offset = parseInt(String(req.query["offset"] ?? "0"));
      const ip     = req.query["ip"]     ? String(req.query["ip"])     : null;
      const limiter= req.query["limiter"]? String(req.query["limiter"]): null;

      const conditions: string[] = ["action = 'rate_limit_blocked'"];
      const params: unknown[]    = [];
      let   p = 1;

      if (ip) {
        conditions.push(`ip_address = $${p++}::inet`);
        params.push(ip);
      }
      if (limiter) {
        conditions.push(`metadata->>'limiter' = $${p++}`);
        params.push(limiter);
      }

      const where = conditions.join(" AND ");

      const [dataResult, countResult] = await Promise.all([
        db.query(
          `SELECT id, user_id, ip_address, metadata, created_at
           FROM audit_log
           WHERE ${where}
           ORDER BY created_at DESC
           LIMIT $${p} OFFSET $${p + 1}`,
          [...params, limit, offset],
        ),
        db.query(
          `SELECT COUNT(*)::int AS total FROM audit_log WHERE ${where}`,
          params,
        ),
      ]);

      res.json({
        total:   countResult.rows[0].total,
        entries: dataResult.rows,
      });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/system/stats",
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await systemRepository.getStats();
      res.json(stats);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/admin/stats:
 *   get:
 *     summary: Contadores de usuarios en una sola query
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total, premium, free e inactivos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:    { type: integer }
 *                 premium:  { type: integer }
 *                 free:     { type: integer }
 *                 inactive: { type: integer }
 */
adminRouter.get(
  "/stats",
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await userRepository.getAdminStats();
      res.json(stats);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: Listar todos los usuarios
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, admin] }
 *       - in: query
 *         name: tier
 *         schema: { type: string, enum: [free, premium] }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       403:
 *         description: Acceso denegado
 */
adminRouter.get(
  "/users",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query["limit"] as string) || 20;
      const offset = parseInt(req.query["offset"] as string) || 0;
      const filters = {
        role: req.query["role"] as "user" | "admin" | undefined,
        tier: req.query["tier"] as "free" | "premium" | undefined,
        isActive:
          req.query["isActive"] !== undefined
            ? req.query["isActive"] === "true"
            : undefined,
      };

      const [users, total] = await Promise.all([
        userRepository.findAll(limit, offset, filters),
        userRepository.countAll(filters),
      ]);

      const safeUsers = users.map(({ passwordHash: _, ...u }) => u);
      res.json({ entries: safeUsers, total, limit, offset });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/admin/users/{id}:
 *   get:
 *     summary: Obtener detalle de un usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detalle del usuario
 *       404:
 *         description: Usuario no encontrado
 */
adminRouter.get(
  "/users/:id",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params["id"] as string;
      const user = await userRepository.findById(id);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/admin/users/{id}/tier:
 *   patch:
 *     summary: Cambiar tier de un usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tier]
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [free, premium]
 *           example:
 *             tier: "premium"
 *     responses:
 *       200:
 *         description: Tier actualizado
 *       400:
 *         description: Tier inválido
 */
adminRouter.patch(
  "/users/:id/tier",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params["id"] as string;
      const { tier } = req.body as { tier: "free" | "premium" };

      if (!["free", "premium"].includes(tier)) {
        res.status(400).json({ error: "tier must be free or premium" });
        return;
      }

      await userRepository.updateTier(id, tier);

      await auditRepository.log({
        userId: req.user!.id,
        action: "tier_changed",
        targetType: "user",
        targetId: id,
        metadata: { newTier: tier },
      });

      res.json({ message: `User tier updated to ${tier}` });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/admin/users/{id}/deactivate:
 *   patch:
 *     summary: Desactivar un usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Usuario desactivado
 *       404:
 *         description: Usuario no encontrado
 */
adminRouter.patch(
  "/users/:id/deactivate",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params["id"] as string;
      await userRepository.deactivate(id);

      await auditRepository.log({
        userId: req.user!.id,
        action: "user_deactivated",
        targetType: "user",
        targetId: id,
      });

      res.json({ message: "User deactivated" });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/admin/users/{id}/activate:
 *   patch:
 *     summary: Activar un usuario
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Usuario activado
 */
adminRouter.patch(
  "/users/:id/activate",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params["id"] as string;
      await userRepository.activate(id);

      await auditRepository.log({
        userId: req.user!.id,
        action: "user_activated",
        targetType: "user",
        targetId: id,
      });

      res.json({ message: "User activated" });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/admin/audit:
 *   get:
 *     summary: Ver audit log completo
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
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: anonymousOnly
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Entradas del audit log
 */
adminRouter.get(
  "/audit",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query["limit"] as string) || 50;
      const offset = parseInt(req.query["offset"] as string) || 0;

      const filters: AuditFilters = {};
      if (req.query["action"])
        filters.action = req.query["action"] as AuditAction;
      if (req.query["userId"]) filters.userId = req.query["userId"] as string;
      if (req.query["ip"])     filters.ip     = req.query["ip"]     as string;
      if (req.query["dateFrom"])
        filters.dateFrom = new Date(req.query["dateFrom"] as string);
      if (req.query["dateTo"])
        filters.dateTo = new Date(req.query["dateTo"] as string);
      if (req.query["anonymousOnly"] === "true") filters.anonymousOnly = true;

      const [entries, total] = await Promise.all([
        auditRepository.findAll(limit, offset, filters),
        auditRepository.countAll(filters),
      ]);
      res.json({ entries, total, limit, offset });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/admin/audit/clear:
 *   delete:
 *     summary: Limpiar entradas antiguas del audit log
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action, olderThanDays]
 *             properties:
 *               action:
 *                 type: string
 *               olderThanDays:
 *                 type: integer
 *                 example: 30
 *     responses:
 *       200:
 *         description: Entradas eliminadas
 */
adminRouter.delete(
  "/audit/clear",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { action, olderThanDays } = req.body as {
        action: AuditAction;
        olderThanDays: number;
      };

      if (!action || !olderThanDays) {
        res
          .status(400)
          .json({ error: "action and olderThanDays are required" });
        return;
      }

      const deleted = await auditRepository.clearByAction(
        action,
        olderThanDays,
      );

      await auditRepository.log({
        userId: req.user!.id,
        action: "audit_log_cleared",
        metadata: {
          clearedAction: action,
          olderThanDays,
          deletedCount: deleted,
        },
      });

      res.json({ message: `Deleted ${deleted} audit log entries` });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/admin/history:
 *   get:
 *     summary: Ver historial global de cálculos
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [trigonometric, half_range, complex, fourier_transform, inverse_fourier_transform, dft_signal, dft_epicycles]
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: favoritesOnly
 *         schema: { type: boolean }
 *       - in: query
 *         name: anonymousOnly
 *         schema: { type: boolean }
 *       - in: query
 *         name: minExecutionMs
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Historial global
 */
adminRouter.get(
  "/history",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query["limit"] as string) || 20;
      const offset = parseInt(req.query["offset"] as string) || 0;

      const filters: {
        userId?: string;
        ip?: string;
        type?: string;
        anonymousOnly?: boolean;
        favoritesOnly?: boolean;
        dateFrom?: Date;
        dateTo?: Date;
        minExecutionMs?: number;
      } = {};
      if (req.query["userId"]) filters.userId = req.query["userId"] as string;
      if (req.query["ip"])     filters.ip     = req.query["ip"]     as string;
      if (req.query["type"]) filters.type = req.query["type"] as string;
      if (req.query["anonymousOnly"] === "true") filters.anonymousOnly = true;
      if (req.query["favoritesOnly"] === "true") filters.favoritesOnly = true;
      if (req.query["dateFrom"])
        filters.dateFrom = new Date(req.query["dateFrom"] as string);
      if (req.query["dateTo"])
        filters.dateTo = new Date(req.query["dateTo"] as string);
      if (req.query["minExecutionMs"])
        filters.minExecutionMs = parseInt(
          req.query["minExecutionMs"] as string,
        );

      const [entries, total] = await Promise.all([
        historyRepository.findAll(limit, offset, filters),
        historyRepository.countAll(filters),
      ]);

      res.json({ entries, total, limit, offset });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Feedback stats ──────────────────────────────────────────────────────────

adminRouter.get(
  "/feedback/stats",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dateFrom = req.query["dateFrom"] ? new Date(req.query["dateFrom"] as string) : null;
      const dateTo   = req.query["dateTo"]   ? new Date(req.query["dateTo"]   as string) : null;
      const rawTz    = req.query["tz"] as string | undefined;
      let clientTz = "UTC";
      if (rawTz) { try { Intl.DateTimeFormat(undefined, { timeZone: rawTz }); clientTz = rawTz; } catch { clientTz = "UTC"; } }

      const params = [dateFrom, dateTo];
      const dateFilter = `
        ($1::timestamptz IS NULL OR created_at >= $1)
        AND ($2::timestamptz IS NULL OR created_at <= $2)
      `;

      const [catRes, ratingRes, dayRes, totalRes] = await Promise.all([
        db.query<{ category: string; count: number }>(
          `SELECT category::text, COUNT(*)::int AS count
           FROM feedback WHERE ${dateFilter}
           GROUP BY category ORDER BY count DESC`,
          params,
        ),
        db.query<{ rating: number; count: number }>(
          `SELECT rating, COUNT(*)::int AS count
           FROM feedback WHERE rating IS NOT NULL AND ${dateFilter}
           GROUP BY rating ORDER BY rating`,
          params,
        ),
        db.query<{ day: string; count: number }>(
          `SELECT to_char(DATE(created_at AT TIME ZONE $3), 'YYYY-MM-DD') AS day,
                  COUNT(*)::int AS count
           FROM feedback
           WHERE ${dateFilter}
           GROUP BY DATE(created_at AT TIME ZONE $3)
           ORDER BY DATE(created_at AT TIME ZONE $3)`,
          [...params, clientTz],
        ),
        db.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM feedback WHERE ${dateFilter}`,
          params,
        ),
      ]);

      res.json({
        total:      totalRes.rows[0]?.total ?? 0,
        byCategory: catRes.rows,
        byRating:   ratingRes.rows,
        byDay:      dayRes.rows,
      });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/feedback/list",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const category = req.query.category as string | undefined;

      let query = `
        SELECT
          id,
          user_id,
          email,
          category::text,
          rating,
          message,
          created_at,
          (SELECT COUNT(*) FROM feedback f2 WHERE f2.category = feedback.category)::int AS category_total
        FROM feedback
      `;
      const params: (string | number)[] = [];

      if (
        category &&
        ["bug", "suggestion", "question", "other", "rating"].includes(category)
      ) {
        query += ` WHERE category = $${params.length + 1}`;
        params.push(category);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const countQuery = `SELECT COUNT(*)::int AS total FROM feedback${category && ["bug", "suggestion", "question", "other", "rating"].includes(category) ? ` WHERE category = $1` : ""}`;
      const countParams =
        category &&
        ["bug", "suggestion", "question", "other", "rating"].includes(category)
          ? [category]
          : [];

      const [feedbackRes, countRes] = await Promise.all([
        db.query<{
          id: string;
          user_id: string | null;
          email: string | null;
          category: string;
          rating: number | null;
          message: string | null;
          created_at: string;
          category_total: number;
        }>(query, params),
        db.query<{ total: number }>(countQuery, countParams),
      ]);

      res.json({
        total: countRes.rows[0]?.total ?? 0,
        limit,
        offset,
        data: feedbackRes.rows,
      });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get(
  "/comments/all",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const source = req.query.source as "feedback" | "survey" | undefined;

      const feedbackBlock = `
        SELECT 'feedback' AS source, id, user_id, email, category::text AS type,
               message AS content, created_at, rating
        FROM feedback
        WHERE message IS NOT NULL AND message <> ''`;

      const surveyBlock = `
        SELECT 'survey' AS source, id, user_id, NULL::VARCHAR AS email,
               'bug' AS type, bug_description AS content, created_at, NULL::SMALLINT AS rating
        FROM survey_responses WHERE bug_description IS NOT NULL AND bug_description <> ''
        UNION ALL
        SELECT 'survey', id, user_id, NULL::VARCHAR,
               'comment', general_comments, created_at, NULL::SMALLINT
        FROM survey_responses WHERE general_comments IS NOT NULL AND general_comments <> ''
        UNION ALL
        SELECT 'survey', id, user_id, NULL::VARCHAR,
               'regression', regressions, created_at, NULL::SMALLINT
        FROM survey_responses WHERE regressions IS NOT NULL AND regressions <> ''`;

      const unionParts = source === 'feedback' ? feedbackBlock
                       : source === 'survey'   ? surveyBlock
                       : `${feedbackBlock} UNION ALL ${surveyBlock}`;

      const query = `
        SELECT source, id, user_id, email, type, content, created_at, rating
        FROM (${unionParts}) all_comments
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`;

      const countQuery = `
        SELECT COUNT(*)::int AS total FROM (${unionParts}) c`;

      interface CommentRow {
        source: "feedback" | "survey";
        id: string;
        user_id: string | null;
        email: string | null;
        type: string;
        content: string | null;
        created_at: string;
        rating: number | null;
      }

      const [commentsRes, countRes] = await Promise.all([
        db.query<CommentRow>(query, [limit, offset]),
        db.query<{ total: number }>(countQuery),
      ]);

      res.json({
        total: countRes.rows[0]?.total ?? 0,
        limit,
        offset,
        data: commentsRes.rows,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Calculation stats ───────────────────────────────────────────────────────

adminRouter.get(
  "/calculations/stats",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dateFrom = req.query["dateFrom"]
        ? new Date(req.query["dateFrom"] as string)
        : null;
      const dateTo = req.query["dateTo"]
        ? new Date(req.query["dateTo"] as string)
        : null;
      const topN = Math.min(
        Math.max(1, parseInt((req.query["topN"] as string) || "10") || 10),
        100,
      );

      // Timezone del navegador del cliente para agrupar días correctamente.
      // Se valida contra Intl para rechazar valores arbitrarios.
      const rawTz = req.query["tz"] as string | undefined;
      let clientTz = "UTC";
      if (rawTz) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: rawTz });
          clientTz = rawTz;
        } catch {
          clientTz = "UTC";
        }
      }

      const params: (Date | null)[] = [dateFrom, dateTo];

      const dateFilter = `
        ($1::timestamptz IS NULL OR c.created_at >= $1)
        AND ($2::timestamptz IS NULL OR c.created_at <= $2)
      `;

      // execution_log es la fuente de verdad para conteos: cada fila = 1 ejecución real.
      // dateFilter sobre execution_log.executed_at para summary/byType/authSplit/topCalcs.
      // daily usa executed_at directamente con fallback de 30 días.
      const elDateFilter = `
        ($1::timestamptz IS NULL OR el.executed_at >= $1)
        AND ($2::timestamptz IS NULL OR el.executed_at <= $2)
      `;

      const [summaryRes, byTypeRes, dailyRes, authSplitRes, topCalcsRes] =
        await Promise.all([
          db.query<{
            total_executions: number;
            unique_calcs: number;
            unique_users: number;
            avg_execution_ms: number | null;
          }>(
            `SELECT
              COUNT(el.id)::int                     AS total_executions,
              COUNT(DISTINCT c.id)::int             AS unique_calcs,
              COUNT(DISTINCT ce.user_id)::int       AS unique_users,
              ROUND(AVG(ce.execution_ms))::int      AS avg_execution_ms
            FROM execution_log el
            JOIN calculation_events ce ON ce.id = el.event_id
            JOIN calculations c        ON c.id  = ce.calculation_id
            WHERE ${elDateFilter}`,
            params,
          ),

          db.query<{
            type: string;
            total_executions: number;
            unique_calcs: number;
            unique_users: number;
            avg_execution_ms: number | null;
          }>(
            `SELECT
              c.type::text,
              COUNT(el.id)::int                AS total_executions,
              COUNT(DISTINCT c.id)::int        AS unique_calcs,
              COUNT(DISTINCT ce.user_id)::int  AS unique_users,
              ROUND(AVG(ce.execution_ms))::int AS avg_execution_ms
            FROM execution_log el
            JOIN calculation_events ce ON ce.id = el.event_id
            JOIN calculations c        ON c.id  = ce.calculation_id
            WHERE ${elDateFilter}
            GROUP BY c.type
            ORDER BY total_executions DESC`,
            params,
          ),

          db.query<{ day: string; executions: number; unique_calcs: number }>(
            `SELECT
              to_char(DATE(el.executed_at AT TIME ZONE $3), 'YYYY-MM-DD') AS day,
              COUNT(el.id)::int                                            AS executions,
              COUNT(DISTINCT c.id)::int                                    AS unique_calcs
            FROM execution_log el
            JOIN calculation_events ce ON ce.id = el.event_id
            JOIN calculations c        ON c.id  = ce.calculation_id
            WHERE ${elDateFilter}
            GROUP BY DATE(el.executed_at AT TIME ZONE $3)
            ORDER BY DATE(el.executed_at AT TIME ZONE $3)`,
            [...params, clientTz],
          ),

          db.query<{
            is_authenticated: boolean;
            executions: number;
            unique_actors: number;
          }>(
            `SELECT
              (ce.user_id IS NOT NULL)                                          AS is_authenticated,
              COUNT(el.id)::int                                                 AS executions,
              COUNT(DISTINCT COALESCE(ce.user_id, ce.ip_address::text))::int   AS unique_actors
            FROM execution_log el
            JOIN calculation_events ce ON ce.id = el.event_id
            JOIN calculations c        ON c.id  = ce.calculation_id
            WHERE ${elDateFilter}
            GROUP BY (ce.user_id IS NOT NULL)`,
            params,
          ),

          db.query<{
            id: string;
            type: string;
            input: Record<string, unknown>;
            created_at: string;
            total_executions: number;
            unique_users: number;
          }>(
            `SELECT
              c.id,
              c.type::text,
              c.input,
              c.created_at,
              COUNT(el.id)::int               AS total_executions,
              COUNT(DISTINCT ce.user_id)::int AS unique_users
            FROM execution_log el
            JOIN calculation_events ce ON ce.id = el.event_id
            JOIN calculations c        ON c.id  = ce.calculation_id
            WHERE ${elDateFilter}
            GROUP BY c.id, c.type, c.input, c.created_at
            ORDER BY total_executions DESC
            LIMIT $3`,
            [...params, topN],
          ),
        ]);

      const summary = summaryRes.rows[0] ?? {
        total_executions: 0,
        unique_calcs: 0,
        unique_users: 0,
        avg_execution_ms: null,
      };

      res.json({
        summary,
        byType: byTypeRes.rows,
        daily: dailyRes.rows,
        authSplit: authSplitRes.rows,
        topCalcs: topCalcsRes.rows,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Survey stats ────────────────────────────────────────────────────────────

adminRouter.get(
  "/survey/stats",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dateFrom = req.query["dateFrom"] ? new Date(req.query["dateFrom"] as string) : null;
      const dateTo   = req.query["dateTo"]   ? new Date(req.query["dateTo"]   as string) : null;
      const rawTz    = req.query["tz"] as string | undefined;
      let clientTz = "UTC";
      if (rawTz) { try { Intl.DateTimeFormat(undefined, { timeZone: rawTz }); clientTz = rawTz; } catch { clientTz = "UTC"; } }

      const params = [dateFrom, dateTo];
      const dateFilter = `
        ($1::timestamptz IS NULL OR created_at >= $1)
        AND ($2::timestamptz IS NULL OR created_at <= $2)
      `;

      const [
        totalRes, roleRes, academicLevelRes, countryRes, howFoundRes,
        purposeRes, featureRes, deviceRes, prevRes, improvRes,
        ratingsRes, ratingDistRes, dayRes, otherTextsRes, institutionRes,
      ] = await Promise.all([
        db.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM survey_responses WHERE ${dateFilter}`, params,
        ),
        db.query<{ role: string; count: number }>(
          `SELECT role::text, COUNT(*)::int AS count
           FROM survey_responses WHERE ${dateFilter}
           GROUP BY role ORDER BY count DESC`, params,
        ),
        db.query<{ academic_level: string; count: number }>(
          `SELECT academic_level::text, COUNT(*)::int AS count
           FROM survey_responses WHERE ${dateFilter}
           GROUP BY academic_level ORDER BY count DESC`, params,
        ),
        db.query<{ country: string; count: number }>(
          `SELECT country, COUNT(*)::int AS count
           FROM survey_responses WHERE ${dateFilter}
           GROUP BY country ORDER BY count DESC LIMIT 10`, params,
        ),
        db.query<{ how_found: string; count: number }>(
          `SELECT how_found::text, COUNT(*)::int AS count
           FROM survey_responses WHERE ${dateFilter}
           GROUP BY how_found ORDER BY count DESC`, params,
        ),
        db.query<{ purpose: string; count: number }>(
          `SELECT p AS purpose, COUNT(*)::int AS count
           FROM survey_responses, unnest(purpose) AS p
           WHERE ${dateFilter}
           GROUP BY p ORDER BY count DESC`, params,
        ),
        db.query<{ feature: string; count: number }>(
          `SELECT f AS feature, COUNT(*)::int AS count
           FROM survey_responses, unnest(features_used) AS f
           WHERE ${dateFilter}
           GROUP BY f ORDER BY count DESC`, params,
        ),
        db.query<{ device: string; count: number }>(
          `SELECT d AS device, COUNT(*)::int AS count
           FROM survey_responses, unnest(device) AS d
           WHERE ${dateFilter}
           GROUP BY d ORDER BY count DESC`, params,
        ),
        db.query<{ used_previous: boolean; count: number }>(
          `SELECT used_previous, COUNT(*)::int AS count
           FROM survey_responses WHERE ${dateFilter}
           GROUP BY used_previous`, params,
        ),
        db.query<{ improvement: string; count: number }>(
          `SELECT i AS improvement, COUNT(*)::int AS count
           FROM survey_responses, unnest(improvements) AS i
           WHERE used_previous = true AND ${dateFilter}
           GROUP BY i ORDER BY count DESC`, params,
        ),
        db.query<{ usefulness: number; ease: number; vs_other: number; recommend: number }>(
          `SELECT
             ROUND(AVG(usefulness_rating)::numeric,    2)::float AS usefulness,
             ROUND(AVG(ease_of_use_rating)::numeric,   2)::float AS ease,
             ROUND(AVG(vs_other_tools_rating)::numeric,2)::float AS vs_other,
             ROUND(AVG(recommend_rating)::numeric,     2)::float AS recommend
           FROM survey_responses WHERE ${dateFilter}`, params,
        ),
        // Distribución completa de ratings (1–5) por cada dimensión
        db.query<{ rating: number; usefulness: number; ease: number; vs_other: number; recommend: number }>(
          `SELECT
             r AS rating,
             COUNT(*) FILTER (WHERE usefulness_rating     = r)::int AS usefulness,
             COUNT(*) FILTER (WHERE ease_of_use_rating    = r)::int AS ease,
             COUNT(*) FILTER (WHERE vs_other_tools_rating = r)::int AS vs_other,
             COUNT(*) FILTER (WHERE recommend_rating      = r)::int AS recommend
           FROM generate_series(1,5) AS r
           CROSS JOIN LATERAL (
             SELECT usefulness_rating, ease_of_use_rating, vs_other_tools_rating, recommend_rating
             FROM survey_responses
             WHERE ${dateFilter}
           ) sr
           GROUP BY r ORDER BY r`, params,
        ),
        // Tendencia diaria con timezone del cliente
        db.query<{ day: string; count: number }>(
          `SELECT to_char(DATE(created_at AT TIME ZONE $3), 'YYYY-MM-DD') AS day,
                  COUNT(*)::int AS count
           FROM survey_responses
           WHERE ${dateFilter}
           GROUP BY DATE(created_at AT TIME ZONE $3)
           ORDER BY DATE(created_at AT TIME ZONE $3)`,
          [...params, clientTz],
        ),
        // Campos "otro" — textos libres no vacíos agrupados por campo
        db.query<{ field: string; value: string; count: number }>(
          `SELECT field, value, COUNT(*)::int AS count
           FROM (
             SELECT 'role'         AS field, role_other          AS value FROM survey_responses WHERE role_other          IS NOT NULL AND role_other          <> '' AND ${dateFilter}
             UNION ALL
             SELECT 'academic',             academic_level_other           FROM survey_responses WHERE academic_level_other IS NOT NULL AND academic_level_other <> '' AND ${dateFilter}
             UNION ALL
             SELECT 'how_found',            how_found_other                FROM survey_responses WHERE how_found_other      IS NOT NULL AND how_found_other      <> '' AND ${dateFilter}
             UNION ALL
             SELECT 'purpose',              purpose_other                  FROM survey_responses WHERE purpose_other        IS NOT NULL AND purpose_other        <> '' AND ${dateFilter}
             UNION ALL
             SELECT 'improvements',         improvements_other             FROM survey_responses WHERE improvements_other   IS NOT NULL AND improvements_other   <> '' AND ${dateFilter}
           ) t
           GROUP BY field, value
           ORDER BY field, count DESC`,
          params,
        ),
        // Instituciones y carreras más mencionadas (top 15 de cada una)
        db.query<{ type: string; value: string; count: number }>(
          `SELECT type, value, count FROM (
             SELECT 'institution' AS type, institution AS value, COUNT(*)::int AS count
             FROM survey_responses
             WHERE institution IS NOT NULL AND institution <> '' AND ${dateFilter}
             GROUP BY institution
             ORDER BY count DESC LIMIT 15
           ) inst
           UNION ALL
           SELECT type, value, count FROM (
             SELECT 'career' AS type, career AS value, COUNT(*)::int AS count
             FROM survey_responses
             WHERE career IS NOT NULL AND career <> '' AND ${dateFilter}
             GROUP BY career
             ORDER BY count DESC LIMIT 15
           ) car`,
          params,
        ),
      ]);

      res.json({
        total:           totalRes.rows[0]?.total ?? 0,
        byRole:          roleRes.rows,
        byAcademicLevel: academicLevelRes.rows,
        topCountries:    countryRes.rows,
        byHowFound:      howFoundRes.rows,
        byPurpose:       purposeRes.rows,
        byFeature:       featureRes.rows,
        byDevice:        deviceRes.rows,
        usedPrevious:    prevRes.rows,
        improvements:    improvRes.rows,
        avgRatings:      ratingsRes.rows[0] ?? { usefulness: 0, ease: 0, vs_other: 0, recommend: 0 },
        ratingDist:      ratingDistRes.rows,
        byDay:           dayRes.rows,
        otherTexts:      otherTextsRes.rows,
        institutions:    institutionRes.rows.filter((r) => r.type === 'institution'),
        careers:         institutionRes.rows.filter((r) => r.type === 'career'),
      });
    } catch (err) {
      next(err);
    }
  },
);
