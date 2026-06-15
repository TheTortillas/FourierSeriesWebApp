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
 * Expression evaluation uses the same Maxima→JS translation pipeline as the
 * frontend (MathUtilsService.maximaToJs), ported here without dependencies.
 */

import type { PiecewiseSegment } from "../../domain/types/fourier.types";

// ── Maxima → JS translation (mirrors MathUtilsService.maximaToJs) ────────────

/**
 * Translates a Maxima expression string to evaluable JS.
 * Covers the same subset as the frontend MathUtilsService to avoid divergence.
 */
function maximaToJs(expr: string): string {
  let s = expr
    .replace(/%pi\b/g, "Math.PI")
    .replace(/%e\b/g, "Math.E")
    .replace(/%i\b/g, "0")
    .replace(/\binf\b/g, "Infinity")
    .replace(/\bminf\b/g, "-Infinity")
    .replace(/\^/g, "**");

  s = fixUnaryMinusPow(s);

  s = s
    .replace(/\basinh\b/g, "Math.asinh")
    .replace(/\bacosh\b/g, "Math.acosh")
    .replace(/\batanh\b/g, "Math.atanh")
    .replace(/\basin\b/g, "Math.asin")
    .replace(/\bacos\b/g, "Math.acos")
    .replace(/\batan2\b/g, "Math.atan2")
    .replace(/\batan\b/g, "Math.atan")
    .replace(/\bsinh\b/g, "Math.sinh")
    .replace(/\bcosh\b/g, "Math.cosh")
    .replace(/\btanh\b/g, "Math.tanh")
    .replace(/\bsin\b/g, "Math.sin")
    .replace(/\bcos\b/g, "Math.cos")
    .replace(/\btan\b/g, "Math.tan")
    .replace(/\bsqrt\b/g, "Math.sqrt")
    .replace(/\bexp\b/g, "Math.exp")
    .replace(/\blog\b/g, "Math.log")
    .replace(/\babs\b/g, "Math.abs")
    .replace(/\bfloor\b/g, "Math.floor")
    .replace(/\bceiling\b/g, "Math.ceil")
    .replace(/\bsign\b/g, "Math.sign");

  return s;
}

/** Compile a Maxima expression to a JS function f(varName) → number. */
function compile(expr: string, varName: string): ((t: number) => number) | null {
  try {
    const js = maximaToJs(expr);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(varName, `"use strict"; try { return (${js}); } catch { return NaN; }`) as (t: number) => number;
    fn(0); // syntax smoke-test
    return fn;
  } catch {
    return null;
  }
}

