import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import type {
  LaplaceDirectInput,
  LaplaceDirectResult,
  LaplaceInverseInput,
  LaplaceInverseResult,
  LaplaceOdeInput,
  LaplaceOdeResult,
  PiecewiseSegment,
  SymbolicExpression,
} from "../../domain/types/fourier.types";

export class LaplaceService {
  constructor(private readonly runner: MaximaRunner) {}

  // ── Direct: F(s) = L{f(t)} ───────────────────────────────────────────────

  async direct(input: LaplaceDirectInput): Promise<LaplaceDirectResult> {
    const startTime = Date.now();
    const timeVar  = input.timeVar ?? "t";
    const freqVar  = input.freqVar ?? "s";
    const funcInput = this.buildFuncInput(input.segments);

    const script = await loadScript("transforms", "laplace_direct.mac");
    const fullScript = `
radexpand: false$
FUNC_INPUT: ${funcInput};
INTVAR: ${timeVar};
TRANSVAR: ${freqVar};
${script}
kill(all)$
`.trim();

    const { raw } = await this.runner.run({ script: fullScript, timeoutMs: 60000 });

    const exists   = this.extractBetween(raw, "__EXISTS__", "__F_MAXIMA__").trim().includes("true");
    const fMaxima  = this.extractBetween(raw, "__F_MAXIMA__", "__F_TEX__").trim();
    const fTex     = this.extractTex(this.extractBetween(raw, "__F_TEX__", "__PARAMS__"));
    const paramsRaw = this.extractBetween(raw, "__PARAMS__", null).trim();
    const params   = this.parseParams(paramsRaw);

    return {
      input,
      exists,
      F: this.toSymbolic(fMaxima, fTex),
      params: params.length ? params : undefined,
      executionTimeMs: Date.now() - startTime,
    };
  }

  // ── Inverse: f(t) = L⁻¹{F(s)} ───────────────────────────────────────────

  async inverse(input: LaplaceInverseInput): Promise<LaplaceInverseResult> {
    const startTime = Date.now();
    const freqVar = input.freqVar ?? "s";
    const timeVar = input.timeVar ?? "t";

    const script = await loadScript("transforms", "laplace_inverse.mac");
    const fullScript = `
radexpand: false$
EXPR_INPUT: ${input.expression};
TRANSVAR: ${freqVar};
INTVAR: ${timeVar};
${script}
kill(all)$
`.trim();

    const { raw } = await this.runner.run({ script: fullScript, timeoutMs: 60000 });

    const exists  = this.extractBetween(raw, "__EXISTS__", "__F_MAXIMA__").trim().includes("true");
    const fMaxima = this.extractBetween(raw, "__F_MAXIMA__", "__F_TEX__").trim();
    const fTex    = this.extractTex(this.extractBetween(raw, "__F_TEX__", "__INVERSE_METHOD__"));
    const method  = this.extractBetween(raw, "__INVERSE_METHOD__", null).trim() as "ilt" | "pwilt" | "failed";

    return {
      input,
      exists,
      f: this.toSymbolic(fMaxima, fTex),
      inverseMethod: method || "failed",
      executionTimeMs: Date.now() - startTime,
    };
  }

  // ── ODE: solve via desolve + atvalue ─────────────────────────────────────

  async ode(input: LaplaceOdeInput): Promise<LaplaceOdeResult> {
    const startTime = Date.now();
    const timeVar = input.timeVar ?? "t";

    const icMaxima = input.initialConditions
      .map((ic) => `[${ic.order}, ${ic.value}]`)
      .join(", ");

    const script = await loadScript("transforms", "laplace_ode.mac");
    const fullScript = `
radexpand: false$
ODE_INPUT: ${input.equation};
UNKNOWN_FN: ${input.unknown};
INTVAR: ${timeVar};
IC_INPUT: [${icMaxima}];
${script}
kill(all)$
`.trim();

    const { raw } = await this.runner.run({ script: fullScript, timeoutMs: 90000 });

    const exists    = this.extractBetween(raw, "__EXISTS__", "__SOL_MAXIMA__").trim().includes("true");
    const solMaxima = this.extractBetween(raw, "__SOL_MAXIMA__", "__SOL_TEX__").trim();
    const solTex    = this.extractTex(this.extractBetween(raw, "__SOL_TEX__", null));

    return {
      input,
      exists,
      solution: this.toSymbolic(solMaxima, solTex),
      executionTimeMs: Date.now() - startTime,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildFuncInput(segments: PiecewiseSegment[]): string {
    const rows = segments.map((s) => `[${s.expression}, ${s.from}, ${s.to}]`).join(", ");
    return `matrix(${rows})`;
  }

  private parseParams(raw: string): string[] {
    const match = raw.match(/\[([^\]]*)\]/);
    if (!match) return [];
    return match[1].split(",").map((s) => s.trim()).filter(Boolean);
  }

  private toSymbolic(maxima: string, tex: string): SymbolicExpression | undefined {
    if (!maxima) return undefined;
    if (/^(result\d+|%r\d+|%t\d+|%c\d+)$/.test(maxima.trim())) return undefined;
    return { maxima, tex };
  }

  private extractBetween(text: string, start: string, end: string | null): string {
    const startIdx = text.indexOf(start);
    if (startIdx === -1) return "";
    const afterStart = startIdx + start.length;
    if (end === null) return text.slice(afterStart);
    const endIdx = text.indexOf(end, afterStart);
    return endIdx === -1 ? text.slice(afterStart) : text.slice(afterStart, endIdx);
  }

  private extractTex(raw: string): string {
    const match = raw.match(/\$\$([\s\S]+?)\$\$/);
    return match ? match[1].trim() : "";
  }
}
