import { Component, computed, inject, signal, DestroyRef, effect, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, finalize } from 'rxjs';
import { CalculatorStore } from '../../store/calculator.store';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../../shared/components/function-plot/function-plot.component';
import {
  FourierReconstructionService,
  TrigNumericTerm,
  ComplexNumericTerm,
} from '../../../../core/services/canvas/fourier-reconstruction.service';
import { PlottingService } from '../../../../core/services/canvas/plotting.service';
import { MathUtilsService } from '../../../../core/services/math/math-utils.service';
import { MathjaxDirective } from '../../../../shared/directives/mathjax.directive';
import { ApiService } from '../../../../core/services/api/api.service';
import { UserStore } from '../../../../core/services/auth/user.store';
import { ParamSlidersComponent } from '../../../../shared/components/param-sliders/param-sliders.component';
import type { ParamValues } from '../../../../shared/components/param-sliders/param-sliders.component';
import { SimplifyProfile, HistoryEntry } from '../../../../domain';
import { TrigonometricTerm, ComplexTerm } from '../../../../domain/types/fourier.types';

/** Cycling hue palette for individual harmonics */
const HARMONIC_COLORS = [
  'hsla(217, 70%, 55%, 0.55)',
  'hsla(145, 60%, 45%, 0.55)',
  'hsla(38,  80%, 50%, 0.55)',
  'hsla(270, 60%, 60%, 0.55)',
  'hsla(0,   70%, 55%, 0.55)',
  'hsla(185, 65%, 45%, 0.55)',
  'hsla(320, 60%, 55%, 0.55)',
  'hsla(60,  70%, 45%, 0.55)',
];

@Component({
  selector: 'app-results-summary',
  imports: [FunctionPlotComponent, MathjaxDirective, FormsModule, ParamSlidersComponent],
  templateUrl: './results-summary.component.html',
})
export class ResultsSummaryComponent {
  readonly store = inject(CalculatorStore);
  readonly reconstruction = inject(FourierReconstructionService);
  readonly plotter = inject(PlottingService);
  private readonly math = inject(MathUtilsService);
  readonly api = inject(ApiService);
  readonly userStore = inject(UserStore);
  readonly destroyRef = inject(DestroyRef);

  // ── Free-parameter sliders ────────────────────────────────────────────────
  readonly paramValues  = signal<ParamValues>({});
  readonly activeParams = computed<string[]>(() => this.store.result()?.params ?? []);

  // ── Canvas settings ──────────────────────────────────────────────────────
  readonly xAxisFormat = signal<'pi' | 'e' | 'integer'>('pi');
  readonly showHarmonics = signal(false);
  readonly originalColor = signal('#8b2500');
  readonly approxColor = signal('#1a4a6b');
  readonly originalLineWidth = signal(2.5);
  readonly approxLineWidth = signal(1.75);
  readonly showCanvasSettings = signal(false);
  readonly isFullscreen = signal(false);
  readonly showShareDialog = signal(false);
  readonly urlCopied = signal(false);

  // ── Favorite state ────────────────────────────────────────────────────────
  readonly latestHistoryEntry = signal<HistoryEntry | null>(null);
  readonly favoriteLoading = signal(false);
  readonly showFavoriteDialog = signal(false);
  favoriteName = '';

  // ── Canvas wrapper ref (for Fullscreen API) ───────────────────────────────
  readonly canvasWrapper = viewChild<ElementRef<HTMLDivElement>>('canvasWrapper');

  // ── Simplify state ──────────────────────────────────────────────────────────
  readonly simplifyProfile = signal<SimplifyProfile>('raw');
  readonly simplifying = signal(false);
  readonly simplifiedCoeffs = signal<Record<string, string> | null>(null);

  // exponential sub-flags (only relevant when profile === 'exponential')
  readonly expFlag = signal<'exponentialize' | 'demoivre'>('exponentialize');

