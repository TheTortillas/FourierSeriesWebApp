/**
 * absExpander.ts
 *
 * When a piecewise segment contains abs(g(var)), Maxima cannot integrate it
 * symbolically and returns the integral unevaluated.
 *
 * Strategy (mirrors the Heaviside gate construction in fourier_transform.mac):
 *   For each segment [a, b] whose expression contains abs(g(var)):
 *     1. Extract g from abs(g).
 *     2. Find all real zeros of g in (a, b) numerically via a uniform grid + bisection.
 *     3. Split [a, b] at those zeros into sub-intervals where g has constant sign.
 *     4. On each sub-interval replace abs(g) with +g or -g accordingly.
 *
 * No external dependencies — evaluation is done with Function() on a sanitized
 * JS expression so that the backend stays dependency-free.
 */

import type { PiecewiseSegment } from "../../domain/types/fourier.types";

// ── Expression translation: Maxima → JS ──────────────────────────────────────

/**
 * Convert a Maxima expression string to a JS-evaluable string.
 * Covers the subset users typically enter in the Fourier series form.
 */
function maximaToJs(expr: string, varName: string): string {
  return expr
    // Maxima constants
    .replace(/%pi/g, "Math.PI")
    .replace(/%e/g, "Math.E")
    // Maxima exponentiation
    .replace(/\^/g, "**")
    // Maxima trig / math functions → Math.*
    .replace(/\bsin\b/g, "Math.sin")
    .replace(/\bcos\b/g, "Math.cos")
    .replace(/\btan\b/g, "Math.tan")
    .replace(/\bexp\b/g, "Math.exp")
    .replace(/\bsqrt\b/g, "Math.sqrt")
    .replace(/\blog\b/g, "Math.log")
    .replace(/\babs\b/g, "Math.abs")
    .replace(/\bsinh\b/g, "Math.sinh")
    .replace(/\bcosh\b/g, "Math.cosh")
    .replace(/\btanh\b/g, "Math.tanh")
    // Keep the integration variable as-is (it will be the function parameter)
    ;
}

/** Compile a Maxima expression string into a JS function f(varName) → number. */
function compile(expr: string, varName: string): ((t: number) => number) | null {
  try {
    const jsExpr = maximaToJs(expr, varName);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(varName, `"use strict"; try { return (${jsExpr}); } catch { return NaN; }`) as (t: number) => number;
    // Quick smoke-test to catch syntax errors
    fn(0);
    return fn;
  } catch {
    return null;
  }
}

