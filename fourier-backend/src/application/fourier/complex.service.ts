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
    if (cached) {
      //console.log(`Cache hit: ${cacheKey}`);
      return cached as ComplexFourierResult;
    }

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

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
${script}
kill(all)$
`;

    const result = await this.runner.run({ script: fullScript });

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    const parsed = parseMarkeredOutput(result.raw, COMPLEX_MARKERS);

    const complexResult: ComplexFourierResult = {
      input,
      coefficients: {
        c0: parsed["c0"] ?? { tex: "", maxima: "" },
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

    const quadIntegralReal = input.segments
      .map(
        (s) =>
          `float(realpart(rectform((1/T) * integrate((${s.expression}) * (exp(%i*i*w0*${intVar}) + exp(-%i*i*w0*${intVar})), ${intVar}, ${s.from}, ${s.to}))))`,
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
  [cn_val, cn_neg_val, term_real, amp, ph, real_float],
  for i: 1 thru ${nTerms} do (
    cn_val: ratsimp(factor(subst(n=i, Coeff_n))),
    cn_neg_val: ratsimp(factor(subst(n=-i, Coeff_n))),
    term_real: factor(ratsimp(realpart(rectform(
      cn_val * exp(%i * i * w0 * ${intVar}) + cn_neg_val * exp(-%i * i * w0 * ${intVar})
    )))),
    term_real: block([cleaned: errcatch(simplify_expint(clean_integral(term_real, ${intVar})))],
      if cleaned = [] then term_real else first(cleaned)),
    real_float: block(
      [cos_coeff: coeff(term_real, cos(i * w0 * ${intVar})),
       sin_coeff: coeff(term_real, sin(i * w0 * ${intVar})),
       result],
      result: errcatch(float(cos_coeff + sin_coeff)),
      if result = [] or not numberp(first(result))
      then ${quadIntegralReal}
      else first(result)
    ),
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
    print("__REAL_FLOAT__"),
    print(string(real_float)),
    print("__AMPLITUDE__"),
    print(string(amp)),
    print("__PHASE__"),
    print(string(ph))
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
        this.extractBetween(block, "__REAL_TEX__", "__REAL_FLOAT__"),
      );
      const realFloatStr = this.extractBetween(
        block,
        "__REAL_FLOAT__",
        "__AMPLITUDE__",
      );
      const amplitudeStr = this.extractBetween(
        block,
        "__AMPLITUDE__",
        "__PHASE__",
      );
      const phaseStr = this.extractBetween(block, "__PHASE__", null);

      return {
        n,
        cn: { maxima: cnMaxima.replace(/false/g, "").trim(), tex: cnTex },
        cnNeg: {
          maxima: cnNegMaxima.replace(/false/g, "").trim(),
          tex: cnNegTex,
        },
        real: { maxima: realMaxima.replace(/false/g, "").trim(), tex: realTex },
        realFloat: parseFloat(realFloatStr.replace(/false/g, "").trim()) || 0,
        amplitude: parseFloat(amplitudeStr.replace(/false/g, "").trim()) || 0,
        phase:
          parseFloat(
            phaseStr.replace(/false/g, "").trim().split("\n")[0] ?? "0",
          ) || 0,
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