  // half-range series mode (only relevant when result.type === 'halfRange')
  readonly halfRangeMode = signal<'cosine' | 'sine'>('cosine');

  // ── Helper: parse a Maxima string to number ─────────────────────────────────
  private parseMaxima(s: string): number {
    try {
      // eslint-disable-next-line no-new-func
      return new Function(
        `return (${s.replace(/%pi/g, String(Math.PI)).replace(/%e/g, String(Math.E)).replace(/\^/g, '**')})`,
      )() as number;
    } catch {
      return 0;
    }
  }

  /** Canvas layers: original function + harmonics + Fourier approximation */
  readonly layers = computed<PlotLayer[]>(() => {
    const result = this.store.result();
    const previews = this.store.previewFunctions();
    const nTerms = this.store.nTerms();
    const hrMode = this.halfRangeMode();
    const plotter = this.plotter;
    const math = this.math;
    const rec = this.reconstruction;
    const showHarmonics = this.showHarmonics();
    const origColor = this.originalColor();
    const approxColorVal = this.approxColor();
    const origWidth = this.originalLineWidth();
    const approxWidth = this.approxLineWidth();

    // If free params are set, re-compile the original segments with those values
    // so the canvas reflects the chosen parameter configuration.
    const pv     = this.paramValues();
    const hasPv  = Object.keys(pv).length > 0;
    const segs   = hasPv ? this.store.segments() : null;
    const intVar = hasPv ? this.store.intVar()   : null;
    const origFns = hasPv && segs && intVar
      ? segs.map((s, i) => ({
          fn:   math.compile(s.expression, intVar, pv),
          from: previews[i]?.from ?? NaN,
          to:   previews[i]?.to   ?? NaN,
        }))
      : previews;

    if (!result) {
      return [
        {
          curves: [],
          onDraw(ctx, vp) {
            for (const { fn, from, to } of origFns) {
              if (fn && isFinite(from) && isFinite(to)) {
                plotter.plotFnRange(ctx, fn, from, to, 400, vp, {
                  color: origColor,
                  lineWidth: origWidth,
                });
              }
            }
          },
        },
      ];
    }

    const w0 = rec.parseW0(result.data.w0.maxima);

    let approxFn: ((x: number) => number) | null = null;
    let harmonicFns: Array<(x: number) => number> = [];

    if (result.type === 'trigonometric') {
      const terms = result.terms.terms as TrigNumericTerm[];
      const a0 = result.data.coefficients.a0Float ?? 0;
      approxFn = rec.buildTrigonometric(a0, terms, w0, nTerms);
      if (showHarmonics) {
        const limit = Math.min(nTerms, terms.length);
        harmonicFns = terms.slice(0, limit).map((t) => {
          const { n, anFloat, bnFloat } = t;
          return (x: number) => anFloat * Math.cos(n * w0 * x) + bnFloat * Math.sin(n * w0 * x);
        });
      }
    } else if (result.type === 'halfRange') {
      const terms = result.terms.terms as TrigNumericTerm[];
      if (hrMode === 'cosine') {
        const a0 = result.data.coefficients.a0Float ?? 0;
        approxFn = rec.buildCosineOnly(a0, terms, w0, nTerms);
        if (showHarmonics) {
          const limit = Math.min(nTerms, terms.length);
          harmonicFns = terms.slice(0, limit).map((t) => {
            const { n, anFloat } = t;
            return (x: number) => anFloat * Math.cos(n * w0 * x);
          });
        }
      } else {
        approxFn = rec.buildSineOnly(terms, w0, nTerms);
        if (showHarmonics) {
          const limit = Math.min(nTerms, terms.length);
          harmonicFns = terms.slice(0, limit).map((t) => {
            const { n, bnFloat } = t;
            return (x: number) => bnFloat * Math.sin(n * w0 * x);
          });
        }
      }
    } else if (result.type === 'complex') {
      const terms = result.terms.terms as ComplexNumericTerm[];
      const c0 =
        result.data.coefficients.c0Float ?? this.parseMaxima(result.data.coefficients.c0.maxima);
      approxFn = rec.buildComplex(c0, terms, w0, nTerms);
      if (showHarmonics) {
        const limit = Math.min(nTerms, terms.length);
        harmonicFns = terms.slice(0, limit).map((t) => {
          const { n, cosFloat, sinFloat } = t;
          return (x: number) => cosFloat * Math.cos(n * w0 * x) + sinFloat * Math.sin(n * w0 * x);
        });
      }
    }

    const localApprox = approxFn;
    const localHarmonics = harmonicFns;

    return [
      {
        curves: [],
        onDraw(ctx, vp) {
          // Harmonics (drawn first, behind everything)
          for (let i = 0; i < localHarmonics.length; i++) {
            plotter.plotFn(ctx, localHarmonics[i], vp, {
              color: HARMONIC_COLORS[i % HARMONIC_COLORS.length],
              lineWidth: 1,
            });
          }
          // Original function (bounded to piece intervals)
          for (const { fn, from, to } of origFns) {
            if (fn && isFinite(from) && isFinite(to)) {
              plotter.plotFnRange(ctx, fn, from, to, 400, vp, {
                color: origColor,
                lineWidth: origWidth,
              });
            }
          }
          // Fourier approximation (fills visible range)
          if (localApprox) {
            plotter.plotFn(ctx, localApprox, vp, { color: approxColorVal, lineWidth: approxWidth });
          }
        },
      },
    ];
  });

