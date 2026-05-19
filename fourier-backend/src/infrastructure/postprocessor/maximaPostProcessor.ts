import { MaximaRunner } from "../maxima/maximaRunner";
import { loadScript } from "../maxima/scriptLoader";
import type {
  IPostProcessor,
  CleanableSeriesResult,
} from "../../domain/interfaces/IPostProcessor";
import type { SymbolicExpression } from "../../domain/types/fourier.types";

const SERIES_FIELDS = [
  "series",
  "seriesComplex",
  "seriesCosine",
  "seriesSine",
] as const;

export class MaximaPostProcessor implements IPostProcessor {
  constructor(private readonly runner: MaximaRunner) {}

  canProcess(expr: SymbolicExpression): boolean {
    return expr.maxima.includes("gamma_incomplete");
  }

  async process<T extends CleanableSeriesResult>(result: T): Promise<T> {
    const script = await loadScript("auxiliary", "clean_integral.mac");
    const updatedCoefficients = { ...result.coefficients };
    const simplifications: Record<string, SymbolicExpression> = {
      ...result.simplifications,
    };
    const seriesUpdates: Partial<Record<string, SymbolicExpression>> = {};

    // Numeric fields hold plain numbers; DC fields (a0/c0) come from plain
    // integrals without a complex exponential, so clean_integral (which targets
    // gamma_incomplete produced by complex-exponential integration) must not be
    // applied to them — it would produce wrong Si/Ci forms for Shi/Ei integrals.
    const skipFields = new Set(["a0Float", "c0Float", "a0", "a0Raw", "c0"]);

    for (const [key, expr] of Object.entries(result.coefficients)) {
      if (skipFields.has(key)) continue;
      if (!expr || !this.canProcess(expr as SymbolicExpression)) continue;

      const symbolicExpr = expr as SymbolicExpression;
      const cleaned = await this.cleanExpr(script, symbolicExpr);
      if (cleaned) {
        simplifications[`${key}_gamma`] = symbolicExpr;
        (updatedCoefficients as Record<string, unknown>)[key] = cleaned;
      }
    }

    for (const field of SERIES_FIELDS) {
      const expr = (result as Record<string, unknown>)[field] as
        | SymbolicExpression
        | undefined;
      if (!expr || !this.canProcess(expr)) continue;
      const cleaned = await this.cleanExpr(script, expr);
      if (cleaned) {
        simplifications[`${field}_gamma`] = expr;
        seriesUpdates[field] = cleaned;
      }
    }

    return {
      ...result,
      coefficients: updatedCoefficients,
      simplifications,
      ...seriesUpdates,
    } as T;
  }

  private async cleanExpr(
    script: string,
    expr: SymbolicExpression,
  ): Promise<SymbolicExpression | null> {
    const call = `
block(
  [_expr: simplify_expint(clean_integral(${expr.maxima}, x))],
  print(string(_expr)),
  tex(_expr)
);`;
    const maxResult = await this.runner.run({ script: `${script}\n${call}` });
    if (!maxResult.success) return null;
    return this.parseResult(maxResult.raw);
  }

  private parseResult(raw: string): SymbolicExpression {
    const texMatch = raw.match(/\$\$(.+?)\$\$/s);
    const tex = texMatch ? texMatch[1].trim() : "";
    const maxima = raw
      .replace(/\$\$.*?\$\$/s, "")
      .replace(/false/g, "")
      .trim();

    return { tex, maxima };
  }
}
