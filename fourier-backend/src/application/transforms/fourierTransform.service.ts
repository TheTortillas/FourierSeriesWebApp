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
import path from "path";

export class FourierTransformService {
  constructor(private readonly runner: MaximaRunner) {}

  async transform(
    input: FourierTransformInput,
  ): Promise<FourierTransformResult> {
    const startTime = Date.now();
    const intVar = input.intVar ?? "t";
    const transVar = input.transVar ?? "w";

    const libPath = path.join(
      process.cwd(),
      "src/scripts/maxima/lib/fourier_transforms.mac",
    );
    const cleanPath = path.join(
      process.cwd(),
      "src/scripts/maxima/auxiliary/clean_integral.mac",
    );

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
    // console.log("FT RAW:", JSON.stringify(result.raw.slice(0, 500)));
    // console.log("SUCCESS:", result.success);
    // console.log("ERROR:", result.error);
    // console.log("CLEAN PATH:", cleanPath);
    // console.log("LIB PATH:", libPath);
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
      this.extractBetween(raw, "__IMAG_TEX__", "__INPUT_REAL_MAXIMA__"),
    );
    const inputRealMaxima = this.extractBetween(
      raw,
      "__INPUT_REAL_MAXIMA__",
      "__INPUT_REAL_TEX__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const inputRealTex = this.extractTex(
      this.extractBetween(raw, "__INPUT_REAL_TEX__", "__INPUT_IMAG_MAXIMA__"),
    );
    const inputImagMaxima = this.extractBetween(
      raw,
      "__INPUT_IMAG_MAXIMA__",
      "__INPUT_IMAG_TEX__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const inputImagTex = this.extractTex(
      this.extractBetween(raw, "__INPUT_IMAG_TEX__", "__DISPLAY_F_MAXIMA__"),
    );
    const displayFTex = this.extractTex(
      this.extractBetween(raw, "__DISPLAY_F_TEX__", "__DISPLAY_REAL_MAXIMA__"),
    );
    const displayRealTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_REAL_TEX__",
        "__DISPLAY_IMAG_MAXIMA__",
      ),
    );
    const displayImagTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_IMAG_TEX__",
        "__DISPLAY_INPUT_REAL_MAXIMA__",
      ),
    );
    const displayInputRealTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_INPUT_REAL_TEX__",
        "__DISPLAY_INPUT_IMAG_MAXIMA__",
      ),
    );
    const displayInputImagTex = this.extractTex(
      this.extractBetween(raw, "__DISPLAY_INPUT_IMAG_TEX__", "__PARAMS__"),
    );

    const params = this.extractParams(raw, "__PARAMS__");

    return {
      input,
      exists,
      F: exists ? this.toSymbolic(fMaxima, fTex, displayFTex) : undefined,
      realPart: exists
        ? this.toSymbolic(realMaxima, realTex, displayRealTex)
        : undefined,
      imagPart: exists
        ? this.toSymbolic(imagMaxima, imagTex, displayImagTex)
        : undefined,
      inputRealPart: this.toSymbolic(
        inputRealMaxima,
        inputRealTex,
        displayInputRealTex,
      ),
      inputImagPart: this.toSymbolic(
        inputImagMaxima,
        inputImagTex,
        displayInputImagTex,
      ),
      params,
      executionTimeMs: Date.now() - startTime,
    };
  }

  async inverseTransform(
    input: InverseFourierTransformInput,
  ): Promise<InverseFourierTransformResult> {
    const startTime = Date.now();
    const intVar = input.intVar ?? "w";
    const transVar = input.transVar ?? "t";

    const libPath = path.join(
      process.cwd(),
      "src/scripts/maxima/lib/fourier_transforms.mac",
    );
    const cleanPath = path.join(
      process.cwd(),
      "src/scripts/maxima/auxiliary/clean_integral.mac",
    );

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
    // console.log("IFT RAW:", JSON.stringify(result.raw.slice(0, 500)));
    // console.log("SUCCESS:", result.success);
    // console.log("ERROR:", result.error);

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
      this.extractBetween(raw, "__F_COMBINED_TEX__", "__INPUT_REAL_MAXIMA__"),
    );

    const inputRealMaxima = this.extractBetween(
      raw,
      "__INPUT_REAL_MAXIMA__",
      "__INPUT_REAL_TEX__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const inputRealTex = this.extractTex(
      this.extractBetween(raw, "__INPUT_REAL_TEX__", "__INPUT_IMAG_MAXIMA__"),
    );
    const inputImagMaxima = this.extractBetween(
      raw,
      "__INPUT_IMAG_MAXIMA__",
      "__INPUT_IMAG_TEX__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const inputImagTex = this.extractTex(
      this.extractBetween(raw, "__INPUT_IMAG_TEX__", "__OUTPUT_REAL_MAXIMA__"),
    );
    const outputRealMaxima = this.extractBetween(
      raw,
      "__OUTPUT_REAL_MAXIMA__",
      "__OUTPUT_REAL_TEX__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const outputRealTex = this.extractTex(
      this.extractBetween(raw, "__OUTPUT_REAL_TEX__", "__OUTPUT_IMAG_MAXIMA__"),
    );
    const outputImagMaxima = this.extractBetween(
      raw,
      "__OUTPUT_IMAG_MAXIMA__",
      "__OUTPUT_IMAG_TEX__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const outputImagTex = this.extractTex(
      this.extractBetween(
        raw,
        "__OUTPUT_IMAG_TEX__",
        "__DISPLAY_F_POS_MAXIMA__",
      ),
    );
    const displayFPosTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_F_POS_TEX__",
        "__DISPLAY_F_NEG_MAXIMA__",
      ),
    );
    const displayFNegTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_F_NEG_TEX__",
        "__DISPLAY_F_COMBINED_MAXIMA__",
      ),
    );
    const displayFCombinedTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_F_COMBINED_TEX__",
        "__DISPLAY_INPUT_REAL_MAXIMA__",
      ),
    );
    const displayInputRealTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_INPUT_REAL_TEX__",
        "__DISPLAY_INPUT_IMAG_MAXIMA__",
      ),
    );
    const displayInputImagTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_INPUT_IMAG_TEX__",
        "__DISPLAY_OUTPUT_REAL_MAXIMA__",
      ),
    );
    const displayOutputRealTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_OUTPUT_REAL_TEX__",
        "__DISPLAY_OUTPUT_IMAG_MAXIMA__",
      ),
    );
    const displayOutputImagTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_OUTPUT_IMAG_TEX__",
        "__DISPLAY_OUTPUT_REAL_POS_TEX__",
      ),
    );
    const displayOutputRealPosTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_OUTPUT_REAL_POS_TEX__",
        "__DISPLAY_OUTPUT_REAL_NEG_TEX__",
      ),
    );
    const displayOutputRealNegTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_OUTPUT_REAL_NEG_TEX__",
        "__DISPLAY_OUTPUT_IMAG_POS_TEX__",
      ),
    );
    const displayOutputImagPosTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_OUTPUT_IMAG_POS_TEX__",
        "__DISPLAY_OUTPUT_IMAG_NEG_TEX__",
      ),
    );
    const displayOutputImagNegTex = this.extractTex(
      this.extractBetween(
        raw,
        "__DISPLAY_OUTPUT_IMAG_NEG_TEX__",
        "__OUTPUT_REAL_POS_MAXIMA__",
      ),
    );

    const outputRealPosMaxima = this.extractBetween(
      raw,
      "__OUTPUT_REAL_POS_MAXIMA__",
      "__OUTPUT_REAL_NEG_MAXIMA__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const outputRealNegMaxima = this.extractBetween(
      raw,
      "__OUTPUT_REAL_NEG_MAXIMA__",
      "__OUTPUT_IMAG_POS_MAXIMA__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const outputImagPosMaxima = this.extractBetween(
      raw,
      "__OUTPUT_IMAG_POS_MAXIMA__",
      "__OUTPUT_IMAG_NEG_MAXIMA__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const outputImagNegMaxima = this.extractBetween(
      raw,
      "__OUTPUT_IMAG_NEG_MAXIMA__",
      "__F_OUT_U_FORM_MAXIMA__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const fOutUFormMaxima = this.extractBetween(
      raw,
      "__F_OUT_U_FORM_MAXIMA__",
      "__F_OUT_U_FORM_TEX__",
    )
      .replace(/false/g, "")
      .trim();
    const fOutUFormTex = this.extractTex(
      this.extractBetween(raw, "__F_OUT_U_FORM_TEX__", "__DISPLAY_F_OUT_U_FORM_TEX__"),
    );
    const displayFOutUFormTex = this.extractTex(
      this.extractBetween(raw, "__DISPLAY_F_OUT_U_FORM_TEX__", "__F_OUT_U_FORM_REAL_MAXIMA__"),
    );
    const fOutUFormRealMaxima = this.extractBetween(
      raw,
      "__F_OUT_U_FORM_REAL_MAXIMA__",
      "__F_OUT_U_FORM_REAL_TEX__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const fOutUFormRealTex = this.extractTex(
      this.extractBetween(raw, "__F_OUT_U_FORM_REAL_TEX__", "__F_OUT_U_FORM_IMAG_MAXIMA__"),
    );
    const fOutUFormImagMaxima = this.extractBetween(
      raw,
      "__F_OUT_U_FORM_IMAG_MAXIMA__",
      "__F_OUT_U_FORM_IMAG_TEX__",
    )
      .replace(/\bfalse\b/g, "")
      .trim();
    const fOutUFormImagTex = this.extractTex(
      this.extractBetween(raw, "__F_OUT_U_FORM_IMAG_TEX__", "__PARAMS__"),
    );

    const params = this.extractParams(raw, "__PARAMS__");

    return {
      input,
      exists: fPosMaxima !== "" || fNegMaxima !== "",
      fPositive: this.toSymbolic(fPosMaxima, fPosTex, displayFPosTex),
      fNegative: this.toSymbolic(fNegMaxima, fNegTex, displayFNegTex),
      fCombined:
        hasCombined && fCombinedMaxima
          ? this.toSymbolic(fCombinedMaxima, fCombinedTex, displayFCombinedTex)
          : undefined,
      fOutUForm: fOutUFormMaxima
        ? this.toSymbolic(fOutUFormMaxima, fOutUFormTex, displayFOutUFormTex)
        : undefined,
      inputRealPart: this.toSymbolic(
        inputRealMaxima,
        inputRealTex,
        displayInputRealTex,
      ),
      inputImagPart: this.toSymbolic(
        inputImagMaxima,
        inputImagTex,
        displayInputImagTex,
      ),
      outputRealPart: this.toSymbolic(
        outputRealMaxima,
        outputRealTex,
        displayOutputRealTex,
      ),
      outputImagPart: this.toSymbolic(
        outputImagMaxima,
        outputImagTex,
        displayOutputImagTex,
      ),
      outputRealPartPositive: this.toSymbolic(
        outputRealPosMaxima,
        displayOutputRealPosTex,
      ),
      outputRealPartNegative: this.toSymbolic(
        outputRealNegMaxima,
        displayOutputRealNegTex,
      ),
      outputImagPartPositive: this.toSymbolic(
        outputImagPosMaxima,
        displayOutputImagPosTex,
      ),
      outputImagPartNegative: this.toSymbolic(
        outputImagNegMaxima,
        displayOutputImagNegTex,
      ),
      outputRealUForm: this.toSymbolic(fOutUFormRealMaxima, fOutUFormRealTex),
      outputImagUForm: this.toSymbolic(fOutUFormImagMaxima, fOutUFormImagTex),
      params,
      executionTimeMs: Date.now() - startTime,
    };
  }

  private toSymbolic(maxima: string, tex: string, displayTex?: string) {
    if (!maxima) return undefined;
    // Maxima sometimes returns internal label names (result3, %r2, %t1, …) when
    // integrate() leaves an expression unsimplified. These are meaningless to the
    // user and should be treated as "no closed form found".
    if (/^(result\d+|%r\d+|%t\d+|%c\d+)$/.test(maxima.trim())) return undefined;
    return {
      maxima,
      tex: displayTex || tex,
    };
  }

  private buildFuncInput(segments: PiecewiseSegment[]): string {
    const rows = segments
      .map((s) => `[${s.expression}, ${s.from}, ${s.to}]`)
      .join(", ");
    return `matrix(${rows})`;
  }

  private extractParams(raw: string, marker: string): string[] {
    const section = this.extractBetween(raw, marker, null);
    const match = section.match(/\[([^\]]*)\]/);
    if (!match || !match[1].trim()) return [];
    return match[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
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
