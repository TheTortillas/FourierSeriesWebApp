import { Router, Request, Response, NextFunction } from "express";
import { fourierTransformService } from "../../infrastructure/container";
import type { FourierTransformInput } from "../../domain/types/fourier.types";

export const transformsRouter = Router();

/**
 * @openapi
 * /api/transforms/fourier:
 *   post:
 *     summary: Calcula la transformada continua de Fourier
 *     tags: [Transforms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [segments]
 *             properties:
 *               segments:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/PiecewiseSegment'
 *               intVar:
 *                 type: string
 *                 example: "t"
 *               transVar:
 *                 type: string
 *                 example: "w"
 *           example:
 *             segments:
 *               - expression: "exp(t)"
 *                 from: "minf"
 *                 to: "0"
 *               - expression: "exp(-t)"
 *                 from: "0"
 *                 to: "inf"
 *             intVar: "t"
 *             transVar: "w"
 *     responses:
 *       200:
 *         description: Transformada calculada exitosamente
 *       500:
 *         description: Error de cálculo
 */
transformsRouter.post(
  "/fourier",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as FourierTransformInput;
      if (!input.segments || input.segments.length === 0) {
        res.status(400).json({ error: "segments is required" });
        return;
      }
      const result = await fourierTransformService.transform(input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/transforms/fourier/inverse:
 *   post:
 *     summary: Calcula la transformada inversa de Fourier
 *     tags: [Transforms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [segments]
 *             properties:
 *               segments:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/PiecewiseSegment'
 *               intVar:
 *                 type: string
 *                 example: "w"
 *               transVar:
 *                 type: string
 *                 example: "t"
 *           example:
 *             segments:
 *               - expression: "2/(w^2+1)"
 *                 from: "minf"
 *                 to: "inf"
 *             intVar: "w"
 *             transVar: "t"
 *     responses:
 *       200:
 *         description: Transformada inversa calculada exitosamente
 *       500:
 *         description: Error de cálculo
 */
transformsRouter.post(
  "/fourier/inverse",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as FourierTransformInput;
      if (!input.segments || input.segments.length === 0) {
        res.status(400).json({ error: "segments is required" });
        return;
      }
      const result = await fourierTransformService.inverseTransform(input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
