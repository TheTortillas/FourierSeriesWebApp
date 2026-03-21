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
    if (cached) {
      //console.log(`Cache hit: ${cacheKey}`);
      return cached as HalfRangeResult;
    }

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
        validation,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const script = await loadScript("halfRange", "halfRange.mac");
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

    const parsed = parseMarkeredOutput(result.raw, HALF_RANGE_MARKERS);

    const halfRangeResult: HalfRangeResult = {
      input,
      coefficients: {
        a0: parsed["a0"],
        an: parsed["an"],
        bn: parsed["bn"],
      },
      seriesCosine: parsed["series_coseno"] ?? { tex: "", maxima: "" },
      seriesSine: parsed["series_seno"] ?? { tex: "", maxima: "" },
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
    const intVar = input.intVar ?? "x";
    const script = await loadScript("halfRange", "halfRange.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const termsScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
${script}
block(
  [],
  for i: 1 thru ${nTerms} do (
    an_i: factor(ratsimp(subst(n=i, Coeff_An))),
    bn_i: factor(ratsimp(subst(n=i, Coeff_Bn))),
    print("__TERM_START__"),
    print(i),
    print("__AN_MAXIMA__"),
    print(string(an_i)),
    print("__AN_TEX__"),
    tex(an_i),
    print("__BN_MAXIMA__"),
    print(string(bn_i)),
    print("__BN_TEX__"),
    tex(bn_i)
  )
)$
kill(all)$
`;

    const result = await this.runner.run({ script: termsScript });

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    return { terms: this.parseTerms(result.raw) };
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
        this.extractBetween(block, "__BN_TEX__", null),
      );

      return {
        n,
        an: { maxima: anMaxima.replace(/false/g, "").trim(), tex: anTex },
        bn: { maxima: bnMaxima.replace(/false/g, "").trim(), tex: bnTex },
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
