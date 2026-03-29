import { Injectable } from '@angular/core';
import { DftCoefficient, DftPoint, DftResponse } from '../../../domain/types/dft.types';

// ── Shared types ──────────────────────────────────────────────────────────────

/** Window function families for spectral analysis. */
export type WindowType = 'rectangular' | 'hann' | 'hamming' | 'blackman';

/** Frequency-domain filter shapes for the Phase-C filter. */
export type PhaseCFilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

/** A DFT coefficient paired with its display x-axis position. */
export interface SpectrumBin {
  coeff: DftCoefficient;
  /** Either `coeff.k` (unsigned) or its signed equivalent, depending on `shifted`. */
  xBin: number;
}

/** Spectral leakage statistics derived from a DFT result. */
export interface LeakageStats {
  dominantK: number;
  dominantAmplitude: number;
  /** Fraction of total energy outside the dominant bin's main lobe [0, 1]. */
  leakageRatio: number;
}

/** Per-signal stats produced by the Phase-C filter. */
export interface PhaseCStats {
  keptBins: number;
  /** Energy retained after filtering, relative to the original [0, 1]. */
  keptEnergyRatio: number;
  rmsError: number;
}

/** Full output of applyPhaseCFilter. */
export interface PhaseCFilterResult {
  filteredCoefficients: DftCoefficient[];
  reconstruction: DftPoint[];
  stats: PhaseCStats;
}

/** UI-state parameters for the Phase-C filter — resolved by the caller. */
export interface PhaseCFilterOptions {
  filterType: PhaseCFilterType;
  /** Lower cutoff (frequency index). */
  k1: number;
  /** Upper cutoff — only used by bandpass/notch. */
  k2: number;
  /** When true, the DC component (k=0) is always kept regardless of the filter. */
  preserveDC: boolean;
}

const TAU = Math.PI * 2;

/**
 * 1-D DFT signal-processing utilities.
 *
 * All methods are stateless: every piece of UI state that influences the
 * computation is passed as an explicit parameter, keeping the service
 * independently testable and reusable outside Angular's signal context.
 */
@Injectable({ providedIn: 'root' })
export class DftSignalService {

  // ── Frequency index utilities ─────────────────────────────────────────────

  /**
   * Converts an unsigned DFT frequency index into a signed one using the
   * standard convention: indices above N/2 are mapped to negative frequencies.
   *
   * @example signedK(192, 256) → -64
   */
  signedK(k: number, n: number): number {
    return k > n / 2 ? k - n : k;
  }

  // ── Window functions ──────────────────────────────────────────────────────

  /**
   * Returns the window-function weight for sample `i` of `n` total samples.
   *
   * Supported windows:
   *   - `rectangular` → 1 (no windowing)
   *   - `hann`        → 0.5 − 0.5·cos(2πi/(n−1))
   *   - `hamming`     → 0.54 − 0.46·cos(2πi/(n−1))
   *   - `blackman`    → 0.42 − 0.5·cos(x) + 0.08·cos(2x)
   */
  windowAt(type: WindowType, i: number, n: number): number {
    const denom = Math.max(1, n - 1);
    const x     = (TAU * i) / denom;

    switch (type) {
      case 'hann':      return 0.5  - 0.5  * Math.cos(x);
      case 'hamming':   return 0.54 - 0.46 * Math.cos(x);
      case 'blackman':  return 0.42 - 0.5  * Math.cos(x) + 0.08 * Math.cos(2 * x);
      case 'rectangular':
      default:          return 1;
    }
  }

  /**
   * Multiplies each sample's y value by its window-function coefficient.
   * Returns the original array unchanged for `rectangular` or length ≤ 1.
   */
  applyWindowToSignal(points: DftPoint[], type: WindowType): DftPoint[] {
    const n = points.length;
    if (n <= 1 || type === 'rectangular') return points;
    return points.map((p, i) => ({ x: p.x, y: p.y * this.windowAt(type, i, n) }));
  }

  // ── Signal generation ─────────────────────────────────────────────────────

  /**
   * Generates N discrete samples with optional additive white noise.
   *
   * The `generator` receives `(sampleIndex, t)` where `t = i / N ∈ [0, 1)`.
   */
  generateSampledSignal(
    generator: (n: number, t: number) => number,
    sampleCount: number,
    noiseLevel: number,
  ): DftPoint[] {
    const points: DftPoint[] = [];
    for (let i = 0; i < sampleCount; i++) {
      const t     = i / sampleCount;
      const noisy = generator(i, t) + this.randomNoise(noiseLevel);
      points.push({ x: i, y: noisy });
    }
    return points;
  }