  /** LaTeX coefficient strings for display */
  readonly coeffTex = computed(() => {
    const result = this.store.result();
    const hrMode = this.halfRangeMode();
    if (!result) return null;

    if (result.type === 'trigonometric') {
      const c = result.data.coefficients;
      return {
        a0: c.a0?.tex ?? null,
        an: c.an?.tex ?? null,
        bn: c.bn?.tex ?? null,
        w0: result.data.w0.tex,
      };
    }
    if (result.type === 'halfRange') {
      const c = result.data.coefficients;
      return hrMode === 'cosine'
        ? { a0: c.a0?.tex ?? null, an: c.an?.tex ?? null, w0: result.data.w0.tex }
        : { bn: c.bn?.tex ?? null, w0: result.data.w0.tex };
    }
    if (result.type === 'complex') {
      const c = result.data.coefficients;
      return { c0: c.c0.tex, cn: c.cn.tex, w0: result.data.w0.tex };
    }
    return null;
  });

  /** Active coefficient LaTeX: uses simplified values when available, else falls back to coeffTex */
  readonly activeCoeffTex = computed(() => {
    const simplified = this.simplifiedCoeffs();
    const base = this.coeffTex();
    if (!base) return null;
    if (!simplified) return base;

    return {
      ...base,
      ...(simplified['a0'] !== undefined ? { a0: simplified['a0'] } : {}),
      ...(simplified['an'] !== undefined ? { an: simplified['an'] } : {}),
      ...(simplified['bn'] !== undefined ? { bn: simplified['bn'] } : {}),
      ...(simplified['c0'] !== undefined ? { c0: simplified['c0'] } : {}),
      ...(simplified['cn'] !== undefined ? { cn: simplified['cn'] } : {}),
      ...(simplified['w0'] !== undefined ? { w0: simplified['w0'] } : {}),
    };
  });

  readonly execTime = computed(() => {
    const r = this.store.result();
    return r ? r.data.executionTimeMs : null;
  });

  // ── Tab state ─────────────────────────────────────────────────────────────
  readonly activeTab = signal<'coefficients' | 'terms' | 'validation'>('coefficients');

