import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import type {
  FourierTransformInput,
  FourierTransformResult,
  InverseFourierTransformInput,
  InverseFourierTransformRegionResult,
  InverseFourierTransformResult,
  PiecewiseSegment,
} from "../../domain/types/fourier.types";
import path from "path/win32";

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

    const libPath = path
      .join(process.cwd(), "src/scripts/maxima/lib/fourier_transforms.mac")
      .replace(/\\/g, "/");
    const cleanPath = path
      .join(process.cwd(), "src/scripts/maxima/auxiliary/clean_integral.mac")
      .replace(/\\/g, "/");

    const script = (await loadScript("transforms", "fourier_transform.mac"))
      .replace("CLEAN_INTEGRAL_PATH", cleanPath)
      .replace("LIB_PATH", libPath);

    const funcInput = this.buildFuncInput(input.segments);

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
TRANSVAR: ${transVar};
${script}
kill(all)$
`;

    const result = await this.runner.run({ script: fullScript });
    console.log("FT RAW:", JSON.stringify(result.raw.slice(0, 500)));
    console.log("SUCCESS:", result.success);
    console.log("ERROR:", result.error);
    console.log("CLEAN PATH:", cleanPath);
    console.log("LIB PATH:", libPath);
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
    input: InverseFourierTransformInput,
  ): Promise<InverseFourierTransformResult> {
    const startTime = Date.now();
    const intVar = input.intVar ?? "w";
    const transVar = input.transVar ?? "t";

    const libPath = path
      .join(process.cwd(), "src/scripts/maxima/lib/fourier_transforms.mac")
      .replace(/\\/g, "/");
    const cleanPath = path
      .join(process.cwd(), "src/scripts/maxima/auxiliary/clean_integral.mac")
      .replace(/\\/g, "/");

    const scriptRaw = await loadScript(
      "transforms",
      "inverse_fourier_transform.mac",
    );
    const script = scriptRaw
      .replace("CLEAN_INTEGRAL_PATH", cleanPath)
      .replace("LIB_PATH", libPath);

    const funcInput = this.buildFuncInput(input.segments);

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
TRANSVAR: ${transVar};
${script}
kill(all)$
`;

    const result = await this.runner.run({
      script: fullScript,
      timeoutMs: 60000,
    });
    console.log("IFT RAW:", JSON.stringify(result.raw.slice(0, 500)));
    console.log("SUCCESS:", result.success);
    console.log("ERROR:", result.error);

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    const raw = result.raw;

    const fPosMaxima = this.extractBetween(
      raw,
      "__F_POS_MAXIMA__",
      "__F_POS_TEX__",
    )
      .replace(/false/g, "")
      .trim();
    const fPosTex = this.extractTex(
      this.extractBetween(raw, "__F_POS_TEX__", "__F_NEG_MAXIMA__"),
    );
    const fNegMaxima = this.extractBetween(
      raw,
      "__F_NEG_MAXIMA__",
      "__F_NEG_TEX__",
    )
      .replace(/false/g, "")
      .trim();
    const fNegTex = this.extractTex(
      this.extractBetween(raw, "__F_NEG_TEX__", "__HAS_COMBINED__"),
    );
    const hasCombined =
      this.extractBetween(raw, "__HAS_COMBINED__", "__F_COMBINED_MAXIMA__")
        .replace(/false/g, "")
        .trim() === "true";
    const fCombinedMaxima = this.extractBetween(
      raw,
      "__F_COMBINED_MAXIMA__",
      "__F_COMBINED_TEX__",
    )
      .replace(/false/g, "")
      .trim();
    const fCombinedTex = this.extractTex(
      this.extractBetween(raw, "__F_COMBINED_TEX__", null),
    );

    return {
      input,
      exists: fPosMaxima !== "" || fNegMaxima !== "",
      fPositive: fPosMaxima ? { maxima: fPosMaxima, tex: fPosTex } : undefined,
      fNegative: fNegMaxima ? { maxima: fNegMaxima, tex: fNegTex } : undefined,
      fCombined:
        hasCombined && fCombinedMaxima
          ? { maxima: fCombinedMaxima, tex: fCombinedTex }
          : undefined,
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
