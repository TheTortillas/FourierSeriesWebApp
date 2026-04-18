import { Injectable } from '@angular/core';
import type { DftCoefficient, DftPoint } from '../../../domain/types/dft.types';

const TAU = Math.PI * 2;

interface Complex { re: number; im: number; }

function cleanFloat(v: number, threshold = 1e-10): number {
  return Math.abs(v) < threshold ? 0 : v;
}

function simplifyPhaseInPi(phase: number): string {
  const FRACTIONS: [number, string][] = [
    [0, '0'], [1, '1'], [-1, '-1'],
    [0.5, '1/2'], [-0.5, '-1/2'],
    [1/3, '1/3'], [-1/3, '-1/3'],
    [2/3, '2/3'], [-2/3, '-2/3'],
    [1/4, '1/4'], [-1/4, '-1/4'],
    [3/4, '3/4'], [-3/4, '-3/4'],
    [1/6, '1/6'], [-1/6, '-1/6'],
    [5/6, '5/6'], [-5/6, '-5/6'],
  ];
  const ratio = phase / Math.PI;
  for (const [val, label] of FRACTIONS) {
    if (Math.abs(ratio - val) < 1e-6) return label;
  }
  const rounded = Number(ratio.toFixed(6));
  return Number.isFinite(rounded) ? `${rounded}` : '0';
}

/**
 * Pure TypeScript 1-D DFT and FFT computation.
 *
 * Normalization convention (matches backend DFTService):
 *   stored re[k] = Re{X[k]} / N,  im[k] = Im{X[k]} / N
 * so that IDFT is simply:  x[n] = Σ_k (re[k]·cos − im[k]·sin)(2πkn/N)
 */
@Injectable({ providedIn: 'root' })
export class DftComputeService {

  // ── Forward transforms ──────────────────────────────────────────────────────

  /** DFT naive O(N²). Always works regardless of N. */
  private dftRaw(samples: number[]): Complex[] {
    const N = samples.length;
    const result: Complex[] = new Array(N);
    for (let k = 0; k < N; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const angle = (TAU * k * n) / N;
        const s = samples[n] ?? 0;
        re += s * Math.cos(angle);
        im -= s * Math.sin(angle);
      }
      result[k] = { re, im };
    }
    return result;
  }

  /**
   * FFT Cooley-Tukey radix-2 iterative, O(N log N).
   * N must be a power of 2.
   */
  private fftRaw(samples: number[]): Complex[] {
    const N = samples.length;
    const a: Complex[] = samples.map((v) => ({ re: v, im: 0 }));

    // Bit-reversal permutation
    let j = 0;
    for (let i = 1; i < N; i++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { const tmp = a[i]!; a[i] = a[j]!; a[j] = tmp; }
    }

    // Butterfly stages
    for (let len = 2; len <= N; len <<= 1) {
      const ang = -TAU / len;
      const wRe = Math.cos(ang);
      const wIm = Math.sin(ang);
      for (let i = 0; i < N; i += len) {
        let curRe = 1, curIm = 0;
        const half = len >> 1;
        for (let k = 0; k < half; k++) {
          const u = a[i + k]!;
          const v = a[i + k + half]!;
          const vRe = v.re * curRe - v.im * curIm;
          const vIm = v.re * curIm + v.im * curRe;
          a[i + k]        = { re: u.re + vRe, im: u.im + vIm };
          a[i + k + half] = { re: u.re - vRe, im: u.im - vIm };
          const nextRe = curRe * wRe - curIm * wIm;
          curIm = curRe * wIm + curIm * wRe;
          curRe = nextRe;
        }
      }
    }
    return a;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Compute DFT (O(N²)) on the given samples. Returns coefficients + elapsed ms. */
  computeDft(samples: number[]): { coefficients: DftCoefficient[]; timeMs: number } {
    const t0 = performance.now();
    const raw = this.dftRaw(samples);
    const coefficients = this.buildCoefficients(raw, samples.length);
    return { coefficients, timeMs: Math.round(performance.now() - t0) };
  }

  /** Compute FFT (O(N log N)) on the given samples. N must be a power of 2. */
  computeFft(samples: number[]): { coefficients: DftCoefficient[]; timeMs: number } {
    const t0 = performance.now();
    const raw = this.fftRaw(samples);
    const coefficients = this.buildCoefficients(raw, samples.length);
    return { coefficients, timeMs: Math.round(performance.now() - t0) };
  }

  /** IDFT: reconstruct discrete signal from normalized coefficients. */
  reconstruct(coefficients: DftCoefficient[], N: number, xs?: number[]): DftPoint[] {
    const points: DftPoint[] = new Array(N);
    for (let n = 0; n < N; n++) {
      let y = 0;
      for (const c of coefficients) {
        const angle = (TAU * c.k * n) / N;
        y += c.re * Math.cos(angle) - c.im * Math.sin(angle);
      }
      points[n] = { x: xs ? (xs[n] ?? n) : n, y: cleanFloat(y, 1e-9) };
    }
    return points;
  }

  /** Select top K coefficients by amplitude, sorted descending. */
  topCoefficients(coefficients: DftCoefficient[], limit = 256): DftCoefficient[] {
    return [...coefficients]
      .sort((a, b) => b.amplitude - a.amplitude)
      .slice(0, Math.min(limit, coefficients.length));
  }

  /** RMS error between original y-values and reconstructed DftPoints. */
  rmsError(originals: number[], reconstructed: DftPoint[]): number {
    const n = Math.min(originals.length, reconstructed.length);
    if (n === 0) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = (originals[i] ?? 0) - (reconstructed[i]?.y ?? 0);
      sum += d * d;
    }
    return cleanFloat(Math.sqrt(sum / n), 1e-12);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private buildCoefficients(raw: Complex[], N: number): DftCoefficient[] {
    const totalAmp = raw.reduce((s, c) => s + Math.hypot(c.re, c.im) / N, 0);
    return raw.map((c, k) => {
      const re = cleanFloat(c.re / N);
      const im = cleanFloat(c.im / N);
      const amplitude = cleanFloat(Math.hypot(re, im));
      const phase = amplitude < 1e-12 ? 0 : cleanFloat(Math.atan2(im, re), 1e-12);
      return {
        k,
        re,
        im,
        amplitude,
        amplitudePercent: totalAmp > 0 ? (amplitude / totalAmp) * 100 : 0,
        phase,
        phaseInPi: simplifyPhaseInPi(phase),
        freq: k / N,
      };
    });
  }
}
