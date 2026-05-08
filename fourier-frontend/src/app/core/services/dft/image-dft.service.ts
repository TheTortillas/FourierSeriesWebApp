import { inject, Injectable } from '@angular/core';
import { DftSignalService } from './dft-signal.service';

/** A complex number with real and imaginary parts. */
export interface ComplexValue {
  re: number;
  im: number;
}

/** 2D frequency-domain filter shapes. */
export type ImageFilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

/** Built-in grayscale image patterns. */
export type ImagePresetId = 'dot' | 'bars' | 'checker';

/**
 * Parameters for applyFrequencyFilter — all resolved from signals by the
 * caller so this service remains stateless and independently testable.
 */
export interface ImageFilterOptions {
  filterType: ImageFilterType;
  /** Inner radius (lowpass cutoff / bandpass lower bound). */
  r1: number;
  /** Outer radius (bandpass upper bound). Ignored for lowpass/highpass. */
  r2: number;
}

const TAU = Math.PI * 2;

/**
 * 2-D DFT / FFT and image-processing primitives.
 *
 * All methods are stateless: they receive every parameter explicitly so that
 * the component (or a future test) can call them without Angular signal context.
 *
 * Dependency on DftSignalService is limited to two shared utilities:
 *   - signedK  — converts a positive frequency index to a signed one
 *   - windowAt — computes a single window-function coefficient
 */
@Injectable({ providedIn: 'root' })
export class ImageDftService {
  private readonly signal = inject(DftSignalService);

  // ── Power-of-two guard ────────────────────────────────────────────────────

  /** Returns true only for n > 1 that is an exact power of two. */
  isPowerOfTwo(n: number): boolean {
    return n > 1 && (n & (n - 1)) === 0;
  }

  // ── 1-D FFT / IFFT ────────────────────────────────────────────────────────

  /**
   * In-place Cooley-Tukey radix-2 FFT.
   * Input length must be a power of two.
   */
  fft1d(values: ComplexValue[]): ComplexValue[] {
    const n = values.length;
    const output = values.map((v) => ({ re: v.re, im: v.im }));

    let j = 0;
    for (let i = 1; i < n; i++) {
      let bit = n >> 1;
      while (j & bit) { j ^= bit; bit >>= 1; }
      j ^= bit;
      if (i < j) {
        const tmp = output[i];
        output[i] = output[j] as ComplexValue;
        output[j] = tmp as ComplexValue;
      }
    }

    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const theta = -TAU / len;
      const wlenRe = Math.cos(theta);
      const wlenIm = Math.sin(theta);

      for (let i = 0; i < n; i += len) {
        let wRe = 1;
        let wIm = 0;

        for (let k = 0; k < half; k++) {
          const u  = output[i + k]        as ComplexValue;
          const v0 = output[i + k + half] as ComplexValue;
          const vRe = v0.re * wRe - v0.im * wIm;
          const vIm = v0.re * wIm + v0.im * wRe;

          output[i + k]        = { re: u.re + vRe, im: u.im + vIm };
          output[i + k + half] = { re: u.re - vRe, im: u.im - vIm };

          const nextWRe = wRe * wlenRe - wIm * wlenIm;
          const nextWIm = wRe * wlenIm + wIm * wlenRe;
          wRe = nextWRe;
          wIm = nextWIm;
        }
      }
    }

