import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import type {
  DFTInput,
  DFTResult,
  DFTCoefficient,
  DFTPoint,
} from "../../domain/types/fourier.types";

const MAX_POINTS = 1024;

export class DFTService {
  constructor(private readonly runner: MaximaRunner) {}

  async compute(input: DFTInput): Promise<DFTResult> {
    const startTime = Date.now();

    if (input.points.length > MAX_POINTS) {
      throw new Error(`Maximum ${MAX_POINTS} points allowed`);
    }

    if (input.points.length < 2) {
      throw new Error("At least 2 points are required");
    }

    const script = await loadScript("transforms", "dft.mac");

    const pointsX = input.points.map((p) => p.x).join(", ");

    const pointsRe = input.points
      .map((p) => (input.mode === "epicycles" ? p.x : p.y))
      .join(", ");

    const pointsIm = input.points
      .map((p) => (input.mode === "epicycles" ? p.y : 0))
      .join(", ");

    const fullScript = `
POINTS_X: [${pointsX}];
POINTS_RE: [${pointsRe}];
POINTS_IM: [${pointsIm}];
MODE: "${input.mode}";
${script}
kill(all)$
`;

    const result = await this.runner.run({
      script: fullScript,
      timeoutMs: 30000,
    });

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    return this.parseResult(result.raw, input, Date.now() - startTime);
  }

  private parseResult(
    raw: string,
    input: DFTInput,
    executionTimeMs: number,
  ): DFTResult {
    const N =
      parseInt(this.extractBetween(raw, "__N__", "__COEFFS__").trim()) ||
      input.points.length;

    const coeffsRaw = this.extractBetween(
      raw,
      "__COEFFS__",
      "__RECONSTRUCTED__",
    ).trim();
    const reconstructedRaw = this.extractBetween(
      raw,
      "__RECONSTRUCTED__",
      "__TOP_COEFFS__",
    ).trim();
    const topCoeffsRaw = this.extractBetween(
      raw,
      "__TOP_COEFFS__",
      "__RMS_ERROR__",
    ).trim();
    const rmsRaw = this.extractBetween(raw, "__RMS_ERROR__", null)
      .replace(/false/g, "")
      .trim();

    const rawPoints = this.parsePoints(reconstructedRaw);
    const coefficients = this.parseCoefficients(coeffsRaw);
    const topCoefficients = this.parseCoefficients(topCoeffsRaw);

    const totalAmplitude = coefficients.reduce(
      (sum, c) => sum + c.amplitude,
      0,
    );

    const enrichCoefficients = (coeffs: DFTCoefficient[]) =>
      coeffs.map((c) => ({
        ...c,
        amplitudePercent:
          totalAmplitude > 0
            ? parseFloat(((c.amplitude / totalAmplitude) * 100).toFixed(4))
            : 0,
        freq: parseFloat((c.k / N).toFixed(6)),
      }));

    const reconstructed: DFTPoint[] = rawPoints.map((p, idx) => {
      if (input.mode === "signal") {
        return {
          x: input.points[idx]?.x ?? 0,
          y: p.x,
        };
      }
      return { x: p.x, y: p.y };
    });

    return {
      mode: input.mode,
      N,
      coefficients: enrichCoefficients(coefficients),
      topCoefficients: enrichCoefficients(topCoefficients),
      reconstructed,
      rmsError: parseFloat(rmsRaw) || 0,
      executionTimeMs,
    };
  }

  private cleanFloat(val: number, threshold = 1e-10): number {
    return Math.abs(val) < threshold ? 0 : val;
  }

  private parseCoefficients(raw: string): DFTCoefficient[] {
    const cleaned = raw.replace(/\\\n/g, "").replace(/\r/g, "").trim();
    const blocks = cleaned.split("],[").map((b, i, arr) => {
      if (i === 0) return b.replace(/^\[+/, "");
      if (i === arr.length - 1) return b.replace(/\]+$/, "");
      return b;
    });

    return blocks
      .map((block) => {
        const parts = block.split(",");
        if (parts.length < 6) return null;

        const k = parseInt(parts[0] ?? "0");
        const re = this.cleanFloat(parseFloat(parts[1] ?? "0"));
        const im = this.cleanFloat(parseFloat(parts[2] ?? "0"));
        const amplitude = this.cleanFloat(parseFloat(parts[3] ?? "0"));
        const phase = amplitude === 0 ? 0 : parseFloat(parts[4] ?? "0");
        const rawPhaseInPi = (parts.slice(5).join(",") ?? "0")
          .trim()
          .replace(/^"+|"+$/g, "");
        const phaseInPi = this.simplifyPhaseInPi(phase, rawPhaseInPi);

        return { k, re, im, amplitude, phase, phaseInPi };
      })
      .filter((c): c is DFTCoefficient => c !== null);
  }

  private simplifyPhaseInPi(phase: number, rationalized: string): string {
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

    // Si no es una fracción común, devolver el valor racionalizado sin comillas
    return rationalized;
  }

  private parsePoints(raw: string): DFTPoint[] {
    // console.log("DFT RAW FULL:", JSON.stringify(raw));
    // console.log("DFT RAW:", JSON.stringify(raw.slice(0, 800)));

    const cleaned = raw.replace(/\\\n/g, "").replace(/\r/g, "").trim();
    const matches = cleaned.matchAll(/\[(-?[\d.e+-]+),(-?[\d.e+-]+)\]/g);
    const points: DFTPoint[] = [];

    for (const match of matches) {
      points.push({
        x: parseFloat(match[1] ?? "0"),
        y: parseFloat(match[2] ?? "0"),
      });
    }

    return points;
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