  /**
   * Evaluates the generator over `[0, sampleCount − 1]` at high density for
   * smooth continuous-curve rendering.
   */
  generateContinuousFunction(
    generator: (n: number, t: number) => number,
    sampleCount: number,
  ): DftPoint[] {
    const dense  = Math.max(512, Math.min(2400, sampleCount * 3));
    const points: DftPoint[] = [];
    for (let i = 0; i < dense; i++) {
      const t = i / (dense - 1);
      points.push({ x: t * (sampleCount - 1), y: generator(i, t) });
    }
    return points;
  }

  /**
   * Same as generateContinuousFunction but mirrored to negative x for f(−t).
   * Returns points sorted ascending by x.
   */
  generateNegativeContinuousFunction(
    generator: (n: number, t: number) => number,
    sampleCount: number,
  ): DftPoint[] {
    const dense  = Math.max(512, Math.min(2400, sampleCount * 3));
    const points: DftPoint[] = [];
    for (let i = 0; i < dense; i++) {
      const t = i / (dense - 1);
      points.push({ x: -t * (sampleCount - 1), y: generator(i, -t) });
    }
    return points.sort((a, b) => a.x - b.x);
  }

  /**
   * Compiles a safe, sandboxed numeric expression entered by the user.
   *
   * Allowed characters: digits, a-z, `_ + - * / ^ ( ) . ,` and whitespace.
   * Dangerous constructs (assignments, keywords, brackets) are rejected.
   *
   * @returns A `(n, t) → number` function, or `null` if the expression is
   *          invalid or potentially unsafe.
   */
  buildManualGenerator(rawExpression: string): ((n: number, t: number) => number) | null {
    const expression = rawExpression.trim().toLowerCase();
    if (!expression) return null;

    if (/constructor|window|global|process|require|import|function|=>|;|\{|\}|\[|\]|=/.test(expression)) {
      return null;
    }
    if (/[^0-9a-z_+\-*/^().,\s]/.test(expression)) {
      return null;
    }

    const jsExpr = expression.replace(/\^/g, '**');

    try {
      const fn = new Function(
        't', 'pi', 'sin', 'cos', 'tan', 'sqrt', 'abs', 'exp', 'log', 'pow',
        `return (${jsExpr});`,
      ) as (
        t: number, pi: number,
        sin: typeof Math.sin, cos: typeof Math.cos, tan: typeof Math.tan,
        sqrt: typeof Math.sqrt, abs: typeof Math.abs,
        exp: typeof Math.exp, log: typeof Math.log, pow: typeof Math.pow,
      ) => number;

      // Smoke-test with a finite probe value
      const probe = fn(0.123, Math.PI, Math.sin, Math.cos, Math.tan,
        Math.sqrt, Math.abs, Math.exp, Math.log, Math.pow);
      if (!Number.isFinite(probe)) return null;

      return (_n: number, t: number) => {
        const y = fn(t, Math.PI, Math.sin, Math.cos, Math.tan,
          Math.sqrt, Math.abs, Math.exp, Math.log, Math.pow);
        return Number.isFinite(y) ? y : 0;
      };
    } catch {
      return null;
    }
  }

  // ── Spectrum utilities ────────────────────────────────────────────────────

  /**
   * Maps a DFT result to displayable spectrum bins.
   *
   * @param shifted  When true, frequency indices are converted to signed form
   *                 so the spectrum is centred around DC (k=0).
   */
  buildSpectrumBins(res: DftResponse, shifted: boolean): SpectrumBin[] {
    return res.coefficients
      .map((coeff) => ({
        coeff,
        xBin: shifted ? this.signedK(coeff.k, res.N) : coeff.k,
      }))
      .sort((a, b) => a.xBin - b.xBin);
  }

  /**
   * Same as buildSpectrumBins but accepts a raw coefficients array when the
   * full DftResponse is not available (e.g. phase-C filtered coefficients).
   */
  buildSpectrumBinsFromCoefficients(
    coeffs: DftCoefficient[],
    n: number,
    shifted: boolean,
  ): SpectrumBin[] {
    return coeffs
      .map((coeff) => ({
        coeff,
        xBin: shifted ? this.signedK(coeff.k, n) : coeff.k,
      }))
      .sort((a, b) => a.xBin - b.xBin);
  }

  // ── Leakage analysis ──────────────────────────────────────────────────────