    return output;
  }

  /**
   * Inverse FFT via conjugation trick: IFFT(x) = conj(FFT(conj(x))) / N.
   */
  ifft1d(values: ComplexValue[]): ComplexValue[] {
    const n = values.length;
    const conjugated  = values.map((v) => ({ re: v.re, im: -v.im }));
    const transformed = this.fft1d(conjugated);
    return transformed.map((v) => ({ re: v.re / n, im: -v.im / n }));
  }

  // ── 2-D FFT / IFFT ────────────────────────────────────────────────────────

  /**
   * Separable 2-D FFT: row-wise then column-wise.
   * Input must be square with side length that is a power of two.
   */
  fft2d(input: number[][]): ComplexValue[][] {
    const n = input.length;
    const rows: ComplexValue[][] = Array.from({ length: n }, (_, y) =>
      this.fft1d(Array.from({ length: n }, (_, x) => ({ re: input[y]?.[x] ?? 0, im: 0 }))),
    );

    const out: ComplexValue[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ re: 0, im: 0 })),
    );

    for (let x = 0; x < n; x++) {
      const col    = Array.from({ length: n }, (_, y) => rows[y]?.[x] ?? { re: 0, im: 0 });
      const colFft = this.fft1d(col);
      for (let y = 0; y < n; y++) {
        out[y][x] = colFft[y] as ComplexValue;
      }
    }

    return out;
  }

  /**
   * Separable 2-D IFFT: column-wise then row-wise, returns real part.
   */
  ifft2d(input: ComplexValue[][]): number[][] {
    const n = input.length;
    const colsDone: ComplexValue[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ re: 0, im: 0 })),
    );

    for (let x = 0; x < n; x++) {
      const col     = Array.from({ length: n }, (_, y) => input[y]?.[x] ?? { re: 0, im: 0 });
      const colIfft = this.ifft1d(col);
      for (let y = 0; y < n; y++) {
        colsDone[y][x] = colIfft[y] as ComplexValue;
      }
    }

    const out: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    for (let y = 0; y < n; y++) {
      const row = this.ifft1d(colsDone[y] ?? []);
      for (let x = 0; x < n; x++) {
        out[y][x] = row[x]?.re ?? 0;
      }
    }

    return out;
  }

  // ── 2-D DFT / IDFT (O(n⁴) naive, used when n is not a power of two) ──────

  /** Naive 2-D DFT. Use only for small non-power-of-two sizes. */
  dft2d(input: number[][]): ComplexValue[][] {
    const n = input.length;
    const out: ComplexValue[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ re: 0, im: 0 })),
    );

    for (let u = 0; u < n; u++) {
      for (let v = 0; v < n; v++) {
        let re = 0;
        let im = 0;
        for (let x = 0; x < n; x++) {
          for (let y = 0; y < n; y++) {
            const angle = (TAU * (u * x + v * y)) / n;
            const value = input[y]?.[x] ?? 0;
            re += value * Math.cos(angle);
            im -= value * Math.sin(angle);
          }
        }
        out[u][v] = { re: re / n, im: im / n };
      }
    }

    return out;
  }

  /** Naive 2-D IDFT. */
  idft2d(input: ComplexValue[][]): number[][] {
    const n = input.length;
    const out: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        let value = 0;
        for (let u = 0; u < n; u++) {
          for (let v = 0; v < n; v++) {
            const c     = input[u]?.[v] ?? { re: 0, im: 0 };
            const angle = (TAU * (u * x + v * y)) / n;
            value += c.re * Math.cos(angle) - c.im * Math.sin(angle);
          }
        }
        out[y][x] = value / n;
      }
    }

    return out;
  }

  // ── Frequency-domain operations ───────────────────────────────────────────

  /**
   * Zeroes out frequency bins that fall outside the filter passband.
   *
   * @param spectrum  FFT/DFT output (zero-centered convention NOT assumed —
   *                  unsigned indices are converted via signedK internally).
   * @param opts      Filter type and radii, resolved from UI signals by the caller.
   */
  applyFrequencyFilter(spectrum: ComplexValue[][], opts: ImageFilterOptions): ComplexValue[][] {
    const n   = spectrum.length;
    const low  = Math.min(opts.r1, opts.r2);
    const high = Math.max(opts.r1, opts.r2);

    const out: ComplexValue[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ re: 0, im: 0 })),
    );

    for (let u = 0; u < n; u++) {
      for (let v = 0; v < n; v++) {
        const us = this.signal.signedK(u, n);
        const vs = this.signal.signedK(v, n);
        const r  = Math.sqrt(us * us + vs * vs);

        let keep = true;
        switch (opts.filterType) {
          case 'lowpass':  keep = r <= low;                    break;
          case 'highpass': keep = r >= low;                    break;
          case 'bandpass': keep = r >= low && r <= high;       break;
          case 'notch':    keep = !(r >= low && r <= high);    break;
        }

        if (keep) {
          out[u][v] = spectrum[u]?.[v] ?? { re: 0, im: 0 };
        }
      }
    }

    return out;
  }

  /**
   * Applies a separable 2-D window function to a real matrix.
   * The window is applied along both axes independently (outer product).
   */
  applyWindow(input: number[][], type: Parameters<DftSignalService['windowAt']>[0]): number[][] {
    const n   = input.length;
    const out: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

    for (let y = 0; y < n; y++) {
      const wy = this.signal.windowAt(type, y, n);
      for (let x = 0; x < n; x++) {
        const wx = this.signal.windowAt(type, x, n);
        out[y][x] = (input[y]?.[x] ?? 0) * wx * wy;
      }
    }

    return out;
  }

  // ── Display utilities ─────────────────────────────────────────────────────

  /**
   * Converts a complex spectrum to a log-magnitude image with the DC
   * component shifted to the center, normalized to [0, 1].
   */
  magnitudeLogNormalized(spectrum: ComplexValue[][]): number[][] {
    const n = spectrum.length;
    const shifted: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    let maxValue = 0;

    for (let u = 0; u < n; u++) {
      for (let v = 0; v < n; v++) {
        const c      = spectrum[u]?.[v] ?? { re: 0, im: 0 };
        const mag    = Math.sqrt(c.re * c.re + c.im * c.im);
        const logMag = Math.log(1 + mag);
        const su     = (u + Math.floor(n / 2)) % n;
        const sv     = (v + Math.floor(n / 2)) % n;
        shifted[su][sv] = logMag;
        maxValue = Math.max(maxValue, logMag);
      }
    }

    if (maxValue <= 0) return shifted;
    return shifted.map((row) => row.map((v) => v / maxValue));
  }

  // ── Matrix utilities ──────────────────────────────────────────────────────

  /** Root-mean-square difference between two same-size matrices. */
  matrixRms(a: number[][], b: number[][]): number {
    const n = Math.min(a.length, b.length);
    if (n === 0) return 0;

    let sum   = 0;
    let count = 0;
    for (let y = 0; y < n; y++) {
      const rowA = a[y] ?? [];
      const rowB = b[y] ?? [];
      const m    = Math.min(rowA.length, rowB.length);
      for (let x = 0; x < m; x++) {
        const d = (rowA[x] ?? 0) - (rowB[x] ?? 0);
        sum += d * d;
        count++;
      }
    }

    return count > 0 ? Math.sqrt(sum / count) : 0;
  }

  /** Flattens a 2-D matrix into a 1-D array, row by row. */
  flattenMatrix(matrix: number[][]): number[] {
    return matrix.flatMap((row) => row);
  }

  /**
   * Nearest-neighbour resize of a rectangular matrix to an n×n square.
   * Falls back to `generatePreset('dot', n)` for empty inputs.
   */
  resizeImageMatrix(input: number[][], n: number): number[][] {
    if (input.length === 0 || input[0]?.length === 0) {
      return this.generatePreset('dot', n);
    }

    const srcH = input.length;
    const srcW = input[0]?.length ?? 1;
    const out  = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

    for (let y = 0; y < n; y++) {
      const sy = Math.min(srcH - 1, Math.floor((y / Math.max(1, n - 1)) * (srcH - 1)));
      for (let x = 0; x < n; x++) {
        const sx = Math.min(srcW - 1, Math.floor((x / Math.max(1, n - 1)) * (srcW - 1)));
        out[y][x] = input[sy]?.[sx] ?? 0;
      }
    }

    return out;
  }

  // ── Image generation ──────────────────────────────────────────────────────

  /**
   * Generates a built-in n×n grayscale test pattern.
   *
   * - `dot`     — single bright pixel at the center
   * - `bars`    — alternating vertical bars (period 4)
   * - `checker` — checkerboard (period 2)
   */
  generatePreset(preset: ImagePresetId, n: number): number[][] {
    const img    = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    const center = Math.floor(n / 2);

    if (preset === 'dot') {
      img[center][center] = 1;
      return img;
    }

    if (preset === 'bars') {
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          img[y][x] = x % 4 < 2 ? 0.95 : 0.1;
        }
      }
      return img;
    }

    // checker
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        img[y][x] = (x + y) % 2 === 0 ? 0.95 : 0.05;
      }
    }
    return img;
  }

  /**
   * Decodes a user-supplied image file into a grayscale matrix via Canvas 2D.
   * The image is downscaled proportionally if any dimension exceeds
   * `maxDimension`.
   *
   * @param maxDimension  Maximum allowed side length before downscaling.
   */
  readAsGrayscaleMatrix(file: File, maxDimension: number): Promise<number[][]> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('read-failed'));
      fr.onload  = () => {
        const dataUrl = fr.result;
        if (typeof dataUrl !== 'string') {
          reject(new Error('invalid-data-url'));
          return;
        }

        const img = new Image();
        img.onerror = () => reject(new Error('image-decode-failed'));
        img.onload  = () => {
          const w       = Math.max(1, img.width);
          const h       = Math.max(1, img.height);
          const scale   = Math.min(1, maxDimension / Math.max(w, h));
          const targetW = Math.max(1, Math.round(w * scale));
          const targetH = Math.max(1, Math.round(h * scale));

          const canvas = document.createElement('canvas');
          canvas.width  = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('no-2d-context')); return; }

          ctx.drawImage(img, 0, 0, targetW, targetH);
          const data   = ctx.getImageData(0, 0, targetW, targetH).data;
          const matrix = Array.from({ length: targetH }, () =>
            Array.from({ length: targetW }, () => 0),
          );

          for (let y = 0; y < targetH; y++) {
            for (let x = 0; x < targetW; x++) {
              const idx  = (y * targetW + x) * 4;
              const r    = data[idx]     ?? 0;
              const g    = data[idx + 1] ?? 0;
              const b    = data[idx + 2] ?? 0;
              // BT.601 luma coefficients
              matrix[y][x] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            }
          }

          resolve(matrix);
        };

        img.src = dataUrl;
      };

      fr.readAsDataURL(file);
    });
  }
}
