import { Router, Request, Response, NextFunction } from "express";
import {
  fourierTransformService,
  fourierIntegralService,
  laplaceService,
  dftService,
  historyRepository,
} from "../../infrastructure/container";
import type {
  FourierTransformInput,
  InverseFourierTransformInput,
  FourierIntegralInput,
  FourierIntegralReconstructInput,
  DFTInput,
  DFTFunctionInput,
  LaplaceDirectInput,
  LaplaceInverseInput,
  LaplaceOdeInput,
} from "../../domain/types/fourier.types";
import {
  sanitizeConvention,
  sanitizeExpression,
  sanitizeSegments,
  sanitizeVariableName,
} from "../middlewares/sanitize";
import { AuthenticatedRequest } from "../middlewares/authenticate";
import { tryConsumeQuota, type QuotaRequest } from "../middlewares/requireTierLimit";
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

      if (input.intVar) {
        const intVarCheck = sanitizeVariableName(input.intVar, "intVar");
        if (!intVarCheck.valid) {
          res.status(400).json({ error: intVarCheck.error });
          return;
        }
      }

      if (input.transVar) {
        const transVarCheck = sanitizeVariableName(input.transVar, "transVar");
        if (!transVarCheck.valid) {
          res.status(400).json({ error: transVarCheck.error });
          return;
        }
      }

      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }
      input.convention = sanitizeConvention(input.convention);
      const result = await fourierTransformService.transform(input);
      const shouldConsume = shouldConsumeTransformCalculation(result);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        if (shouldConsume) await tryConsumeQuota(req as QuotaRequest);
        await historyRepository.create({
          userId: req.user?.id,
          ipAddress: req.ip ?? undefined,
          type: "fourier_transform",
          input: input as unknown as Record<string, unknown>,
          executionMs: result.executionTimeMs,
        });
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

      if (input.intVar) {
        const intVarCheck = sanitizeVariableName(input.intVar, "intVar");
        if (!intVarCheck.valid) {
          res.status(400).json({ error: intVarCheck.error });
          return;
        }
      }

      if (input.transVar) {
        const transVarCheck = sanitizeVariableName(input.transVar, "transVar");
        if (!transVarCheck.valid) {
          res.status(400).json({ error: transVarCheck.error });
          return;
        }
      }

      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }
      input.convention = sanitizeConvention(input.convention);
      const result = await fourierTransformService.inverseTransform(input);
      const shouldConsume = shouldConsumeTransformCalculation(result);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        if (shouldConsume) await tryConsumeQuota(req as QuotaRequest);
        await historyRepository.create({
          userId: req.user?.id,
          ipAddress: req.ip ?? undefined,
          type: "inverse_fourier_transform",
          input: input as unknown as Record<string, unknown>,
          executionMs: result.executionTimeMs,
        });
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
/**
 * @openapi
 * /api/transforms/fourier-integral/coefficients:
 *   post:
 *     summary: Calcula los coeficientes de la Integral de Fourier (A(w), B(w) o C(w))
 *     tags: [Transforms]
 */
transformsRouter.post(
  "/fourier-integral/coefficients",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = trackClientConnection(req, res);
      const input = req.body as FourierIntegralInput;

      if (!input.segments || input.segments.length === 0) {
        res.status(400).json({ error: "segments is required" });
        return;
      }

      const validVariants = ["trigonometric", "complex", "cosine", "sine"];
      if (!input.variant || !validVariants.includes(input.variant)) {
        res.status(400).json({ error: `variant must be one of: ${validVariants.join(", ")}` });
        return;
      }

      if (input.intVar) {
        const check = sanitizeVariableName(input.intVar, "intVar");
        if (!check.valid) { res.status(400).json({ error: check.error }); return; }
      }
      if (input.transVar) {
        const check = sanitizeVariableName(input.transVar, "transVar");
        if (!check.valid) { res.status(400).json({ error: check.error }); return; }
      }

      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }

      const result = await fourierIntegralService.coefficients(input);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        if (result.exists) await tryConsumeQuota(req as QuotaRequest);
        await historyRepository.create({
          userId: req.user?.id,
          ipAddress: req.ip ?? undefined,
          type: "fourier_integral",
          input: input as unknown as Record<string, unknown>,
          executionMs: result.executionTimeMs,
        });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/transforms/fourier-integral/reconstruct:
 *   post:
 *     summary: Reconstruye f(x) numéricamente con límite superior `a` (para el slider)
 *     tags: [Transforms]
 */