  /**
   * Series LaTeX composed from active coefficient values.
   * Automatically reflects simplification — no separate series API call needed.
   * Rules:
   *  - w0 = 1 → omit from the argument (write nx instead of n·1·x)
   *  - zero coefficients → skip that term entirely
   *  - complex → full double-sided sum Σ_{n=-∞}^∞
   */
  readonly composedSeriesTex = computed(() => {
    const r = this.store.result();
    const coeffs = this.activeCoeffTex();
    if (!r || !coeffs) return null;

    const intVar = r.data.input.intVar ?? 'x';
    const w0Tex = coeffs.w0;
    const w0IsOne = w0Tex === '1';
    const omega = w0IsOne ? `n\\,${intVar}` : `n\\,${w0Tex}\\,${intVar}`;

    if (r.type === 'trigonometric') {
      const { a0, an, bn } = coeffs;
      const a0Float = r.data.coefficients.a0Float;
      const a0IsZero = a0Float === undefined || Math.abs(a0Float) < 1e-12;
      const anIsZero = !an || an === '0';
      const bnIsZero = !bn || bn === '0';

      const parts: string[] = [];
      if (!anIsZero) parts.push(`${an}\\cos\\!\\left(${omega}\\right)`);
      if (!bnIsZero) parts.push(`${bn}\\sin\\!\\left(${omega}\\right)`);

      if (parts.length === 0) return a0IsZero ? '0' : (a0 ?? '0');

      const body = `\\sum_{n=1}^{\\infty}\\left(${parts.join('+')}\\right)`;
      if (!a0IsZero && a0) {
        const sep = body.startsWith('-') ? ' ' : ' + ';
        return `${a0}${sep}${body}`;
      }
      return body;
    }

    if (r.type === 'halfRange') {
      const hrMode = this.halfRangeMode();
      const { a0, an, bn } = coeffs;
      if (hrMode === 'cosine') {
        const a0Float = r.data.coefficients.a0Float;
        const a0IsZero = a0Float === undefined || Math.abs(a0Float) < 1e-12;
        const anIsZero = !an || an === '0';

        if (anIsZero) return a0IsZero ? '0' : (a0 ?? '0');

        const body = `\\sum_{n=1}^{\\infty}${an}\\cos\\!\\left(${omega}\\right)`;
        if (!a0IsZero && a0) {
          const sep = body.startsWith('-') ? ' ' : ' + ';
          return `${a0}${sep}${body}`;
        }
        return body;
      }
      const bnIsZero = !bn || bn === '0';
      if (bnIsZero) return '0';
      return `\\sum_{n=1}^{\\infty}${bn}\\sin\\!\\left(${omega}\\right)`;
    }

    if (r.type === 'complex') {
      const { cn } = coeffs;
      const cnIsZero = !cn || cn === '0';
      if (cnIsZero) return '0';
      return `\\sum_{n=-\\infty}^{\\infty}\\left(${cn}\\right)e^{i${omega}}`;
    }

    return null;
  });

  // ── Validation ────────────────────────────────────────────────────────────
  readonly validation = computed(() => this.store.result()?.data.validation ?? null);

  readonly hasValidationWarning = computed(() => {
    const v = this.validation();
    return !!v && v.decision !== 'proceed';
  });

  // ── Typed term arrays for the terms tab ────────────────────────────────────
  readonly trigTerms = computed<TrigonometricTerm[] | null>(() => {
    const r = this.store.result();
    if (r?.type === 'trigonometric' || r?.type === 'halfRange') return r.terms.terms;
    return null;
  });

  readonly complexTerms = computed<ComplexTerm[] | null>(() => {
    const r = this.store.result();
    if (r?.type === 'complex') return r.terms.terms;
    return null;
  });

  /** Typed tabs array so the template gets literal types */
  readonly tabs: { id: 'coefficients' | 'terms' | 'validation'; label: string }[] = [
    { id: 'coefficients', label: 'Coeficientes' },
    { id: 'terms',        label: 'Términos'      },
    { id: 'validation',   label: 'Validación'    },
  ];

