import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import type {
  ValidationResult,
  Singularity,
  SingularityType,
  PiecewiseSegment,
} from "../../domain/types/fourier.types";

const FATAL_TYPES: SingularityType[] = [
  "asintotica",
  "esencial",
  "fuera_de_dominio",
];
const WARN_TYPES: SingularityType[] = ["removible", "salto"];

export class AuxiliaryService {
  constructor(private readonly runner: MaximaRunner) {}

  async validateFunction(
    segments: PiecewiseSegment[],
  ): Promise<ValidationResult> {
    const script = await loadScript("auxiliary", "find_singularities.mac");
    const allSingularities: Singularity[] = [];

    for (const segment of segments) {
      const call = `find_singularities(${segment.expression}, x, ${segment.from}, ${segment.to});`;
      const result = await this.runner.run({ script: `${script}\n${call}` });

      if (!result.success) {
        return {
          decision: "reject",
          singularities: [],
          message: `Maxima error validating segment [${segment.from}, ${segment.to}]: ${result.error}`,
        };
      }

      const parsed = this.parseSingularities(result.raw);
      allSingularities.push(...parsed);
    }

    return this.decide(allSingularities);
  }

  private parseSingularities(raw: string): Singularity[] {
    const cleaned = raw.replace(/\\\n/g, "").replace(/\n/g, " ");

    const match = cleaned.match(/\[.*\]/s);
    if (!match) return [];

    try {
      return JSON.parse(match[0]) as Singularity[];
    } catch {
      return [];
    }
  }

  private decide(singularities: Singularity[]): ValidationResult {
    const fatal = singularities.filter((s) => FATAL_TYPES.includes(s.type));
    const warnings = singularities.filter((s) => WARN_TYPES.includes(s.type));

    if (fatal.length > 0) {
      return {
        decision: "reject",
        singularities,
        message: `Function has ${fatal.length} non-integrable singularity/singularities. Fourier series cannot be computed.`,
      };
    }

    if (warnings.length > 0) {
      return {
        decision: "warn",
        singularities,
        message: `Function has ${warnings.length} removable or jump singularity/singularities. Proceeding with calculation.`,
      };
    }

    return { decision: "proceed", singularities: [] };
  }
}
