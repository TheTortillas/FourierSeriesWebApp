import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import { parseMarkeredOutput } from "../../infrastructure/maxima/maximaOutputParser";
import type {
  PiecewiseFourierInput,
  PiecewiseSegment,
  ParsevalTrig,
  ParsevalHalfRange,
  ParsevalComplex,
  ParsevalApiResult,
  SingularTerm,
} from "../../domain/types/fourier.types";
import {
  buildCacheKey,
  getFromCache,
  setInCache,
} from "../../infrastructure/cache/fourierCache";

const TRIG_PARSEVAL_MARKERS = [
  "__PARSEVAL_LHS_MAXIMA__",
  "__PARSEVAL_LHS_TEX__",
  "__PARSEVAL_A0_TERM_MAXIMA__",
  "__PARSEVAL_A0_TERM_TEX__",
  "__PARSEVAL_K_MAXIMA__",
  "__PARSEVAL_K_TEX__",
  "__PARSEVAL_SUMMAND_MAXIMA__",
  "__PARSEVAL_SUMMAND_TEX__",
  "__PARSEVAL_LHS_FINAL_MAXIMA__",
  "__PARSEVAL_LHS_FINAL_TEX__",
  "__PARSEVAL_FORMAL_K_MAXIMA__",
  "__PARSEVAL_FORMAL_K_TEX__",
  "__PARSEVAL_FORMAL_SUMMAND_MAXIMA__",
  "__PARSEVAL_FORMAL_SUMMAND_TEX__",
  "__PARSEVAL_FORMAL_LHS_FINAL_MAXIMA__",
  "__PARSEVAL_FORMAL_LHS_FINAL_TEX__",
];

const HALF_PARSEVAL_MARKERS = [
  "__PARSEVAL_LHS_MAXIMA__",
  "__PARSEVAL_LHS_TEX__",
  "__PARSEVAL_COS_A0_TERM_MAXIMA__",
  "__PARSEVAL_COS_A0_TERM_TEX__",
  "__PARSEVAL_COS_K_MAXIMA__",
  "__PARSEVAL_COS_K_TEX__",
  "__PARSEVAL_COS_SUMMAND_MAXIMA__",
  "__PARSEVAL_COS_SUMMAND_TEX__",
  "__PARSEVAL_COS_LHS_FINAL_MAXIMA__",
  "__PARSEVAL_COS_LHS_FINAL_TEX__",
  "__PARSEVAL_SIN_K_MAXIMA__",
  "__PARSEVAL_SIN_K_TEX__",
  "__PARSEVAL_SIN_SUMMAND_MAXIMA__",
  "__PARSEVAL_SIN_SUMMAND_TEX__",
  "__PARSEVAL_SIN_LHS_FINAL_MAXIMA__",
  "__PARSEVAL_SIN_LHS_FINAL_TEX__",
  "__PARSEVAL_COS_FORMAL_K_MAXIMA__",
  "__PARSEVAL_COS_FORMAL_K_TEX__",
  "__PARSEVAL_COS_FORMAL_SUMMAND_MAXIMA__",
  "__PARSEVAL_COS_FORMAL_SUMMAND_TEX__",
  "__PARSEVAL_COS_FORMAL_LHS_FINAL_MAXIMA__",
  "__PARSEVAL_COS_FORMAL_LHS_FINAL_TEX__",
  "__PARSEVAL_SIN_FORMAL_K_MAXIMA__",
  "__PARSEVAL_SIN_FORMAL_K_TEX__",
  "__PARSEVAL_SIN_FORMAL_SUMMAND_MAXIMA__",
  "__PARSEVAL_SIN_FORMAL_SUMMAND_TEX__",
  "__PARSEVAL_SIN_FORMAL_LHS_FINAL_MAXIMA__",
  "__PARSEVAL_SIN_FORMAL_LHS_FINAL_TEX__",
];

