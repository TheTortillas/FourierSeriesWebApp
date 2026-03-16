import { MaximaRunner } from "../maxima/maximaRunner";
import { loadScript } from "../maxima/scriptLoader";
import type { IPostProcessor } from "../../domain/interfaces/IPostProcessor";
import type {
  FourierResult,
  SymbolicExpression,
} from "../../domain/types/fourier.types";

export class MaximaPostProcessor implements IPostProcessor {
  constructor(private readonly runner: MaximaRunner) {}

  canProcess(expr: SymbolicExpression): boolean {
    return expr.maxima.includes("gamma_incomplete");
  }

  async process(result: FourierResult): Promise<FourierResult> {
    const script = await loadScript("auxiliary", "clean_integral.mac");
    const updatedCoefficients = { ...result.coefficients };
    const simplifications: Record<string, SymbolicExpression> = {
      ...result.simplifications,
    };

    for (const [key, expr] of Object.entries(result.coefficients)) {
      if (!expr || !this.canProcess(expr)) continue;

      const call = `
block(
  [_expr: simplify_expint(clean_integral(${expr.maxima}, x))],
  print(string(_expr)),
  tex(_expr)
);`;

      const maxResult = await this.runner.run({
        script: `${script}\n${call}`,
      });

      if (maxResult.success) {
        simplifications[`${key}_gamma`] = expr;
        updatedCoefficients[key as keyof typeof updatedCoefficients] =
          this.parseResult(maxResult.raw);
      }
    }

    return {
      ...result,
      coefficients: updatedCoefficients,
      simplifications,
    };
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

  // private extractTex(raw: string): string {
  //   const match = raw.match(/\$\$(.+?)\$\$/s);
  //   return match ? match[1].trim() : raw.trim();
  // }
}
