import { Router, Request, Response, NextFunction } from "express";
import {
  complexService,
  halfRangeService,
  trigonometricService,
} from "../../infrastructure/container";
import { validateFourierInput } from "../middlewares/validate";
import type { PiecewiseFourierInput } from "../../domain/types/fourier.types";
import { sanitizeSegments, sanitizeExpression } from "../middlewares/sanitize";
import { incrementCalculationCount } from "../middlewares/requireTierLimit";
import type { AuthenticatedRequest } from "../middlewares/authenticate";

export const fourierRouter = Router();

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
      const input = req.body as PiecewiseFourierInput;
      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }
      const result = await trigonometricService.calculate(input);
      await incrementCalculationCount(req.user!.id);
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
      const sanitizeCheck = sanitizeSegments(input.segments);
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
      const input = req.body as PiecewiseFourierInput;
      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }
      const result = await halfRangeService.calculate(input);
      await incrementCalculationCount(req.user!.id);
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
      const sanitizeCheck = sanitizeSegments(input.segments);
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
      const input = req.body as PiecewiseFourierInput;
      const sanitizeCheck = sanitizeSegments(input.segments);
      if (!sanitizeCheck.valid) {
        res.status(400).json({ error: sanitizeCheck.error });
        return;
      }

      const result = await complexService.calculate(input);
      await incrementCalculationCount(req.user!.id);

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
      const sanitizeCheck = sanitizeSegments(input.segments);
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
