import { Injectable } from '@angular/core';

/** Numeric-only subset of TrigonometricTerm needed for reconstruction */
export interface TrigNumericTerm {
  n: number;
  anFloat: number;
  bnFloat: number;
  anUsedLimit?: boolean;
  bnUsedLimit?: boolean;
}

/** Numeric-only subset of ComplexTerm needed for reconstruction */
export interface ComplexNumericTerm {
  n: number;
  cosFloat: number;
  sinFloat: number;
  amplitude: number; // kept for spectrum table display
  phase: number; // kept for spectrum table display
  cnUsedLimit?: boolean;
  cnNegUsedLimit?: boolean;
}

/**
 * Reconstructs the Fourier partial sum f_N(x) from numeric coefficients
 * returned by the backend.
 *
 * The backend's /fourier/{type}/terms endpoint already evaluates all
 * coefficients numerically, so no symbolic evaluation is needed here.
 *
 * SSR-safe: no DOM dependencies.
 */
@Injectable({ providedIn: 'root' })
export class FourierReconstructionService {
  // ── Trigonometric ─────────────────────────────────────────────────────────

  /**
   * Builds f_N(x) = a0/2 + Σ_{n=1}^{N} [an·cos(n·w0·x) + bn·sin(n·w0·x)]
   *
   * @param a0    DC component (numeric)
   * @param terms Array of { n, anFloat, bnFloat } from the backend
   * @param w0    Fundamental angular frequency (numeric, radians/unit)
   * @param nMax  Number of harmonics to include (≤ terms.length)
   */
  buildTrigonometric(
    a0: number,
    terms: TrigNumericTerm[],
    w0: number,
    nMax?: number,
  ): (x: number) => number {
    const limit = nMax !== undefined ? Math.min(nMax, terms.length) : terms.length;
    const slice = terms.slice(0, limit);
    const dc = a0 / 2; // DC component is a0/2 in the trigonometric form

    return (x: number): number => {
      let sum = dc;
      for (const { n, anFloat, bnFloat } of slice) {
        const arg = n * w0 * x;
        sum += anFloat * Math.cos(arg) + bnFloat * Math.sin(arg);
      }
      return sum;
    };
  }

  // ── Half-range expansions ─────────────────────────────────────────────────

  /**
   * Builds the half-range cosine expansion:
   *   f_N(x) = a0/2 + Σ_{n=1}^{N} aₙ·cos(n·w0·x)
   */
  buildCosineOnly(
    a0: number,
    terms: TrigNumericTerm[],
    w0: number,
    nMax?: number,
  ): (x: number) => number {
    const limit = nMax !== undefined ? Math.min(nMax, terms.length) : terms.length;
    const slice = terms.slice(0, limit);
    const dc = a0 / 2;

    return (x: number): number => {
      let sum = dc;
      for (const { n, anFloat } of slice) {
        sum += anFloat * Math.cos(n * w0 * x);
      }
      return sum;
    };
  }

  /**
   * Builds the half-range sine expansion:
   *   f_N(x) = Σ_{n=1}^{N} bₙ·sin(n·w0·x)
   */
  buildSineOnly(terms: TrigNumericTerm[], w0: number, nMax?: number): (x: number) => number {
    const limit = nMax !== undefined ? Math.min(nMax, terms.length) : terms.length;
    const slice = terms.slice(0, limit);

    return (x: number): number => {
      let sum = 0;
      for (const { n, bnFloat } of slice) {
        sum += bnFloat * Math.sin(n * w0 * x);
      }
      return sum;
    };
  }

  // ── Complex ───────────────────────────────────────────────────────────────

  /**
   * Builds the real reconstruction of the complex Fourier series:
   *   f_N(x) = c0 + Σ_{n=1}^{N} [cosFloat·cos(n·w0·x) + sinFloat·sin(n·w0·x)]
   *
   * `cosFloat` and `sinFloat` are precomputed by the backend so that this is
   * equivalent to c_n·e^{inw0x} + c_{-n}·e^{-inw0x} for each harmonic.
   *
   * @param c0      Numeric value of c0 (always real for real-valued functions)
   * @param terms   Array of { n, cosFloat, sinFloat } from the backend
   * @param w0      Fundamental angular frequency
   * @param nMax    Number of harmonics to include
   */
  buildComplex(
    c0: number,
    terms: ComplexNumericTerm[],
    w0: number,
    nMax?: number,
  ): (x: number) => number {
    const limit = nMax !== undefined ? Math.min(nMax, terms.length) : terms.length;
    const slice = terms.slice(0, limit);

    return (x: number): number => {
      let sum = c0;
      for (const { n, cosFloat, sinFloat } of slice) {
        const arg = n * w0 * x;
        sum += cosFloat * Math.cos(arg) + sinFloat * Math.sin(arg);
      }
      return sum;
    };
  }

  // ── Generic summatoria helper ─────────────────────────────────────────────

  /**
   * Evaluates an arbitrary series Σ_{n=1}^{N} term(n, x).
   * Useful for custom series or testing.
   */
  sumSeries(termFn: (n: number, x: number) => number, nTerms: number, x: number, dc = 0): number {
    let sum = dc;
    for (let n = 1; n <= nTerms; n++) {
      sum += termFn(n, x);
    }
    return sum;
  }

  // ── w0 parsing ────────────────────────────────────────────────────────────

  /**
   * Extracts a numeric w0 from the backend SymbolicExpression.
   * The backend returns w0 as { tex: '...', maxima: '...' }.
   * We parse the Maxima string (e.g. "2*%pi/3") to a float.
   *
   * Falls back to Math.PI if parsing fails.
   */
  parseW0(maxima: string): number {
    const js = maxima
      .replace(/%pi/g, String(Math.PI))
      .replace(/%e/g, String(Math.E))
      .replace(/\^/g, '**');
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${js})`)() as number;
      return isFinite(result) && result > 0 ? result : Math.PI;
    } catch {
      return Math.PI;
    }
  }
}
