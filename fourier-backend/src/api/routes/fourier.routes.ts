import { Router, Request, Response, NextFunction } from "express";
import {
  complexService,
  halfRangeService,
  trigonometricService,
} from "../../infrastructure/container";
import { validateFourierInput } from "../middlewares/validate";
import type { PiecewiseFourierInput } from "../../domain/types/fourier.types";
import {
  sanitizeSegments,
  sanitizeVariableName,
} from "../middlewares/sanitize";
import { incrementCalculationCount } from "../middlewares/requireTierLimit";
import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { historyRepository } from "../../infrastructure/container";
import { trackClientConnection } from "../middlewares/requestLifecycle";

export const fourierRouter = Router();

function shouldConsumeCalculation(result: {
  validation?: { decision?: string };
}): boolean {
  return result.validation?.decision !== "reject";
}

function sanitizeFourierInput(input: PiecewiseFourierInput): {
  valid: boolean;
  error?: string;
} {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Invalid Fourier input payload" };
  }

  if (!Array.isArray(input.segments)) {
    return { valid: false, error: "Input segments must be an array" };
  }

  const segmentsCheck = sanitizeSegments(input.segments);
  if (!segmentsCheck.valid) {
    return segmentsCheck;
  }

  if (typeof input.intVar !== "string") {
    return { valid: false, error: "integration variable must be provided" };
  }

  const intVarCheck = sanitizeVariableName(
    input.intVar,
    "integration variable",
  );
  if (!intVarCheck.valid) {
    return intVarCheck;
  }

  return { valid: true };
}

/**
 * @openapi
 * /api/fourier/trigonometric:
 *   post:
 *     summary: Calcula la serie de Fourier trigonométrica
 *     tags: [Fourier]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FourierInput'
 *           example:
 *             segments:
 *               - expression: "cosh(x)"
 *                 from: "-%pi"
 *                 to: "%pi"
 *             seriesType: "trigonometric"
 *             intVar: "x"
 *     responses:
 *       200:
 *         description: Serie calculada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FourierResult'
 *       400:
 *         description: Input inválido
 *       500:
 *         description: Error de cálculo en Maxima
 */
