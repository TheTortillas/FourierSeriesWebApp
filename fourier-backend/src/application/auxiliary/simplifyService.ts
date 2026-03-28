import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import type {
  SimplifyInput,
  SimplifyResult,
  SimplificationFunction,
} from "../../domain/types/fourier.types";

const DEFAULT_FUNCTIONS: Record<string, SimplificationFunction[]> = {
  raw: [],
  integer: ["fullratsimp", "factor"],
  trigonometric: ["fullratsimp", "factor"],
  exponential: ["fullratsimp", "factor"],
  complete: ["fullratsimp", "factor"],
};

export class SimplifyService {
  constructor(private readonly runner: MaximaRunner) {}

  async simplify(input: SimplifyInput): Promise<SimplifyResult> {
    const functions = input.functions ?? DEFAULT_FUNCTIONS[input.profile] ?? [];
    const flags = input.displayFlags ?? {};
    const erfRepresentation = flags.erfRepresentation ?? "erf";

    if (flags.exponentialize && flags.demoivre) {
      throw new Error("exponentialize and demoivre cannot both be true");
    }

    if (!["erf", "erfc", "erfi"].includes(erfRepresentation)) {
      throw new Error("erfRepresentation must be one of: erf, erfc, erfi");
    }

    const script = await loadScript("auxiliary", "simplify.mac");

    const simpFunctionsList = `[${functions.map((f) => `"${f}"`).join(", ")}]`;

    const fullScript = `
EXPR_INPUT: "${input.expression.replace(/"/g, '\\"')}"$
PROFILE: "${input.profile}"$
SIMP_FUNCTIONS: ${simpFunctionsList}$
FLAG_EDISPFLAG: ${flags.edispflag ? "true" : "false"}$
FLAG_EXPONENT:  ${flags.exponentialize ? "true" : "false"}$
FLAG_DEMOIVRE:  ${flags.demoivre ? "true" : "false"}$
FLAG_ERF_REPR:  "${erfRepresentation}"$
${script}
kill(all)$
`;

    //console.log("SIMPLIFY SCRIPT:", fullScript.slice(0, 300));

    const result = await this.runner.run({ script: fullScript });
    //console.log("RAW OUTPUT:", JSON.stringify(result.raw));

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    const simplifiedMaxima = this.extractBetween(
      result.raw,
      "__SIMPLIFIED_MAXIMA__",
      "__SIMPLIFIED_TEX__",
    )
      .replace(/false/g, "")
      .trim();

    const simplifiedTex = this.extractTex(
      this.extractBetween(result.raw, "__SIMPLIFIED_TEX__", null),
    );

    return {
      original: { maxima: input.expression, tex: "" },
      simplified: { maxima: simplifiedMaxima, tex: simplifiedTex },
      profile: input.profile,
      functionsApplied: functions,
    };
  }

  private extractBetween(
    text: string,
    start: string,
    end: string | null,
  ): string {
    const startIdx = text.indexOf(start);
    if (startIdx === -1) return "";
    const afterStart = startIdx + start.length;
    if (end === null) return text.slice(afterStart);
    const endIdx = text.indexOf(end, afterStart);
    return endIdx === -1
      ? text.slice(afterStart)
      : text.slice(afterStart, endIdx);
  }

  private extractTex(raw: string): string {
    const match = raw.match(/\$\$([\s\S]+?)\$\$/);
    if (!match) return "";

    return this.normalizeSpecialFunctionTex(match[1].trim());
  }

  private normalizeSpecialFunctionTex(tex: string): string {
    // Maxima can emit italic identifiers like {\it erfi}; normalize for consistent MathJax rendering.
    return tex
      .replace(/\{\\it\s+erf(i|c)?\}/g, (_m, suffix: string | undefined) => {
        const fn = `erf${suffix ?? ""}`;
        return `\\operatorname{${fn}}`;
      })
      .replace(/\\mathit\{erf(i|c)?\}/g, (_m, suffix: string | undefined) => {
        const fn = `erf${suffix ?? ""}`;
        return `\\operatorname{${fn}}`;
      });
  }
}
