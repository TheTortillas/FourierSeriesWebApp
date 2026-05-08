import type { PiecewiseSegment } from "../../domain/types/fourier.types";
import type { ValidationResult } from "../../domain/types/fourier.types";

function evaluateNumericExpression(expression: string): number | null {
  const src = expression
    .replace(/%pi/g, "CONST_PI")
    .replace(/%e/g, "CONST_E")
    .trim();

  if (!src) return null;

  let index = 0;

  const skipWhitespace = (): void => {
    while (index < src.length && /\s/.test(src[index])) index += 1;
  };

  const parseNumber = (): number | null => {
    const chunk = src.slice(index);
    const match = chunk.match(/^(?:\d+\.\d*|\d+|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!match) return null;
    index += match[0].length;
    const value = Number.parseFloat(match[0]);
    return Number.isFinite(value) ? value : null;
  };

  const parsePrimary = (): number | null => {
    skipWhitespace();
    if (index >= src.length) return null;

    if (src.startsWith("CONST_PI", index)) {
      index += "CONST_PI".length;
      return Math.PI;
    }

    if (src.startsWith("CONST_E", index)) {
      index += "CONST_E".length;
      return Math.E;
    }

    if (src[index] === "(") {
      index += 1;
      const value = parseExpression();
      skipWhitespace();
      if (value === null || src[index] !== ")") return null;
      index += 1;
      return value;
    }

    return parseNumber();
  };

  const parseUnary = (): number | null => {
    skipWhitespace();
    if (src[index] === "+") {
      index += 1;
      return parseUnary();
    }
    if (src[index] === "-") {
      index += 1;
      const value = parseUnary();
      return value === null ? null : -value;
    }
    return parsePrimary();
  };

  const parsePower = (): number | null => {
    const left = parseUnary();
    if (left === null) return null;

    skipWhitespace();
    if (src[index] !== "^") return left;

    index += 1;
    const right = parsePower();
    if (right === null) return null;
    const value = Math.pow(left, right);
    return Number.isFinite(value) ? value : null;
  };

  const parseTerm = (): number | null => {
    let value = parsePower();
    if (value === null) return null;

    while (true) {
      skipWhitespace();
      const op = src[index];
      if (op !== "*" && op !== "/") return value;
      index += 1;

      const rhs = parsePower();
      if (rhs === null) return null;
      if (op === "*") {
        value *= rhs;
      } else {
        if (rhs === 0) return null;
        value /= rhs;
      }

      if (!Number.isFinite(value)) return null;
    }
  };

  const parseExpression = (): number | null => {
    let value = parseTerm();
    if (value === null) return null;

    while (true) {
      skipWhitespace();
      const op = src[index];
      if (op !== "+" && op !== "-") return value;
      index += 1;

      const rhs = parseTerm();
      if (rhs === null) return null;
      value = op === "+" ? value + rhs : value - rhs;

      if (!Number.isFinite(value)) return null;
    }
  };

  const value = parseExpression();
  skipWhitespace();
  if (value === null || index !== src.length) return null;
  return value;
}

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

  const parsePoint = (p: string): number => {
    const parsed = evaluateNumericExpression(p);
    return parsed ?? NaN;
  };

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
