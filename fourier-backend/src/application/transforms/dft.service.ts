import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import type {
  DFTInput,
  DFTResult,
  DFTCoefficient,
  DFTFunctionInput,
  DFTFunctionResult,
  DFTSampleResult,
  DFTPoint,
  PiecewiseSegment,
} from "../../domain/types/fourier.types";

const TAU = Math.PI * 2;
const MAX_POINTS = 20000;
const TOP_COEFFS_LIMIT = 256;

export class DFTService {
  constructor(private readonly runner: MaximaRunner) {}

  async compute(input: DFTInput): Promise<DFTResult> {
    const startTime = Date.now();
    void this.runner;

    if (input.points.length > MAX_POINTS) {
      throw new Error(`Maximum ${MAX_POINTS} points allowed`);
    }

    if (input.points.length < 2) {
      throw new Error("At least 2 points are required");
    }

    const N = input.points.length;
    const signalRe = input.points.map((p) =>
      input.mode === "epicycles" ? p.x : p.y,
    );
    const signalIm = input.points.map((p) =>
      input.mode === "epicycles" ? p.y : 0,
    );

    const baseCoefficients = this.computeCoefficients(signalRe, signalIm);
    const reconstructedComplex = this.reconstruct(baseCoefficients);

    const totalAmplitude = baseCoefficients.reduce(
      (sum, c) => sum + c.amplitude,
      0,
    );

    const coefficients: DFTCoefficient[] = baseCoefficients.map((c) => ({
      ...c,
      amplitudePercent:
        totalAmplitude > 0
          ? parseFloat(((c.amplitude / totalAmplitude) * 100).toFixed(4))
          : 0,
      freq: parseFloat((c.k / N).toFixed(6)),
    }));

    const topCoefficients = [...coefficients]
      .sort((a, b) => b.amplitude - a.amplitude)
      .slice(0, Math.min(TOP_COEFFS_LIMIT, coefficients.length));

    const reconstructed: DFTPoint[] = reconstructedComplex.map((p, idx) => {
      if (input.mode === "signal") {
        return {
          x: input.points[idx]?.x ?? idx,
          y: p.x,
        };
      }
      return p;
    });

    const rmsError = this.computeRmsError(
      input.mode,
      input.points,
      reconstructedComplex,
    );

    return {
      mode: input.mode,
      N,
      coefficients,
      topCoefficients,
      reconstructed,
      rmsError,
      executionTimeMs: Date.now() - startTime,
    };
  }

  private cleanFloat(val: number, threshold = 1e-10): number {
    return Math.abs(val) < threshold ? 0 : val;
  }

  private computeCoefficients(
    signalRe: number[],
    signalIm: number[],
  ): Array<Omit<DFTCoefficient, "amplitudePercent" | "freq">> {
    const N = signalRe.length;
    const coeffs: Array<Omit<DFTCoefficient, "amplitudePercent" | "freq">> =
      new Array(N);

    for (let k = 0; k < N; k++) {
      const step = (-TAU * k) / N;
      const cosStep = Math.cos(step);
      const sinStep = Math.sin(step);

      let cosAcc = 1;
      let sinAcc = 0;

      let reSum = 0;
      let imSum = 0;

      for (let n = 0; n < N; n++) {
        const xr = signalRe[n] ?? 0;
        const xi = signalIm[n] ?? 0;

        reSum += xr * cosAcc - xi * sinAcc;
        imSum += xr * sinAcc + xi * cosAcc;

        const nextCos = cosAcc * cosStep - sinAcc * sinStep;
        const nextSin = sinAcc * cosStep + cosAcc * sinStep;
        cosAcc = nextCos;
        sinAcc = nextSin;
      }

      const re = this.cleanFloat(reSum / N);
      const im = this.cleanFloat(imSum / N);
      const amplitude = this.cleanFloat(Math.hypot(re, im));
      const phase =
        amplitude < 1e-12 ? 0 : this.cleanFloat(Math.atan2(im, re), 1e-12);

      coeffs[k] = {
        k,
        re,
        im,
        amplitude,
        phase,
        phaseInPi: this.simplifyPhaseInPi(phase),
      };
    }

    return coeffs;
  }

  private simplifyPhaseInPi(phase: number): string {
    const PI = Math.PI;
    const tolerance = 1e-6;

    const commonFractions = [
      [0, "0"],
      [1, "1"],
      [-1, "-1"],
      [0.5, "1/2"],
      [-0.5, "-1/2"],
      [1 / 3, "1/3"],
      [-1 / 3, "-1/3"],
      [2 / 3, "2/3"],
      [-2 / 3, "-2/3"],
      [1 / 4, "1/4"],
      [-1 / 4, "-1/4"],
      [3 / 4, "3/4"],
      [-3 / 4, "-3/4"],
      [1 / 6, "1/6"],
      [-1 / 6, "-1/6"],
      [5 / 6, "5/6"],
      [-5 / 6, "-5/6"],
    ];

    const phaseOverPi = phase / PI;

    for (const [val, label] of commonFractions) {
      if (Math.abs(phaseOverPi - (val as number)) < tolerance) {
        return label as string;
      }
    }

    const rounded = Number(phaseOverPi.toFixed(6));
    return Number.isFinite(rounded) ? `${rounded}` : "0";
  }

