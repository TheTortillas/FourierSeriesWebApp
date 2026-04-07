import { Router, Request, Response, NextFunction } from "express";
import { LatexParserService } from "../../application/latex/latexParser.service";
import { auxiliaryService } from "../../infrastructure/container";

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
    res.status(400).json({ ok: false, error: "El campo 'latex' es requerido y debe ser una cadena no vacía." });
    return;
  }

  if (latex.length > 500) {
    res.status(400).json({ ok: false, error: "La expresión excede el límite de 500 caracteres." });
    return;
  }

  const result =
    mode === "transform"
      ? parserService.parseForTransforms(latex)
      : parserService.parse(latex);

  res.json(result);
});

/**
 * POST /api/parse/compare
 *
 * Symbolically compares pairs of Maxima expressions via ratsimp(a - b) = 0.
 * Used for real-time interval continuity validation in the UI.
 *
 * Body: { pairs: Array<{ a: string, b: string }> }
 * Response: { results: Array<'equal' | 'different' | 'unknown'> }
 */
router.post("/compare", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pairs } = req.body as { pairs?: unknown };

    if (!Array.isArray(pairs) || pairs.length === 0 || pairs.length > 10) {
      res.status(400).json({ ok: false, error: "pairs must be a non-empty array (max 10)" });
      return;
    }

    const validated = (pairs as unknown[]).map((p) => {
      if (typeof p !== "object" || p === null) throw new Error("invalid pair");
      const { a, b } = p as { a: unknown; b: unknown };
      if (typeof a !== "string" || typeof b !== "string") throw new Error("invalid pair");
      if (a.length > 300 || b.length > 300) throw new Error("expression too long");
      return { a: a.trim(), b: b.trim() };
    });

    const results = await auxiliaryService.compareExpressions(validated);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

export { router as parseRouter };
