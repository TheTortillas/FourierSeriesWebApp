import { Router, Request, Response, NextFunction } from "express";
import { simplifyService } from "../../infrastructure/container";
import type { SimplifyInput } from "../../domain/types/fourier.types";
import { sanitizeExpression } from "../middlewares/sanitize";

export const simplifyRouter = Router();

/**
 * @openapi
 * /api/simplify:
 *   post:
 *     summary: Aplica simplificaciones a una expresión de Maxima
 *     tags: [Simplify]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [expression, profile]
 *             properties:
 *               expression:
 *                 type: string
 *                 example: "((cos(%pi*n)+1)/(n^2-1))"
 *               profile:
 *                 type: string
 *                 enum: [raw, integer, trigonometric, exponential, complete]
 *               functions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [fullratsimp, ratsimp, trigsimp, trigreduce, trigexpand, factor, expand, radcan, rectform, polarform]
 *               displayFlags:
 *                 type: object
 *                 properties:
 *                   edispflag:
 *                     type: boolean
 *                   exponentialize:
 *                     type: boolean
 *                   demoivre:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Expresión simplificada
 *       500:
 *         description: Error de simplificación
 */
simplifyRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as SimplifyInput;

      if (!input.expression || !input.profile) {
        res.status(400).json({ error: "expression and profile are required" });
        return;
      }

      const sanitizeCheck = sanitizeExpression(input.expression);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }

      const result = await simplifyService.simplify(input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
