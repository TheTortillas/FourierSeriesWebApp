import { computed, inject, Injectable } from '@angular/core';
import { ThemeService } from '../theme/theme.service';

export interface TransformColors {
  original:     string; // Re f(t) / f(t)
  originalImag: string; // Im f(t)
  originalMag:  string; // |f(t)|
  result:       string; // Re F(ω)
  imag:         string; // Im F(ω)
  mag:          string; // |F(ω)|
}

export interface SeriesColors {
  original:  string;
  approx:    string;
  harmonics: string[];
}

export interface PairColors {
  input:  string;
  result: string;
}

@Injectable({ providedIn: 'root' })
export class CanvasColorService {
  private readonly theme = inject(ThemeService);

  // ── Transform FT/IFT palette ────────────────────────────────────────────
  readonly transformColors = computed<TransformColors>(() => {
    const dark    = this.theme.theme() === 'dark';
    const neutral = this.theme.palette() === 'neutral';

    if (!neutral && !dark) return {
      original:     '#dc2626',
      originalImag: '#9333ea',
      originalMag:  '#0891b2',
      result:       '#2563eb',
      imag:         '#d97706',
      mag:          '#16a34a',
    };

    if (!neutral && dark) return {
      original:     '#f87171',
      originalImag: '#c084fc',
      originalMag:  '#22d3ee',
      result:       '#60a5fa',
      imag:         '#fbbf24',
      mag:          '#4ade80',
    };

    if (neutral && !dark) return {
      original:     '#2563eb',
      originalImag: '#7c3aed',
      originalMag:  '#0891b2',
      result:       '#0f766e',
      imag:         '#c2410c',
      mag:          '#4f46e5',
    };

    // neutral + dark
    return {
      original:     '#60a5fa',
      originalImag: '#a78bfa',
      originalMag:  '#22d3ee',
      result:       '#2dd4bf',
      imag:         '#fb923c',
      mag:          '#818cf8',
    };
  });

  // ── Fourier Series palette ───────────────────────────────────────────────
  readonly seriesColors = computed<SeriesColors>(() => {
    const dark    = this.theme.theme() === 'dark';
    const neutral = this.theme.palette() === 'neutral';

    if (!neutral && !dark) return {
      original: '#8b2500',
      approx:   '#1a4a6b',
      harmonics: [
        'hsla(217, 70%, 55%, 0.55)', 'hsla(145, 60%, 45%, 0.55)',
        'hsla(38, 80%, 50%, 0.55)',  'hsla(270, 60%, 60%, 0.55)',
        'hsla(0, 70%, 55%, 0.55)',   'hsla(185, 65%, 45%, 0.55)',
        'hsla(320, 60%, 55%, 0.55)', 'hsla(60, 70%, 45%, 0.55)',
      ],
    };

    if (!neutral && dark) return {
      original: '#e0ad74',
      approx:   '#79b6de',
      harmonics: [
        'hsla(210, 85%, 72%, 0.62)', 'hsla(145, 65%, 58%, 0.62)',
        'hsla(36, 90%, 62%, 0.62)',  'hsla(280, 70%, 72%, 0.62)',
        'hsla(0, 80%, 68%, 0.62)',   'hsla(185, 75%, 62%, 0.62)',
        'hsla(325, 70%, 70%, 0.62)', 'hsla(60, 80%, 62%, 0.62)',
      ],
    };

    if (neutral && !dark) return {
      original: '#2563eb',
      approx:   '#0f766e',
      harmonics: [
        'hsla(217, 78%, 52%, 0.5)', 'hsla(162, 70%, 35%, 0.5)',
        'hsla(280, 60%, 55%, 0.5)', 'hsla(29, 92%, 48%, 0.5)',
        'hsla(348, 78%, 50%, 0.5)', 'hsla(198, 80%, 42%, 0.5)',
        'hsla(83, 62%, 42%, 0.5)',  'hsla(44, 90%, 45%, 0.5)',
      ],
    };

    // neutral + dark
    return {
      original: '#60a5fa',
      approx:   '#2dd4bf',
      harmonics: [
        'hsla(217, 85%, 68%, 0.62)', 'hsla(162, 70%, 58%, 0.62)',
        'hsla(280, 65%, 68%, 0.62)', 'hsla(29, 90%, 65%, 0.62)',
        'hsla(348, 80%, 68%, 0.62)', 'hsla(198, 78%, 62%, 0.62)',
        'hsla(83, 65%, 62%, 0.62)',  'hsla(44, 88%, 62%, 0.62)',
      ],
    };
  });

  // ── Laplace: input (red) + result (blue) ────────────────────────────────
  readonly laplaceColors = computed<PairColors>(() => {
    const dark = this.theme.theme() === 'dark';
    return {
      input:  dark ? '#f87171' : '#dc2626',
      result: dark ? '#60a5fa' : '#2563eb',
    };
  });

  // ── Fourier Integral: original (red) + reconstruct (blue) ───────────────
  readonly integralColors = computed<PairColors>(() => {
    const dark = this.theme.theme() === 'dark';
    return {
      input:  dark ? '#f87171' : '#dc2626',
      result: dark ? '#60a5fa' : '#2563eb',
    };
  });

  // ── ODE / single-curve default ──────────────────────────────────────────
  readonly singleCurveDefault = computed<string>(() =>
    this.theme.theme() === 'dark' ? '#60a5fa' : '#3b82f6',
  );
}
