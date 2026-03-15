import { MaximaRunner } from "../maxima/maximaRunner";
import { loadScript } from "../maxima/scriptLoader";
import type { IPostProcessor } from "../../domain/interfaces/IPostProcessor";
import type { FourierResult } from "../../domain/types/fourier.types";

export class MaximaPostProcessor implements IPostProcessor {
  constructor(private readonly runner: MaximaRunner) {}

  canProcess(raw: string): boolean {
    return raw.includes("gamma_incomplete");
  }

  async process(result: FourierResult): Promise<FourierResult> {
    const script = await loadScript("auxiliary", "clean_integral.mac");

    const updatedCoefficients = { ...result.coefficients };
    const simplifications: Record<string, string> = {
      ...result.simplifications,
    };

    for (const [key, value] of Object.entries(result.coefficients)) {
      if (!value || !this.canProcess(value)) continue;

      const call = `string(simplify_expint(clean_integral(${value}, x)));`;
      const maxResult = await this.runner.run({
        script: `${script}\n${call}`,
      });

      if (maxResult.success && maxResult.raw) {
        simplifications[`${key}_gamma`] = value;
        updatedCoefficients[key as keyof typeof updatedCoefficients] =
          maxResult.raw.trim();
      }
    }

    return {
      ...result,
      coefficients: updatedCoefficients,
      simplifications,
    };
  }
}
