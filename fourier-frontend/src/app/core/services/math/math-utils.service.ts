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
   * Compiles a Maxima expression string to a JS function of `x`.
   * Returns null if the expression cannot be compiled.
   */
  compile(maxima: string): JsFunction | null {
    if (!maxima.trim()) return null;

    try {
      const js = this.maximaToJs(maxima);
      // eslint-disable-next-line no-new-func
      const fn = new Function('x', `"use strict"; return (${js});`) as JsFunction;
      // Smoke-test: evaluate at x=0 to catch obvious syntax errors
      const test = fn(0);
      if (typeof test !== 'number') return null;
      return fn;
    } catch {
      return null;
    }
  }

  /**
   * Evaluates a Maxima expression at a given x value.
   * Returns NaN if compilation fails or the result is non-finite.
   */
  evaluate(maxima: string, x: number): number {
    const fn = this.compile(maxima);
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
  ): { x: number; y: number }[] {
    const fn = this.compile(maxima);
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
    return expr
      // Constants
      .replace(/%pi\b/g, 'Math.PI')
      .replace(/%e\b/g, 'Math.E')
      .replace(/\binf\b/g, 'Infinity')
      // Power operator: ^ → **
      .replace(/\^/g, '**')
      // Functions — order matters (longer names first)
      .replace(/\basinh\b/g, 'Math.asinh')
      .replace(/\bacosh\b/g, 'Math.acosh')
      .replace(/\batanh\b/g, 'Math.atanh')
      .replace(/\basin\b/g, 'Math.asin')
      .replace(/\bacos\b/g, 'Math.acos')
      .replace(/\batan2\b/g, 'Math.atan2')
      .replace(/\batan\b/g, 'Math.atan')
      .replace(/\bsinh\b/g, 'Math.sinh')
      .replace(/\bcosh\b/g, 'Math.cosh')
      .replace(/\btanh\b/g, 'Math.tanh')
      .replace(/\bsin\b/g, 'Math.sin')
      .replace(/\bcos\b/g, 'Math.cos')
      .replace(/\btan\b/g, 'Math.tan')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\bexp\b/g, 'Math.exp')
      .replace(/\blog\b/g, 'Math.log')   // Maxima log = natural log
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\bfloor\b/g, 'Math.floor')
      .replace(/\bceiling\b/g, 'Math.ceil')
      .replace(/\bmax\b/g, 'Math.max')
      .replace(/\bmin\b/g, 'Math.min')
      .replace(/\bsign\b/g, 'Math.sign');
  }
}