const COMPLEX_PARSEVAL_MARKERS = [
  "__PARSEVAL_LHS_MAXIMA__",
  "__PARSEVAL_LHS_TEX__",
  "__PARSEVAL_C0_TERM_MAXIMA__",
  "__PARSEVAL_C0_TERM_TEX__",
  "__PARSEVAL_K_MAXIMA__",
  "__PARSEVAL_K_TEX__",
  "__PARSEVAL_SUMMAND_MAXIMA__",
  "__PARSEVAL_SUMMAND_TEX__",
  "__PARSEVAL_LHS_FINAL_MAXIMA__",
  "__PARSEVAL_LHS_FINAL_TEX__",
  "__PARSEVAL_FORMAL_K_MAXIMA__",
  "__PARSEVAL_FORMAL_K_TEX__",
  "__PARSEVAL_FORMAL_SUMMAND_MAXIMA__",
  "__PARSEVAL_FORMAL_SUMMAND_TEX__",
  "__PARSEVAL_FORMAL_LHS_FINAL_MAXIMA__",
  "__PARSEVAL_FORMAL_LHS_FINAL_TEX__",
];

export class ParsevalService {
  constructor(private readonly runner: MaximaRunner) {}

  async calculate(input: PiecewiseFourierInput): Promise<ParsevalApiResult> {
    const parsevalKey = `parseval::${buildCacheKey(input)}`;
    const cached = await getFromCache(parsevalKey);
    if (cached && "parseval" in cached) return cached as ParsevalApiResult;

    const startTime = Date.now();
    const intVar = input.intVar ?? "x";
    const funcInput = this.buildFuncInput(input.segments);

    let parseval: ParsevalTrig | ParsevalHalfRange | ParsevalComplex | undefined;

    if (input.seriesType === "trigonometric") {
      parseval = await this.calculateTrig(funcInput, intVar);
    } else if (input.seriesType === "halfRange") {
      parseval = await this.calculateHalfRange(funcInput, intVar);
    } else if (input.seriesType === "complex") {
      parseval = await this.calculateComplex(funcInput, intVar);
    }

    const result: ParsevalApiResult = { parseval, executionTimeMs: Date.now() - startTime };
    void setInCache(parsevalKey, result);
    return result;
  }

