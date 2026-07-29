import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import type {
  FourierIntegralInput,
  FourierIntegralCoefficientsResult,
  FourierIntegralReconstructInput,
  FourierIntegralReconstructResult,
  DFTPoint,
  PiecewiseSegment,
  SymbolicExpression,
} from "../../domain/types/fourier.types";
import path from "path";

export class FourierIntegralService {
  constructor(private readonly runner: MaximaRunner) {}

  async coefficients(
    input: FourierIntegralInput,
  ): Promise<FourierIntegralCoefficientsResult> {
    const startTime = Date.now();
    const intVar = input.intVar ?? "v";
    const transVar = input.transVar ?? "w";
    const variant = input.variant;

    const cleanPath = path.join(
      process.cwd(),
      "src/scripts/maxima/auxiliary/clean_integral.mac",
    );
    const libPath = path.join(
      process.cwd(),
      "src/scripts/maxima/lib/fourier_transforms.mac",
    );
    const funcInput = this.buildFuncInput(input.segments);

    if (variant === "complex") {
      return this.coefficientsComplex(
        input,
        intVar,
        transVar,
        funcInput,
        cleanPath,
        libPath,
        startTime,
      );
    }

    return this.coefficientsTrig(
      input,
      intVar,
      transVar,
      funcInput,
      cleanPath,
      startTime,
    );
  }

