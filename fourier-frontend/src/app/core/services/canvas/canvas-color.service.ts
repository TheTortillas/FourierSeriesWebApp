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

export interface DftColors {
  samples:        string;
  reconstruction: string;
  specAmplitude:  string;
  specPhase:      string;
  epicOriginal:   string;
  epicSampled:    string;
}

/** Colors for each SpectrumChart display mode (Fourier Series spectrum). */
export interface SpectrumColors {
  trigAn:       string; // cosine coefficients aₙ
  trigAnAbs:    string; // |aₙ|
  trigBn:       string; // sine coefficients bₙ
  trigBnAbs:    string; // |bₙ|
  trigAmp:      string; // amplitude spectrum cₙ
  complexRe:    string; // Re Cₙ
  complexIm:    string; // Im Cₙ
  complexPhase: string; // ∠Cₙ
  complexAbs:   string; // |Cₙ|
  highlight:    string; // hovered stem highlight
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

  // ── DFT palette ─────────────────────────────────────────────────────────
  readonly dftColors = computed<DftColors>(() => {
    const dark    = this.theme.theme() === 'dark';
    const neutral = this.theme.palette() === 'neutral';

    if (!neutral && !dark) return {
      samples:        '#ea580c',
      reconstruction: '#6366f1',
      specAmplitude:  '#7c3aed',
      specPhase:      '#059669',
      epicOriginal:   '#6b7280',
      epicSampled:    '#d97706',
    };

    if (!neutral && dark) return {
      samples:        '#fb923c',
      reconstruction: '#818cf8',
      specAmplitude:  '#a78bfa',
      specPhase:      '#6ee7b7',
      epicOriginal:   '#9ca3af',
      epicSampled:    '#fbbf24',
    };

    if (neutral && !dark) return {
      samples:        '#c2410c',
      reconstruction: '#4f46e5',
      specAmplitude:  '#6d28d9',
      specPhase:      '#0f766e',
      epicOriginal:   '#6b7280',
      epicSampled:    '#b45309',
    };

    // neutral + dark
    return {
      samples:        '#fb923c',
      reconstruction: '#818cf8',
      specAmplitude:  '#a78bfa',
      specPhase:      '#2dd4bf',
      epicOriginal:   '#9ca3af',
      epicSampled:    '#fbbf24',
    };
  });

  // ── Fourier Series spectrum palette ─────────────────────────────────────
  readonly spectrumColors = computed<SpectrumColors>(() => {
    const dark    = this.theme.theme() === 'dark';
    const neutral = this.theme.palette() === 'neutral';

    return {
      trigAn:       dark ? '#7db7e8' : '#2563eb',
      trigAnAbs:    dark ? '#7db7e8' : '#2563eb',
      trigBn:       !neutral ? (dark ? '#e0ad74' : '#c14030') : (dark ? '#fb923c' : '#c2410c'),
      trigBnAbs:    !neutral ? (dark ? '#e0ad74' : '#c14030') : (dark ? '#fb923c' : '#c2410c'),
      trigAmp:      dark ? '#c4b5fd' : '#7c3aed',
      complexRe:    dark ? '#7db7e8' : '#2563eb',
      complexIm:    dark ? '#7dd3a0' : '#059669',
      complexPhase: dark ? '#f6b26b' : '#d97706',
      complexAbs:   dark ? '#c4b5fd' : '#7c3aed',
      highlight:    dark ? '#fbbf24' : '#d97706',
    };
  });

  // ── ODE / single-curve default ──────────────────────────────────────────
  readonly singleCurveDefault = computed<string>(() =>
    this.theme.theme() === 'dark' ? '#60a5fa' : '#3b82f6',
  );

  // ── Complex plot overlay colors ──────────────────────────────────────────
  // The WebGL canvas always has a black background regardless of app theme,
  // so overlay colors (axes, grid, labels) are always white-on-black.
  readonly complexPlotColors = computed(() => {
    const dark = this.theme.theme() === 'dark';
    return {
      // 2D overlay — always white-on-black (WebGL background is always dark)
      axis:      'rgba(255,255,255,0.45)',
      gridMajor: 'rgba(255,255,255,0.12)',
      gridMinor: 'rgba(255,255,255,0.05)',
      label:     'rgba(255,255,255,0.75)',
      // legend ring — always white-on-black
      legendStroke: 'rgba(255,255,255,0.30)',
      legendText:   'rgba(255,255,255,0.75)',
      legendMuted:  'rgba(255,255,255,0.45)',
      // 3D axes labels (rendered as CSS overlay, not WebGL)
      axisRe: dark ? '#f87171' : '#dc2626',
      axisIm: dark ? '#4ade80' : '#16a34a',
      axisF:  dark ? '#60a5fa' : '#2563eb',
      // 3D tick dots
      tickRe:    'rgba(241,135,135,0.65)',
      tickIm:    'rgba(74,222,128,0.65)',
      tickLabel: 'rgba(255,255,255,0.60)',
    };
  });
}