  private async calculateTrig(funcInput: string, intVar: string): Promise<ParsevalTrig | undefined> {
    const script = await loadScript("trigonometric", "trigonometric.mac");
    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
load("${process.cwd()}/src/scripts/maxima/lib/const_factor.mac")$
${script}
load("${process.cwd()}/src/scripts/maxima/lib/emit_parseval_trig.mac")$
kill(all)$
`;
    const result = await this.runner.run({ script: fullScript });
    if (!result.success) throw new Error(`Maxima error (parseval/trig): ${result.error}`);

    const parsed = parseMarkeredOutput(result.raw, TRIG_PARSEVAL_MARKERS);
    if (!parsed["parseval_lhs"] || !parsed["parseval_k"] || !parsed["parseval_summand"]) return undefined;

    return {
      lhs: parsed["parseval_lhs"],
      a0Term: parsed["parseval_a0_term"] ?? { tex: "", maxima: "0" },
      k: parsed["parseval_k"],
      summand: parsed["parseval_summand"],
      lhsFinal: parsed["parseval_lhs_final"] ?? parsed["parseval_lhs"],
      sumStart:
        parseInt(
          this.extractBetween(result.raw, "__PARSEVAL_SUM_START__", "__PARSEVAL_HAS_SINGULAR__")
            .replace(/false/g, "")
            .trim()
            .split("\n")[0] ?? "1",
        ) || 1,
      hasSingular: this.extractBetween(
        result.raw,
        "__PARSEVAL_HAS_SINGULAR__",
        "__PARSEVAL_SING_VALS__",
      ).includes("true"),
      singVals: this.parseSingVals(
        this.extractBetween(
          result.raw,
          "__PARSEVAL_SING_VALS__",
          "__PARSEVAL_FORMAL_K_MAXIMA__",
        ),
      ),
      singularTerms: this.parseSingularTerms(
        result.raw,
        "__PARSEVAL_SING_TERMS_START__",
        "__PARSEVAL_SING_TERMS_END__",
      ),
      formal:
        parsed["parseval_formal_k"] && parsed["parseval_formal_summand"]
          ? {
              k: parsed["parseval_formal_k"],
              summand: parsed["parseval_formal_summand"],
              lhsFinal:
                parsed["parseval_formal_lhs_final"] ?? parsed["parseval_lhs"],
            }
          : undefined,
    };
  }

  private async calculateHalfRange(funcInput: string, intVar: string): Promise<ParsevalHalfRange | undefined> {
    const script = await loadScript("halfRange", "halfRange.mac");
    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
load("${process.cwd()}/src/scripts/maxima/lib/const_factor.mac")$
${script}
load("${process.cwd()}/src/scripts/maxima/lib/emit_parseval_half.mac")$
kill(all)$
`;
    const result = await this.runner.run({ script: fullScript });
    if (!result.success) throw new Error(`Maxima error (parseval/half): ${result.error}`);

    const parsed = parseMarkeredOutput(result.raw, HALF_PARSEVAL_MARKERS);
    if (!parsed["parseval_lhs"] || !parsed["parseval_cos_k"] || !parsed["parseval_sin_k"]) return undefined;

    return {
      lhs: parsed["parseval_lhs"],
      cosine: {
        a0Term: parsed["parseval_cos_a0_term"] ?? { tex: "", maxima: "0" },
        k: parsed["parseval_cos_k"],
        summand: parsed["parseval_cos_summand"] ?? { tex: "", maxima: "1" },
        lhsFinal: parsed["parseval_cos_lhs_final"] ?? parsed["parseval_lhs"],
        sumStart:
          parseInt(
            this.extractBetween(result.raw, "__PARSEVAL_COS_SUM_START__", "__PARSEVAL_COS_HAS_SINGULAR__")
              .replace(/false/g, "")
              .trim()
              .split("\n")[0] ?? "1",
          ) || 1,
        hasSingular: this.extractBetween(
          result.raw,
          "__PARSEVAL_COS_HAS_SINGULAR__",
          "__PARSEVAL_COS_SING_VALS__",
        ).includes("true"),
        singVals: this.parseSingVals(
          this.extractBetween(
            result.raw,
            "__PARSEVAL_COS_SING_VALS__",
            "__PARSEVAL_SIN_K_MAXIMA__",
          ),
        ),
        singularTerms: this.parseSingularTerms(
          result.raw,
          "__PARSEVAL_COS_SING_TERMS_START__",
          "__PARSEVAL_COS_SING_TERMS_END__",
        ),
        formal:
          parsed["parseval_cos_formal_k"] && parsed["parseval_cos_formal_summand"]
            ? {
                k: parsed["parseval_cos_formal_k"],
                summand: parsed["parseval_cos_formal_summand"],
                lhsFinal:
                  parsed["parseval_cos_formal_lhs_final"] ?? parsed["parseval_lhs"],
              }
            : undefined,
      },
      sine: {
        k: parsed["parseval_sin_k"],
        summand: parsed["parseval_sin_summand"] ?? { tex: "", maxima: "1" },
        lhsFinal: parsed["parseval_sin_lhs_final"] ?? parsed["parseval_lhs"],
        sumStart:
          parseInt(
            this.extractBetween(result.raw, "__PARSEVAL_SIN_SUM_START__", "__PARSEVAL_SIN_HAS_SINGULAR__")
              .replace(/false/g, "")
              .trim()
              .split("\n")[0] ?? "1",
          ) || 1,
        hasSingular: this.extractBetween(
          result.raw,
          "__PARSEVAL_SIN_HAS_SINGULAR__",
          "__PARSEVAL_SIN_SING_VALS__",
        ).includes("true"),
        singVals: this.parseSingVals(
          this.extractBetween(
            result.raw,
            "__PARSEVAL_SIN_SING_VALS__",
            "__PARSEVAL_COS_FORMAL_K_MAXIMA__",
          ),
        ),
        singularTerms: this.parseSingularTerms(
          result.raw,
          "__PARSEVAL_SIN_SING_TERMS_START__",
          "__PARSEVAL_SIN_SING_TERMS_END__",
        ),
        formal:
          parsed["parseval_sin_formal_k"] && parsed["parseval_sin_formal_summand"]
            ? {
                k: parsed["parseval_sin_formal_k"],
                summand: parsed["parseval_sin_formal_summand"],
                lhsFinal:
                  parsed["parseval_sin_formal_lhs_final"] ?? parsed["parseval_lhs"],
              }
            : undefined,
      },
    };
  }