  /** Context for the terms tab — trig / half-range branch */
  readonly termsTrigCtx = computed(() => {
    const r = this.store.result();
    if (r?.type !== 'trigonometric' && r?.type !== 'halfRange') return null;
    const c = r.data.coefficients;
    return {
      a0Float: c.a0Float,
      a0Half:  c.a0Float !== undefined ? c.a0Float / 2 : undefined,
      a0Tex:   c.a0?.tex ?? null,
    };
  });

  /** Context for the terms tab — complex branch */
  readonly termsComplexCtx = computed(() => {
    const r = this.store.result();
    if (r?.type !== 'complex') return null;
    const c = r.data.coefficients;
    return {
      c0Float:    c.c0Float,
      c0FloatAbs: c.c0Float !== undefined ? Math.abs(c.c0Float) : undefined,
      c0Tex:      c.c0?.tex ?? null,
    };
  });

  readonly singularityLabels: Record<string, string | undefined> = {
    removible:        'Removible',
    salto:            'Salto',
    asintotica:       'Asintótica',
    esencial:         'Esencial',
    fuera_de_dominio: 'Fuera del dominio',
  };

  // ── Profile selector options ────────────────────────────────────────────────
  readonly profileOptions: { value: SimplifyProfile; label: string }[] = [
    { value: 'raw', label: 'Sin simp.' },
    { value: 'integer', label: 'Entero' },
    { value: 'trigonometric', label: 'Trig.' },
    { value: 'exponential', label: 'Exp.' },
    { value: 'complete', label: 'Completo' },
  ];

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  constructor() {
    // Reset all local state whenever a new result arrives; also fetch latest history entry for favorite
    effect(() => {
      const result = this.store.result();
      if (result) {
        this.activeTab.set('coefficients');
        this.simplifiedCoeffs.set(null);
        this.simplifyProfile.set('raw');
        this.halfRangeMode.set('cosine');
        this.showFavoriteDialog.set(false);
        this.latestHistoryEntry.set(null);
        this.favoriteName = '';

        // Pre-fetch the history entry so the star button can resolve immediately on click
        if (this.userStore.isAuthenticated()) {
          this.fetchLatestEntry();
        }
      }
    });

    // Track native fullscreen changes
    if (typeof document !== 'undefined') {
      const handler = () => this.isFullscreen.set(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handler);
      this.destroyRef.onDestroy(() => document.removeEventListener('fullscreenchange', handler));
    }
  }

  // ── Tab & mode actions ────────────────────────────────────────────────────

  setTab(tab: 'coefficients' | 'terms' | 'validation'): void {
    this.activeTab.set(tab);
  }

  setHalfRangeMode(mode: 'cosine' | 'sine'): void {
    this.halfRangeMode.set(mode);
    this.simplifiedCoeffs.set(null);
    this.simplifyProfile.set('raw');
  }

  // ── Canvas actions ────────────────────────────────────────────────────────

  toggleFullscreen(): void {
    const el = this.canvasWrapper()?.nativeElement;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }

  downloadCanvas(): void {
    const canvas = this.canvasWrapper()?.nativeElement?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fourier-series.png';
    a.click();
  }

  get shareHref(): string {
    return typeof window !== 'undefined' ? window.location.href : '';
  }

  openShareDialog(): void {
    this.showShareDialog.set(true);
  }

