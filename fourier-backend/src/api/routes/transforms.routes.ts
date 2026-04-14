import { Router, Request, Response, NextFunction } from "express";
import {
  fourierTransformService,
  dftService,
  historyRepository,
} from "../../infrastructure/container";
import type {
  FourierTransformInput,
  InverseFourierTransformInput,
  DFTInput,
} from "../../domain/types/fourier.types";
import { sanitizeSegments, sanitizeExpression } from "../middlewares/sanitize";
import { AuthenticatedRequest } from "../middlewares/authenticate";
import { incrementCalculationCount } from "../middlewares/requireTierLimit";
import { trackClientConnection } from "../middlewares/requestLifecycle";

export const transformsRouter = Router();

function shouldConsumeTransformCalculation(result: {
  exists?: boolean;
}): boolean {
  return result.exists !== false;
}

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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = trackClientConnection(req, res);
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
      const shouldConsume = shouldConsumeTransformCalculation(result);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        if (req.user) {
          if (shouldConsume) {
            await incrementCalculationCount(req.user.id);
          }
          await historyRepository.create({
            userId: req.user.id,
            type: "fourier_transform",
            input: input as unknown as Record<string, unknown>,
            executionMs: result.executionTimeMs,
          });
        } else {
          if (shouldConsume) {
            await incrementCalculationCount(req.ip ?? "0.0.0.0", true);
          }
          await historyRepository.create({
            ipAddress: req.ip ?? undefined,
            type: "fourier_transform",
            input: input as unknown as Record<string, unknown>,
            executionMs: result.executionTimeMs,
          });
        }
      }
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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = trackClientConnection(req, res);
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
      const shouldConsume = shouldConsumeTransformCalculation(result);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        if (req.user) {
          if (shouldConsume) {
            await incrementCalculationCount(req.user.id);
          }
          await historyRepository.create({
            userId: req.user.id,
            type: "inverse_fourier_transform",
            input: input as unknown as Record<string, unknown>,
            executionMs: result.executionTimeMs,
          });
        } else {
          if (shouldConsume) {
            await incrementCalculationCount(req.ip ?? "0.0.0.0", true);
          }
          await historyRepository.create({
            ipAddress: req.ip ?? undefined,
            type: "inverse_fourier_transform",
            input: input as unknown as Record<string, unknown>,
            executionMs: result.executionTimeMs,
          });
        }
      }
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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = trackClientConnection(req, res);
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

      if (input.points.length > 20000) {
        res.status(400).json({ error: "Maximum 20000 points allowed" });
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
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        if (req.user) {
          await incrementCalculationCount(req.user.id);
          await historyRepository.create({
            userId: req.user.id,
            type: "dft_signal",
            input: input as unknown as Record<string, unknown>,
            executionMs: result.executionTimeMs,
          });
        } else {
          await incrementCalculationCount(req.ip ?? "0.0.0.0", true);
          await historyRepository.create({
            ipAddress: req.ip ?? undefined,
            type: "dft_signal",
            input: input as unknown as Record<string, unknown>,
            executionMs: result.executionTimeMs,
          });
        }
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
