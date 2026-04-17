import { Router, Request, Response } from "express";
import {
  getCacheStats,
  clearCache,
} from "../../infrastructure/cache/fourierCache";
import { authenticate, requireAdmin } from "../middlewares/authenticate";

export const cacheRouter = Router();

/**
 * @openapi
 * /api/cache/stats:
 *   get:
 *     summary: Estadísticas del caché
 *     tags: [Cache]
 *     responses:
 *       200:
 *         description: Estadísticas actuales del caché (backend, tamaño, TTL, versión)
 */
cacheRouter.get(
  "/stats",
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    res.json(await getCacheStats());
  },
);

/**
 * @openapi
 * /api/cache/clear:
 *   post:
 *     summary: Limpia el caché
 *     tags: [Cache]
 *     responses:
 *       200:
 *         description: Caché limpiado
 */
cacheRouter.post(
  "/clear",
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    await clearCache();
    res.json({ message: "Cache cleared" });
  },
);
