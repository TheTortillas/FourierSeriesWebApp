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
import { getRateLimitMetricsSnapshot } from "../middlewares/rateLimiter";

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

/**
 * @openapi
 * /api/admin/rate-limit/metrics:
 *   get:
 *     summary: Obtener métricas en memoria de rate limiting
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Snapshot de métricas de rate limiting por bucket y endpoint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 startedAt: { type: string, format: date-time }
 *                 requestsByBucket:
 *                   type: object
 *                   properties:
 *                     compute: { type: integer }
 *                     parse: { type: integer }
 *                     auth: { type: integer }
 *                 blockedByBucket:
 *                   type: object
 *                   properties:
 *                     compute: { type: integer }
 *                     parse: { type: integer }
 *                     auth: { type: integer }
 *                 requestsByEndpoint:
 *                   type: object
 *                   additionalProperties: { type: integer }
 *                 blockedByEndpoint:
 *                   type: object
 *                   additionalProperties: { type: integer }
 *                 blockedByLimiter:
 *                   type: object
 *                   additionalProperties: { type: integer }
 *                 ratios:
 *                   type: object
 *                   properties:
 *                     compute: { type: number, format: float }
 *                     parse: { type: number, format: float }
 *                     auth: { type: number, format: float }
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
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(getRateLimitMetricsSnapshot());
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
      await userRepository.softDelete(id);

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
        type?: string;
        anonymousOnly?: boolean;
        favoritesOnly?: boolean;
        dateFrom?: Date;
        dateTo?: Date;
        minExecutionMs?: number;
      } = {};
      if (req.query["userId"]) filters.userId = req.query["userId"] as string;
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
  async (_req, res: Response, next: NextFunction) => {
    try {
      const [catRes, ratingRes, dayRes, totalRes] = await Promise.all([
        db.query<{ category: string; count: number }>(
          `SELECT category::text, COUNT(*)::int AS count
         FROM feedback GROUP BY category ORDER BY count DESC`,
        ),
        db.query<{ rating: number; count: number }>(
          `SELECT rating, COUNT(*)::int AS count
         FROM feedback WHERE rating IS NOT NULL
         GROUP BY rating ORDER BY rating`,
        ),
        db.query<{ day: string; count: number }>(
          `SELECT to_char(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
         FROM feedback
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at) ORDER BY DATE(created_at)`,
        ),
        db.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM feedback`,
        ),
      ]);

      res.json({
        total: totalRes.rows[0]?.total ?? 0,
        byCategory: catRes.rows,
        byRating: ratingRes.rows,
        byDay: dayRes.rows,
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
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const query = `
        WITH all_comments AS (
          SELECT
            'feedback' AS source,
            id,
            user_id,
            email,
            category::text AS type,
            message AS content,
            created_at,
            rating
          FROM feedback
          WHERE message IS NOT NULL AND message <> ''
          UNION ALL
          SELECT
            'survey' AS source,
            id,
            user_id,
            NULL::VARCHAR AS email,
            'bug' AS type,
            bug_description AS content,
            created_at,
            NULL::SMALLINT AS rating
          FROM survey_responses
          WHERE bug_description IS NOT NULL AND bug_description <> ''
          UNION ALL
          SELECT
            'survey' AS source,
            id,
            user_id,
            NULL::VARCHAR AS email,
            'comment' AS type,
            general_comments AS content,
            created_at,
            NULL::SMALLINT AS rating
          FROM survey_responses
          WHERE general_comments IS NOT NULL AND general_comments <> ''
        )
        SELECT source, id, user_id, email, type, content, created_at, rating
        FROM all_comments
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT id FROM feedback WHERE message IS NOT NULL AND message <> ''
          UNION ALL
          SELECT id FROM survey_responses WHERE bug_description IS NOT NULL AND bug_description <> ''
          UNION ALL
          SELECT id FROM survey_responses WHERE general_comments IS NOT NULL AND general_comments <> ''
        ) AS c
      `;

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

      const params: (Date | null)[] = [dateFrom, dateTo];

      const dateFilter = `
        ($1::timestamptz IS NULL OR c.created_at >= $1)
        AND ($2::timestamptz IS NULL OR c.created_at <= $2)
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
              COALESCE(SUM(ce.count), 0)::int       AS total_executions,
              COUNT(DISTINCT c.id)::int             AS unique_calcs,
              COUNT(DISTINCT ce.user_id)::int       AS unique_users,
              ROUND(AVG(ce.execution_ms))::int      AS avg_execution_ms
            FROM calculations c
            JOIN calculation_events ce ON ce.calculation_id = c.id
            WHERE ${dateFilter}`,
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
              COALESCE(SUM(ce.count), 0)::int  AS total_executions,
              COUNT(DISTINCT c.id)::int        AS unique_calcs,
              COUNT(DISTINCT ce.user_id)::int  AS unique_users,
              ROUND(AVG(ce.execution_ms))::int AS avg_execution_ms
            FROM calculations c
            JOIN calculation_events ce ON ce.calculation_id = c.id
            WHERE ${dateFilter}
            GROUP BY c.type
            ORDER BY total_executions DESC`,
            params,
          ),

          db.query<{ day: string; executions: number; unique_calcs: number }>(
            `SELECT
              to_char(DATE(ce.last_calculated_at), 'YYYY-MM-DD') AS day,
              COALESCE(SUM(ce.count), 0)::int     AS executions,
              COUNT(DISTINCT c.id)::int           AS unique_calcs
            FROM calculation_events ce
            JOIN calculations c ON c.id = ce.calculation_id
            WHERE
              ce.last_calculated_at >= COALESCE($1, NOW() - INTERVAL '30 days')
              AND ($2::timestamptz IS NULL OR ce.last_calculated_at <= $2)
            GROUP BY DATE(ce.last_calculated_at)
            ORDER BY DATE(ce.last_calculated_at)`,
            params,
          ),

          db.query<{
            is_authenticated: boolean;
            executions: number;
            unique_actors: number;
          }>(
            `SELECT
              (ce.user_id IS NOT NULL)                              AS is_authenticated,
              COALESCE(SUM(ce.count), 0)::int                       AS executions,
              COUNT(DISTINCT COALESCE(ce.user_id, ce.ip_address::text))::int AS unique_actors
            FROM calculation_events ce
            JOIN calculations c ON c.id = ce.calculation_id
            WHERE ${dateFilter}
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
              COALESCE(SUM(ce.count), 0)::int        AS total_executions,
              COUNT(DISTINCT ce.user_id)::int        AS unique_users
            FROM calculations c
            JOIN calculation_events ce ON ce.calculation_id = c.id
            WHERE ${dateFilter}
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
  async (_req, res: Response, next: NextFunction) => {
    try {
      const [
        totalRes,
        roleRes,
        countryRes,
        howFoundRes,
        purposeRes,
        featureRes,
        deviceRes,
        prevRes,
        improvRes,
        ratingsRes,
        dayRes,
      ] = await Promise.all([
        db.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM survey_responses`,
        ),
        db.query<{ role: string; count: number }>(
          `SELECT role::text, COUNT(*)::int AS count
         FROM survey_responses GROUP BY role ORDER BY count DESC`,
        ),
        db.query<{ country: string; count: number }>(
          `SELECT country, COUNT(*)::int AS count
         FROM survey_responses GROUP BY country ORDER BY count DESC LIMIT 10`,
        ),
        db.query<{ how_found: string; count: number }>(
          `SELECT how_found::text, COUNT(*)::int AS count
         FROM survey_responses GROUP BY how_found ORDER BY count DESC`,
        ),
        db.query<{ purpose: string; count: number }>(
          `SELECT p AS purpose, COUNT(*)::int AS count
         FROM survey_responses, unnest(purpose) AS p
         GROUP BY p ORDER BY count DESC`,
        ),
        db.query<{ feature: string; count: number }>(
          `SELECT f AS feature, COUNT(*)::int AS count
         FROM survey_responses, unnest(features_used) AS f
         GROUP BY f ORDER BY count DESC`,
        ),
        db.query<{ device: string; count: number }>(
          `SELECT d AS device, COUNT(*)::int AS count
         FROM survey_responses, unnest(device) AS d
         GROUP BY d ORDER BY count DESC`,
        ),
        db.query<{ used_previous: boolean; count: number }>(
          `SELECT used_previous, COUNT(*)::int AS count
         FROM survey_responses GROUP BY used_previous`,
        ),
        db.query<{ improvement: string; count: number }>(
          `SELECT i AS improvement, COUNT(*)::int AS count
         FROM survey_responses, unnest(improvements) AS i
         WHERE used_previous = true
         GROUP BY i ORDER BY count DESC`,
        ),
        db.query<{
          usefulness: number;
          ease: number;
          vs_other: number;
          recommend: number;
        }>(
          `SELECT
           ROUND(AVG(usefulness_rating)::numeric,    2)::float AS usefulness,
           ROUND(AVG(ease_of_use_rating)::numeric,   2)::float AS ease,
           ROUND(AVG(vs_other_tools_rating)::numeric,2)::float AS vs_other,
           ROUND(AVG(recommend_rating)::numeric,     2)::float AS recommend
         FROM survey_responses`,
        ),
        db.query<{ day: string; count: number }>(
          `SELECT to_char(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
         FROM survey_responses
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at) ORDER BY DATE(created_at)`,
        ),
      ]);

      res.json({
        total: totalRes.rows[0]?.total ?? 0,
        byRole: roleRes.rows,
        topCountries: countryRes.rows,
        byHowFound: howFoundRes.rows,
        byPurpose: purposeRes.rows,
        byFeature: featureRes.rows,
        byDevice: deviceRes.rows,
        usedPrevious: prevRes.rows,
        improvements: improvRes.rows,
        avgRatings: ratingsRes.rows[0] ?? {
          usefulness: 0,
          ease: 0,
          vs_other: 0,
          recommend: 0,
        },
        byDay: dayRes.rows,
      });
    } catch (err) {
      next(err);
    }
  },
);
