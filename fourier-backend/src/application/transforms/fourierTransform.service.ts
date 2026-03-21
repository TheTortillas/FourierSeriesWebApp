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
    input: InverseFourierTransformInput,
  ): Promise<InverseFourierTransformResult> {
    const startTime = Date.now();
    const intVar = input.intVar ?? "w";
    const transVar = input.transVar ?? "t";
    const regions = input.regions ?? [
      { condition: `${transVar} > 0` },
      { condition: `${transVar} < 0` },
    ];

    const script = await loadScript(
      "transforms",
      "inverse_fourier_transform.mac",
    );
    const funcInput = this.buildFuncInput(input.segments);

    const regionsScript = regions
      .map((region, idx) => {
        const assumptions = region.condition
          .split(",")
          .map((c) => `parse_string("${c.trim()}")`)
          .join(", ");
        return `
result_${idx}: errcatch(compute_inverse([${assumptions}]))$
print("__REGION_${idx}__")$
if result_${idx} = [] 
  then print("__FAILED__")
  else (
    print(string(first(result_${idx}))),
    print("__TEX_${idx}__"),
    tex(first(result_${idx}))
  )$`;
      })
      .join("\n");

    const fullScript = `
FUNC_INPUT: ${funcInput};
INTVAR: ${intVar};
TRANSVAR: ${transVar};
${script}
${regionsScript}
kill(all)$
`;

    const result = await this.runner.run({
      script: fullScript,
      timeoutMs: 60000,
    });

    if (!result.success) {
      throw new Error(`Maxima error: ${result.error}`);
    }

    const raw = result.raw;
    const results: InverseFourierTransformRegionResult[] = [];
    let exists = true;

    for (let idx = 0; idx < regions.length; idx++) {
      const regionRaw = this.extractBetween(
        raw,
        `__REGION_${idx}__`,
        idx < regions.length - 1 ? `__REGION_${idx + 1}__` : null,
      );

      if (regionRaw.includes("__FAILED__")) {
        exists = false;
        continue;
      }

      const fMaxima = this.extractBetween(regionRaw, "", `__TEX_${idx}__`)
        .replace(/false/g, "")
        .trim();
      const fTex = this.extractTex(
        this.extractBetween(regionRaw, `__TEX_${idx}__`, null),
      );

      results.push({
        condition: regions[idx]!.condition,
        f: { maxima: fMaxima, tex: fTex },
      });
    }

    return {
      input,
      exists,
      results: exists ? results : undefined,
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