fourierRouter.post(
  "/trigonometric",
  validateFourierInput,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = trackClientConnection(req, res);
      const input = req.body as PiecewiseFourierInput;
      const sanitizeCheck = sanitizeFourierInput(input);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }
      const result = await trigonometricService.calculate(input);
      const shouldConsume = shouldConsumeCalculation(result);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        if (req.user) {
          if (shouldConsume) {
            await incrementCalculationCount(req.user.id);
          }
          await historyRepository.create({
            userId: req.user.id,
            type: "trigonometric",
            input: input as unknown as Record<string, unknown>,
            executionMs: result.executionTimeMs,
          });
        } else {
          if (shouldConsume) {
            await incrementCalculationCount(req.ip ?? "0.0.0.0", true);
          }
          await historyRepository.create({
            ipAddress: req.ip ?? undefined,
            type: "trigonometric",
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
 * /api/fourier/trigonometric/terms:
 *   post:
 *     summary: Calcula los primeros N términos de la serie trigonométrica
 *     tags: [Fourier]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [input, nTerms]
 *             properties:
 *               input:
 *                 $ref: '#/components/schemas/FourierInput'
 *               nTerms:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       200:
 *         description: Términos calculados exitosamente
 *       500:
 *         description: Error de cálculo en Maxima
 */
fourierRouter.post(
  "/trigonometric/terms",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { input, nTerms } = req.body as {
        input: PiecewiseFourierInput;
        nTerms: number;
      };
      const sanitizeCheck = sanitizeFourierInput(input);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }
      const result = await trigonometricService.calculateTerms(input, nTerms);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/fourier/half-range:
 *   post:
 *     summary: Calcula las series de Fourier de medio rango (seno y coseno)
 *     tags: [Fourier]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FourierInput'
 *           example:
 *             segments:
 *               - expression: "x"
 *                 from: "0"
 *                 to: "%pi"
 *             seriesType: "halfRange"
 *             intVar: "x"
 *     responses:
 *       200:
 *         description: Series calculadas exitosamente
 *       400:
 *         description: Input inválido
 *       500:
 *         description: Error de cálculo en Maxima
 */
fourierRouter.post(
  "/half-range",
  validateFourierInput,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = trackClientConnection(req, res);
      const input = req.body as PiecewiseFourierInput;
      const sanitizeCheck = sanitizeFourierInput(input);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }
      const result = await halfRangeService.calculate(input);
      const shouldConsume = shouldConsumeCalculation(result);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        if (req.user) {
          if (shouldConsume) {
            await incrementCalculationCount(req.user.id);
          }
          await historyRepository.create({
            userId: req.user.id,
            type: "half_range",
            input: input as unknown as Record<string, unknown>,
            executionMs: result.executionTimeMs,
          });
        } else {
          if (shouldConsume) {
            await incrementCalculationCount(req.ip ?? "0.0.0.0", true);
          }
          await historyRepository.create({
            ipAddress: req.ip ?? undefined,
            type: "half_range",
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
 * /api/fourier/half-range/terms:
 *   post:
 *     summary: Calcula los primeros N términos de la serie de medio rango
 *     tags: [Fourier]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [input, nTerms]
 *             properties:
 *               input:
 *                 $ref: '#/components/schemas/FourierInput'
 *               nTerms:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       200:
 *         description: Términos calculados exitosamente
 *       500:
 *         description: Error de cálculo en Maxima
 */
fourierRouter.post(
  "/half-range/terms",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { input, nTerms } = req.body as {
        input: PiecewiseFourierInput;
        nTerms: number;
      };
      const sanitizeCheck = sanitizeFourierInput(input);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }
      const result = await halfRangeService.calculateTerms(input, nTerms);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/fourier/complex:
 *   post:
 *     summary: Calcula la serie de Fourier compleja
 *     tags: [Fourier]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FourierInput'
 *           example:
 *             segments:
 *               - expression: "exp(-x)"
 *                 from: "-%pi"
 *                 to: "%pi"
 *             seriesType: "complex"
 *             intVar: "x"
 *     responses:
 *       200:
 *         description: Serie calculada exitosamente
 *       400:
 *         description: Input inválido
 *       500:
 *         description: Error de cálculo en Maxima
 */
fourierRouter.post(
  "/complex",
  validateFourierInput,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = trackClientConnection(req, res);
      const input = req.body as PiecewiseFourierInput;
      const sanitizeCheck = sanitizeFourierInput(input);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }

      const result = await complexService.calculate(input);
      const shouldConsume = shouldConsumeCalculation(result);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        if (req.user) {
          if (shouldConsume) {
            await incrementCalculationCount(req.user.id);
          }
          await historyRepository.create({
            userId: req.user.id,
            type: "complex",
            input: input as unknown as Record<string, unknown>,
            executionMs: result.executionTimeMs,
          });
        } else {
          if (shouldConsume) {
            await incrementCalculationCount(req.ip ?? "0.0.0.0", true);
          }
          await historyRepository.create({
            ipAddress: req.ip ?? undefined,
            type: "complex",
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
 * /api/fourier/complex/terms:
 *   post:
 *     summary: Calcula los primeros N términos de la serie compleja
 *     tags: [Fourier]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [input, nTerms]
 *             properties:
 *               input:
 *                 $ref: '#/components/schemas/FourierInput'
 *               nTerms:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       200:
 *         description: Términos calculados exitosamente
 *       500:
 *         description: Error de cálculo en Maxima
 */
fourierRouter.post(
  "/complex/terms",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { input, nTerms } = req.body as {
        input: PiecewiseFourierInput;
        nTerms: number;
      };
      const sanitizeCheck = sanitizeFourierInput(input);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }
      const result = await complexService.calculateTerms(input, nTerms);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
