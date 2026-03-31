import { Router, Request, Response } from "express";
import {
  getCacheStats,
  clearCache,
} from "../../infrastructure/cache/fourierCache";
import {
  authenticate,
  requireAdmin,
} from "../middlewares/authenticate";

export const cacheRouter = Router();

/**
 * @openapi
 * /api/cache/stats:
 *   get:
 *     summary: Estadísticas del caché
 *     tags: [Cache]
 *     responses:
 *       200:
 *         description: Estadísticas actuales del caché
 */
cacheRouter.get("/stats", (_req: Request, res: Response) => {
  res.json(getCacheStats());
});

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
cacheRouter.post("/clear", authenticate, requireAdmin, (_req: Request, res: Response) => {
  clearCache();
  res.json({ message: "Cache cleared" });
});
