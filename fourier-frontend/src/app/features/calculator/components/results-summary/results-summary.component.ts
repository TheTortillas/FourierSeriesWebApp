import {
  Component,
  computed,
  inject,
  signal,
  DestroyRef,
  effect,
  ElementRef,
  viewChild,
} from '@angular/core';
import { DecimalPipe, LowerCasePipe, NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, finalize, of, switchMap, map, catchError, Subject, takeUntil } from 'rxjs';
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
import { ThemeService } from '../../../../core/services/theme/theme.service';
import { SpectrumChartComponent } from '../../../../shared/components/spectrum-chart/spectrum-chart.component';
import type { ParamValues } from '../../../../shared/components/param-sliders/param-sliders.component';
import { SimplifyProfile, HistoryEntry } from '../../../../domain';
import {
  TrigonometricTerm,
  ComplexTerm,
  ParsevalTrig,
  ParsevalHalfRange,
  ParsevalComplex,
  SingularTerm,
} from '../../../../domain/types/fourier.types';
import type { SymbolicExpression } from '../../../../domain/types/common.types';
import { ExportButtonComponent } from '../../../../shared/components/export-button/export-button.component';
import { CsvExportService } from '../../../../core/services/csv-export.service';

/** Cycling hue palette for individual harmonics */
interface SeriesColorPreset {
  original: string;
  approx: string;
  harmonics: string[];
}

function getSeriesColorPreset(isDark: boolean, isNeutral: boolean): SeriesColorPreset {
  if (!isNeutral && !isDark) {
    return {
      original: '#8b2500',
      approx: '#1a4a6b',
      harmonics: [
        'hsla(217, 70%, 55%, 0.55)',
        'hsla(145, 60%, 45%, 0.55)',
        'hsla(38, 80%, 50%, 0.55)',
        'hsla(270, 60%, 60%, 0.55)',
        'hsla(0, 70%, 55%, 0.55)',
        'hsla(185, 65%, 45%, 0.55)',
        'hsla(320, 60%, 55%, 0.55)',
        'hsla(60, 70%, 45%, 0.55)',
      ],
    };
  }

  if (!isNeutral && isDark) {
    return {
      original: '#e0ad74',
      approx: '#79b6de',
      harmonics: [
        'hsla(210, 85%, 72%, 0.62)',
        'hsla(145, 65%, 58%, 0.62)',
        'hsla(36, 90%, 62%, 0.62)',
        'hsla(280, 70%, 72%, 0.62)',
        'hsla(0, 80%, 68%, 0.62)',
        'hsla(185, 75%, 62%, 0.62)',
        'hsla(325, 70%, 70%, 0.62)',
        'hsla(60, 80%, 62%, 0.62)',
      ],
    };
  }

  if (isNeutral && !isDark) {
    return {
      original: '#2563eb',
      approx: '#0f766e',
      harmonics: [
        'hsla(217, 78%, 52%, 0.5)',
        'hsla(162, 70%, 35%, 0.5)',
        'hsla(280, 60%, 55%, 0.5)',
        'hsla(29, 92%, 48%, 0.5)',
        'hsla(348, 78%, 50%, 0.5)',
        'hsla(198, 80%, 42%, 0.5)',
        'hsla(83, 62%, 42%, 0.5)',
        'hsla(44, 90%, 45%, 0.5)',
      ],
    };
  }

  return {
    original: '#60a5fa',
    approx: '#2dd4bf',
    harmonics: [
      'hsla(213, 90%, 72%, 0.62)',
      'hsla(168, 80%, 60%, 0.62)',
      'hsla(280, 80%, 72%, 0.62)',
      'hsla(32, 95%, 65%, 0.62)',
      'hsla(350, 90%, 72%, 0.62)',
      'hsla(190, 88%, 66%, 0.62)',
      'hsla(96, 75%, 62%, 0.62)',
      'hsla(48, 95%, 66%, 0.62)',
    ],
  };
}

@Component({
  selector: 'app-results-summary',
  imports: [
    DecimalPipe,
    LowerCasePipe,
    NgTemplateOutlet,
    FunctionPlotComponent,
    MathjaxDirective,
    FormsModule,
    SpectrumChartComponent,
    TranslocoPipe,
    ExportButtonComponent,
  ],
  templateUrl: './results-summary.component.html',
})
export class ResultsSummaryComponent {
  readonly Math = Math;
  readonly store = inject(CalculatorStore);
  private readonly transloco = inject(TranslocoService);
  readonly reconstruction = inject(FourierReconstructionService);
  readonly plotter = inject(PlottingService);
  private readonly math = inject(MathUtilsService);
  readonly api = inject(ApiService);
  readonly userStore = inject(UserStore);
  readonly theme = inject(ThemeService);
  readonly destroyRef = inject(DestroyRef);
  private readonly csvExport = inject(CsvExportService);

  readonly isMobile = signal(typeof window !== 'undefined' && window.innerWidth < 1024);

  // ── Free-parameter sliders ────────────────────────────────────────────────
  readonly activeParams = computed<string[]>(() => this.store.result()?.data.params ?? []);

  /** Lives in the store so the left-panel sliders and the canvas share the same values. */
  readonly paramValues = this.store.paramValues;

  /** Parameters used for numeric evaluation on canvas (default = 1 for missing sliders). */
  readonly evaluationParams = computed<ParamValues>(() => {
    const names = this.activeParams();
    const pv = this.paramValues();
    const merged: ParamValues = { ...pv };
    for (const name of names) {
      if (!Number.isFinite(merged[name])) merged[name] = 1;
    }
    return merged;
  });

  /** Name of the param currently used for the custom axis unit (null = first param). */
  readonly customConstName = signal<string | null>(null);

  /** Axis constant used when xAxisFormat === 'custom'. */
  readonly customConst = computed(() => {
    const params = this.activeParams();
    const pv = this.paramValues();
    const name = this.customConstName() ?? params[0];
    if (!name) return { symbol: 'T', value: 1 };
    return { symbol: name, value: pv[name] ?? 1 };
  });

  // ── Canvas settings ──────────────────────────────────────────────────────
  readonly xAxisFormat = signal<'pi' | 'e' | 'integer' | 'custom'>('pi');
  readonly showHarmonics = signal(false);
  readonly showDcHarmonic = signal(true);
  readonly controlHarmonics = signal(false);
  readonly enabledHarmonics = signal<Set<number>>(new Set<number>());
  readonly selectedHarmonicN = signal<number | null>(null);
  readonly originalColor = signal('#8b2500');
  readonly approxColor = signal('#1a4a6b');
  readonly customOriginalColor = signal(false);
  readonly customApproxColor = signal(false);
  readonly originalLineWidth = signal(2.5);
  readonly approxLineWidth = signal(1.75);
  readonly originalDashed = signal(false);
  readonly approxDashed = signal(false);
  readonly showCanvasSettings = signal(false);

  // ── Per-param slider ranges (editable in side panel) ─────────────────────
  readonly paramRanges = signal<Record<string, { min: number; max: number }>>({});

  paramSliderMin(name: string): number { return this.paramRanges()[name]?.min ?? -5; }
  paramSliderMax(name: string): number { return this.paramRanges()[name]?.max ?? 5; }

  setParamMin(name: string, value: number): void {
    if (!isFinite(value)) return;
    this.paramRanges.update(r => ({ ...r, [name]: { min: value, max: r[name]?.max ?? 5 } }));
  }

  setParamMax(name: string, value: number): void {
    if (!isFinite(value)) return;
    this.paramRanges.update(r => ({ ...r, [name]: { min: r[name]?.min ?? -5, max: value } }));
  }

  onParamSliderInput(name: string, value: number): void {
    if (!isFinite(value)) return;
    this.store.paramValues.update(pv => ({ ...pv, [name]: value }));
  }
  readonly canvasNTerms = signal(10);
  readonly hadResult = signal(false);
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
  readonly simplifiedCoeffsMaxima = signal<Record<string, string> | null>(null);
  readonly simplifiedFactored = signal<Record<string, { k: string; s: string; kMx: string } | null> | null>(
    null,
  );
  readonly showFactoredSeries = signal(false);
  readonly showGammaNotation = signal(false);

  /** True when the backend stored gamma_incomplete alternatives in simplifications. */
  readonly hasGammaAlternatives = computed(() => {
    const result = this.store.result();
    if (!result) return false;
    const s = result.data.simplifications;
    return !!s && Object.keys(s).some(k => k.endsWith('_gamma'));
  });

  // exponential sub-flags (only relevant when profile === 'exponential')
  readonly expFlag = signal<'exponentialize' | 'demoivre'>('exponentialize');
  readonly useEdispflag = signal(false);
  readonly erfRepresentationOptions = ['erf', 'erfc', 'erfi'] as const;
  readonly erfRepresentation = signal<'erf' | 'erfc' | 'erfi'>('erf');
  readonly declareNInteger = signal(true);
  readonly toHyperbolic = signal(false);

  // half-range series mode (only relevant when result.type === 'halfRange')
  readonly halfRangeMode = signal<'cosine' | 'sine'>('cosine');

  /** Computed: check if we have spectrum data (terms loaded) */
  readonly hasSpectrumData = computed(() => {
    const result = this.store.result();
    if (!result) return false;
    if (result.type === 'complex') return (result.terms as any)?.terms?.length > 0;
    if (result.type === 'trigonometric' || result.type === 'halfRange') {
      return (result.terms as any)?.terms?.length > 0;
    }
    return false;
  });