  private async calculateComplex(funcInput: string, intVar: string): Promise<ParsevalComplex | undefined> {
    const script = await loadScript("complex", "complex.mac");
    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
load("${process.cwd()}/src/scripts/maxima/lib/const_factor.mac")$
${script}
load("${process.cwd()}/src/scripts/maxima/lib/emit_parseval_complex.mac")$
kill(all)$
`;
    const result = await this.runner.run({ script: fullScript });
    if (!result.success) throw new Error(`Maxima error (parseval/complex): ${result.error}`);

    const parsed = parseMarkeredOutput(result.raw, COMPLEX_PARSEVAL_MARKERS);
    if (!parsed["parseval_lhs"] || !parsed["parseval_k"] || !parsed["parseval_summand"]) return undefined;

    return {
      lhs: parsed["parseval_lhs"],
      c0Term: parsed["parseval_c0_term"] ?? { tex: "", maxima: "0" },
      k: parsed["parseval_k"],
      summand: parsed["parseval_summand"],
      lhsFinal: parsed["parseval_lhs_final"] ?? parsed["parseval_lhs"],
      sumStart:
        parseInt(
          this.extractBetween(result.raw, "__PARSEVAL_SUM_START__", "__PARSEVAL_HAS_SINGULAR__")
            .replace(/false/g, "")
            .trim()
            .split("\n")[0] ?? "1",
        ) || 1,
      hasSingular: this.extractBetween(
        result.raw,
        "__PARSEVAL_HAS_SINGULAR__",
        "__PARSEVAL_SING_VALS__",
      ).includes("true"),
      singVals: this.parseSingVals(
        this.extractBetween(
          result.raw,
          "__PARSEVAL_SING_VALS__",
          "__PARSEVAL_FORMAL_K_MAXIMA__",
        ),
      ),
      singularTerms: this.parseSingularTerms(
        result.raw,
        "__PARSEVAL_SING_TERMS_START__",
        "__PARSEVAL_SING_TERMS_END__",
      ),
      formal:
        parsed["parseval_formal_k"] && parsed["parseval_formal_summand"]
          ? {
              k: parsed["parseval_formal_k"],
              summand: parsed["parseval_formal_summand"],
              lhsFinal:
                parsed["parseval_formal_lhs_final"] ?? parsed["parseval_lhs"],
            }
          : undefined,
    };
  }

  private buildFuncInput(segments: PiecewiseSegment[]): string {
    const rows = segments
      .map((s) => `[${s.expression}, ${s.from}, ${s.to}]`)
      .join(", ");
    return `matrix(${rows})`;
  }

  private parseSingVals(raw: string): number[] {
    const cleaned = raw.replace(/[\[\]\s]/g, "");
    if (!cleaned) return [];
    return cleaned
      .split(",")
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  private parseSingularTerms(raw: string, startMarker: string, endMarker: string): SingularTerm[] {
    const block = this.extractBetween(raw, startMarker, endMarker);
    if (!block.trim()) return [];
    const nMarker = "__SING_TERM_N__";
    const maximaMarker = "__SING_TERM_MAXIMA__";
    const texMarker = "__SING_TERM_TEX__";
    const chunks = block.split(nMarker).slice(1);
    return chunks.flatMap((chunk) => {
      const mIdx = chunk.indexOf(maximaMarker);
      const tIdx = chunk.indexOf(texMarker);
      if (mIdx === -1 || tIdx === -1) return [];
      const n = parseInt(chunk.slice(0, mIdx).trim().split("\n")[0] ?? "", 10);
      const maxima = chunk.slice(mIdx + maximaMarker.length, tIdx).trim().split("\n")[0] ?? "";
      const texRaw = chunk.slice(tIdx + texMarker.length).trim();
      const tex = texRaw.replace(/^\s*\$\$\s*/, "").replace(/\s*\$\$\s*$/, "").trim();
      if (!Number.isFinite(n) || !maxima) return [];
      return [{ n, maxima, tex }];
    });
  }

  private extractBetween(text: string, start: string, end: string | null): string {
    const startIdx = text.indexOf(start);
    if (startIdx === -1) return "";
    const afterStart = startIdx + start.length;
    if (end === null) return text.slice(afterStart);
    const endIdx = text.indexOf(end, afterStart);
    return endIdx === -1 ? text.slice(afterStart) : text.slice(afterStart, endIdx);
  }
}