/** Evaluate f at t, returning NaN on any error. */
function safeEval(fn: (t: number) => number, t: number): number {
  try {
    const v = fn(t);
    return typeof v === "number" && isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

// ── Zero finding ──────────────────────────────────────────────────────────────

/**
 * Find all zeros of fn in the open interval (a, b) using a uniform grid
 * followed by bisection refinement.  Returns values sorted ascending.
 */
function findZeros(
  fn: (t: number) => number,
  a: number,
  b: number,
  gridPoints = 500,
): number[] {
  const zeros: number[] = [];
  const step = (b - a) / gridPoints;

  const pushUnique = (z: number) => {
    if (zeros.length === 0 || Math.abs(zeros[zeros.length - 1]! - z) > 1e-9) {
      zeros.push(z);
    }
  };

  let tPrev = a;
  let fPrev = safeEval(fn, tPrev);

  for (let i = 1; i <= gridPoints; i++) {
    const tCurr = i === gridPoints ? b : a + i * step;
    const fCurr = safeEval(fn, tCurr);

    if (!isNaN(fPrev) && Math.abs(fPrev) < 1e-11) {
      pushUnique(tPrev);
    } else if (!isNaN(fPrev) && !isNaN(fCurr) && fPrev * fCurr < 0) {
      // Sign change → bisect to refine
      let lo = tPrev, hi = tCurr, fLo = fPrev;
      for (let iter = 0; iter < 64; iter++) {
        const mid = (lo + hi) / 2;
        const fMid = safeEval(fn, mid);
        if (isNaN(fMid) || Math.abs(fMid) < 1e-13 || hi - lo < 1e-13) {
          pushUnique(mid);
          break;
        }
        if (fLo * fMid < 0) { hi = mid; } else { lo = mid; fLo = fMid; }
      }
    }

    tPrev = tCurr;
    fPrev = fCurr;
  }

  return zeros;
}

// ── Bound evaluation ──────────────────────────────────────────────────────────

/** Evaluate a Maxima bound string (e.g. "%pi", "-%pi/2", "2") to a number. */
function evalBound(s: string): number {
  const trimmed = s.trim();
  // Fast path for common Maxima constants
  const table: Record<string, number> = {
    "%pi": Math.PI, "-%pi": -Math.PI,
    "%pi/2": Math.PI / 2, "-%pi/2": -Math.PI / 2,
    "%pi/3": Math.PI / 3, "-%pi/3": -Math.PI / 3,
    "%pi/4": Math.PI / 4, "-%pi/4": -Math.PI / 4,
    "%pi/6": Math.PI / 6, "-%pi/6": -Math.PI / 6,
    "2*%pi": 2 * Math.PI, "-2*%pi": -2 * Math.PI,
    "3*%pi/2": 3 * Math.PI / 2, "-3*%pi/2": -3 * Math.PI / 2,
    "inf": Infinity, "minf": -Infinity,
  };
  if (table[trimmed] !== undefined) return table[trimmed]!;

  // General: translate and eval as JS
  try {
    const jsExpr = trimmed
      .replace(/%pi/g, "Math.PI")
      .replace(/%e/g, "Math.E")
      .replace(/\^/g, "**")
      .replace(/\binf\b/g, "Infinity")
      .replace(/\bminf\b/g, "-Infinity");
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(`"use strict"; return (${jsExpr});`) as () => number;
    const val = fn();
    return typeof val === "number" ? val : NaN;
  } catch {
    return NaN;
  }
}

// ── abs() detection & replacement ────────────────────────────────────────────

/** True if the expression string contains abs(…). */
export function containsAbs(expression: string): boolean {
  return /\babs\s*\(/.test(expression);
}

/**
 * Extract the inner expression string from the FIRST abs(...) occurrence,
 * correctly handling nested parentheses.
 * Returns null if not found.
 */
function extractAbsInner(expr: string): string | null {
  const match = /\babs\s*\(/.exec(expr);
  if (!match) return null;

  let depth = 1;
  let i = match.index + match[0].length;
  while (i < expr.length && depth > 0) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") depth--;
    i++;
  }
  return expr.slice(match.index + match[0].length, i - 1);
}

/**
 * Replace every abs(…) in expr with (inner) when sign=+1, or (-(inner)) when sign=-1.
 * Handles nested parentheses correctly.
 */
function replaceAbs(expression: string, sign: 1 | -1): string {
  let result = expression;
  // Iterate until no more abs() found
  let safety = 0;
  while (/\babs\s*\(/.test(result) && safety++ < 20) {
    const match = /\babs\s*\(/.exec(result)!;
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < result.length && depth > 0) {
      if (result[i] === "(") depth++;
      else if (result[i] === ")") depth--;
      i++;
    }
    const inner = result.slice(match.index + match[0].length, i - 1);
    const replacement = sign === 1 ? `(${inner})` : `(-(${inner}))`;
    result = result.slice(0, match.index) + replacement + result.slice(i);
  }
  return result;
}

// ── Numeric → Maxima literal ──────────────────────────────────────────────────

/**
 * Convert a numeric breakpoint back to a readable Maxima string.
 * Tries rational multiples of π first (up to 12ths), then simple rationals,
 * then falls back to a decimal literal.
 */
function toMaximaLiteral(value: number): string {
  if (value === 0) return "0";
  const PI = Math.PI;

  // k*π/d
  for (let d = 1; d <= 12; d++) {
    const k = Math.round((value * d) / PI);
    if (k !== 0 && Math.abs(k * PI / d - value) < 1e-10) {
      if (d === 1) {
        if (k === 1) return "%pi";
        if (k === -1) return "-%pi";
        return `${k}*%pi`;
      }
      return `${k}*%pi/${d}`;
    }
  }

  // Simple rationals a/b (small denominators)
  for (let d = 1; d <= 20; d++) {
    const n = Math.round(value * d);
    if (n !== 0 && Math.abs(n / d - value) < 1e-10) {
      return d === 1 ? `${n}` : `${n}/${d}`;
    }
  }

  return value.toPrecision(15);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Expand any segment whose expression contains abs() into multiple plain
 * segments by splitting at the zeros of the inner function.
 *
 * Segments without abs() are returned unchanged.
 * If parsing or numeric root-finding fails for a segment it is returned as-is
 * (Maxima will fall back to numeric quadrature as before).
 */
export function expandAbsSegments(
  segments: PiecewiseSegment[],
  varName: string,
): PiecewiseSegment[] {
  const result: PiecewiseSegment[] = [];

  for (const seg of segments) {
    if (!containsAbs(seg.expression)) {
      result.push(seg);
      continue;
    }

    const a = evalBound(seg.from);
    const b = evalBound(seg.to);

    if (isNaN(a) || isNaN(b) || !isFinite(a) || !isFinite(b) || a >= b) {
      result.push(seg);
      continue;
    }

    // Extract the inner expression of abs()
    const innerExpr = extractAbsInner(seg.expression);
    if (!innerExpr) {
      result.push(seg);
      continue;
    }

    // Compile the inner expression to find its zeros
    const innerFn = compile(innerExpr, varName);
    if (!innerFn) {
      result.push(seg);
      continue;
    }

    const zeros = findZeros(innerFn, a, b);

    // Build breakpoints and sub-segments
    const breakpoints = [a, ...zeros, b];
    let expanded = false;

    for (let i = 0; i < breakpoints.length - 1; i++) {
      const lo = breakpoints[i]!;
      const hi = breakpoints[i + 1]!;
      if (hi - lo < 1e-12) continue;

      const mid = (lo + hi) / 2;
      const signVal = safeEval(innerFn, mid);
      if (isNaN(signVal)) continue;

      const sign: 1 | -1 = signVal >= 0 ? 1 : -1;
      const newExpr = replaceAbs(seg.expression, sign);

      result.push({
        expression: newExpr,
        from: toMaximaLiteral(lo),
        to: toMaximaLiteral(hi),
      });
      expanded = true;
    }

    // Fallback: if expansion produced nothing, keep the original
    if (!expanded) {
      result.push(seg);
    }
  }

  return result;
}
