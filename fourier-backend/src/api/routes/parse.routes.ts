import { Router, Request, Response } from "express";
import { LatexParserService } from "../../application/latex/latexParser.service";

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

export { router as parseRouter };