  readonly maxCanvasTerms = computed(() => {
    const result = this.store.result();
    if (!result) return this.store.nTerms();
    return result.terms?.terms?.length ?? this.store.nTerms();
  });

  readonly visibleHarmonicNumbers = computed<number[]>(() => {
    const result = this.store.result();
    if (!result) return [];
    const nLimit = this.canvasNTerms();
    return result.terms.terms.map((t) => t.n).filter((n) => n <= nLimit);
  });

  readonly allVisibleHarmonicsChecked = computed(() => {
    if (!this.controlHarmonics()) return true;
    const visible = this.visibleHarmonicNumbers();
    if (visible.length === 0) return true;
    const enabled = this.enabledHarmonics();
    return visible.every((n) => enabled.has(n));
  });

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

  /**
   * Evaluates a Maxima K-factor string to a finite number.
   * Handles trig/hyperbolic/exp functions so that format-independent numeric
   * comparison can be used instead of string matching.
   * Returns NaN when K is symbolic (e.g. contains free parameters).
   */
  private evalKMx(mx: string): number {
    if (!mx.trim()) return NaN;
    try {
      const js = mx.trim()
        .replace(/%pi\b/g, String(Math.PI))
        .replace(/%e\b/g, String(Math.E))
        .replace(/\^/g, '**')
        .replace(/\bsinh\b/g, 'Math.sinh')
        .replace(/\bcosh\b/g, 'Math.cosh')
        .replace(/\btanh\b/g, 'Math.tanh')
        .replace(/\bsin\b/g, 'Math.sin')
        .replace(/\bcos\b/g, 'Math.cos')
        .replace(/\btan\b/g, 'Math.tan')
        .replace(/\bsqrt\b/g, 'Math.sqrt')
        .replace(/\babs\b/g, 'Math.abs')
        .replace(/\blog\b/g, 'Math.log')
        .replace(/\bexp\b/g, 'Math.exp');
      // eslint-disable-next-line no-new-func
      const v = new Function(`return (${js})`)() as number;
      return isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  }

  /** Best-effort scalar evaluation for symbolic coefficients (a0/c0) under current params. */
  private evalScalar(maxima?: string, fallback?: number): number | undefined {
    if (maxima?.trim()) {
      const fn = this.math.compile(maxima, '_', this.evaluationParams());
      const v = fn?.(0);
      if (v !== undefined && isFinite(v)) return v;
    }
    return fallback !== undefined && isFinite(fallback) ? fallback : undefined;
  }

  private maximaExprToTex(expr: string): string {
    const trimmed = expr.trim();
    if (!trimmed) return '0';

    return trimmed
      .replace(/%pi\b/g, '\\pi')
      .replace(/%e\b/g, 'e')
      .replace(/\*/g, '\\,')
      .replace(/\s+/g, '')
      .replace(/\(/g, '\\left(')
      .replace(/\)/g, '\\right)');
  }

  private formatHalfRangeShiftTex(intVar: string, from: string): string {
    const raw = from.trim();
    if (!raw || raw === '0') return intVar;

    const normalized = raw.replace(/^\(+|\)+$/g, '');
    const negative = normalized.startsWith('-');
    const core = negative ? normalized.slice(1).trim() : normalized;
    const rendered = this.maximaExprToTex(core);

    return negative ? `${intVar} + ${rendered}` : `${intVar} - ${rendered}`;
  }

  /** Canvas layers: original function + harmonics + Fourier approximation */
  readonly layers = computed<PlotLayer[]>(() => {
    const result = this.store.result();
    const previews = this.store.previewFunctions();
    const nTerms = Math.min(this.canvasNTerms(), this.maxCanvasTerms());
    const hrMode = this.halfRangeMode();
    const plotter = this.plotter;
    const math = this.math;
    const rec = this.reconstruction;
    const showHarmonics = this.showHarmonics();
    const controlHarmonics = this.controlHarmonics();
    const enabledHarmonics = this.enabledHarmonics();
    const origColor = this.originalColor();
    const approxColorVal = this.approxColor();
    const harmonicColors = this.harmonicColors();
    const origWidth = this.originalLineWidth();
    const approxWidth = this.approxLineWidth();
    const origDashed = this.originalDashed();
    const approxDashed = this.approxDashed();
    const isHarmonicEnabled = (n: number) => !controlHarmonics || enabledHarmonics.has(n);

    // If free params are set, re-compile the original segments with those values
    // so the canvas reflects the chosen parameter configuration.
    const pv = this.evaluationParams();
    const hasPv = Object.keys(pv).length > 0;
    const segs = hasPv ? this.store.segments() : null;
    const intVar = hasPv ? this.store.intVar() : null;
    const origFns =
      hasPv && segs && intVar
        ? segs.map((s, i) => {
            const fromFn = math.compile(s.from, '_', pv);
            const toFn = math.compile(s.to, '_', pv);
            const fromV = fromFn?.(0);
            const toV = toFn?.(0);
            return {
              fn: math.compile(s.expression, intVar, pv),
              from: fromV !== undefined && isFinite(fromV) ? fromV : (previews[i]?.from ?? NaN),
              to: toV !== undefined && isFinite(toV) ? toV : (previews[i]?.to ?? NaN),
            };
          })
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
                  dashed: origDashed,
                });
              }
            }
          },
        },
      ];
    }

    const w0Base = rec.parseW0(result.data.w0.maxima);
    const w0fn = hasPv ? math.compile(result.data.w0.maxima, '_', pv) : null;
    const w0v = w0fn?.(0);
    const w0 = w0v !== undefined && isFinite(w0v) ? w0v : w0Base;

    let approxFn: ((x: number) => number) | null = null;
    let harmonicFns: Array<{ n: number; fn: (x: number) => number }> = [];
    let dcHarmonicValue: number | null = null;

    if (result.type === 'trigonometric') {
      const rawTerms = result.terms.terms as TrigNumericTerm[];
      const c = result.data.coefficients;
      const a0Raw =
        this.evalScalar(result.data.a0Raw?.maxima, c.a0Float) ??
        (this.evalScalar(c.a0?.maxima, undefined) ?? 0) * 2;
      dcHarmonicValue = a0Raw / 2;
      let terms = rawTerms;
      if (hasPv) {
        const anFn = c.an?.maxima ? math.compile(c.an.maxima, 'n', pv) : null;
        const bnFn = c.bn?.maxima ? math.compile(c.bn.maxima, 'n', pv) : null;
        if (anFn || bnFn) {
          terms = rawTerms.map((t) => {
            const anv = anFn?.(t.n);
            const bnv = bnFn?.(t.n);
            return {
              ...t,
              anFloat: anv !== undefined && isFinite(anv) ? anv : t.anFloat,
              bnFloat: bnv !== undefined && isFinite(bnv) ? bnv : t.bnFloat,
            };
          });
        }
      }
      const activeTerms = terms.filter((t) => t.n <= nTerms && isHarmonicEnabled(t.n));
      approxFn = rec.buildTrigonometric(a0Raw, activeTerms, w0, activeTerms.length);
      if (showHarmonics) {
        harmonicFns = activeTerms.map((t) => {
          const { n, anFloat, bnFloat } = t;
          return {
            n,
            fn: (x: number) => anFloat * Math.cos(n * w0 * x) + bnFloat * Math.sin(n * w0 * x),
          };
        });
      }
    } else if (result.type === 'halfRange') {
      const rawTerms = result.terms.terms as TrigNumericTerm[];
      const c = result.data.coefficients;
      const originX = this.evalScalar(result.data.input.segments[0]?.from, undefined) ?? 0;
      let terms = rawTerms;
      if (hasPv) {
        const anFn = c.an?.maxima ? math.compile(c.an.maxima, 'n', pv) : null;
        const bnFn = c.bn?.maxima ? math.compile(c.bn.maxima, 'n', pv) : null;
        if (anFn || bnFn) {
          terms = rawTerms.map((t) => {
            const anv = anFn?.(t.n);
            const bnv = bnFn?.(t.n);
            return {
              ...t,
              anFloat: anv !== undefined && isFinite(anv) ? anv : t.anFloat,
              bnFloat: bnv !== undefined && isFinite(bnv) ? bnv : t.bnFloat,
            };
          });
        }
      }
      const activeTerms = terms.filter((t) => t.n <= nTerms && isHarmonicEnabled(t.n));
      if (hrMode === 'cosine') {
        const a0Raw =
          this.evalScalar(result.data.a0Raw?.maxima, c.a0Float) ??
          (this.evalScalar(c.a0?.maxima, undefined) ?? 0) * 2;
        dcHarmonicValue = a0Raw / 2;
        approxFn = rec.buildCosineOnly(a0Raw, activeTerms, w0, {
          originX,
          nMax: activeTerms.length,
        });
        if (showHarmonics) {
          harmonicFns = activeTerms.map((t) => {
            const { n, anFloat } = t;
            return { n, fn: (x: number) => anFloat * Math.cos(n * w0 * (x - originX)) };
          });
        }
      } else {
        approxFn = rec.buildSineOnly(activeTerms, w0, {
          originX,
          nMax: activeTerms.length,
        });
        if (showHarmonics) {
          harmonicFns = activeTerms.map((t) => {
            const { n, bnFloat } = t;
            return { n, fn: (x: number) => bnFloat * Math.sin(n * w0 * (x - originX)) };
          });
        }
      }
    } else if (result.type === 'complex') {
      const rawTerms = result.terms.terms as ComplexTerm[];
      const c = result.data.coefficients;
      const c0 = this.evalScalar(c.c0?.maxima, c.c0Float ?? this.parseMaxima(c.c0.maxima)) ?? 0;
      dcHarmonicValue = c0;
      // Re-evaluate cosFloat/sinFloat with current param values, same logic as spectrumComplexTerms
      let terms: ComplexNumericTerm[] = rawTerms;
      if (hasPv) {
        // Re(cn*e^{inw0x} + c-n*e^{-inw0x}) = 2*Re(cn)*cos(nw0x) - 2*Im(cn)*sin(nw0x)
        // cnRe and cnIm are Re(cn) and Im(cn) as pure-real symbolic expressions (no %i)
        terms = rawTerms.map((t) => {
          if (!t.cnRe && !t.cnIm) return t;
          const reFn = t.cnRe ? math.compile(t.cnRe, '_', pv) : null;
          const imFn = t.cnIm ? math.compile(t.cnIm, '_', pv) : null;
          const reV = reFn?.(0);
          const imV = imFn?.(0);
          const cosV = reV !== undefined && isFinite(reV) ? 2 * reV : null;
          const sinV = imV !== undefined && isFinite(imV) ? -2 * imV : null;
          return {
            ...t,
            cosFloat: cosV !== null ? cosV : t.cosFloat,
            sinFloat: sinV !== null ? sinV : t.sinFloat,
          };
        });
      }
      const activeTerms = terms.filter((t) => t.n <= nTerms && isHarmonicEnabled(t.n));
      approxFn = rec.buildComplex(c0, activeTerms, w0, activeTerms.length);
      if (showHarmonics) {
        harmonicFns = activeTerms.map((t) => {
          const { n, cosFloat, sinFloat } = t;
          return {
            n,
            fn: (x: number) => cosFloat * Math.cos(n * w0 * x) + sinFloat * Math.sin(n * w0 * x),
          };
        });
      }
    }

    const localApprox = approxFn;
    const localHarmonics = harmonicFns;
    const selectedN = this.selectedHarmonicN();
    const showDc = this.showDcHarmonic() && showHarmonics;
    const dcValue = dcHarmonicValue;

    return [
      {
        curves: [],
        onDraw(ctx, vp) {
          // Harmonics (drawn first, behind everything)
          if (showDc && dcValue !== null && isFinite(dcValue) && Math.abs(dcValue) > 1e-10) {
            plotter.plotFn(ctx, () => dcValue, vp, {
              color: 'rgba(148, 163, 184, 0.78)',
              lineWidth: 1.3,
            });
          }
          for (let i = 0; i < localHarmonics.length; i++) {
            const harmonic = localHarmonics[i];
            const isSelected = selectedN === harmonic.n;
            const isDimmed = selectedN !== null && !isSelected;
            plotter.plotFn(ctx, harmonic.fn, vp, {
              color: isDimmed
                ? 'rgba(100, 116, 139, 0.22)'
                : harmonicColors[(harmonic.n - 1) % harmonicColors.length],
              lineWidth: isSelected ? 2.2 : 1,
            });
          }
          // Original function (bounded to piece intervals)
          for (const { fn, from, to } of origFns) {
            if (fn && isFinite(from) && isFinite(to)) {
              plotter.plotFnRange(ctx, fn, from, to, 400, vp, {
                color: origColor,
                lineWidth: origWidth,
                dashed: origDashed,
              });
            }
          }
          // Fourier approximation (fills visible range)
          if (localApprox) {
            plotter.plotFn(ctx, localApprox, vp, { color: approxColorVal, lineWidth: approxWidth, dashed: approxDashed });
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

  /**
   * Factored series LaTeX: K · Σ(summand · sin/cos/exp).
   * Only shown in raw profile (K is always from the raw computation).
   * Only shown when one coefficient dominates (an=0 or bn=0 for trig).
   */
  readonly factoredSeriesTex = computed(() => {
    const result = this.store.result();
    if (!result) return null;

    type FEntry = { k: string; s: string; kMx?: string } | null;

    // simplifiedFactored has priority; fall back to raw coeffFactoredTex
    const simplFact = this.simplifiedFactored();
    const rawFact = this.coeffFactoredTex();

    const pick = (key: string): FEntry => {
      if (simplFact && key in simplFact) return simplFact[key];
      if (rawFact) return (rawFact as unknown as Record<string, FEntry>)[key] ?? null;
      return null;
    };

    // Normalize sign convention: K always carries the sign, summand is unsigned.
    // The backend (after simplification) sometimes returns positive K with a
    // negative summand (e.g. 6/π · Σ(-((-1)^n−1)/n)). This absorbs the leading
    // minus from the summand into K so the display is -6/π · Σ(((-1)^n−1)/n).
    const normalize = (f: FEntry): FEntry => {
      if (!f) return null;
      const s = f.s.trimStart();
      if (!s.startsWith('-')) return f;
      const posS = s.slice(1).trimStart();
      const k = f.k.trimStart();
      const negK = k.startsWith('-') ? k.slice(1).trimStart() : `-${f.k}`;
      return { k: negK, s: posS, kMx: f.kMx };
    };

    const intVar = result.data.input.intVar ?? 'x';
    const w0Tex = result.data.w0.tex;
    const w0IsOne = w0Tex === '1';

    const activeA0Tex = this.activeCoeffTex()?.a0;
    const withA0Prefix = (rawA0Tex: string | undefined, sumTex: string): string => {
      const a0Tex = activeA0Tex ?? rawA0Tex;
      const a0IsZero = !a0Tex || a0Tex.trim() === '0';
      if (a0IsZero) return sumTex;
      const sumStartsNegative = sumTex.trimStart().startsWith('-');
      return `${a0Tex}${sumStartsNegative ? '' : '+'}${sumTex}`;
    };

    const activeMx = this.activeCoeffMaxima();

    if (result.type === 'trigonometric') {
      const c = result.data.coefficients;
      const anIsZero = (activeMx?.an ?? c.an?.maxima ?? '').trim() === '0';
      const bnIsZero = (activeMx?.bn ?? c.bn?.maxima ?? '').trim() === '0';
      const om = w0IsOne ? `n\\,${intVar}` : `n\\,${w0Tex}\\,${intVar}`;

      if (anIsZero) {
        const f = normalize(pick('bn'));
        if (f) {
          const sumTex = `${f.k}\\cdot\\sum_{n=1}^{\\infty}\\left(${f.s}\\right)\\sin\\!\\left(${om}\\right)`;
          return withA0Prefix(c.a0?.tex, sumTex);
        }
      } else if (bnIsZero) {
        const f = normalize(pick('an'));
        if (f) {
          const sumTex = `${f.k}\\cdot\\sum_{n=1}^{\\infty}\\left(${f.s}\\right)\\cos\\!\\left(${om}\\right)`;
          return withA0Prefix(c.a0?.tex, sumTex);
        }
      } else {
        // Both non-zero: show K·Σ(sₐ·cos ± s_b·sin) when they share the same K magnitude
        const fa = pick('an');
        const fb = pick('bn');
        if (fa && fb) {
          const faMx = fa.kMx ?? '';
          const fbMx = fb.kMx ?? '';

          // Primary: numeric comparison — format-independent, handles sinh/cosh/sqrt/etc.
          const faNum = this.evalKMx(faMx);
          const fbNum = this.evalKMx(fbMx);

          let kSame: boolean;
          let kOpposite: boolean;
          let faIsNeg: boolean;
          let nonTrivialK: boolean;

          if (isFinite(faNum) && isFinite(fbNum) && Math.abs(faNum) > 1e-12) {
            const tol = Math.abs(faNum) * 1e-9;
            kSame     = Math.abs(faNum - fbNum) < tol;
            kOpposite = !kSame && Math.abs(faNum + fbNum) < tol;
            faIsNeg   = faNum < 0;
            nonTrivialK = Math.abs(Math.abs(faNum) - 1) > 1e-9;
          } else {
            // Fallback: normalized string comparison (strips leading minus + outer parens)
            const stripSign = (s: string): string => {
              const t = s.trim();
              if (!t.startsWith('-')) return t;
              const rest = t.slice(1).trim();
              return rest.startsWith('(') && rest.endsWith(')') ? rest.slice(1, -1).trim() : rest;
            };
            const isNegStr = (s: string): boolean => s.trim().startsWith('-');
            const src = (mx: string, tex: string): string => mx || tex.trimStart();
            const faMag   = stripSign(src(faMx, fa.k));
            const fbMag   = stripSign(src(fbMx, fb.k));
            faIsNeg       = isNegStr(src(faMx, fa.k));
            const fbIsNeg = isNegStr(src(fbMx, fb.k));
            kSame       = faMag === fbMag && faIsNeg === fbIsNeg;
            kOpposite   = faMag === fbMag && faIsNeg !== fbIsNeg;
            nonTrivialK = faMag !== '1';
          }

          if ((kSame || kOpposite) && nonTrivialK) {
            let commonK: string;
            let anS: string;
            let bnS: string;

            if (kSame) {
              commonK = fa.k; anS = fa.s; bnS = fb.s;
            } else {
              // Use the positive K as commonK; negate the summand of the negative-K coefficient
              commonK = faIsNeg ? fb.k : fa.k;
              anS     = faIsNeg ? `-${fa.s}` : fa.s;
              bnS     = faIsNeg ? fb.s : `-${fb.s}`;
            }

            const bnNeg    = bnS.trimStart().startsWith('-');
            const connector  = bnNeg ? '-' : '+';
            const bnDisplay  = bnNeg ? bnS.trimStart().replace(/^-\s*/, '') : bnS;
            const sumTex = `${commonK}\\cdot\\sum_{n=1}^{\\infty}\\left(${anS}\\,\\cos\\!\\left(${om}\\right)${connector}${bnDisplay}\\,\\sin\\!\\left(${om}\\right)\\right)`;
            return withA0Prefix(c.a0?.tex, sumTex);
          }
        }
      }
      return null;
    }

    if (result.type === 'halfRange') {
      const hrMode = this.halfRangeMode();
      const c = result.data.coefficients;
      const originFrom = result.data.input.segments[0]?.from ?? '0';
      const shiftedVar = this.formatHalfRangeShiftTex(intVar, originFrom);
      const shiftedOmega = w0IsOne
        ? `n\\,${shiftedVar}`
        : `n\\,${w0Tex}\\,\\left(${shiftedVar}\\right)`;

      if (hrMode === 'cosine') {
        const anIsZero = (activeMx?.an ?? c.an?.maxima ?? '').trim() === '0';
        if (!anIsZero) {
          const f = normalize(pick('an'));
          if (f) {
            const sumTex = `${f.k}\\cdot\\sum_{n=1}^{\\infty}\\left(${f.s}\\right)\\cos\\!\\left(${shiftedOmega}\\right)`;
            return withA0Prefix(c.a0?.tex, sumTex);
          }
        }
      } else {
        const bnIsZero = (activeMx?.bn ?? c.bn?.maxima ?? '').trim() === '0';
        if (!bnIsZero) {
          const f = normalize(pick('bn'));
          if (f)
            return `${f.k}\\cdot\\sum_{n=1}^{\\infty}\\left(${f.s}\\right)\\sin\\!\\left(${shiftedOmega}\\right)`;
        }
      }
      return null;
    }

    if (result.type === 'complex') {
      const c = result.data.coefficients;
      const cnIsZero = (activeMx?.cn ?? c.cn?.maxima ?? '').trim() === '0';
      if (!cnIsZero) {
        const f = normalize(pick('cn'));
        const om = w0IsOne ? `n\\,${intVar}` : `n\\,${w0Tex}\\,${intVar}`;
        if (f) return `${f.k}\\cdot\\sum_{n=-\\infty}^{\\infty}\\left(${f.s}\\right)e^{i${om}}`;
      }
      return null;
    }

    return null;
  });

  /**
   * Builds the RHS of the Parseval identity as TeX.
   * When singular terms exist, renders an explicit split:
   *   Σ_{n=1}^{k₁-1}(s) + V₁ + Σ_{n=k₁+1}^{k₂-1}(s) + V₂ + Σ_{n=k₂+1}^∞(s)
   * When there are none, renders a plain Σ_{n=1}^∞(s).
   */
  private buildSplitSumTex(s: string, singularTerms: SingularTerm[]): string {
    if (!singularTerms.length) return `\\sum_{n=1}^{\\infty}\\left(${s}\\right)`;

    const sorted = [...singularTerms].sort((a, b) => a.n - b.n);
    const parts: string[] = [];
    let lo = 1;

    for (const term of sorted) {
      if (term.n > lo) {
        const hi = term.n - 1;
        parts.push(`\\sum_{n=${lo}}^{${hi}}\\left(${s}\\right)`);
      }
      parts.push(`\\underbrace{${term.tex || '0'}}_{\\lim_{n\\to ${term.n}}}`);
      lo = term.n + 1;
    }

    parts.push(`\\sum_{n=${lo}}^{\\infty}\\left(${s}\\right)`);
    return parts.join('+');
  }

  /**
   * Builds the RHS for the bilateral sum (n ∈ ℤ, n ≠ 0).
   * Since |cₙ|² = |c₋ₙ|² (even summand), each singular pair n = ±k
   * contributes 2·V_k. The remaining sum excludes 0 and all ±k.
   */
  private buildBilateralSumTex(s: string, singularTerms: SingularTerm[]): string {
    if (!singularTerms.length) {
      return `\\sum_{\\substack{n=-\\infty \\\\ n\\neq 0}}^{\\infty}\\!\\left(${s}\\right)`;
    }

    const sorted = [...singularTerms].sort((a, b) => a.n - b.n);
    const excl = ['0', ...sorted.map(t => `{\\pm ${t.n}}`)].join(',\\,');
    const remainingSum = `\\sum_{\\substack{n=-\\infty \\\\ n\\notin\\{${excl}\\}}}^{\\infty}\\!\\left(${s}\\right)`;

    const singParts = sorted.map(t => {
      const val = t.tex2x ?? `2\\!\\left(${t.tex || '0'}\\right)`;
      return `\\underbrace{${val}}_{\\lim_{|n|\\to ${t.n}}}`;
    });
    return [...singParts, remainingSum].join('+');
  }

  /** Parseval identity LaTeX — two views: formal (sum from 1) or simplified (split or plain).
   *  Complex series additionally supports bilateral (n ∈ ℤ, n ≠ 0) vs unilateral (n ≥ 1). */
  readonly parsevalTex = computed(() => {
    const result = this.store.result();
    const p = this.parsevalData();
    if (!result || !p) return null;

    const view = this.parsevalView();
    const lhsOverride = this.parsevalSimplifiedLhsFinal();
    const summandOverride = this.parsevalSimplifiedSummand();
    const isBilateral = result.type === 'complex' && this.parsevalComplexSumForm() === 'bilateral';

    const fmtSimplified = (
      lhsFinal: string,
      s: string,
      singularTerms: SingularTerm[],
    ): string => {
      const rhsTex = this.buildSplitSumTex(summandOverride ?? s, singularTerms);
      return `${lhsOverride ?? lhsFinal}=${rhsTex}`;
    };

    const fmtFormal = (lhsFinal: string, s: string): string =>
      `${lhsFinal}=\\sum_{n=1}^{\\infty}\\left(${s}\\right)`;

    const fmtBilateral = (lhsFinal: string, s: string, singularTerms: SingularTerm[]): string => {
      const rhsTex = this.buildBilateralSumTex(summandOverride ?? s, singularTerms);
      return `${lhsOverride ?? lhsFinal}=${rhsTex}`;
    };

    if (result.type === 'trigonometric') {
      const pt = p as ParsevalTrig;
      if (view === 'formal' && pt.formal) return fmtFormal(pt.formal.lhsFinal.tex, pt.formal.summand.tex);
      return fmtSimplified(pt.lhsFinal.tex, pt.summand.tex, pt.singularTerms ?? []);
    }

    if (result.type === 'halfRange') {
      const ph = p as ParsevalHalfRange;
      const hrMode = this.halfRangeMode();
      if (hrMode === 'cosine') {
        if (view === 'formal' && ph.cosine.formal) return fmtFormal(ph.cosine.formal.lhsFinal.tex, ph.cosine.formal.summand.tex);
        return fmtSimplified(ph.cosine.lhsFinal.tex, ph.cosine.summand.tex, ph.cosine.singularTerms ?? []);
      } else {
        if (view === 'formal' && ph.sine.formal) return fmtFormal(ph.sine.formal.lhsFinal.tex, ph.sine.formal.summand.tex);
        return fmtSimplified(ph.sine.lhsFinal.tex, ph.sine.summand.tex, ph.sine.singularTerms ?? []);
      }
    }

    if (result.type === 'complex') {
      const pc = p as ParsevalComplex;
      if (isBilateral && pc.bilateral) {
        const bil = pc.bilateral;
        if (view === 'formal' && bil.formal) {
          return fmtBilateral(bil.formal.lhsFinal.tex, pc.formal?.summand.tex ?? pc.summand.tex, pc.singularTerms ?? []);
        }
        return fmtBilateral(bil.lhsFinal.tex, pc.summand.tex, pc.singularTerms ?? []);
      }
      if (view === 'formal' && pc.formal) return fmtFormal(pc.formal.lhsFinal.tex, pc.formal.summand.tex);
      return fmtSimplified(pc.lhsFinal.tex, pc.summand.tex, pc.singularTerms ?? []);
    }

    return null;
  });

  readonly parsevalSingValsLabel = computed(() => {
    const vals = this.parsevalSingVals();
    if (!vals.length) return '';
    if (vals.length === 1) return `n=${vals[0]}`;
    return `n∈{${vals.join(', ')}}`;
  });

  readonly parsevalHasFormal = computed(() => {
    const result = this.store.result();
    const p = this.parsevalData();
    if (!result || !p) return false;
    if (result.type === 'trigonometric') return !!(p as ParsevalTrig).formal;
    if (result.type === 'complex') return !!(p as ParsevalComplex).formal;
    if (result.type === 'halfRange') {
      const ph = p as ParsevalHalfRange;
      return this.halfRangeMode() === 'cosine' ? !!ph.cosine.formal : !!ph.sine.formal;
    }
    return false;
  });

  readonly parsevalHasBilateral = computed(() => {
    const result = this.store.result();
    const p = this.parsevalData();
    if (!result || !p) return false;
    return result.type === 'complex' && !!(p as ParsevalComplex).bilateral;
  });

  readonly parsevalSingVals = computed((): number[] => {
    const result = this.store.result();
    const p = this.parsevalData();
    if (!result || !p) return [];
    if (result.type === 'trigonometric') return (p as ParsevalTrig).singVals ?? [];
    if (result.type === 'complex') return (p as ParsevalComplex).singVals ?? [];
    if (result.type === 'halfRange') {
      const ph = p as ParsevalHalfRange;
      return (this.halfRangeMode() === 'cosine' ? ph.cosine.singVals : ph.sine.singVals) ?? [];
    }
    return [];
  });

  /** Whether the current Parseval identity has singular terms (sum starts at n > 1). */
  readonly parsevalHasSingular = computed(() => {
    const result = this.store.result();
    const p = this.parsevalData();
    if (!result || !p) return false;
    if (result.type === 'trigonometric') return (p as ParsevalTrig).hasSingular ?? false;
    if (result.type === 'complex') return (p as ParsevalComplex).hasSingular ?? false;
    if (result.type === 'halfRange') {
      const ph = p as ParsevalHalfRange;
      return this.halfRangeMode() === 'cosine' ? (ph.cosine.hasSingular ?? false) : (ph.sine.hasSingular ?? false);
    }
    return false;
  });

  /** The n value at which the Parseval sum starts (1 = normal, k > 1 = singular terms excluded). */
  readonly parsevalSumStart = computed(() => {
    const result = this.store.result();
    const p = this.parsevalData();
    if (!result || !p) return 1;
    if (result.type === 'trigonometric') return (p as ParsevalTrig).sumStart ?? 1;
    if (result.type === 'complex') return (p as ParsevalComplex).sumStart ?? 1;
    if (result.type === 'halfRange') {
      const ph = p as ParsevalHalfRange;
      return this.halfRangeMode() === 'cosine' ? (ph.cosine.sumStart ?? 1) : (ph.sine.sumStart ?? 1);
    }
    return 1;
  });

  /** Factored coefficient LaTeX: K · summandₙ form when non-trivial (K ≠ 1). */
  readonly coeffFactoredTex = computed(() => {
    const result = this.store.result();
    const hrMode = this.halfRangeMode();
    if (!result) return null;

    const isTrivial = (k?: SymbolicExpression, s?: SymbolicExpression) =>
      !k || !s || k.maxima.trim() === '1' || s.maxima.trim() === '1';

    if (result.type === 'trigonometric') {
      const c = result.data.coefficients;
      return {
        an: isTrivial(c.anK, c.anSummand) ? null : { k: c.anK!.tex, s: c.anSummand!.tex, kMx: c.anK!.maxima },
        bn: isTrivial(c.bnK, c.bnSummand) ? null : { k: c.bnK!.tex, s: c.bnSummand!.tex, kMx: c.bnK!.maxima },
      };
    }
    if (result.type === 'halfRange') {
      const c = result.data.coefficients;
      return hrMode === 'cosine'
        ? { an: isTrivial(c.anK, c.anSummand) ? null : { k: c.anK!.tex, s: c.anSummand!.tex, kMx: c.anK!.maxima } }
        : { bn: isTrivial(c.bnK, c.bnSummand) ? null : { k: c.bnK!.tex, s: c.bnSummand!.tex, kMx: c.bnK!.maxima } };
    }
    if (result.type === 'complex') {
      const c = result.data.coefficients;
      return {
        cn: isTrivial(c.cnK, c.cnSummand) ? null : { k: c.cnK!.tex, s: c.cnSummand!.tex, kMx: c.cnK!.maxima },
      };
    }
    return null;
  });

  /** Raw Maxima strings for each coefficient (always unsimplified, for copy-to-Maxima). */
  readonly coeffMaxima = computed(() => {
    const result = this.store.result();
    const hrMode = this.halfRangeMode();
    if (!result) return null;

    if (result.type === 'trigonometric') {
      const c = result.data.coefficients;
      return {
        a0: c.a0?.maxima ?? null,
        an: c.an?.maxima ?? null,
        bn: c.bn?.maxima ?? null,
        w0: result.data.w0.maxima,
      };
    }
    if (result.type === 'halfRange') {
      const c = result.data.coefficients;
      return hrMode === 'cosine'
        ? { a0: c.a0?.maxima ?? null, an: c.an?.maxima ?? null, w0: result.data.w0.maxima }
        : { bn: c.bn?.maxima ?? null, w0: result.data.w0.maxima };
    }
    if (result.type === 'complex') {
      const c = result.data.coefficients;
      return { c0: c.c0.maxima, cn: c.cn.maxima, w0: result.data.w0.maxima };
    }
    return null;
  });

  /** Active coefficient LaTeX: uses simplified values when available, else falls back to coeffTex.
   *  When showGammaNotation is true, gamma_incomplete forms from simplifications override everything. */
  readonly activeCoeffTex = computed(() => {
    const simplified = this.simplifiedCoeffs();
    const base = this.coeffTex();
    if (!base) return null;

    const withSimplified = simplified
      ? {
          ...base,
          ...(simplified['a0'] !== undefined ? { a0: simplified['a0'] } : {}),
          ...(simplified['an'] !== undefined ? { an: simplified['an'] } : {}),
          ...(simplified['bn'] !== undefined ? { bn: simplified['bn'] } : {}),
          ...(simplified['c0'] !== undefined ? { c0: simplified['c0'] } : {}),
          ...(simplified['cn'] !== undefined ? { cn: simplified['cn'] } : {}),
          ...(simplified['w0'] !== undefined ? { w0: simplified['w0'] } : {}),
        }
      : { ...base };

    if (!this.showGammaNotation()) return withSimplified;

    const result = this.store.result();
    const simplifications = result?.data.simplifications;
    if (!simplifications) return withSimplified;

    const gammaOverrides: Record<string, string> = {};
    for (const [k, v] of Object.entries(simplifications)) {
      if (k.endsWith('_gamma')) gammaOverrides[k.slice(0, -6)] = v.tex;
    }
    return { ...withSimplified, ...gammaOverrides };
  });

  /** Display-only a0: prefer backend raw a0 (before /2) for trig and half-range cosine views. */
  readonly a0DisplayTex = computed(() => {
    const result = this.store.result();
    if (!result) return null;

    const simplifiedA0Raw = this.simplifiedCoeffs()?.['a0Raw'];

    if (result.type === 'trigonometric') {
      return simplifiedA0Raw ?? result.data.a0Raw?.tex ?? this.activeCoeffTex()?.a0 ?? null;
    }

    if (result.type === 'halfRange' && this.halfRangeMode() === 'cosine') {
      return simplifiedA0Raw ?? result.data.a0Raw?.tex ?? this.activeCoeffTex()?.a0 ?? null;
    }

    return this.activeCoeffTex()?.a0 ?? null;
  });

  /** Active coefficient Maxima: uses simplified Maxima when available, else raw. */
  readonly activeCoeffMaxima = computed(() => {
    const simplified = this.simplifiedCoeffsMaxima();
    const base = this.coeffMaxima();
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

  /** Maxima for the a₀ panel row (uses a0Raw simplified Maxima when available). */
  readonly a0DisplayMaxima = computed(() => {
    const result = this.store.result();
    if (!result) return null;
    const simplifiedA0RawMaxima = this.simplifiedCoeffsMaxima()?.['a0Raw'];
    if (result.type === 'trigonometric') {
      return simplifiedA0RawMaxima ?? result.data.a0Raw?.maxima ?? this.activeCoeffMaxima()?.a0 ?? null;
    }
    if (result.type === 'halfRange' && this.halfRangeMode() === 'cosine') {
      return simplifiedA0RawMaxima ?? result.data.a0Raw?.maxima ?? this.activeCoeffMaxima()?.a0 ?? null;
    }
    return this.activeCoeffMaxima()?.a0 ?? null;
  });

  readonly execTime = computed(() => {
    const r = this.store.result();
    return r ? r.data.executionTimeMs : null;
  });

  /** Label for the series export modal: "f(x)", "f(t)", etc. */
  readonly seriesLabel = computed(() => `f(${this.store.intVar()})`);

  // ── Tab state ─────────────────────────────────────────────────────────────
  readonly activeTab = signal<'coefficients' | 'terms' | 'spectrum' | 'validation' | 'parseval'>('coefficients');
  readonly termsTabInitialized = signal(false);
  readonly showTermsTab = computed(
    () => this.termsTabInitialized() || this.activeTab() === 'terms',
  );

  // ── Parseval tab state ───────────────────────────────────────────────────
  private readonly cancelParseval$ = new Subject<void>();
  readonly parsevalData = signal<ParsevalTrig | ParsevalHalfRange | ParsevalComplex | null>(null);
  readonly parsevalLoading = signal(false);
  readonly parsevalSimplifyProfile = signal<SimplifyProfile>('raw');
  readonly parsevalSimplifying = signal(false);
  readonly parsevalSimplifiedLhsFinal = signal<string | null>(null);
  readonly parsevalSimplifiedSummand = signal<string | null>(null);
  readonly parsevalView = signal<'simplified' | 'formal'>('simplified');
  readonly parsevalComplexSumForm = signal<'unilateral' | 'bilateral'>('unilateral');

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
      const a0IsZero =
        (r.data.a0Raw?.maxima ?? r.data.coefficients.a0?.maxima ?? '').trim() === '0';
      const anIsZero = !an || an === '0';
      const bnIsZero = !bn || bn === '0';

      const parts: string[] = [];
      if (!anIsZero) parts.push(`${an}\\cos\\!\\left(${omega}\\right)`);
      if (!bnIsZero) parts.push(`${bn}\\sin\\!\\left(${omega}\\right)`);

      if (parts.length === 0) return a0IsZero ? '0' : (a0 ?? '0');

      const joinedTerms = parts.reduce((acc, term, index) => {
        const current = term.trim();
        if (index === 0) return current;

        const isNegative =
          current.startsWith('-') || current.startsWith('\\left(-') || current.startsWith('(-');

        return isNegative ? `${acc}${current}` : `${acc}+${current}`;
      }, '');

      const body = `\\sum_{n=1}^{\\infty}\\left(${joinedTerms}\\right)`;
      if (!a0IsZero && a0) {
        const sep = body.startsWith('-') ? ' ' : ' + ';
        return `${a0}${sep}${body}`;
      }
      return body;
    }

    if (r.type === 'halfRange') {
      const hrMode = this.halfRangeMode();
      const { a0, an, bn } = coeffs;
      const originFrom = r.data.input.segments[0]?.from ?? '0';
      const shiftedVar = this.formatHalfRangeShiftTex(intVar, originFrom);
      const shiftedOmega = w0IsOne
        ? `n\\,${shiftedVar}`
        : `n\\,${w0Tex}\\,\\left(${shiftedVar}\\right)`;
      if (hrMode === 'cosine') {
        const a0IsZero =
          (r.data.a0Raw?.maxima ?? r.data.coefficients.a0?.maxima ?? '').trim() === '0';
        const anIsZero = !an || an === '0';

        if (anIsZero) return a0IsZero ? '0' : (a0 ?? '0');

        const body = `\\sum_{n=1}^{\\infty}${an}\\cos\\!\\left(${shiftedOmega}\\right)`;
        if (!a0IsZero && a0) {
          const sep = body.startsWith('-') ? ' ' : ' + ';
          return `${a0}${sep}${body}`;
        }
        return body;
      }
      const bnIsZero = !bn || bn === '0';
      if (bnIsZero) return '0';
      return `\\sum_{n=1}^{\\infty}${bn}\\sin\\!\\left(${shiftedOmega}\\right)`;
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

  readonly indeterminateTrigTerms = computed(() =>
    (this.trigTerms() ?? []).filter(t => t.anUsedLimit || t.bnUsedLimit),
  );

  readonly indeterminateComplexTerms = computed(() =>
    (this.complexTerms() ?? []).filter(t => t.cnUsedLimit || t.cnNegUsedLimit),
  );

  readonly hasIndeterminateTerms = computed(() =>
    this.indeterminateTrigTerms().length > 0 || this.indeterminateComplexTerms().length > 0,
  );

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

  /** Terms re-evaluated with current slider params for spectrum consistency. */
  readonly spectrumTrigTerms = computed<TrigonometricTerm[] | null>(() => {
    const r = this.store.result();
    if (r?.type !== 'trigonometric' && r?.type !== 'halfRange') return null;

    const rawTerms = r.terms.terms as TrigonometricTerm[];
    const coeffs = r.data.coefficients;
    const pv = this.evaluationParams();

    const anFn = coeffs.an?.maxima ? this.math.compile(coeffs.an.maxima, 'n', pv) : null;
    const bnFn = coeffs.bn?.maxima ? this.math.compile(coeffs.bn.maxima, 'n', pv) : null;
    if (!anFn && !bnFn) return rawTerms;

    return rawTerms.map((t) => {
      const anv = anFn?.(t.n);
      const bnv = bnFn?.(t.n);
      return {
        ...t,
        anFloat: anv !== undefined && isFinite(anv) ? anv : t.anFloat,
        bnFloat: bnv !== undefined && isFinite(bnv) ? bnv : t.bnFloat,
      };
    });
  });

  /** Complex spectrum terms adapted to slider params via the real-term representation. */
  readonly spectrumComplexTerms = computed<ComplexTerm[] | null>(() => {
    const r = this.store.result();
    if (r?.type !== 'complex') return null;

    const rawTerms = r.terms.terms as ComplexTerm[];
    if (!rawTerms.length) return rawTerms;

    const pv = this.evaluationParams();
    const w0 = this.resolveW0Value();
    if (!isFinite(w0) || Math.abs(w0) < 1e-12) return rawTerms;

    return rawTerms.map((t) => {
      if (!t.cnRe && !t.cnIm) return t;
      const reFn = t.cnRe ? this.math.compile(t.cnRe, '_', pv) : null;
      const imFn = t.cnIm ? this.math.compile(t.cnIm, '_', pv) : null;
      const a = reFn?.(0);
      const b = imFn?.(0);
      if (a === undefined || b === undefined || !isFinite(a) || !isFinite(b)) return t;

      const amplitude = Math.sqrt(a * a + b * b) / 2;
      const phase = Math.atan2(-b, a);

      return {
        ...t,
        cosFloat: a,
        sinFloat: b,
        amplitude: isFinite(amplitude) ? amplitude : t.amplitude,
        phase: isFinite(phase) ? phase : t.phase,
      };
    });
  });

  /** Typed tabs array so the template gets literal types */
  readonly tabs: {
    id: 'coefficients' | 'terms' | 'spectrum' | 'validation' | 'parseval';
    labelKey: string;
    descKey: string;
    icon: string; // SVG path d=""
  }[] = [
    {
      id: 'coefficients',
      labelKey: 'settingsCanvas.tabCoefficients',
      descKey: 'settingsCanvas.tabCoefficientsDesc',
      icon: 'M4 6h16M4 10h10M4 14h7M4 18h5',
    },
    {
      id: 'terms',
      labelKey: 'settingsCanvas.tabTerms',
      descKey: 'settingsCanvas.tabTermsDesc',
      icon: 'M3 17l3-8 3 4 3-6 3 10 3-6',
    },
    {
      id: 'spectrum',
      labelKey: 'settingsCanvas.tabSpectrum',
      descKey: 'settingsCanvas.tabSpectrumDesc',
      icon: 'M4 20v-4M8 20v-8M12 20V8M16 20v-6M20 20v-10',
    },
    {
      id: 'validation',
      labelKey: 'settingsCanvas.tabValidation',
      descKey: 'settingsCanvas.tabValidationDesc',
      icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    },
    {
      id: 'parseval',
      labelKey: 'settingsCanvas.tabParseval',
      descKey: 'settingsCanvas.tabParsevalDesc',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    },
  ];

  /** Context for the terms tab — trig / half-range branch */
  readonly termsTrigCtx = computed(() => {
    const r = this.store.result();
    if (r?.type !== 'trigonometric' && r?.type !== 'halfRange') return null;
    const c = r.data.coefficients;
    const a0RawResolved =
      this.evalScalar(r.data.a0Raw?.maxima, c.a0Float) ??
      (this.evalScalar(c.a0?.maxima, undefined) ?? 0) * 2;
    return {
      a0Float: a0RawResolved,
      a0Half: a0RawResolved !== undefined ? a0RawResolved / 2 : undefined,
      a0Tex: c.a0?.tex ?? null,
    };
  });

  /** Context for the terms tab — complex branch */
  readonly termsComplexCtx = computed(() => {
    const r = this.store.result();
    if (r?.type !== 'complex') return null;
    const c = r.data.coefficients;
    const c0Resolved = this.evalScalar(c.c0?.maxima, c.c0Float);
    return {
      c0Float: c0Resolved,
      c0FloatAbs: c0Resolved !== undefined ? Math.abs(c0Resolved) : undefined,
      c0Tex: c.c0?.tex ?? null,
    };
  });

  private readonly singularityKeyMap: Record<string, string> = {
    removible: 'resultPanel.singularity.removible',
    salto: 'resultPanel.singularity.salto',
    asintotica: 'resultPanel.singularity.asintotica',
    esencial: 'resultPanel.singularity.esencial',
    fuera_de_dominio: 'resultPanel.singularity.fuera_de_dominio',
  };

  singularityLabel(type: string): string {
    const key = this.singularityKeyMap[type];
    return key ? this.transloco.translate(key) : type;
  }

  // ── Profile selector options ────────────────────────────────────────────────
  readonly profileOptions: { value: SimplifyProfile; labelKey: string; descKey: string }[] = [
    { value: 'raw',           labelKey: 'settingsCanvas.profileRaw',      descKey: 'simplify.profileRawDesc' },
    { value: 'integer',       labelKey: 'settingsCanvas.profileInteger',  descKey: 'simplify.profileIntegerDesc' },
    { value: 'trigonometric', labelKey: 'settingsCanvas.profileTrig',     descKey: 'simplify.profileTrigDesc' },
    { value: 'exponential',   labelKey: 'settingsCanvas.profileExp',      descKey: 'simplify.profileExpDesc' },
    { value: 'complete',      labelKey: 'settingsCanvas.profileComplete', descKey: 'simplify.profileCompleteDesc' },
  ];

  readonly activeProfileDescKey = computed(
    () => this.profileOptions.find(o => o.value === this.simplifyProfile())?.descKey ?? '',
  );

  readonly activeParsevalProfileDescKey = computed(
    () => this.profileOptions.find(o => o.value === this.parsevalSimplifyProfile())?.descKey ?? '',
  );

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  constructor() {
    if (typeof window !== 'undefined') {
      const onResize = () => this.isMobile.set(window.innerWidth < 1024);
      window.addEventListener('resize', onResize);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
    }

    effect(() => {
      void this.theme.theme();
      void this.theme.palette();
      const preset = this.currentColorPreset();
      if (!this.customOriginalColor()) this.originalColor.set(preset.original);
      if (!this.customApproxColor()) this.approxColor.set(preset.approx);
    });

    // Reset all local state whenever a new result arrives; also fetch latest history entry for favorite
    effect(() => {
      const result = this.store.result();
      if (result) {
        const decision = result.data.validation?.decision;
        this.activeTab.set(decision === 'reject' ? 'validation' : 'coefficients');
        this.termsTabInitialized.set(false);
        this.canvasNTerms.set(
          Math.max(0, Math.min(this.store.nTerms(), result.terms.terms.length)),
        );
        this.simplifiedCoeffs.set(null);
        this.simplifiedCoeffsMaxima.set(null);
        this.simplifiedFactored.set(null);
        this.showFactoredSeries.set(false);
        this.showGammaNotation.set(false);
        this.simplifyProfile.set('raw');
        this.showCanvasSettings.set(!this.isMobile());
        this.declareNInteger.set(true);
        this.toHyperbolic.set(false);
        this.halfRangeMode.set('cosine');
        this.cancelParseval$.next();
        this.parsevalData.set(null);
        this.parsevalSimplifiedLhsFinal.set(null);
        this.parsevalSimplifiedSummand.set(null);
        this.parsevalSimplifyProfile.set('raw');
        this.parsevalView.set('simplified');
        this.parsevalComplexSumForm.set('unilateral');
        this.controlHarmonics.set(false);
        this.enabledHarmonics.set(new Set(result.terms.terms.map((t) => t.n)));
        this.selectedHarmonicN.set(null);
        this.showFavoriteDialog.set(false);
        this.latestHistoryEntry.set(null);
        this.favoriteName = '';
        this.customConstName.set(null);

        // Pre-fetch the history entry so the star button can resolve immediately on click
        if (this.userStore.isAuthenticated()) {
          this.fetchLatestEntry();
        }
      }
    });

    effect(() => {
      const max = this.maxCanvasTerms();
      const current = this.canvasNTerms();
      if (current > max) {
        this.canvasNTerms.set(max);
      }
    });

    effect(() => {
      const hasResult = this.store.hasResult();
      if (hasResult) {
        this.hadResult.set(true);
        return;
      }
      if (this.hadResult()) {
        this.showCanvasSettings.set(false);
        this.paramRanges.set({});
        this.originalDashed.set(false);
        this.approxDashed.set(false);
        this.hadResult.set(false);
      }
    });

    // Track native fullscreen changes
    if (typeof document !== 'undefined') {
      const handler = () => this.isFullscreen.set(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handler);
      this.destroyRef.onDestroy(() => document.removeEventListener('fullscreenchange', handler));
    }
  }

  readonly currentColorPreset = computed(() =>
    getSeriesColorPreset(this.theme.isDark, this.theme.isNeutral),
  );

  readonly harmonicColors = computed(() => this.currentColorPreset().harmonics);

  // ── Tab & mode actions ────────────────────────────────────────────────────

  setTab(tab: 'coefficients' | 'terms' | 'spectrum' | 'validation' | 'parseval'): void {
    if (tab === 'terms' && !this.termsTabInitialized()) {
      this.termsTabInitialized.set(true);
    }
    if (tab === 'parseval' && !this.parsevalData() && !this.parsevalLoading()) {
      this.fetchParseval();
    }
    this.activeTab.set(tab);
  }

  private fetchParseval(): void {
    const result = this.store.result();
    if (!result) return;
    this.cancelParseval$.next();
    this.parsevalLoading.set(true);
    this.api
      .calculateParseval(result.data.input)
      .pipe(
        takeUntil(this.cancelParseval$),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.parsevalLoading.set(false)),
      )
      .subscribe({
        next: (res) => this.parsevalData.set(res.parseval ?? null),
        error: () => this.parsevalData.set(null),
      });
  }

  simplifyParseval(profile: SimplifyProfile): void {
    this.parsevalSimplifyProfile.set(profile);
    if (profile === 'raw') {
      this.parsevalSimplifiedLhsFinal.set(null);
      this.parsevalSimplifiedSummand.set(null);
      return;
    }

    const result = this.store.result();
    const p = this.parsevalData();
    if (!result || !p) return;

    let lhsFinalMaxima: string | undefined;
    let summandMaxima: string | undefined;
    let hasSingularTerms = false;
    if (result.type === 'trigonometric') {
      const pt = p as ParsevalTrig;
      lhsFinalMaxima = pt.lhsFinal.maxima;
      summandMaxima = pt.summand.maxima;
      hasSingularTerms = (pt.singularTerms?.length ?? 0) > 0;
    } else if (result.type === 'complex') {
      const pc = p as ParsevalComplex;
      const isBilateral = this.parsevalComplexSumForm() === 'bilateral';
      lhsFinalMaxima = isBilateral ? (pc.bilateral?.lhsFinal.maxima ?? pc.lhsFinal.maxima) : pc.lhsFinal.maxima;
      summandMaxima = pc.summand.maxima;
      hasSingularTerms = (pc.singularTerms?.length ?? 0) > 0;
    } else if (result.type === 'halfRange') {
      const arm = this.halfRangeMode() === 'cosine'
        ? (p as ParsevalHalfRange).cosine
        : (p as ParsevalHalfRange).sine;
      lhsFinalMaxima = arm.lhsFinal.maxima;
      summandMaxima = arm.summand.maxima;
      hasSingularTerms = (arm.singularTerms?.length ?? 0) > 0;
    }

    if (!lhsFinalMaxima || !summandMaxima) return;

    this.parsevalSimplifying.set(true);

    // Step 1: simplify the summand and extract any remaining constant factor K.
    // Step 2: simplify lhsFinal / K so both sides of the identity stay balanced.
    // When singular terms exist, K-extraction is suppressed: the singular term TeX
    // values are scalars already normalized by the original K, so dividing out a new K'
    // would break the equation balance without a way to update those values.
    const parsevalDisplayFlags = {
      declareNInteger: this.declareNInteger(),
      ...(this.toHyperbolic() ? { toHyperbolic: true } : {}),
    };

    this.api.simplify({ expression: summandMaxima, profile, displayFlags: parsevalDisplayFlags })
      .pipe(
        switchMap((summandRes) => {
          const K = hasSingularTerms ? null : summandRes.simplifiedK;
          const newSummandTex = K
            ? (summandRes.simplifiedSummand?.tex ?? summandRes.simplified.tex)
            : summandRes.simplified.tex;
          // If K ≠ 1 divide it out of the LHS; otherwise just simplify as-is.
          const adjustedLhs = K ? `(${lhsFinalMaxima!}) / (${K.maxima})` : lhsFinalMaxima!;
          return this.api.simplify({ expression: adjustedLhs, profile, displayFlags: parsevalDisplayFlags }).pipe(
            map((lhsRes) => ({ lhsFinalTex: lhsRes.simplified.tex, summandTex: newSummandTex })),
          );
        }),
        finalize(() => this.parsevalSimplifying.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ lhsFinalTex, summandTex }) => {
        this.parsevalSimplifiedLhsFinal.set(lhsFinalTex);
        this.parsevalSimplifiedSummand.set(summandTex);
      });
  }

  setComplexSumForm(form: 'unilateral' | 'bilateral'): void {
    this.parsevalComplexSumForm.set(form);
    this.parsevalSimplifiedLhsFinal.set(null);
    this.parsevalSimplifiedSummand.set(null);
    this.parsevalSimplifyProfile.set('raw');
  }

  setHalfRangeMode(mode: 'cosine' | 'sine'): void {
    this.halfRangeMode.set(mode);
    this.simplifiedCoeffs.set(null);
    this.simplifyProfile.set('raw');
    this.parsevalSimplifiedLhsFinal.set(null);
    this.parsevalSimplifiedSummand.set(null);
    this.parsevalSimplifyProfile.set('raw');
    this.parsevalView.set('simplified');
    this.parsevalComplexSumForm.set('unilateral');
  }

  setHarmonicControl(enabled: boolean): void {
    this.controlHarmonics.set(enabled);
    if (enabled) {
      const enabled = this.enabledHarmonics();
      if (enabled.size === 0) {
        this.enabledHarmonics.set(new Set(this.visibleHarmonicNumbers()));
      }
    } else {
      this.selectedHarmonicN.set(null);
    }
  }

  toggleHarmonicControl(): void {
    this.setHarmonicControl(!this.controlHarmonics());
  }

  isHarmonicEnabled(n: number): boolean {
    return !this.controlHarmonics() || this.enabledHarmonics().has(n);
  }

  isHarmonicSelected(n: number): boolean {
    return this.selectedHarmonicN() === n;
  }

  harmonicColorForN(n: number): string {
    const palette = this.harmonicColors();
    return palette[(n - 1) % palette.length] ?? 'rgba(59, 130, 246, 0.4)';
  }

  rowHarmonicBackground(n: number): string {
    const inRange = n <= this.canvasNTerms();
    const enabled = this.isHarmonicEnabled(n);
    const selected = this.isHarmonicSelected(n);

    if (selected) return this.withAlpha(this.harmonicColorForN(n), 0.28);
    if (this.controlHarmonics() && !enabled) return '';
    if (inRange)
      return this.withAlpha(this.harmonicColorForN(n), this.controlHarmonics() ? 0.12 : 0.08);
    return '';
  }

  isHarmonicInCanvasRange(n: number): boolean {
    return n <= this.canvasNTerms();
  }

  focusHarmonic(n: number): void {
    this.showHarmonics.set(true);
    if (this.controlHarmonics() && !this.enabledHarmonics().has(n)) {
      const next = new Set(this.enabledHarmonics());
      next.add(n);
      this.enabledHarmonics.set(next);
    }
    this.selectedHarmonicN.set(this.selectedHarmonicN() === n ? null : n);
  }

  setHarmonicEnabled(n: number, checked: boolean): void {
    const next = new Set(this.enabledHarmonics());
    if (checked) next.add(n);
    else next.delete(n);
    this.enabledHarmonics.set(next);
    if (!checked && this.selectedHarmonicN() === n) {
      this.selectedHarmonicN.set(null);
    }
  }

  toggleAllVisibleHarmonics(checked: boolean): void {
    const next = new Set(this.enabledHarmonics());
    for (const n of this.visibleHarmonicNumbers()) {
      if (checked) next.add(n);
      else next.delete(n);
    }
    this.enabledHarmonics.set(next);
    if (!checked) {
      const selected = this.selectedHarmonicN();
      if (selected !== null && !next.has(selected)) {
        this.selectedHarmonicN.set(null);
      }
    }
  }

  private withAlpha(color: string, alpha: number): string {
    if (color.startsWith('hsla(')) {
      return color.replace(/hsla\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `hsla($1,$2,$3,${alpha})`);
    }
    if (color.startsWith('hsl(')) {
      return color.replace(/hsl\(([^,]+),([^,]+),([^)]+)\)/, `hsla($1,$2,$3,${alpha})`);
    }
    return color;
  }

  private resolveW0Value(): number {
    const r = this.store.result();
    if (!r) return Math.PI;
    const pv = this.evaluationParams();
    const parsed = this.reconstruction.parseW0(r.data.w0.maxima);
    const fn = this.math.compile(r.data.w0.maxima, '_', pv);
    const value = fn?.(0);
    return value !== undefined && isFinite(value) ? value : parsed;
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

  onOriginalColorInput(value: string): void {
    this.customOriginalColor.set(true);
    this.originalColor.set(value);
  }

  onApproxColorInput(value: string): void {
    this.customApproxColor.set(true);
    this.approxColor.set(value);
  }

  resetLineColorsToPreset(): void {
    const preset = this.currentColorPreset();
    this.customOriginalColor.set(false);
    this.customApproxColor.set(false);
    this.originalColor.set(preset.original);
    this.approxColor.set(preset.approx);
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

  exportTrigCsv(): void {
    const terms = this.trigTerms();
    if (!terms?.length) return;
    const header = ['n', 'an_float', 'bn_float'];
    const rows = terms.map((t) => [String(t.n), String(t.anFloat), String(t.bnFloat)]);
    this.csvExport.download('fourier-trig-coefficients.csv', [header, ...rows]);
  }

  exportComplexCsv(): void {
    const terms = this.complexTerms();
    if (!terms?.length) return;
    const header = ['n', 'amplitude', 'phase_rad', 'cos_coeff', 'sin_coeff'];
    const rows = terms.map((t) => [
      String(t.n),
      String(t.amplitude),
      String(t.phase),
      String(t.cosFloat),
      String(t.sinFloat),
    ]);
    this.csvExport.download('fourier-complex-coefficients.csv', [header, ...rows]);
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
    this.api
      .getHistory({ limit: 1 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((res) => {
          const latest = res.entries[0] ?? null;
          if (!latest || latest.isFavorite) return of(latest);
          return this.api.getHistory({ favorites: true, limit: 1 }).pipe(
            map((favRes) => {
              const fav = favRes.entries[0];
              return fav && JSON.stringify(fav.input) === JSON.stringify(latest.input)
                ? fav
                : latest;
            }),
            catchError(() => of(latest)),
          );
        }),
      )
      .subscribe({
        next: (entry) => {
          this.latestHistoryEntry.set(entry);
          callback?.();
        },
        error: () => callback?.(),
      });
  }

  private doToggle(entry: HistoryEntry): void {
    if (entry.isFavorite) {
      this.favoriteLoading.set(true);
      this.api
        .toggleFavorite(entry.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            this.latestHistoryEntry.set(updated);
            this.favoriteLoading.set(false);
          },
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
    this.api
      .toggleFavorite(entry.id, this.favoriteName.trim() || undefined)
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
      this.simplifiedCoeffsMaxima.set(null);
      this.simplifiedFactored.set(null);
      this.showFactoredSeries.set(false);
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

  setEdispflag(enabled: boolean): void {
    this.useEdispflag.set(enabled);
    if (this.simplifyProfile() !== 'raw') {
      this.simplifyAll(this.simplifyProfile());
    }
  }

  setErfRepresentation(repr: 'erf' | 'erfc' | 'erfi'): void {
    this.erfRepresentation.set(repr);
    if (this.simplifyProfile() !== 'raw') {
      this.simplifyAll(this.simplifyProfile());
    }
  }

  setDeclareNInteger(enabled: boolean): void {
    this.declareNInteger.set(enabled);
    if (this.simplifyProfile() !== 'raw') {
      this.simplifyAll(this.simplifyProfile());
    }
  }

  setToHyperbolic(enabled: boolean): void {
    this.toHyperbolic.set(enabled);
    if (this.simplifyProfile() !== 'raw') {
      this.simplifyAll(this.simplifyProfile());
    }
  }

  simplifyAll(
    profile: SimplifyProfile,
    flag: 'exponentialize' | 'demoivre' = this.expFlag(),
  ): void {
    const result = this.store.result();
    if (!result) return;

    this.simplifying.set(true);

    const profileFlags =
      profile === 'exponential'
        ? flag === 'exponentialize'
          ? { exponentialize: true }
          : { demoivre: true }
        : undefined;

    const displayFlags = {
      ...(profileFlags ?? {}),
      ...(this.useEdispflag() ? { edispflag: true } : {}),
      erfRepresentation: this.erfRepresentation(),
      declareNInteger: this.declareNInteger(),
      ...(this.toHyperbolic() ? { toHyperbolic: true } : {}),
    };

    const calls: Record<string, ReturnType<typeof this.api.simplify>> = {};

    if (result.type === 'trigonometric') {
      const c = result.data.coefficients;
      if (c.a0?.maxima)
        calls['a0'] = this.api.simplify({ expression: c.a0.maxima, profile, displayFlags });
      if (result.data.a0Raw?.maxima)
        calls['a0Raw'] = this.api.simplify({ expression: result.data.a0Raw.maxima, profile, displayFlags });
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
        if (result.data.a0Raw?.maxima)
          calls['a0Raw'] = this.api.simplify({ expression: result.data.a0Raw.maxima, profile, displayFlags });
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
        const simplifiedMaxima: Record<string, string> = {};
        const factored: Record<string, { k: string; s: string; kMx: string } | null> = {};
        for (const [key, res] of Object.entries(responses)) {
          simplified[key] = res.simplified.tex;
          simplifiedMaxima[key] = res.simplified.maxima;
          factored[key] =
            res.simplifiedK && res.simplifiedSummand
              ? { k: res.simplifiedK.tex, s: res.simplifiedSummand.tex, kMx: res.simplifiedK.maxima }
              : null;
        }

        // K-unification for trig series: when raw emission unified K_an == K_bn
        // (emit_factored_trig absorbed the ratio into bn_summand) but simplifying
        // each coefficient independently gives different Ks, adopt the raw bn
        // summand (which already carries the ratio) under the simplified K so the
        // frontend's kSame path can render K·Σ(sₐ·cos + s_b·sin).
        type FE = { k: string; s: string; kMx: string } | null;
        const rawFact = this.coeffFactoredTex() as Record<string, FE> | null;
        if (rawFact) {
          const rawAn = rawFact['an'];
          const rawBn = rawFact['bn'];
          const simpAn = factored['an'];
          const simpBn = factored['bn'];
          if (rawAn && rawBn && rawAn.kMx === rawBn.kMx && simpAn && simpBn && simpAn.kMx !== simpBn.kMx) {
            factored['bn'] = { k: simpAn.k, s: rawBn.s, kMx: simpAn.kMx };
          }
        }

        this.simplifiedCoeffs.set(simplified);
        this.simplifiedCoeffsMaxima.set(simplifiedMaxima);
        this.simplifiedFactored.set(factored);
        this.showFactoredSeries.set(false);
      });
  }
}