  private reconstruct(
    coefficients: Array<Omit<DFTCoefficient, "amplitudePercent" | "freq">>,
  ): DFTPoint[] {
    const N = coefficients.length;
    const points: DFTPoint[] = new Array(N);

    for (let n = 0; n < N; n++) {
      const step = (TAU * n) / N;
      const cosStep = Math.cos(step);
      const sinStep = Math.sin(step);

      let cosAcc = 1;
      let sinAcc = 0;

      let reSum = 0;
      let imSum = 0;

      for (let k = 0; k < N; k++) {
        const c = coefficients[k];
        if (!c) continue;

        reSum += c.re * cosAcc - c.im * sinAcc;
        imSum += c.re * sinAcc + c.im * cosAcc;

        const nextCos = cosAcc * cosStep - sinAcc * sinStep;
        const nextSin = sinAcc * cosStep + cosAcc * sinStep;
        cosAcc = nextCos;
        sinAcc = nextSin;
      }

      points[n] = {
        x: this.cleanFloat(reSum, 1e-9),
        y: this.cleanFloat(imSum, 1e-9),
      };
    }

    return points;
  }

  /** Sample a piecewise function at N points using Maxima — no DFT computation. */
  async sampleFunction(input: DFTFunctionInput): Promise<DFTSampleResult> {
    const startTime = Date.now();
    const N = Math.max(2, Math.min(4096, input.N));
    const intVar = input.intVar ?? "x";

    const script = await loadScript("transforms", "eval_function.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
N_SAMPLES: ${N};
${script}
kill(all)$
`;
    const result = await this.runner.run({ script: fullScript });
    if (!result.success) {
      throw new Error(`Maxima error during function evaluation: ${result.error}`);
    }

    const a = parseFloat(this.extractSection(result.raw, "__A__", "__B__"));
    const b = parseFloat(this.extractSection(result.raw, "__B__", "__XS__"));
    const xs = this.parseFloatList(this.extractSection(result.raw, "__XS__", "__YS__"));
    const ys = this.parseFloatList(this.extractSection(result.raw, "__YS__", null));

    if (xs.length === 0 || ys.length === 0) {
      throw new Error("Function evaluation returned no points");
    }

    return {
      sampledPoints: xs.map((x, i) => ({ x, y: ys[i] ?? 0 })),
      interval: { a, b },
      samplingTimeMs: Date.now() - startTime,
    };
  }

  async computeFromFunction(input: DFTFunctionInput): Promise<DFTFunctionResult> {
    const startTime = Date.now();
    const N = Math.max(2, Math.min(4096, input.N));
    const intVar = input.intVar ?? "x";

    const script = await loadScript("transforms", "eval_function.mac");
    const funcInput = this.buildFuncInput(input.segments);

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
N_SAMPLES: ${N};
${script}
kill(all)$
`;
    const result = await this.runner.run({ script: fullScript });
    if (!result.success) {
      throw new Error(`Maxima error during function evaluation: ${result.error}`);
    }

    const a = parseFloat(this.extractSection(result.raw, "__A__", "__B__"));
    const b = parseFloat(this.extractSection(result.raw, "__B__", "__XS__"));
    const xs = this.parseFloatList(this.extractSection(result.raw, "__XS__", "__YS__"));
    const ys = this.parseFloatList(this.extractSection(result.raw, "__YS__", null));

    if (xs.length === 0 || ys.length === 0) {
      throw new Error("Function evaluation returned no points");
    }

    const sampledPoints: DFTPoint[] = xs.map((x, i) => ({ x, y: ys[i] ?? 0 }));
    const dftResult = await this.compute({ points: sampledPoints, mode: "signal" });

    return {
      ...dftResult,
      sampledPoints,
      interval: { a, b },
      executionTimeMs: Date.now() - startTime,
    };
  }

  private buildFuncInput(segments: PiecewiseSegment[]): string {
    const rows = segments.map((s) => `[${s.expression}, ${s.from}, ${s.to}]`).join(", ");
    return `matrix(${rows})`;
  }

  private extractSection(raw: string, start: string, end: string | null): string {
    const si = raw.indexOf(start);
    if (si === -1) return "";
    const after = si + start.length;
    if (end === null) return raw.slice(after).trim();
    const ei = raw.indexOf(end, after);
    return ei === -1 ? raw.slice(after).trim() : raw.slice(after, ei).trim();
  }

  private parseFloatList(raw: string): number[] {
    const clean = raw.replace(/\\\n/g, "").replace(/\s+/g, "").trim();
    if (!clean.startsWith("[")) return [];
    const inner = clean.slice(1, -1);
    if (!inner) return [];
    return inner.split(",").map((s) => {
      const n = parseFloat(s);
      return isFinite(n) ? n : 0;
    });
  }

  private computeRmsError(
    mode: DFTInput["mode"],
    original: DFTPoint[],
    reconstructed: DFTPoint[],
  ): number {
    const N = Math.min(original.length, reconstructed.length);
    if (N === 0) return 0;

    let sumSq = 0;

    for (let i = 0; i < N; i++) {
      if (mode === "signal") {
        const dr = (original[i]?.y ?? 0) - (reconstructed[i]?.x ?? 0);
        sumSq += dr * dr;
        continue;
      }

      const dr = (original[i]?.x ?? 0) - (reconstructed[i]?.x ?? 0);
      const di = (original[i]?.y ?? 0) - (reconstructed[i]?.y ?? 0);
      sumSq += dr * dr + di * di;
    }

    return this.cleanFloat(Math.sqrt(sumSq / N), 1e-12);
  }
}
