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

  const safeQuad = (from: string, to: string, expression: string): string =>
    `block([q: errcatch(first(quad_qags(${factor} * (${expression})${core}, ${intVar}, ${from}, ${to}))), qv: false, r: [], rv: false], if q # [] then qv: first(q), if qv # false and numberp(qv) and freeof(${intVar}, qv) then qv else (r: errcatch(romberg(${factor} * (${expression})${core}, ${intVar}, ${from}, ${to})), if r # [] then rv: first(r), if rv # false and numberp(rv) and freeof(${intVar}, rv) then rv else 0))`;

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
        return safeQuad(s.from, s.to, s.expression);
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
        parts.push(safeQuad(breakpoints[i], breakpoints[i + 1], s.expression));
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
