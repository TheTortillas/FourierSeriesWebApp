import type { PiecewiseSegment } from "../../domain/types/fourier.types";
import type { ValidationResult } from "../../domain/types/fourier.types";

export function buildQuadWithSingularities(
  segments: PiecewiseSegment[],
  intVar: string,
  singularities: string[],
  factor: string,
  core = "",
): string {
  const eps = "1e-8";

  const parsePoint = (p: string): number =>
    parseFloat(
      p
        .replace("-%pi", String(-Math.PI))
        .replace("%pi", String(Math.PI))
        .replace("%e", String(Math.E)),
    );

  return segments
    .map((s) => {
      const a = parsePoint(s.from);
      const b = parsePoint(s.to);

      const singInSegment = singularities
        .map((sp) => parsePoint(sp))
        .filter((p) => !isNaN(p) && p > a && p < b);

      if (singInSegment.length === 0) {
        return `first(quad_qags(${factor} * (${s.expression})${core}, ${intVar}, ${s.from}, ${s.to}))`;
      }

      const sorted = [...singInSegment].sort((a, b) => a - b);
      const breakpoints: string[] = [s.from];
      for (const sp of sorted) {
        breakpoints.push(`${sp}-${eps}`);
        breakpoints.push(`${sp}+${eps}`);
      }
      breakpoints.push(s.to);

      const parts: string[] = [];
      for (let i = 0; i < breakpoints.length - 1; i++) {
        parts.push(
          `first(quad_qags(${factor} * (${s.expression})${core}, ${intVar}, ${breakpoints[i]}, ${breakpoints[i + 1]}))`,
        );
      }
      return parts.join(" + ");
    })
    .join(" + ");
}

export function getRemovableSingularities(
  validation: ValidationResult,
): string[] {
  return (
    validation.singularities
      ?.filter((s) => s.type === "removible" || s.type === "salto")
      .map((s) => s.point) ?? []
  );
}