  private async coefficientsTrig(
    input: FourierIntegralInput,
    intVar: string,
    transVar: string,
    funcInput: string,
    cleanPath: string,
    startTime: number,
  ): Promise<FourierIntegralCoefficientsResult> {
    const script = (
      await loadScript("transforms", "fourier_integral_trig.mac")
    ).replace("CLEAN_INTEGRAL_PATH", cleanPath);

    const fullScript = `
radexpand: false$
load("${process.cwd()}/src/scripts/maxima/lib/const_factor.mac")$
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
TRANSVAR: ${transVar};
VARIANT: "${input.variant}";
${script}
kill(all)$
`;

    const result = await this.runner.run({ script: fullScript, timeoutMs: 60000 });
    if (!result.success) throw new Error(`Maxima error: ${result.error}`);

    const raw = result.raw;
    const exists =
      this.extractBetween(raw, "__EXISTS__", "__A_MAXIMA__").replace(/false/g, "").trim() === "true";

    const aMaxima = this.extractBetween(raw, "__A_MAXIMA__", "__A_TEX__").replace(/false/g, "").trim();
    const aTex    = this.extractTex(this.extractBetween(raw, "__A_TEX__", "__B_MAXIMA__"));
    const bMaxima = this.extractBetween(raw, "__B_MAXIMA__", "__B_TEX__").replace(/false/g, "").trim();
    const bTex    = this.extractTex(this.extractBetween(raw, "__B_TEX__", "__FI_TEX__"));
    const fourierIntegralTex = this.extractBetween(raw, "__FI_TEX__", "__INTEGRAND_MAXIMA__").trim();

    const integrandMaxima = this.extractBetween(raw, "__INTEGRAND_MAXIMA__", "__INTEGRAND_TEX__").trim();
    const integrandTex    = this.extractTex(this.extractBetween(raw, "__INTEGRAND_TEX__", "__INTEGRAND_K_MAXIMA__"));

    const integrandKMaxima = this.extractBetween(raw, "__INTEGRAND_K_MAXIMA__", "__INTEGRAND_K_TEX__").replace(/\bfalse\b/g, "").trim();
    const integrandKTex    = this.extractTex(this.extractBetween(raw, "__INTEGRAND_K_TEX__", "__INTEGRAND_S_MAXIMA__"));
    const integrandSMaxima = this.extractBetween(raw, "__INTEGRAND_S_MAXIMA__", "__INTEGRAND_S_TEX__").replace(/\bfalse\b/g, "").trim();
    const integrandSTex    = this.extractTex(this.extractBetween(raw, "__INTEGRAND_S_TEX__", "__INPUT_REAL_MAXIMA__"));

    const inputRealMaxima = this.extractBetween(raw, "__INPUT_REAL_MAXIMA__", "__INPUT_REAL_TEX__").replace(/\bfalse\b/g, "").trim();
    const inputRealTex    = this.extractTex(this.extractBetween(raw, "__INPUT_REAL_TEX__", "__INPUT_IMAG_MAXIMA__"));
    const inputImagMaxima = this.extractBetween(raw, "__INPUT_IMAG_MAXIMA__", "__INPUT_IMAG_TEX__").replace(/\bfalse\b/g, "").trim();
    const inputImagTex    = this.extractTex(this.extractBetween(raw, "__INPUT_IMAG_TEX__", "__PARAMS__"));

    const paramsSection = this.extractBetween(raw, "__PARAMS__", null);
    const paramsMatch   = paramsSection.match(/\[([^\]]*)\]/);
    const params = paramsMatch && paramsMatch[1].trim()
      ? paramsMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    return {
      input,
      exists,
      fourierIntegralTex: exists ? fourierIntegralTex : undefined,
      integrand:         exists ? this.toSymbolic(integrandMaxima, integrandTex) : undefined,
      integrandK:        exists ? this.toSymbolic(integrandKMaxima, integrandKTex) : undefined,
      integrandSummand:  exists ? this.toSymbolic(integrandSMaxima, integrandSTex) : undefined,
      A: exists && input.variant !== "sine"   ? this.toSymbolic(aMaxima, aTex) : undefined,
      B: exists && input.variant !== "cosine" ? this.toSymbolic(bMaxima, bTex) : undefined,
      inputRealPart: this.toSymbolic(inputRealMaxima, inputRealTex),
      inputImagPart: this.toSymbolic(inputImagMaxima, inputImagTex),
      params,
      executionTimeMs: Date.now() - startTime,
    };
  }

  private async coefficientsComplex(
    input: FourierIntegralInput,
    intVar: string,
    transVar: string,
    funcInput: string,
    cleanPath: string,
    libPath: string,
    startTime: number,
  ): Promise<FourierIntegralCoefficientsResult> {
    const script = (await loadScript("transforms", "fourier_integral_complex.mac"))
      .replace("CLEAN_INTEGRAL_PATH", cleanPath)
      .replace("LIB_PATH", libPath);

    const fullScript = `
radexpand: false$
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
TRANSVAR: ${transVar};
load("${process.cwd()}/src/scripts/maxima/lib/const_factor.mac")$
${script}
kill(all)$
`;

    const result = await this.runner.run({ script: fullScript, timeoutMs: 60000 });
    if (!result.success) throw new Error(`Maxima error: ${result.error}`);

    const raw = result.raw;
    const exists =
      this.extractBetween(raw, "__EXISTS__", "__FI_TEX__").replace(/false/g, "").trim() === "true";

    const fourierIntegralTex = this.extractBetween(raw, "__FI_TEX__", "__INTEGRAND_K_MAXIMA__").trim();

    const integrandKMaxima = this.extractBetween(raw, "__INTEGRAND_K_MAXIMA__", "__INTEGRAND_K_TEX__").replace(/\bfalse\b/g, "").trim();
    const integrandKTex    = this.extractTex(this.extractBetween(raw, "__INTEGRAND_K_TEX__", "__INTEGRAND_S_MAXIMA__"));
    const integrandSMaxima = this.extractBetween(raw, "__INTEGRAND_S_MAXIMA__", "__INTEGRAND_S_TEX__").replace(/\bfalse\b/g, "").trim();
    const integrandSTex    = this.extractTex(this.extractBetween(raw, "__INTEGRAND_S_TEX__", "__C_MAXIMA__"));

    const cMaxima     = this.extractBetween(raw, "__C_MAXIMA__",      "__C_TEX__").replace(/false/g, "").trim();
    const cTex        = this.extractTex(this.extractBetween(raw, "__C_TEX__",      "__C_REAL_MAXIMA__"));
    const cRealMaxima = this.extractBetween(raw, "__C_REAL_MAXIMA__", "__C_REAL_TEX__").replace(/false/g, "").trim();
    const cRealTex    = this.extractTex(this.extractBetween(raw, "__C_REAL_TEX__", "__C_IMAG_MAXIMA__"));
    const cImagMaxima = this.extractBetween(raw, "__C_IMAG_MAXIMA__", "__C_IMAG_TEX__").replace(/false/g, "").trim();
    const cImagTex    = this.extractTex(this.extractBetween(raw, "__C_IMAG_TEX__", "__INPUT_REAL_MAXIMA__"));

    const inputRealMaxima = this.extractBetween(raw, "__INPUT_REAL_MAXIMA__", "__INPUT_REAL_TEX__").replace(/\bfalse\b/g, "").trim();
    const inputRealTex    = this.extractTex(this.extractBetween(raw, "__INPUT_REAL_TEX__", "__INPUT_IMAG_MAXIMA__"));
    const inputImagMaxima = this.extractBetween(raw, "__INPUT_IMAG_MAXIMA__", "__INPUT_IMAG_TEX__").replace(/\bfalse\b/g, "").trim();
    const inputImagTex    = this.extractTex(this.extractBetween(raw, "__INPUT_IMAG_TEX__", "__PARAMS__"));

    const paramsSection = this.extractBetween(raw, "__PARAMS__", null);
    const paramsMatch   = paramsSection.match(/\[([^\]]*)\]/);
    const params = paramsMatch && paramsMatch[1].trim()
      ? paramsMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    return {
      input,
      exists,
      fourierIntegralTex: exists ? fourierIntegralTex : undefined,
      integrandK:       exists ? this.toSymbolic(integrandKMaxima, integrandKTex) : undefined,
      integrandSummand: exists ? this.toSymbolic(integrandSMaxima, integrandSTex) : undefined,
      C:         exists ? this.toSymbolic(cMaxima,     cTex)     : undefined,
      realPart:  exists ? this.toSymbolic(cRealMaxima, cRealTex) : undefined,
      imagPart:  exists ? this.toSymbolic(cImagMaxima, cImagTex) : undefined,
      inputRealPart: this.toSymbolic(inputRealMaxima, inputRealTex),
      inputImagPart: this.toSymbolic(inputImagMaxima, inputImagTex),
      params,
      executionTimeMs: Date.now() - startTime,
    };
  }

  async reconstruct(
    input: FourierIntegralReconstructInput,
  ): Promise<FourierIntegralReconstructResult> {
    const startTime = Date.now();
    const intVar   = input.intVar   ?? "v";
    const transVar = input.transVar ?? "w";
    const nPoints  = input.nPoints  ?? 200;

    const cleanPath = path.join(
      process.cwd(),
      "src/scripts/maxima/auxiliary/clean_integral.mac",
    );
    const funcInput = this.buildFuncInput(input.segments);

    /* Build x grid as Maxima list */
    const step = (input.xMax - input.xMin) / (nPoints - 1);
    const xGrid = Array.from({ length: nPoints }, (_, i) =>
      parseFloat((input.xMin + i * step).toFixed(8)),
    );
    const xGridMaxima = `[${xGrid.join(",")}]`;

    const script = (
      await loadScript("transforms", "fourier_integral_reconstruct.mac")
    ).replace("CLEAN_INTEGRAL_PATH", cleanPath);

    const fullScript = `
radexpand: false$
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
TRANSVAR: ${transVar};
VARIANT: "${input.variant}";
UPPER_LIMIT: ${input.upperLimit};
X_GRID: ${xGridMaxima};
${script}
kill(all)$
`;

    const result = await this.runner.run({ script: fullScript, timeoutMs: 120000 });
    if (!result.success) throw new Error(`Maxima error: ${result.error}`);

    const raw = result.raw;
    const ySection = this.extractBetween(raw, "__Y_VALUES__", "__END__").trim();
    const points = this.parseYValues(ySection, xGrid);

    return {
      input,
      points,
      executionTimeMs: Date.now() - startTime,
    };
  }

  private parseYValues(raw: string, xGrid: number[]): DFTPoint[] {
    /* Maxima emits list as [y0,y1,...] possibly split across lines */
    const cleaned = raw.replace(/\s+/g, "").replace(/^\[/, "").replace(/\]$/, "");
    if (!cleaned) return xGrid.map((x) => ({ x, y: 0 }));

    const values = cleaned.split(",").map((s) => {
      const n = parseFloat(s);
      return isFinite(n) ? n : 0;
    });

    return xGrid.map((x, i) => ({ x, y: values[i] ?? 0 }));
  }

  private buildFuncInput(segments: PiecewiseSegment[]): string {
    const rows = segments
      .map((s) => `[${s.expression}, ${s.from}, ${s.to}]`)
      .join(", ");
    return `matrix(${rows})`;
  }

  private toSymbolic(maxima: string, tex: string): SymbolicExpression | undefined {
    if (!maxima) return undefined;
    if (/^(result\d+|%r\d+|%t\d+|%c\d+)$/.test(maxima.trim())) return undefined;
    return { maxima, tex };
  }

  private extractBetween(text: string, start: string, end: string | null): string {
    const startIdx = text.indexOf(start);
    if (startIdx === -1) return "";
    const afterStart = startIdx + start.length;
    if (end === null) return text.slice(afterStart);
    const endIdx = text.indexOf(end, afterStart);
    return endIdx === -1 ? text.slice(afterStart) : text.slice(afterStart, endIdx);
  }

  private extractTex(raw: string): string {
    const match = raw.match(/\$\$([\s\S]+?)\$\$/);
    return match ? match[1].trim() : "";
  }
}