/** Evaluate fn at t, returning NaN on error or non-finite result. */
function safeEval(fn: (t: number) => number, t: number): number {
  try {
    const v = fn(t);
    return typeof v === "number" && isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

// ── JS SyntaxError fix: unary minus before ** ─────────────────────────────────

function fixUnaryMinusPow(s: string): string {
  const isUnary = (str: string, pos: number) =>
    pos === 0 || /[(,=+\-*\/!&|~?:%\s]/.test(str[pos - 1] ?? "");

  const collectGroup = (str: string, start: number): number => {
    let depth = 0, j = start;
    while (j < str.length) {
      if (str[j] === "(") depth++;
      else if (str[j] === ")") { depth--; if (depth === 0) return j; }
      j++;
    }
    return j - 1;
  };
  const collectToken = (str: string, start: number): number => {
    let j = start;
    while (j < str.length && /[\w.]/.test(str[j] ?? "")) j++;
    return j - 1;
  };

  for (let pass = 0; pass < 10; pass++) {
    let i = 0, out = "", changed = false;
    while (i < s.length) {
      if (s[i] === "-" && isUnary(s, i)) {
        const next = i + 1;
        let baseEnd: number;
        const baseStart = next;
        if (s[next] === "(") baseEnd = collectGroup(s, next);
        else if (/[\w]/.test(s[next] ?? "")) baseEnd = collectToken(s, next);
        else { out += s[i++]; continue; }
        const afterBase = baseEnd + 1;
        if (s.slice(afterBase, afterBase + 2) === "**") {
          const expStart = afterBase + 2;
          const expEnd = s[expStart] === "(" ? collectGroup(s, expStart) : collectToken(s, expStart);
          out += "-(" + s.slice(baseStart, expEnd + 1) + ")";
          i = expEnd + 1; changed = true; continue;
        }
      }
      out += s[i++];
    }
    s = out;
    if (!changed) break;
  }
  return s;
}

// ── Bound evaluation ──────────────────────────────────────────────────────────

/** Evaluate a Maxima bound string to a number. */
function evalBound(s: string): number {
  // Fast-path table for common Maxima literals
  const PI = Math.PI;
  const table: Record<string, number> = {
    "%pi": PI, "-%pi": -PI,
    "%pi/2": PI / 2, "-%pi/2": -PI / 2,
    "%pi/3": PI / 3, "-%pi/3": -PI / 3,
    "%pi/4": PI / 4, "-%pi/4": -PI / 4,
    "%pi/6": PI / 6, "-%pi/6": -PI / 6,
    "2*%pi": 2 * PI, "-2*%pi": -2 * PI,
    "3*%pi": 3 * PI, "-3*%pi": -3 * PI,
    "3*%pi/2": 3 * PI / 2, "-3*%pi/2": -3 * PI / 2,
    "inf": Infinity, "minf": -Infinity,
  };
  const trimmed = s.trim();
  if (table[trimmed] !== undefined) return table[trimmed]!;

  // General: translate and eval as JS
  try {
    const js = maximaToJs(trimmed);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const val = (new Function(`"use strict"; return (${js});`))() as number;
    return typeof val === "number" ? val : NaN;
  } catch {
    return NaN;
  }
}

// ── Zero finding ──────────────────────────────────────────────────────────────

/**
 * Find all zeros of fn in the open interval (a, b).
 * Uses a uniform grid + bisection refinement.
 * NaN values (e.g. at removable singularities like sin(x)/x at 0) are skipped —
 * they are NOT treated as sign changes, so the interval is not split there.
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

  let tPrev = a + step * 0.5; // start away from endpoint to avoid boundary NaNs
  let fPrev = safeEval(fn, tPrev);

  for (let i = 1; i < gridPoints; i++) {
    const tCurr = a + (i + 0.5) * step;
    const fCurr = safeEval(fn, tCurr);

    if (!isNaN(fPrev) && Math.abs(fPrev) < 1e-11) {
      pushUnique(tPrev);
    } else if (!isNaN(fPrev) && !isNaN(fCurr) && fPrev * fCurr < 0) {
      // Genuine sign change → bisect
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

// ── abs() detection & replacement ────────────────────────────────────────────

/** True if the expression string contains abs(…). */
export function containsAbs(expression: string): boolean {
  return /\babs\s*\(/.test(expression);
}

/**
 * Extract the inner expression string from the FIRST abs(...) occurrence,
 * correctly handling nested parentheses.
 */
function extractAbsInner(expr: string): string | null {
  const match = /\babs\s*\(/.exec(expr);
  if (!match) return null;
  let depth = 1, i = match.index + match[0].length;
  while (i < expr.length && depth > 0) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") depth--;
    i++;
  }
  return expr.slice(match.index + match[0].length, i - 1);
}

/**
 * Replace ALL abs(…) occurrences in expr with (inner) when sign=+1,
 * or (-(inner)) when sign=-1. Handles nested parentheses correctly.
 */
function replaceAbs(expression: string, sign: 1 | -1): string {
  let result = expression;
  let safety = 0;
  while (/\babs\s*\(/.test(result) && safety++ < 20) {
    const match = /\babs\s*\(/.exec(result)!;
    let depth = 1, i = match.index + match[0].length;
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
 * Convert a numeric breakpoint to a readable Maxima string.
 * Tries rational multiples of π (up to 12ths), then simple rationals,
 * then a full-precision decimal.
 */
function toMaximaLiteral(value: number): string {
  // Snap values very close to 0 (floating-point residue from bisection)
  if (Math.abs(value) < 1e-9) return "0";
  const PI = Math.PI;
  // Rational multiples of π (k/d * π) up to denominator 12
  for (let d = 1; d <= 12; d++) {
    const k = Math.round((value * d) / PI);
    if (k !== 0 && Math.abs(k * PI / d - value) < 1e-9) {
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
    if (n !== 0 && Math.abs(n / d - value) < 1e-9) {
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
 * If parsing or numeric root-finding fails, the segment is returned as-is
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

    const innerExpr = extractAbsInner(seg.expression);
    if (!innerExpr) {
      result.push(seg);
      continue;
    }

    const innerFn = compile(innerExpr, varName);
    if (!innerFn) {
      result.push(seg);
      continue;
    }

    const zeros = findZeros(innerFn, a, b);
    const breakpoints = [a, ...zeros, b];
    let expanded = false;

    for (let i = 0; i < breakpoints.length - 1; i++) {
      const lo = breakpoints[i]!;
      const hi = breakpoints[i + 1]!;
      if (hi - lo < 1e-12) continue;

      // Sample sign at multiple midpoints to handle functions that return NaN
      // near the midpoint (e.g. sin(x)/x near 0)
      const candidates = [
        (lo + hi) / 2,
        lo + (hi - lo) * 0.25,
        lo + (hi - lo) * 0.75,
      ];
      let signVal = NaN;
      for (const c of candidates) {
        const v = safeEval(innerFn, c);
        if (!isNaN(v)) { signVal = v; break; }
      }
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

    if (!expanded) result.push(seg);
  }

  return result;
}
