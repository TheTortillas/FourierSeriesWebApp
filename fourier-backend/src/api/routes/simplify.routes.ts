import { Router, Request, Response, NextFunction } from "express";
import { simplifyService } from "../../infrastructure/container";
import type {
  SimplifyInput,
  SimplificationFunction,
  SimplificationProfile,
} from "../../domain/types/fourier.types";
import {
  sanitizeConvention,
  sanitizeExpression,
  sanitizeVariableName,
} from "../middlewares/sanitize";

export const simplifyRouter = Router();

const VALID_PROFILES: SimplificationProfile[] = [
  "raw",
  "integer",
  "trigonometric",
  "exponential",
  "complete",
];

const VALID_FUNCTIONS: SimplificationFunction[] = [
  "fullratsimp",
  "ratsimp",
  "trigsimp",
  "trigreduce",
  "trigexpand",
  "factor",
  "expand",
  "radcan",
  "rectform",
  "polarform",
  "to_hyper",
];

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
 *                 erfRepresentation:
 *                   type: string
 *                   enum: [erf, erfc, erfi]
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

      if (!VALID_PROFILES.includes(input.profile)) {
        res.status(400).json({ error: `profile must be one of: ${VALID_PROFILES.join(", ")}` });
        return;
      }

      if (input.functions !== undefined) {
        if (!Array.isArray(input.functions) || !input.functions.every((f) => VALID_FUNCTIONS.includes(f))) {
          res.status(400).json({ error: `functions must be a subset of: ${VALID_FUNCTIONS.join(", ")}` });
          return;
        }
      }

      if (input.splitVar !== undefined) {
        const splitVarCheck = sanitizeVariableName(input.splitVar, "splitVar");
        if (!splitVarCheck.valid) { res.status(400).json({ error: splitVarCheck.error }); return; }
      }

      if (input.baseK !== undefined) {
        const baseKCheck = sanitizeExpression(input.baseK);
        if (!baseKCheck.valid) { res.status(400).json({ error: `baseK: ${baseKCheck.error}` }); return; }
      }

      input.convention = sanitizeConvention(input.convention);
      const result = await simplifyService.simplify(input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
