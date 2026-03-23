import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { MaximaPostProcessor } from "../../infrastructure/postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../auxiliary/auxiliaryService";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import { parseMarkeredOutput } from "../../infrastructure/maxima/maximaOutputParser";
import type {
  ComplexFourierResult,
  ComplexTerm,
  ComplexTermsResult,
  PiecewiseFourierInput,
  PiecewiseSegment,
} from "../../domain/types/fourier.types";
import {
  buildCacheKey,
  getFromCache,
  setInCache,
} from "../../infrastructure/cache/fourierCache";

const COMPLEX_MARKERS = [
  "__C0_MAXIMA__",
  "__C0_TEX__",
  "__CN_MAXIMA__",
  "__CN_TEX__",
  "__SERIES_COMPLEX_MAXIMA__",
  "__SERIES_COMPLEX_TEX__",
  "__W0_MAXIMA__",
  "__W0_TEX__",
];

export class ComplexService {
  constructor(
    private readonly runner: MaximaRunner,
    private readonly postProcessor: MaximaPostProcessor,
    private readonly auxiliaryService: AuxiliaryService,
  ) {}

  async calculate(input: PiecewiseFourierInput): Promise<ComplexFourierResult> {
    const cacheKey = buildCacheKey(input);
    const cached = getFromCache(cacheKey);
    if (cached) return cached as ComplexFourierResult;

    const startTime = Date.now();
    const intVar = input.intVar ?? "x";

    const validation = await this.auxiliaryService.validateFunction(
      input.segments,
    );

    if (validation.decision === "reject") {
      return {
        input,
        coefficients: {
          c0: { tex: "", maxima: "" },
          cn: { tex: "", maxima: "" },
        },
        seriesComplex: { tex: "", maxima: "" },
        w0: { tex: "", maxima: "" },
        validation,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const script = await loadScript("complex", "complex.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const quadIntegralC0 = input.segments
      .map(
        (s) =>
          `first(quad_qags((1/T) * (${s.expression}), ${intVar}, ${s.from}, ${s.to}))`,
      )
      .join(" + ");

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
${script}
load("${process.cwd()}/src/scripts/maxima/auxiliary/clean_integral.mac")$
__C0_CLEAN__: if not freeof(gamma_incomplete, Coeff_0)
  then block([cleaned: errcatch(simplify_expint(clean_integral(Coeff_0, ${intVar})))],
    if cleaned = [] then Coeff_0 else first(cleaned))
  else Coeff_0$
__C0_FLOAT_VAL__: block(
  [r: if freeof('integrate, __C0_CLEAN__)
    then errcatch(float(realpart(rectform(__C0_CLEAN__))))
    else []],
  if r = [] or not numberp(first(r))
  then block([q: errcatch(${quadIntegralC0})],
    if q = [] then "NaN" else first(q))
  else first(r))$
print("__C0_FLOAT__")$
print(string(__C0_FLOAT_VAL__))$
kill(all)$
`;

    const result = await this.runner.run({ script: fullScript });

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    const parsed = parseMarkeredOutput(result.raw, COMPLEX_MARKERS);

    const c0FloatRaw =
      this.extractBetween(result.raw, "__C0_FLOAT__", null)
        .replace(/false/g, "")
        .replace(/[\[\]]/g, "")
        .trim()
        .split("\n")[0] ?? "NaN";
    const c0Float = parseFloat(c0FloatRaw);

    const complexResult: ComplexFourierResult = {
      input,
      coefficients: {
        c0: parsed["c0"] ?? { tex: "", maxima: "" },
        c0Float: isNaN(c0Float) ? undefined : c0Float,
        cn: parsed["cn"] ?? { tex: "", maxima: "" },
      },
      seriesComplex: parsed["series_complex"] ?? { tex: "", maxima: "" },
      w0: parsed["w0"] ?? { tex: "", maxima: "" },
      validation,
      executionTimeMs: Date.now() - startTime,
    };

    setInCache(cacheKey, complexResult);
    return complexResult;
  }

  async calculateTerms(
    input: PiecewiseFourierInput,
    nTerms: number,
  ): Promise<ComplexTermsResult> {
    const startTime = Date.now();
    const intVar = input.intVar ?? "x";
    const script = await loadScript("complex", "complex_coeffs.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const quadCos = input.segments
      .map(
        (s) =>
          `first(quad_qags((2/T) * (${s.expression}) * cos(i * w0 * ${intVar}), ${intVar}, ${s.from}, ${s.to}))`,
      )
      .join(" + ");

    const quadSin = input.segments
      .map(
        (s) =>
          `first(quad_qags((2/T) * (${s.expression}) * sin(i * w0 * ${intVar}), ${intVar}, ${s.from}, ${s.to}))`,
      )
      .join(" + ");

    const termsScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
${script}
load("${process.cwd()}/src/scripts/maxima/auxiliary/clean_integral.mac")$
Coeff_n: if not freeof(gamma_incomplete, Coeff_n)
  then block([cleaned: errcatch(simplify_expint(clean_integral(Coeff_n, ${intVar})))],
    if cleaned = [] then Coeff_n else first(cleaned))
  else Coeff_n$
block(
  [cn_val, cn_neg_val, term_real, cos_coeff, sin_coeff, amp, ph, cn_used_limit, cn_neg_used_limit],
  for i: 1 thru ${nTerms} do (
    cn_used_limit: false,
    cn_neg_used_limit: false,
    cn_val: block([r: errcatch(ratsimp(subst(n=i, Coeff_n)))],
      if r = [] then block([lim: errcatch(limit(Coeff_n, n, i))],
        cn_used_limit: true,
        if lim = [] then 0 else first(lim))
      else block([val: first(r)],
        if numberp(val) or freeof(n, val) then val
        else block([lim: errcatch(limit(Coeff_n, n, i))],
          cn_used_limit: true,
          if lim = [] then val else first(lim)))),
    cn_neg_val: block([r: errcatch(ratsimp(subst(n=-i, Coeff_n)))],
      if r = [] then block([lim: errcatch(limit(Coeff_n, n, -i))],
        cn_neg_used_limit: true,
        if lim = [] then 0 else first(lim))
      else block([val: first(r)],
        if numberp(val) or freeof(n, val) then val
        else block([lim: errcatch(limit(Coeff_n, n, -i))],
          cn_neg_used_limit: true,
          if lim = [] then val else first(lim)))),
    term_real: fullratsimp(demoivre(
      cn_val * exp(%i * i * w0 * ${intVar}) + cn_neg_val * exp(-%i * i * w0 * ${intVar})
    )),
    cos_coeff: block(
      [expanded: expand(term_real),
      r: errcatch(float(coeff(expand(term_real), cos(i * w0 * ${intVar}))))],
      if r = [] or not numberp(first(r))
      then ${quadCos}
      else first(r)),
    sin_coeff: block(
      [expanded: expand(term_real),
      r: errcatch(float(coeff(expand(term_real), sin(i * w0 * ${intVar}))))],
      if r = [] or not numberp(first(r))
      then ${quadSin}
      else first(r)),
    amp: float(abs(cn_val)),
    ph: float(carg(cn_val)),
    print("__TERM_START__"),
    print(i),
    print("__CN_MAXIMA__"),
    print(string(cn_val)),
    print("__CN_TEX__"),
    tex(cn_val),
    print("__CN_NEG_MAXIMA__"),
    print(string(cn_neg_val)),
    print("__CN_NEG_TEX__"),
    tex(cn_neg_val),
    print("__REAL_MAXIMA__"),
    print(string(term_real)),
    print("__REAL_TEX__"),
    tex(term_real),
    print("__COS_FLOAT__"),
    print(string(cos_coeff)),
    print("__SIN_FLOAT__"),
    print(string(sin_coeff)),
    print("__AMPLITUDE__"),
    print(string(amp)),
    print("__PHASE__"),
    print(string(ph)),
    print("__CN_USED_LIMIT__"),
    print(string(cn_used_limit)),
    print("__CN_NEG_USED_LIMIT__"),
    print(string(cn_neg_used_limit))
  )
)$
kill(all)$
`;

    const result = await this.runner.run({ script: termsScript });

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    return {
      terms: this.parseTerms(result.raw),
      executionTimeMs: Date.now() - startTime,
    };
  }

  private parseTerms(raw: string): ComplexTerm[] {
    const cleaned = raw.replace(/\\\n/g, "").replace(/\r/g, "");
    const blocks = cleaned.split("__TERM_START__").slice(1);

    return blocks.map((block) => {
      const nMatch = block.match(/^\s*(\d+)/);
      const n = parseInt(nMatch?.[1] ?? "0");

      const cnMaxima = this.extractBetween(
        block,
        "__CN_MAXIMA__",
        "__CN_TEX__",
      );
      const cnTex = this.extractTex(
        this.extractBetween(block, "__CN_TEX__", "__CN_NEG_MAXIMA__"),
      );
      const cnNegMaxima = this.extractBetween(
        block,
        "__CN_NEG_MAXIMA__",
        "__CN_NEG_TEX__",
      );
      const cnNegTex = this.extractTex(
        this.extractBetween(block, "__CN_NEG_TEX__", "__REAL_MAXIMA__"),
      );
      const realMaxima = this.extractBetween(
        block,
        "__REAL_MAXIMA__",
        "__REAL_TEX__",
      );
      const realTex = this.extractTex(
        this.extractBetween(block, "__REAL_TEX__", "__COS_FLOAT__"),
      );
      const cosFloatStr = this.extractBetween(
        block,
        "__COS_FLOAT__",
        "__SIN_FLOAT__",
      );
      const sinFloatStr = this.extractBetween(
        block,
        "__SIN_FLOAT__",
        "__AMPLITUDE__",
      );
      const amplitudeStr = this.extractBetween(
        block,
        "__AMPLITUDE__",
        "__PHASE__",
      );
      const phaseStr = this.extractBetween(
        block,
        "__PHASE__",
        "__CN_USED_LIMIT__",
      );
      const cnUsedLimitStr = this.extractBetween(
        block,
        "__CN_USED_LIMIT__",
        "__CN_NEG_USED_LIMIT__",
      )
        .replace(/false/g, "")
        .trim();
      const cnNegUsedLimitStr = this.extractBetween(
        block,
        "__CN_NEG_USED_LIMIT__",
        null,
      )
        .replace(/false/g, "")
        .trim();

      return {
        n,
        cn: { maxima: cnMaxima.replace(/false/g, "").trim(), tex: cnTex },
        cnNeg: {
          maxima: cnNegMaxima.replace(/false/g, "").trim(),
          tex: cnNegTex,
        },
        real: { maxima: realMaxima.replace(/false/g, "").trim(), tex: realTex },
        cosFloat: parseFloat(cosFloatStr.replace(/false/g, "").trim()) || 0,
        sinFloat: parseFloat(sinFloatStr.replace(/false/g, "").trim()) || 0,
        amplitude: parseFloat(amplitudeStr.replace(/false/g, "").trim()) || 0,
        phase:
          parseFloat(
            phaseStr.replace(/false/g, "").trim().split("\n")[0] ?? "0",
          ) || 0,
        cnUsedLimit: cnUsedLimitStr.includes("true"),
        cnNegUsedLimit: cnNegUsedLimitStr.includes("true"),
      };
    });
  }

  private buildFuncInput(segments: PiecewiseSegment[]): string {
    const rows = segments
      .map((s) => `[${s.expression}, ${s.from}, ${s.to}]`)
      .join(", ");
    return `matrix(${rows})`;
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
    return match ? match[1].trim() : "";
  }
}