  /**
   * Computes spectral leakage statistics for a DFT result.
   * Returns `null` when no coefficients are available.
   *
   * The leakage ratio is the fraction of total energy that lies outside the
   * main lobe of the dominant frequency (±1 bin tolerance).
   */
  computeLeakage(res: DftResponse): LeakageStats | null {
    if (res.coefficients.length === 0) return null;

    const bins = res.coefficients
      .map((c) => ({ coeff: c, kSigned: this.signedK(c.k, res.N) }))
      .filter((x) => x.kSigned >= 0 && x.kSigned <= Math.floor(res.N / 2));

    if (bins.length === 0) return null;

    const dominant = bins.reduce((best, cur) =>
      cur.coeff.amplitude > best.coeff.amplitude ? cur : best,
    );

    const totalEnergy = bins.reduce((s, x) => s + x.coeff.amplitude * x.coeff.amplitude, 0);
    if (totalEnergy <= 0) {
      return { dominantK: dominant.kSigned, dominantAmplitude: 0, leakageRatio: 0 };
    }

    const mainLobeEnergy = bins
      .filter((x) => Math.abs(x.kSigned - dominant.kSigned) <= 1)
      .reduce((s, x) => s + x.coeff.amplitude * x.coeff.amplitude, 0);

    return {
      dominantK:         dominant.kSigned,
      dominantAmplitude: dominant.coeff.amplitude,
      leakageRatio:      Math.max(0, (totalEnergy - mainLobeEnergy) / totalEnergy),
    };
  }

  // ── Phase-C (in-signal frequency) filter ─────────────────────────────────

  /**
   * Returns true if coefficient `k` should be kept given `opts`.
   * The DC component (k = 0 after signing) is always kept when `preserveDC`
   * is set, regardless of the filter type.
   */
  shouldKeepCoefficient(k: number, n: number, opts: PhaseCFilterOptions): boolean {
    const kAbs = Math.abs(this.signedK(k, n));
    if (opts.preserveDC && kAbs === 0) return true;

    const half = Math.floor(n / 2);
    const k1   = Math.max(0, Math.min(half, Math.round(opts.k1)));
    const k2   = Math.max(0, Math.min(half, Math.round(opts.k2)));
    const low  = Math.min(k1, k2);
    const high = Math.max(k1, k2);

    switch (opts.filterType) {
      case 'lowpass':  return kAbs <= low;
      case 'highpass': return kAbs >= low;
      case 'bandpass': return kAbs >= low && kAbs <= high;
      case 'notch':    return !(kAbs >= low && kAbs <= high);
      default:         return true;
    }
  }

  /**
   * Applies the Phase-C filter to a DFT result and reconstructs the signal.
   *
   * Returns `null` when there is no result or analyzed signal to work with.
   * The caller is responsible for writing the returned values into signals.
   */
  applyPhaseCFilter(
    res: DftResponse,
    analyzed: DftPoint[],
    opts: PhaseCFilterOptions,
  ): PhaseCFilterResult | null {
    if (analyzed.length === 0) return null;

    const filteredCoefficients = res.coefficients.map((c) => {
      if (this.shouldKeepCoefficient(c.k, res.N, opts)) return c;
      return { ...c, re: 0, im: 0, amplitude: 0, amplitudePercent: 0, phase: 0, phaseInPi: '0' };
    });

    const reconstruction = analyzed.map((p, n) => {
      let y = 0;
      for (const c of filteredCoefficients) {
        const angle = (TAU * c.k * n) / res.N;
        y += c.re * Math.cos(angle) - c.im * Math.sin(angle);
      }
      return { x: p.x, y };
    });

    let originalEnergy = 0;
    let keptEnergy     = 0;
    let keptBins       = 0;
    for (let i = 0; i < res.coefficients.length; i++) {
      const e0 = res.coefficients[i]?.amplitude ?? 0;
      const e1 = filteredCoefficients[i]?.amplitude ?? 0;
      originalEnergy += e0 * e0;
      keptEnergy     += e1 * e1;
      if (e1 > 0) keptBins++;
    }

    const m = Math.min(analyzed.length, reconstruction.length);
    let rmsSum = 0;
    for (let i = 0; i < m; i++) {
      const d = (analyzed[i]?.y ?? 0) - (reconstruction[i]?.y ?? 0);
      rmsSum += d * d;
    }

    return {
      filteredCoefficients,
      reconstruction,
      stats: {
        keptBins,
        keptEnergyRatio: originalEnergy > 0 ? keptEnergy / originalEnergy : 0,
        rmsError:        m > 0 ? Math.sqrt(rmsSum / m) : 0,
      },
    };
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /** Returns a uniform random value in [−level, +level], or 0 if level ≤ 0. */
  randomNoise(level: number): number {
    if (level <= 0) return 0;
    return (Math.random() * 2 - 1) * level;
  }
}
