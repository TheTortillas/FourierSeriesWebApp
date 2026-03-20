import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { MaximaPostProcessor } from "../../infrastructure/postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../auxiliary/auxiliaryService";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import { parseMarkeredOutput } from "../../infrastructure/maxima/maximaOutputParser";
import type {
  ComplexFourierResult,
  ComplexTermsResult,
  PiecewiseFourierInput,
  PiecewiseSegment,
} from "../../domain/types/fourier.types";

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

    return {
      input,
      coefficients: {
        c0: parsed["c0"] ?? { tex: "", maxima: "" },
        cn: parsed["cn"] ?? { tex: "", maxima: "" },
      },
      seriesComplex: parsed["series_complex"] ?? { tex: "", maxima: "" },
      validation,
      executionTimeMs: Date.now() - startTime,
    };
  }

  async calculateTerms(
    input: PiecewiseFourierInput,
    nTerms: number,
  ): Promise<ComplexTermsResult> {
    const intVar = input.intVar ?? "x";
    const script = await loadScript("complex", "complex.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const termsScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
${script}
block(
  [cn_val, cn_neg_val, term_complex, term_real, amp, ph],
  for i: 1 thru ${nTerms} do (
    cn_val: ratsimp(subst(n=i, Coeff_n)),
    cn_neg_val: ratsimp(subst(n=-i, Coeff_n)),
    term_complex: cn_val * exp(%i * i * w0 * ${intVar}) + cn_neg_val * exp(-%i * i * w0 * ${intVar}),
    term_real: factor(ratsimp(realpart(rectform(term_complex)))),
    amp: float(abs(cn_val)),
    ph: float(carg(cn_val)),
    print("__TERM_START__"),
    print(i),
    print("__COMPLEX_MAXIMA__"),
    print(string(term_complex)),
    print("__COMPLEX_TEX__"),
    tex(term_complex),
    print("__REAL_MAXIMA__"),
    print(string(term_real)),
    print("__REAL_TEX__"),
    tex(term_real),
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

    return { terms: this.parseTerms(result.raw) };
  }

  private buildFuncInput(segments: PiecewiseSegment[]): string {
    const rows = segments
      .map((s) => `[${s.expression}, ${s.from}, ${s.to}]`)
      .join(", ");
    return `matrix(${rows})`;
  }

  private parseTerms(raw: string): ComplexTermsResult["terms"] {
    const cleaned = raw.replace(/\\\n/g, "").replace(/\r/g, "");
    const blocks = cleaned.split("__TERM_START__").slice(1);

    return blocks.map((block) => {
      const nMatch = block.match(/^\s*(\d+)/);
      const n = parseInt(nMatch?.[1] ?? "0");

      const complexMaxima = this.extractBetween(
        block,
        "__COMPLEX_MAXIMA__",
        "__COMPLEX_TEX__",
      );
      const complexTex = this.extractTex(
        this.extractBetween(block, "__COMPLEX_TEX__", "__REAL_MAXIMA__"),
      );
      const realMaxima = this.extractBetween(
        block,
        "__REAL_MAXIMA__",
        "__REAL_TEX__",
      );
      const realTex = this.extractTex(
        this.extractBetween(block, "__REAL_TEX__", "__AMPLITUDE__"),
      );
      const amplitudeStr = this.extractBetween(
        block,
        "__AMPLITUDE__",
        "__PHASE__",
      );
      const phaseStr = this.extractBetween(block, "__PHASE__", null);

      return {
        n,
        complex: {
          maxima: complexMaxima.replace(/false/g, "").trim(),
          tex: complexTex,
        },
        real: {
          maxima: realMaxima.replace(/false/g, "").trim(),
          tex: realTex,
        },
        amplitude: parseFloat(amplitudeStr.replace(/false/g, "").trim()) || 0,
        phase:
          parseFloat(
            phaseStr.replace(/false/g, "").trim().split("\n")[0] ?? "0",
          ) || 0,
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
}