transformsRouter.post(
  "/fourier-integral/reconstruct",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input = req.body as FourierIntegralReconstructInput;

      if (!input.segments || input.segments.length === 0) {
        res.status(400).json({ error: "segments is required" });
        return;
      }

      const validVariants = ["trigonometric", "complex", "cosine", "sine"];
      if (!input.variant || !validVariants.includes(input.variant)) {
        res.status(400).json({ error: `variant must be one of: ${validVariants.join(", ")}` });
        return;
      }

      if (typeof input.upperLimit !== "number" || input.upperLimit <= 0) {
        res.status(400).json({ error: "upperLimit must be a positive number" });
        return;
      }

      if (typeof input.xMin !== "number" || typeof input.xMax !== "number" || input.xMin >= input.xMax) {
        res.status(400).json({ error: "xMin must be less than xMax" });
        return;
      }

      if (input.nPoints !== undefined && (input.nPoints < 10 || input.nPoints > 500)) {
        res.status(400).json({ error: "nPoints must be between 10 and 500" });
        return;
      }

      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }

      const result = await fourierIntegralService.reconstruct(input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);


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

      const historyType = input.mode === "epicycles" ? "dft_epicycles" : "dft_signal";
      if (shouldPersistSideEffects) {
        await tryConsumeQuota(req as QuotaRequest);
        await historyRepository.create({
          userId: req.user?.id,
          ipAddress: req.ip ?? undefined,
          type: historyType,
          input: input as unknown as Record<string, unknown>,
          executionMs: result.executionTimeMs,
        });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/transforms/dft/sample:
 *   post:
 *     summary: Muestrea una función definida por tramos para usarla como entrada de la DFT
 *     tags: [Transforms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [segments, N]
 *             properties:
 *               segments:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/PiecewiseSegment'
 *               N:
 *                 type: integer
 *                 minimum: 4
 *                 maximum: 4096
 *                 description: Número de muestras
 *               intVar:
 *                 type: string
 *                 example: "t"
 *           example:
 *             segments:
 *               - expression: "sin(t)"
 *                 from: "0"
 *                 to: "2*%pi"
 *             N: 64
 *             intVar: "t"
 *     responses:
 *       200:
 *         description: Muestras obtenidas exitosamente
 *       400:
 *         description: Input inválido
 *       500:
 *         description: Error de cálculo
 */
transformsRouter.post(
  "/dft/sample",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = trackClientConnection(req, res);
      const input = req.body as DFTFunctionInput;

      if (!input.segments || !Array.isArray(input.segments) || input.segments.length === 0) {
        res.status(400).json({ error: "segments is required" });
        return;
      }

      if (!input.N || input.N < 4 || input.N > 4096) {
        res.status(400).json({ error: "N must be between 4 and 4096" });
        return;
      }

      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }

      if (input.intVar) {
        const varCheck = sanitizeVariableName(input.intVar, "intVar");
        if (!varCheck.valid) {
          res.status(400).json({ error: varCheck.error });
          return;
        }
      }

      const result = await dftService.sampleFunction(input);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        await tryConsumeQuota(req as QuotaRequest);
        await historyRepository.create({
          userId: req.user?.id,
          ipAddress: req.ip ?? undefined,
          type: "dft_signal",
          input: input as unknown as Record<string, unknown>,
          executionMs: result.samplingTimeMs,
        });
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @openapi
 * /api/transforms/dft/function:
 *   post:
 *     summary: Calcula la DFT/FFT a partir de una función definida por tramos
 *     tags: [Transforms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [segments, N]
 *             properties:
 *               segments:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/PiecewiseSegment'
 *               N:
 *                 type: integer
 *                 minimum: 4
 *                 maximum: 4096
 *                 description: Número de muestras a tomar de la función
 *               intVar:
 *                 type: string
 *                 example: "t"
 *           example:
 *             segments:
 *               - expression: "sin(t)"
 *                 from: "0"
 *                 to: "2*%pi"
 *             N: 64
 *             intVar: "t"
 *     responses:
 *       200:
 *         description: DFT calculada exitosamente
 *       400:
 *         description: Input inválido
 *       500:
 *         description: Error de cálculo
 */
transformsRouter.post(
  "/dft/function",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = trackClientConnection(req, res);
      const input = req.body as DFTFunctionInput;

      if (!input.segments || !Array.isArray(input.segments) || input.segments.length === 0) {
        res.status(400).json({ error: "segments is required" });
        return;
      }

      if (!input.N || input.N < 4 || input.N > 4096) {
        res.status(400).json({ error: "N must be between 4 and 4096" });
        return;
      }

      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }

      if (input.intVar) {
        const varCheck = sanitizeVariableName(input.intVar, "intVar");
        if (!varCheck.valid) {
          res.status(400).json({ error: varCheck.error });
          return;
        }
      }

      const result = await dftService.computeFromFunction(input);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects) {
        await tryConsumeQuota(req as QuotaRequest);
        await historyRepository.create({
          userId: req.user?.id,
          ipAddress: req.ip ?? undefined,
          type: "dft_signal",
          input: input as unknown as Record<string, unknown>,
          executionMs: result.executionTimeMs,
        });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ── Laplace: direct ──────────────────────────────────────────────────────────

transformsRouter.post(
  "/laplace/direct",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LaplaceDirectInput;

      if (!Array.isArray(body.segments) || body.segments.length === 0) {
        res.status(400).json({ error: "segments required" });
        return;
      }
      const sanitized = sanitizeSegments(body.segments);
      if (!sanitized.valid) { res.status(400).json({ error: sanitized.error ?? "Invalid segments" }); return; }

      const timeVarCheck = body.timeVar ? sanitizeVariableName(body.timeVar, "timeVar") : null;
      if (timeVarCheck && !timeVarCheck.valid) { res.status(400).json({ error: timeVarCheck.error }); return; }
      const freqVarCheck = body.freqVar ? sanitizeVariableName(body.freqVar, "freqVar") : null;
      if (freqVarCheck && !freqVarCheck.valid) { res.status(400).json({ error: freqVarCheck.error }); return; }

      const input: LaplaceDirectInput = {
        segments: body.segments,
        timeVar: body.timeVar ?? "t",
        freqVar: body.freqVar ?? "s",
      };

      const client = trackClientConnection(req, res);
      const result = await laplaceService.direct(input);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects && result.exists) {
        await tryConsumeQuota(req as QuotaRequest);
        await historyRepository.create({
          userId:      req.user?.id,
          ipAddress:   req.ip ?? undefined,
          type:        "laplace_direct",
          input:       input as unknown as Record<string, unknown>,
          executionMs: result.executionTimeMs,
        });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ── Laplace: inverse ─────────────────────────────────────────────────────────

transformsRouter.post(
  "/laplace/inverse",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LaplaceInverseInput;

      if (typeof body.expression !== "string" || !body.expression.trim()) {
        res.status(400).json({ error: "expression required" });
        return;
      }

      const freqVarCheckInv = body.freqVar ? sanitizeVariableName(body.freqVar, "freqVar") : null;
      if (freqVarCheckInv && !freqVarCheckInv.valid) { res.status(400).json({ error: freqVarCheckInv.error }); return; }
      const timeVarCheckInv = body.timeVar ? sanitizeVariableName(body.timeVar, "timeVar") : null;
      if (timeVarCheckInv && !timeVarCheckInv.valid) { res.status(400).json({ error: timeVarCheckInv.error }); return; }

      const exprCheck = sanitizeExpression(body.expression.trim());
      if (!exprCheck.valid) { res.status(400).json({ error: exprCheck.error }); return; }

      const input: LaplaceInverseInput = {
        expression: body.expression.trim(),
        freqVar:    body.freqVar ?? "s",
        timeVar:    body.timeVar ?? "t",
      };

      const client = trackClientConnection(req, res);
      const result = await laplaceService.inverse(input);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects && result.exists) {
        await tryConsumeQuota(req as QuotaRequest);
        await historyRepository.create({
          userId:      req.user?.id,
          ipAddress:   req.ip ?? undefined,
          type:        "laplace_inverse",
          input:       input as unknown as Record<string, unknown>,
          executionMs: result.executionTimeMs,
        });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ── Laplace: ODE ─────────────────────────────────────────────────────────────

transformsRouter.post(
  "/laplace/ode",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LaplaceOdeInput;

      if (typeof body.equation !== "string" || !body.equation.trim()) {
        res.status(400).json({ error: "equation required" });
        return;
      }
      if (typeof body.unknown !== "string" || !body.unknown.trim()) {
        res.status(400).json({ error: "unknown required" });
        return;
      }
      if (!Array.isArray(body.initialConditions)) {
        res.status(400).json({ error: "initialConditions required" });
        return;
      }

      const eqCheck = sanitizeExpression(body.equation.trim());
      if (!eqCheck.valid) { res.status(400).json({ error: eqCheck.error }); return; }
      const timeVarCheckOde = body.timeVar ? sanitizeVariableName(body.timeVar, "timeVar") : null;
      if (timeVarCheckOde && !timeVarCheckOde.valid) { res.status(400).json({ error: timeVarCheckOde.error }); return; }

      const input: LaplaceOdeInput = {
        equation:          body.equation.trim(),
        unknown:           body.unknown.trim(),
        timeVar:           body.timeVar ?? "t",
        initialConditions: body.initialConditions.map((ic) => ({
          order: Number(ic.order),
          value: String(ic.value).trim(),
        })),
      };

      const client = trackClientConnection(req, res);
      const result = await laplaceService.ode(input);
      const shouldPersistSideEffects = !client.isDisconnected();

      if (shouldPersistSideEffects && result.exists) {
        await tryConsumeQuota(req as QuotaRequest);
        await historyRepository.create({
          userId:      req.user?.id,
          ipAddress:   req.ip ?? undefined,
          type:        "laplace_ode",
          input:       input as unknown as Record<string, unknown>,
          executionMs: result.executionTimeMs,
        });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
