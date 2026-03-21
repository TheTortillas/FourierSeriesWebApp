import { Router, Request, Response, NextFunction } from "express";
import {
  fourierTransformService,
  dftService,
} from "../../infrastructure/container";
import type {
  FourierTransformInput,
  InverseFourierTransformInput,
  DFTInput,
} from "../../domain/types/fourier.types";
import { sanitizeSegments, sanitizeExpression } from "../middlewares/sanitize";

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
      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
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
      const input = req.body as InverseFourierTransformInput;
      if (!input.segments || input.segments.length === 0) {
        res.status(400).json({ error: "segments is required" });
        return;
      }
      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }
      const result = await fourierTransformService.inverseTransform(input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/transforms/dft:
 *   post:
 *     summary: Calcula la DFT/FFT de una señal o figura
 *     tags: [Transforms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [points, mode]
 *             properties:
 *               points:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     x: { type: number }
 *                     y: { type: number }
 *               mode:
 *                 type: string
 *                 enum: [signal, epicycles]
 *               N:
 *                 type: integer
 *                 description: Número de puntos (máximo 1024)
 *           example:
 *             points:
 *               - x: 0
 *                 y: 0
 *               - x: 0.785
 *                 y: 0.707
 *               - x: 1.571
 *                 y: 1
 *               - x: 2.356
 *                 y: 0.707
 *               - x: 3.141
 *                 y: 0
 *               - x: 3.927
 *                 y: -0.707
 *               - x: 4.712
 *                 y: -1
 *               - x: 5.497
 *                 y: -0.707
 *             mode: "signal"
 *     responses:
 *       200:
 *         description: DFT calculada exitosamente
 *       400:
 *         description: Input inválido
 *       500:
 *         description: Error de cálculo
 */
transformsRouter.post(
  "/dft",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as DFTInput;

      if (
        !input.points ||
        !Array.isArray(input.points) ||
        input.points.length < 2
      ) {
        res
          .status(400)
          .json({ error: "points must be an array with at least 2 elements" });
        return;
      }

      if (!input.mode || !["signal", "epicycles"].includes(input.mode)) {
        res.status(400).json({ error: "mode must be signal or epicycles" });
        return;
      }

      if (input.points.length > 1024) {
        res.status(400).json({ error: "Maximum 1024 points allowed" });
        return;
      }
      const sanitizeCheck = sanitizeSegments(
        input.points.map((p) => ({
          expression: `${p.y}`,
          from: "0",
          to: "0",
        })),
      );
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }

      const result = await dftService.compute(input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
