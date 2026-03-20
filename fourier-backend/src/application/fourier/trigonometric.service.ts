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
    const startTime = Date.now();

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
${script}
`;

    const result = await this.runner.run({ script: fullScript });
    console.log("RAW RUNNER OUTPUT:", JSON.stringify(result.raw));

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
      return this.postProcessor.process(fourierResult);
    }

    return fourierResult;
  }

  async calculateTerms(
    input: PiecewiseFourierInput,
    nTerms: number,
  ): Promise<{
    terms: Array<{ n: number; tex: string; maxima: string; float: number[] }>;
  }> {
    const script = await loadScript("trigonometric", "trigonometric.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const termsScript = `
FUNC_INPUT: ${funcInput};
${script}
block(
  [terms: []],
  for i: 1 thru ${nTerms} do (
    an_i: subst(n=i, Coeff_An),
    bn_i: subst(n=i, Coeff_Bn),
    term: an_i * cos(i * w0 * x) + bn_i * sin(i * w0 * x),
    print("__TERM_START__"),
    print(i),
    print(string(term)),
    tex(term)
  )
)$
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
    const cleaned = raw.replace(/\\\n/g, "").replace(/\n/g, " ");
    const blocks = cleaned.split("__TERM_START__").slice(1);

    return blocks.map((block) => {
      const texMatch = block.match(/\$\$(.+?)\$\$/s);
      const tex = texMatch ? texMatch[1].trim() : "";
      const withoutTex = block
        .replace(/\$\$.*?\$\$/s, "")
        .replace(/false/g, "");
      const parts = withoutTex.trim().split(/\s+/);
      const n = parseInt(parts[0] ?? "0");
      const maxima = parts.slice(1).join(" ").trim();

      return { n, tex, maxima, float: [] };
    });
  }
}