  async copyShareUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.urlCopied.set(true);
      setTimeout(() => this.urlCopied.set(false), 2000);
    } catch {
      // fallback: do nothing
    }
  }

  // ── Favorite actions ──────────────────────────────────────────────────────

  openFavoriteDialog(): void {
    const entry = this.latestHistoryEntry();
    if (entry) {
      this.doToggle(entry);
    } else {
      // Entry not loaded yet — fetch first, then toggle
      this.favoriteLoading.set(true);
      this.fetchLatestEntry(() => {
        this.favoriteLoading.set(false);
        const loaded = this.latestHistoryEntry();
        if (loaded) this.doToggle(loaded);
      });
    }
  }

  private fetchLatestEntry(callback?: () => void): void {
    this.api.getHistory({ limit: 1 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.latestHistoryEntry.set(res.entries[0] ?? null);
          callback?.();
        },
        error: () => callback?.(),
      });
  }

  private doToggle(entry: HistoryEntry): void {
    if (entry.isFavorite) {
      this.favoriteLoading.set(true);
      this.api.toggleFavorite(entry.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => { this.latestHistoryEntry.set(updated); this.favoriteLoading.set(false); },
          error: () => this.favoriteLoading.set(false),
        });
    } else {
      this.showFavoriteDialog.set(true);
    }
  }

  confirmFavorite(): void {
    const entry = this.latestHistoryEntry();
    if (!entry) return;
    this.favoriteLoading.set(true);
    this.showFavoriteDialog.set(false);
    this.api.toggleFavorite(entry.id, this.favoriteName.trim() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.latestHistoryEntry.set(updated);
          this.favoriteLoading.set(false);
          this.favoriteName = '';
        },
        error: () => this.favoriteLoading.set(false),
      });
  }

  cancelFavoriteDialog(): void {
    this.showFavoriteDialog.set(false);
    this.favoriteName = '';
  }

  // ── Simplify actions ──────────────────────────────────────────────────────

  setProfile(profile: SimplifyProfile): void {
    this.simplifyProfile.set(profile);
    if (profile === 'raw') {
      this.simplifiedCoeffs.set(null);
    } else {
      this.simplifyAll(profile);
    }
  }

  setExpFlag(flag: 'exponentialize' | 'demoivre'): void {
    this.expFlag.set(flag);
    if (this.simplifyProfile() === 'exponential') {
      this.simplifyAll('exponential', flag);
    }
  }

  simplifyAll(
    profile: SimplifyProfile,
    flag: 'exponentialize' | 'demoivre' = this.expFlag(),
  ): void {
    const result = this.store.result();
    if (!result) return;

    this.simplifying.set(true);

    const displayFlags =
      profile === 'exponential'
        ? flag === 'exponentialize'
          ? { exponentialize: true }
          : { demoivre: true }
        : undefined;

    const calls: Record<string, ReturnType<typeof this.api.simplify>> = {};

    if (result.type === 'trigonometric') {
      const c = result.data.coefficients;
      if (c.a0?.maxima)
        calls['a0'] = this.api.simplify({ expression: c.a0.maxima, profile, displayFlags });
      if (c.an?.maxima)
        calls['an'] = this.api.simplify({ expression: c.an.maxima, profile, displayFlags });
      if (c.bn?.maxima)
        calls['bn'] = this.api.simplify({ expression: c.bn.maxima, profile, displayFlags });
    } else if (result.type === 'halfRange') {
      const c = result.data.coefficients;
      const hrMode = this.halfRangeMode();
      if (hrMode === 'cosine') {
        if (c.a0?.maxima)
          calls['a0'] = this.api.simplify({ expression: c.a0.maxima, profile, displayFlags });
        if (c.an?.maxima)
          calls['an'] = this.api.simplify({ expression: c.an.maxima, profile, displayFlags });
      } else {
        if (c.bn?.maxima)
          calls['bn'] = this.api.simplify({ expression: c.bn.maxima, profile, displayFlags });
      }
    } else if (result.type === 'complex') {
      const c = result.data.coefficients;
      if (c.c0?.maxima)
        calls['c0'] = this.api.simplify({ expression: c.c0.maxima, profile, displayFlags });
      if (c.cn?.maxima)
        calls['cn'] = this.api.simplify({ expression: c.cn.maxima, profile, displayFlags });
    }

    if (Object.keys(calls).length === 0) {
      this.simplifying.set(false);
      return;
    }

    forkJoin(calls)
      .pipe(
        finalize(() => this.simplifying.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((responses) => {
        const simplified: Record<string, string> = {};
        for (const [key, res] of Object.entries(responses)) {
          simplified[key] = res.simplified.tex;
        }
        this.simplifiedCoeffs.set(simplified);
      });
  }
}
