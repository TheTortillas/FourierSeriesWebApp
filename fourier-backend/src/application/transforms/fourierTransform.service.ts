import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import type {
  FourierTransformInput,
  FourierTransformResult,
  InverseFourierTransformResult,
  PiecewiseSegment,
} from "../../domain/types/fourier.types";

const TRANSFORM_MARKERS = [
  "__EXISTS__",
  "__EXISTS__",
  "__F_MAXIMA__",
  "__F_TEX__",
  "__REAL_MAXIMA__",
  "__REAL_TEX__",
  "__IMAG_MAXIMA__",
  "__IMAG_TEX__",
];

export class FourierTransformService {
  constructor(private readonly runner: MaximaRunner) {}

  async transform(
    input: FourierTransformInput,
  ): Promise<FourierTransformResult> {
    const startTime = Date.now();
    const intVar = input.intVar ?? "t";
    const transVar = input.transVar ?? "w";

    const script = await loadScript("transforms", "fourier_transform.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
TRANSVAR: ${transVar};
${script}
kill(all)$
`;

    const result = await this.runner.run({ script: fullScript });

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    const raw = result.raw;
    const exists =
      this.extractBetween(raw, "__EXISTS__", "__F_MAXIMA__")
        .replace(/false/g, "")
        .trim() === "true";

    const fMaxima = this.extractBetween(raw, "__F_MAXIMA__", "__F_TEX__")
      .replace(/false/g, "")
      .trim();
    const fTex = this.extractTex(
      this.extractBetween(raw, "__F_TEX__", "__REAL_MAXIMA__"),
    );
    const realMaxima = this.extractBetween(
      raw,
      "__REAL_MAXIMA__",
      "__REAL_TEX__",
    )
      .replace(/false/g, "")
      .trim();
    const realTex = this.extractTex(
      this.extractBetween(raw, "__REAL_TEX__", "__IMAG_MAXIMA__"),
    );
    const imagMaxima = this.extractBetween(
      raw,
      "__IMAG_MAXIMA__",
      "__IMAG_TEX__",
    )
      .replace(/false/g, "")
      .trim();
    const imagTex = this.extractTex(
      this.extractBetween(raw, "__IMAG_TEX__", null),
    );

    return {
      input,
      exists,
      F: exists ? { maxima: fMaxima, tex: fTex } : undefined,
      realPart: exists ? { maxima: realMaxima, tex: realTex } : undefined,
      imagPart: exists ? { maxima: imagMaxima, tex: imagTex } : undefined,
      executionTimeMs: Date.now() - startTime,
    };
  }

  async inverseTransform(
    input: FourierTransformInput,
  ): Promise<InverseFourierTransformResult> {
    const startTime = Date.now();
    const intVar = input.intVar ?? "w";
    const transVar = input.transVar ?? "t";

    const script = await loadScript(
      "transforms",
      "inverse_fourier_transform.mac",
    );
    const funcInput = this.buildFuncInput(input.segments);

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
TRANSVAR: ${transVar};
${script}
kill(all)$
`;

    const result = await this.runner.run({ script: fullScript });

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    const raw = result.raw;
    const exists =
      this.extractBetween(raw, "__EXISTS__", "__F_MAXIMA__")
        .replace(/false/g, "")
        .trim() === "true";

    const fMaxima = this.extractBetween(raw, "__F_MAXIMA__", "__F_TEX__")
      .replace(/false/g, "")
      .trim();
    const fTex = this.extractTex(this.extractBetween(raw, "__F_TEX__", null));

    return {
      input,
      exists,
      f: exists ? { maxima: fMaxima, tex: fTex } : undefined,
      executionTimeMs: Date.now() - startTime,
    };
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
