import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { MaximaPostProcessor } from "../../infrastructure/postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../auxiliary/auxiliaryService";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import { parseMarkeredOutput } from "../../infrastructure/maxima/maximaOutputParser";
import type {
  HalfRangeResult,
  HalfRangeTerm,
  HalfRangeTermsResult,
  PiecewiseFourierInput,
  PiecewiseSegment,
} from "../../domain/types/fourier.types";
import {
  buildCacheKey,
  getFromCache,
  setInCache,
} from "../../infrastructure/cache/fourierCache";

const HALF_RANGE_MARKERS = [
  "__A0RAW_MAXIMA__",
  "__A0RAW_TEX__",
  "__A0_MAXIMA__",
  "__A0_TEX__",
  "__AN_MAXIMA__",
  "__AN_TEX__",
  "__BN_MAXIMA__",
  "__BN_TEX__",
  "__W0_MAXIMA__",
  "__W0_TEX__",
  "__SERIES_COSENO_MAXIMA__",
  "__SERIES_COSENO_TEX__",
  "__SERIES_SENO_MAXIMA__",
  "__SERIES_SENO_TEX__",
];

export class HalfRangeService {
  constructor(
    private readonly runner: MaximaRunner,
    private readonly postProcessor: MaximaPostProcessor,
    private readonly auxiliaryService: AuxiliaryService,
  ) {}

