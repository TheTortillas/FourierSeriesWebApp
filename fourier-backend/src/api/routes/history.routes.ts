import { Router, Response, NextFunction } from "express";
import { historyRepository } from "../../infrastructure/container";
import { authenticate } from "../middlewares/authenticate";
import type { AuthenticatedRequest } from "../middlewares/authenticate";

export const historyRouter = Router();

historyRouter.use(authenticate);

/**
 * @openapi
 * /api/history:
 *   get:
 *     summary: Obtener historial de cálculos del usuario
 *     tags: [History]
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
 *         name: favorites
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Historial del usuario
 */
historyRouter.get(
  "/",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const favoritesOnly = req.query["favorites"] === "true";

      const FREE_CAP = favoritesOnly ? 2 : 5;
      const isLimited = user.tier === "free";

      const limit  = isLimited ? FREE_CAP : (parseInt(req.query["limit"] as string) || 20);
      const offset = isLimited ? 0 : (parseInt(req.query["offset"] as string) || 0);

      const [realTotal, entries] = await Promise.all([
        historyRepository.countByUser(user.id, favoritesOnly),
        historyRepository.findByUser(user.id, limit, offset, favoritesOnly),
      ]);

      const total = isLimited ? Math.min(realTotal, FREE_CAP) : realTotal;

      res.json({
        entries,
        total,
        limit,
        offset,
        ...(isLimited ? { isLimited: true, historyLimit: { max: 5, favorites: 2 } } : {}),
      });
    } catch (err) {
      next(err);
    }
  },
);

historyRouter.get(
  "/:id",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params["id"] as string;
      const entry = await historyRepository.findById(id);
      if (!entry || entry.userId !== req.user!.id) {
        res.status(404).json({ error: "History entry not found" });
        return;
      }
      res.json(entry);
    } catch (err) {
      next(err);
    }
  },
);

historyRouter.patch(
  "/:id/favorite",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body as { name?: string };
      const id = req.params["id"] as string;
      const entry = await historyRepository.toggleFavorite(
        id,
        req.user!.id,
        name,
      );
      res.json(entry);
    } catch (err) {
      if (err instanceof Error && err.message === "History entry not found") {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

historyRouter.delete(
  "/:id",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params["id"] as string;
      await historyRepository.delete(id, req.user!.id);
      res.json({ message: "History entry deleted" });
    } catch (err) {
      if (err instanceof Error && err.message === "History entry not found") {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);
