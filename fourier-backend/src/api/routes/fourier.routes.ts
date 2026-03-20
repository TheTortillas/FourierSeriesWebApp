import { Router, Request, Response, NextFunction } from "express";
import { trigonometricService } from "../../infrastructure/container";
import { validateFourierInput } from "../middlewares/validate";
import type { PiecewiseFourierInput } from "../../domain/types/fourier.types";

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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as PiecewiseFourierInput;
      const result = await trigonometricService.calculate(input);
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
      const result = await trigonometricService.calculateTerms(input, nTerms);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
