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
  amplitude: number;
  phase: number;
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
    const dc    = a0 / 2;

    return (x: number): number => {
      let sum = dc;
      for (const { n, anFloat, bnFloat } of slice) {
        const arg = n * w0 * x;
        sum += anFloat * Math.cos(arg) + bnFloat * Math.sin(arg);
      }
      return sum;
    };
  }

  // ── Complex ───────────────────────────────────────────────────────────────

  /**
   * Builds f_N(x) = Σ_{n=-N}^{N} c_n · e^{i·n·w0·x}
   *
   * For real-valued functions c_{-n} = conj(c_n), so the sum collapses to:
   *   c0 + 2 · Σ_{n=1}^{N} [ Re(c_n)·cos(n·w0·x) − Im(c_n)·sin(n·w0·x) ]
   *
   * The backend's ComplexTerm includes `realFloat` = 2·Re(c_n) for the
   * real reconstruction, and `amplitude` / `phase` for the spectrum.
   *
   * @param c0Real  Real part of c0 (= a0/2)
   * @param terms   Array of { n, realFloat, amplitude, phase }
   * @param w0      Fundamental angular frequency
   * @param nMax    Number of harmonics to include
   */
  buildComplex(
    c0Real: number,
    terms: ComplexNumericTerm[],
    w0: number,
    nMax?: number,
  ): (x: number) => number {
    const limit = nMax !== undefined ? Math.min(nMax, terms.length) : terms.length;
    const slice = terms.slice(0, limit);

    return (x: number): number => {
      // c0 + Σ 2·Re(c_n·e^{inw0x}) = c0 + Σ amplitude·cos(n·w0·x + phase)
      let sum = c0Real;
      for (const { n, amplitude, phase } of slice) {
        sum += amplitude * Math.cos(n * w0 * x + phase);
      }
      return sum;
    };
  }

  // ── Generic summatoria helper ─────────────────────────────────────────────

  /**
   * Evaluates an arbitrary series Σ_{n=1}^{N} term(n, x).
   * Useful for custom series or testing.
   */
  sumSeries(
    termFn: (n: number, x: number) => number,
    nTerms: number,
    x: number,
    dc = 0,
  ): number {
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
      .replace(/%e/g,  String(Math.E))
      .replace(/\^/g,  '**');
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${js})`)() as number;
      return isFinite(result) && result > 0 ? result : Math.PI;
    } catch {
      return Math.PI;
    }
  }
}