  async calculate(input: PiecewiseFourierInput): Promise<HalfRangeResult> {
    const cacheKey = buildCacheKey(input);
    const cached = getFromCache(cacheKey);
    if (cached) return cached as HalfRangeResult;

    const startTime = Date.now();
    const intVar = input.intVar ?? "x";

    const validation = await this.auxiliaryService.validateFunction(
      input.segments,
    );

    if (validation.decision === "reject") {
      return {
        input,
        coefficients: {},
        seriesCosine: { tex: "", maxima: "" },
        seriesSine: { tex: "", maxima: "" },
        w0: { tex: "", maxima: "" },
        a0Raw: { tex: "", maxima: "" },
        validation,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const script = await loadScript("halfRange", "halfRange.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const quadIntegralA0 = input.segments
      .map(
        (s) =>
          `first(quad_qags((2/T) * (${s.expression}), ${intVar}, ${s.from}, ${s.to}))`,
      )
      .join(" + ");

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
${script}
load("${process.cwd()}/src/scripts/maxima/auxiliary/clean_integral.mac")$
__A0_CLEAN__: if not freeof(gamma_incomplete, Coeff_A0_Raw)
  then block([cleaned: errcatch(simplify_expint(clean_integral(Coeff_A0_Raw, ${intVar})))],
    if cleaned = [] then Coeff_A0_Raw else first(cleaned))
  else Coeff_A0_Raw$
__A0_FLOAT_VAL__: block(
  [r: if freeof('integrate, __A0_CLEAN__)
    then errcatch(float(realpart(rectform(__A0_CLEAN__))))
    else []],
  if r = [] or not numberp(first(r))
  then block([q: errcatch(${quadIntegralA0})],
    if q = [] then "NaN" else first(q))
  else first(r))$
print("__A0_FLOAT__")$
print(string(__A0_FLOAT_VAL__))$
kill(all)$
`;

    const result = await this.runner.run({ script: fullScript });

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    const parsed = parseMarkeredOutput(result.raw, HALF_RANGE_MARKERS);

    const a0FloatRaw =
      this.extractBetween(result.raw, "__A0_FLOAT__", null)
        .replace(/false/g, "")
        .trim()
        .split("\n")[0] ?? "NaN";
    const a0Float = parseFloat(a0FloatRaw);

    const halfRangeResult: HalfRangeResult = {
      input,
      coefficients: {
        a0: parsed["a0"],
        a0Float: isNaN(a0Float) ? undefined : a0Float,
        an: parsed["an"],
        bn: parsed["bn"],
      },
      seriesCosine: parsed["series_coseno"] ?? { tex: "", maxima: "" },
      seriesSine: parsed["series_seno"] ?? { tex: "", maxima: "" },
      w0: parsed["w0"] ?? { tex: "", maxima: "" },
      a0Raw: parsed["a0raw"],
      validation,
      executionTimeMs: Date.now() - startTime,
    };

    setInCache(cacheKey, halfRangeResult);
    return halfRangeResult;
  }

  async calculateTerms(
    input: PiecewiseFourierInput,
    nTerms: number,
  ): Promise<HalfRangeTermsResult> {
    const startTime = Date.now();
    const intVar = input.intVar ?? "x";
    const script = await loadScript("halfRange", "halfRange_coeffs.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const quadIntegralAn = input.segments
      .map(
        (s) =>
          `first(quad_qags((2/T) * (${s.expression}) * cos(i * w0 * ${intVar}), ${intVar}, ${s.from}, ${s.to}))`,
      )
      .join(" + ");

    const quadIntegralBn = input.segments
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
Coeff_An: if not freeof(gamma_incomplete, Coeff_An)
  then block([cleaned: errcatch(simplify_expint(clean_integral(Coeff_An, ${intVar})))],
    if cleaned = [] then Coeff_An else first(cleaned))
  else Coeff_An$
Coeff_Bn: if not freeof(gamma_incomplete, Coeff_Bn)
  then block([cleaned: errcatch(simplify_expint(clean_integral(Coeff_Bn, ${intVar})))],
    if cleaned = [] then Coeff_Bn else first(cleaned))
  else Coeff_Bn$
block(
  [],
  for i: 1 thru ${nTerms} do (
    an_used_limit: false,
    bn_used_limit: false,
    an_i: block([r: errcatch(ratsimp(factor(subst(n=i, Coeff_An))))],
      if r = [] then block([lim: errcatch(limit(Coeff_An, n, i))],
        an_used_limit: true,
        if lim = [] then 0 else first(lim))
      else block([val: first(r)],
        if numberp(val) or freeof(n, val) then val
        else block([lim: errcatch(limit(Coeff_An, n, i))],
          an_used_limit: true,
          if lim = [] then val else first(lim)))),
    bn_i: block([r: errcatch(ratsimp(factor(subst(n=i, Coeff_Bn))))],
      if r = [] then block([lim: errcatch(limit(Coeff_Bn, n, i))],
        bn_used_limit: true,
        if lim = [] then 0 else first(lim))
      else block([val: first(r)],
        if numberp(val) or freeof(n, val) then val
        else block([lim: errcatch(limit(Coeff_Bn, n, i))],
          bn_used_limit: true,
          if lim = [] then val else first(lim)))),
    an_float: block([result: errcatch(float(an_i))],
      if result = [] or not numberp(first(result))
      then ${quadIntegralAn}
      else first(result)),
    bn_float: block([result: errcatch(float(bn_i))],
      if result = [] or not numberp(first(result))
      then ${quadIntegralBn}
      else first(result)),
    print("__TERM_START__"),
    print(i),
    print("__AN_MAXIMA__"),
    print(string(an_i)),
    print("__AN_TEX__"),
    tex(an_i),
    print("__BN_MAXIMA__"),
    print(string(bn_i)),
    print("__BN_TEX__"),
    tex(bn_i),
    print("__AN_FLOAT__"),
    print(string(an_float)),
    print("__BN_FLOAT__"),
    print(string(bn_float)),
    print("__AN_USED_LIMIT__"),
    print(string(an_used_limit)),
    print("__BN_USED_LIMIT__"),
    print(string(bn_used_limit))
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

  private parseTerms(raw: string): HalfRangeTerm[] {
    const cleaned = raw.replace(/\\\n/g, "").replace(/\r/g, "");
    const blocks = cleaned.split("__TERM_START__").slice(1);

    return blocks.map((block) => {
      const nMatch = block.match(/^\s*(\d+)/);
      const n = parseInt(nMatch?.[1] ?? "0");

      const anMaxima = this.extractBetween(
        block,
        "__AN_MAXIMA__",
        "__AN_TEX__",
      );
      const anTex = this.extractTex(
        this.extractBetween(block, "__AN_TEX__", "__BN_MAXIMA__"),
      );
      const bnMaxima = this.extractBetween(
        block,
        "__BN_MAXIMA__",
        "__BN_TEX__",
      );
      const bnTex = this.extractTex(
        this.extractBetween(block, "__BN_TEX__", "__AN_FLOAT__"),
      );
      const anFloatStr = this.extractBetween(
        block,
        "__AN_FLOAT__",
        "__BN_FLOAT__",
      );
      const bnFloatStr = this.extractBetween(
        block,
        "__BN_FLOAT__",
        "__AN_USED_LIMIT__",
      );
      const anUsedLimitStr = this.extractBetween(
        block,
        "__AN_USED_LIMIT__",
        "__BN_USED_LIMIT__",
      )
        .replace(/false/g, "")
        .trim();
      const bnUsedLimitStr = this.extractBetween(
        block,
        "__BN_USED_LIMIT__",
        null,
      )
        .replace(/false/g, "")
        .trim();

      return {
        n,
        an: { maxima: anMaxima.replace(/false/g, "").trim(), tex: anTex },
        bn: { maxima: bnMaxima.replace(/false/g, "").trim(), tex: bnTex },
        anFloat: parseFloat(anFloatStr.replace(/false/g, "").trim()) || 0,
        bnFloat:
          parseFloat(
            bnFloatStr.replace(/false/g, "").trim().split("\n")[0] ?? "0",
          ) || 0,
        anUsedLimit: anUsedLimitStr.includes("true"),
        bnUsedLimit: bnUsedLimitStr.includes("true"),
      };
    });
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

  private buildFuncInput(segments: PiecewiseSegment[]): string {
    const rows = segments
      .map((s) => `[${s.expression}, ${s.from}, ${s.to}]`)
      .join(", ");
    return `matrix(${rows})`;
  }
}
