import { Router, Request, Response, NextFunction } from "express";
import { LatexParserService } from "../../application/latex/latexParser.service";
import { auxiliaryService } from "../../infrastructure/container";
import { sanitizeExpression } from "../middlewares/sanitize";

const router = Router();
const parserService = new LatexParserService();

/**
 * POST /api/parse/latex
 *
 * Converts a LaTeX expression to Maxima CAS syntax.
 * Lightweight endpoint — runs tex2max (pure JS), no Maxima process is spawned.
 *
 * Body: { latex: string, mode?: "series" | "transform" }
 * Response: { maxima: string, ok: boolean, error?: string }
 */
router.post("/latex", (req: Request, res: Response) => {
  const { latex, mode } = req.body as { latex?: unknown; mode?: unknown };

  if (typeof latex !== "string" || !latex.trim()) {
    res
      .status(400)
      .json({
        ok: false,
        error: "El campo 'latex' es requerido y debe ser una cadena no vacía.",
      });
    return;
  }

  if (latex.length > 500) {
    res
      .status(400)
      .json({
        ok: false,
        error: "La expresión excede el límite de 500 caracteres.",
      });
    return;
  }

  const result =
    mode === "transform"
      ? parserService.parseForTransforms(latex)
      : parserService.parse(latex);

  res.json(result);
});

function validatePairs(
  raw: unknown,
  fieldName: string,
): Array<{ a: string; b: string }> {
  if (!Array.isArray(raw) || raw.length > 10) {
    throw new Error(`${fieldName} must be an array (max 10)`);
  }
  return (raw as unknown[]).map((p) => {
    if (typeof p !== "object" || p === null) throw new Error("invalid pair");
    const { a, b } = p as { a: unknown; b: unknown };
    if (typeof a !== "string" || typeof b !== "string")
      throw new Error("invalid pair");
    if (a.length > 300 || b.length > 300)
      throw new Error("expression too long");

    const left = a.trim();
    const right = b.trim();

    const aCheck = sanitizeExpression(left);
    if (!aCheck.valid) {
      throw new Error(`invalid expression in pair.a: ${aCheck.error}`);
    }

    const bCheck = sanitizeExpression(right);
    if (!bCheck.valid) {
      throw new Error(`invalid expression in pair.b: ${bCheck.error}`);
    }

    return { a: left, b: right };
  });
}

/**
 * POST /api/parse/compare
 *
 * Symbolically validates interval pairs via Maxima. Accepts two optional arrays
 * in a single request to minimise round-trips:
 *   - pairs      → ratsimp(a-b)=0   → continuity check between adjacent segments
 *   - orderPairs → is(a < b)        → from < to check per segment
 *
 * Body: { pairs?: Array<{a,b}>, orderPairs?: Array<{a,b}> }
 * Response: { results?: [...'equal'|'different'|'unknown'], orderResults?: [...'valid'|'invalid'|'unknown'] }
 */
router.post(
  "/compare",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { pairs?: unknown; orderPairs?: unknown };
      const hasPairs =
        Array.isArray(body.pairs) && (body.pairs as unknown[]).length > 0;
      const hasOrderPairs =
        Array.isArray(body.orderPairs) &&
        (body.orderPairs as unknown[]).length > 0;

      if (!hasPairs && !hasOrderPairs) {
        res
          .status(400)
          .json({
            ok: false,
            error: "At least one of 'pairs' or 'orderPairs' must be provided",
          });
        return;
      }

      const [validatedPairs, validatedOrderPairs] = [
        hasPairs ? validatePairs(body.pairs, "pairs") : [],
        hasOrderPairs ? validatePairs(body.orderPairs, "orderPairs") : [],
      ];

      const [results, orderResults] = await Promise.all([
        hasPairs
          ? auxiliaryService.compareExpressions(validatedPairs)
          : Promise.resolve([]),
        hasOrderPairs
          ? auxiliaryService.checkOrders(validatedOrderPairs)
          : Promise.resolve([]),
      ]);

      res.json({
        ...(hasPairs && { results }),
        ...(hasOrderPairs && { orderResults }),
      });
    } catch (err) {
      next(err);
    }
  },
);

export { router as parseRouter };
