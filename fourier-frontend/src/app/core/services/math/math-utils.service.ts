import { Injectable } from '@angular/core';

export type JsFunction = (x: number) => number;

/**
 * Translates a Maxima expression string into an evaluable JS function.
 *
 * Supports the subset of Maxima syntax used by the Fourier backend:
 *   - Arithmetic: +, -, *, /, ^
 *   - Maxima constants: %pi, %e
 *   - Trig: sin, cos, tan, asin, acos, atan
 *   - Hyperbolic: sinh, cosh, tanh
 *   - Other: sqrt, exp, log, abs, floor, ceiling
 *
 * SSR-safe: no DOM dependencies.
 */
@Injectable({ providedIn: 'root' })
export class MathUtilsService {
  /**
   * Compiles a Maxima expression string to a JS function of `variable` (default `'x'`).
   * Returns null if the expression cannot be compiled.
   */
  compile(maxima: string, variable = 'x'): JsFunction | null {
    if (!maxima.trim()) return null;

    try {
      const js = this.maximaToJs(maxima);
      // eslint-disable-next-line no-new-func
      const fn = new Function(variable, `"use strict"; ${this._helpers} return (${js});`) as JsFunction;
      // Smoke-test: evaluate at 0 to catch obvious syntax errors
      const test = fn(0);
      if (typeof test !== 'number') return null;
      return fn;
    } catch {
      return null;
    }
  }

  /**
   * Evaluates a Maxima expression at a given value.
   * Returns NaN if compilation fails or the result is non-finite.
   */
  evaluate(maxima: string, x: number, variable = 'x'): number {
    const fn = this.compile(maxima, variable);
    if (!fn) return NaN;
    try {
      const result = fn(x);
      return isFinite(result) ? result : NaN;
    } catch {
      return NaN;
    }
  }

  /**
   * Samples a Maxima expression over [from, to] with `n` points.
   * Returns an array of { x, y } pairs, skipping NaN results.
   */
  sample(
    maxima: string,
    from: number,
    to: number,
    n = 500,
    variable = 'x',
  ): { x: number; y: number }[] {
    const fn = this.compile(maxima, variable);
    if (!fn) return [];

    const points: { x: number; y: number }[] = [];
    const step = (to - from) / (n - 1);

    for (let i = 0; i < n; i++) {
      const x = from + i * step;
      try {
        const y = fn(x);
        if (isFinite(y)) points.push({ x, y });
      } catch {
        // skip discontinuities
      }
    }
    return points;
  }

  // ── Translation ────────────────────────────────────────────────────────────

  private maximaToJs(expr: string): string {
    let s = expr
      // Constants
      .replace(/%pi\b/g, 'Math.PI')
      .replace(/%e\b/g, 'Math.E')
      .replace(/\binf\b/g, 'Infinity')
      // Power operator: ^ → **
      .replace(/\^/g, '**')
      // Functions — order matters (longer names first to avoid partial matches)
      .replace(/\basinh\b/g, 'Math.asinh')
      .replace(/\bacosh\b/g, 'Math.acosh')
      .replace(/\batanh\b/g, 'Math.atanh')
      .replace(/\basin\b/g, 'Math.asin')
      .replace(/\bacos\b/g, 'Math.acos')
      .replace(/\batan2\b/g, 'Math.atan2')
      .replace(/\batan\b/g, 'Math.atan')
      // Reciprocal inverses (no JS native — express via Math.asin/acos/atan)
      .replace(/\bacot\b/g, '_acot')
      .replace(/\basec\b/g, '_asec')
      .replace(/\bacsc\b/g, '_acsc')
      .replace(/\bsinh\b/g, 'Math.sinh')
      .replace(/\bcosh\b/g, 'Math.cosh')
      .replace(/\btanh\b/g, 'Math.tanh')
      .replace(/\bsin\b/g, 'Math.sin')
      .replace(/\bcos\b/g, 'Math.cos')
      .replace(/\btan\b/g, 'Math.tan')
      // Reciprocals (no JS native — express via sin/cos/tan)
      .replace(/\bcot\b/g, '_cot')
      .replace(/\bsec\b/g, '_sec')
      .replace(/\bcsc\b/g, '_csc')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\bexp\b/g, 'Math.exp')
      .replace(/\blog\b/g, 'Math.log')   // Maxima log = natural log
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\bfloor\b/g, 'Math.floor')
      .replace(/\bceiling\b/g, 'Math.ceil')
      .replace(/\bmax\b/g, 'Math.max')
      .replace(/\bmin\b/g, 'Math.min')
      .replace(/\bsign\b/g, 'Math.sign');

    // Fix JS SyntaxError: unary minus directly before ** is ambiguous.
    // e.g. (-x**2) → (-(x**2))
    // Apply twice to catch patterns after the first pass.
    for (let i = 0; i < 2; i++) {
      s = s.replace(/\(-([\w.]+)\*\*([\w.]+)\)/g, '(-(($1)**($2)))');
    }

    return s;
  }

  // ── Reciprocal / inverse-reciprocal helpers (inlined at eval time) ──────────

  private readonly _helpers = `
    function _cot(x)  { return 1 / Math.tan(x); }
    function _sec(x)  { return 1 / Math.cos(x); }
    function _csc(x)  { return 1 / Math.sin(x); }
    function _acot(x) { return Math.PI / 2 - Math.atan(x); }
    function _asec(x) { return Math.acos(1 / x); }
    function _acsc(x) { return Math.asin(1 / x); }
  `;
}
