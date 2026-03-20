import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { MaximaPostProcessor } from "../../infrastructure/postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../auxiliary/auxiliaryService";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import { parseMarkeredOutput } from "../../infrastructure/maxima/maximaOutputParser";
import type {
  HalfRangeResult,
  PiecewiseFourierInput,
  PiecewiseSegment,
} from "../../domain/types/fourier.types";

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
`;

    const result = await this.runner.run({ script: fullScript });

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    const parsed = parseMarkeredOutput(result.raw, HALF_RANGE_MARKERS);

    return {
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
  }

  private buildFuncInput(segments: PiecewiseSegment[]): string {
    const rows = segments
      .map((s) => `[${s.expression}, ${s.from}, ${s.to}]`)
      .join(", ");
    return `matrix(${rows})`;
  }
}
