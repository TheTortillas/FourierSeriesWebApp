import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import type {
  LaplaceDirectInput,
  LaplaceDirectResult,
  LaplaceInverseInput,
  LaplaceInverseResult,
  LaplaceOdeInput,
  LaplaceOdeResult,
  LaplacePoleZeroInput,
  LaplacePoleZeroResult,
  ComplexPoint2,
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

    const exists     = this.extractBetween(raw, "__EXISTS__", "__F_MAXIMA__").trim().includes("true");
    const fMaxima    = this.extractBetween(raw, "__F_MAXIMA__", "__F_TEX__").trim();
    const fTex       = this.extractTex(this.extractBetween(raw, "__F_TEX__", "__PARAMS__"));
    const paramsRaw  = this.extractBetween(raw, "__PARAMS__", "__INVERSE_METHOD__").trim();
    const params     = this.parseParams(paramsRaw);
    const method     = this.extractBetween(raw, "__INVERSE_METHOD__", null).trim() as "ilt" | "pwilt" | "failed";

    return {
      input,
      exists,
      f: this.toSymbolic(fMaxima, fTex),
      params: params.length ? params : undefined,
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

    const exists     = this.extractBetween(raw, "__EXISTS__", "__SOL_MAXIMA__").trim().includes("true");
    const solMaxima  = this.extractBetween(raw, "__SOL_MAXIMA__", "__SOL_TEX__").trim();
    const solTex     = this.extractTex(this.extractBetween(raw, "__SOL_TEX__", "__PARAMS__"));
    const paramsRaw  = this.extractBetween(raw, "__PARAMS__", null).trim();
    const params     = this.parseParams(paramsRaw);

    return {
      input,
      exists,
      solution: this.toSymbolic(solMaxima, solTex),
      params: params.length ? params : undefined,
      executionTimeMs: Date.now() - startTime,
    };
  }

  // ── Pole-Zero analysis ────────────────────────────────────────────────────

  async poleZero(input: LaplacePoleZeroInput): Promise<LaplacePoleZeroResult> {
    const startTime = Date.now();
    const freqVar = input.freqVar ?? "s";

    const script = await loadScript("transforms", "laplace_pz.mac");
    const fullScript = `
display2d: false$
%iargs: false$
EXPR_INPUT: ${input.expression};
TRANSVAR: ${freqVar};
${script}
kill(all)$
`.trim();

    const { raw } = await this.runner.run({ script: fullScript, timeoutMs: 30000 });

    const isRationalRaw = this.extractBetween(raw, "__IS_RATIONAL__", "__POLES__").trim();
    const polesRaw      = this.extractBetween(raw, "__POLES__", "__ZEROS__").trim();
    const zerosRaw      = this.extractBetween(raw, "__ZEROS__", "__SIGMA0__").trim();
    const sigma0Raw     = this.extractBetween(raw, "__SIGMA0__", "__POLES_TEX__").trim();
    const poleTexRaw    = this.extractBetween(raw, "__POLES_TEX__", "__ZEROS_TEX__").trim();
    const zeroTexRaw    = this.extractBetween(raw, "__ZEROS_TEX__", "__SIGMA0_TEX__").trim();
    const sigma0TexRaw  = this.extractBetween(raw, "__SIGMA0_TEX__", null).trim();

    const poles = this.parseComplexList(polesRaw);
    const zeros = this.parseComplexList(zerosRaw);
    const poleTexList = this.parseStringList(poleTexRaw);
    const zeroTexList = this.parseStringList(zeroTexRaw);

    // Attach tex to each point
    poles.forEach((p, i) => { p.tex = poleTexList[i] ?? ''; });
    zeros.forEach((z, i) => { z.tex = zeroTexList[i] ?? ''; });

    return {
      input,
      isRational:  isRationalRaw.includes("true"),
      poles,
      zeros,
      sigma0:      this.parseSigma0(sigma0Raw),
      sigma0Tex:   sigma0TexRaw.replace(/^\"|\"$/g, '').trim(),
      executionTimeMs: Date.now() - startTime,
    };
  }

  private parseComplexList(raw: string): ComplexPoint2[] {
    const points: ComplexPoint2[] = [];
    const listMatch = raw.match(/^\[(.+)\]$/s);
    if (!listMatch) return points;
    // Match pairs: [re, im] — handles nested brackets
    const pairRe = /\[\s*([^\[\],]+)\s*,\s*([^\[\],]+)\s*\]/g;
    let m: RegExpExecArray | null;
    while ((m = pairRe.exec(listMatch[1])) !== null) {
      const re = parseFloat(m[1]);
      const im = parseFloat(m[2]);
      if (isFinite(re) && isFinite(im)) points.push({ re, im, tex: '' });
    }
    return points;
  }

  private parseStringList(raw: string): string[] {
    // Maxima prints string lists as ["a","b","c"] — extract quoted tokens
    const results: string[] = [];
    const re = /"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) results.push(m[1]);
    return results;
  }

  private parseSigma0(raw: string): number | null {
    if (!raw || raw === "false" || raw.includes("minf") || raw.includes("inf")) return null;
    const v = parseFloat(raw);
    return isFinite(v) ? v : null;
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
