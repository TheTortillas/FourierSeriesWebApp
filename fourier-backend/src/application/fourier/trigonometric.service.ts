import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { MaximaPostProcessor } from "../../infrastructure/postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../auxiliary/auxiliaryService";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import { parseMarkeredOutput } from "../../infrastructure/maxima/maximaOutputParser";
import type {
  FourierResult,
  PiecewiseFourierInput,
  PiecewiseSegment,
} from "../../domain/types/fourier.types";
import {
  buildCacheKey,
  getFromCache,
  setInCache,
} from "../../infrastructure/cache/fourierCache";

const TRIG_MARKERS = [
  "__A0_MAXIMA__",
  "__A0_TEX__",
  "__AN_MAXIMA__",
  "__AN_TEX__",
  "__BN_MAXIMA__",
  "__BN_TEX__",
  "__W0_MAXIMA__",
  "__W0_TEX__",
  "__SERIES_MAXIMA__",
  "__SERIES_TEX__",
];

export class TrigonometricService {
  constructor(
    private readonly runner: MaximaRunner,
    private readonly postProcessor: MaximaPostProcessor,
    private readonly auxiliaryService: AuxiliaryService,
  ) {}

  async calculate(input: PiecewiseFourierInput): Promise<FourierResult> {
    const cacheKey = buildCacheKey(input);
    const cached = getFromCache(cacheKey);
    if (cached) {
      //console.log(`Cache hit: ${cacheKey} at ${Date.now()}`);
      return cached as FourierResult;
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
        series: { tex: "", maxima: "" },
        validation,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const script = await loadScript("trigonometric", "trigonometric.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
${script}
kill(all)$
`;

    const result = await this.runner.run({ script: fullScript });
    //console.log("RAW RUNNER OUTPUT:", JSON.stringify(result.raw));

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    const parsed = parseMarkeredOutput(result.raw, TRIG_MARKERS);

    const fourierResult: FourierResult = {
      input,
      coefficients: {
        a0: parsed["a0"],
        an: parsed["an"],
        bn: parsed["bn"],
      },
      series: parsed["series"] ?? { tex: "", maxima: "" },
      validation,
      executionTimeMs: Date.now() - startTime,
    };

    if (
      (parsed["an"] && this.postProcessor.canProcess(parsed["an"])) ||
      (parsed["bn"] && this.postProcessor.canProcess(parsed["bn"]))
    ) {
      const processed = await this.postProcessor.process(fourierResult);
      setInCache(cacheKey, processed);
      return processed;
    }

    setInCache(cacheKey, fourierResult);
    return fourierResult;
  }

  async calculateTerms(
    input: PiecewiseFourierInput,
    nTerms: number,
  ): Promise<{
    terms: Array<{ n: number; tex: string; maxima: string; float: number[] }>;
  }> {
    const intVar = input.intVar ?? "x";
    const script = await loadScript("trigonometric", "trigonometric.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const termsScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
${script}
block(
  [],
  for i: 1 thru ${nTerms} do (
    an_i: ratsimp(subst(n=i, Coeff_An)),
    bn_i: ratsimp(subst(n=i, Coeff_Bn)),
    term: factor(ratsimp(an_i * cos(i * w0 * ${intVar}) + bn_i * sin(i * w0 * ${intVar}))),
    print("__TERM_START__"),
    print(i),
    print("__TERM_MAXIMA__"),
    print(string(term)),
    print("__TERM_TEX__"),
    tex(term)
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

  private buildFuncInput(segments: PiecewiseSegment[]): string {
    const rows = segments
      .map((s) => `[${s.expression}, ${s.from}, ${s.to}]`)
      .join(", ");
    return `matrix(${rows})`;
  }

  private parseTerms(
    raw: string,
  ): Array<{ n: number; tex: string; maxima: string; float: number[] }> {
    const cleaned = raw.replace(/\\\n/g, "").replace(/\r/g, "");
    const blocks = cleaned.split("__TERM_START__").slice(1);

    return blocks.map((block) => {
      const nMatch = block.match(/^\s*(\d+)/);
      const n = parseInt(nMatch?.[1] ?? "0");

      const maximaRaw = this.extractBetween(
        block,
        "__TERM_MAXIMA__",
        "__TERM_TEX__",
      );
      const texRaw = this.extractBetween(block, "__TERM_TEX__", null);
      const texMatch = texRaw.match(/\$\$([\s\S]+?)\$\$/);

      return {
        n,
        maxima: maximaRaw.replace(/false/g, "").trim(),
        tex: texMatch ? texMatch[1].trim() : "",
        float: [],
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
}
