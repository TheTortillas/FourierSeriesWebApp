import { Router, Response, NextFunction } from "express";
import {
  userRepository,
  historyRepository,
  auditRepository,
  systemRepository,
} from "../../infrastructure/container";
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
