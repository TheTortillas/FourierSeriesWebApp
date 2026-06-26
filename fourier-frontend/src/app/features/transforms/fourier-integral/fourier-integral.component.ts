import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  DestroyRef,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, Subject, switchMap } from 'rxjs';

import { NavComponent } from '../../../shared/components/nav/nav.component';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../shared/components/function-plot/function-plot.component';
import { ApiService } from '../../../core/services/api/api.service';
import { UserStore } from '../../../core/services/auth/user.store';
import { formatApiError } from '../../../shared/utils/api-error.utils';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { CoordinateTransformService } from '../../../core/services/canvas/coordinate-transform.service';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { TransformSegmentComponent, TransformSegmentDraft } from '../continuous/transform-segment.component';
import { MathquillService, KeyBtn } from '../../../core/services/math/mathquill.service';
import { MobileMathKeyboardComponent } from '../../../shared/components/math-keyboard/mobile-math-keyboard.component';
import { ExportButtonComponent } from '../../../shared/components/export-button/export-button.component';
import { ParamSlidersComponent } from '../../../shared/components/param-sliders/param-sliders.component';
import type { ParamValues } from '../../../shared/components/param-sliders/param-sliders.component';
import type {
  FourierIntegralVariant,
  FourierIntegralCoefficientsResponse,
  FourierIntegralReconstructResponse,
  ReconstructPoint,
} from '../../../domain/types/transform.types';
import { HistoryEntry } from '../../../domain';

let _nextId = 0;
const mkId = () => `fi-${++_nextId}`;

function defaultSegment(): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: '1',
    expressionTex: '1',
    from: '-1',
    fromTex: '-1',
    to: '1',
    toTex: '1',
  };
}

/** Variable pair for Fourier Integral: intVar (integration var) → transVar (transform var) */
interface FiVarPair {
  id: string;
  intVar: string;
  transVar: string;
  intDisplay: string;
  transDisplay: string;
}

const FI_VAR_PAIRS: FiVarPair[] = [
  { id: 'v-w',  intVar: 'v', transVar: 'w',   intDisplay: 'v', transDisplay: 'ω' },
  { id: 'x-k',  intVar: 'x', transVar: 'k',   intDisplay: 'x', transDisplay: 'k' },
  { id: 't-w',  intVar: 't', transVar: 'w',   intDisplay: 't', transDisplay: 'ω' },
  { id: 'x-xi', intVar: 'x', transVar: 'xi',  intDisplay: 'x', transDisplay: 'ξ' },
  { id: 'custom', intVar: '', transVar: '',    intDisplay: '', transDisplay: '' },
];

@Component({
  selector: 'app-fourier-integral',
  templateUrl: './fourier-integral.component.html',
  imports: [
    NavComponent,
    MathjaxDirective,
    FunctionPlotComponent,
    TransformSegmentComponent,
    FormsModule,
    TranslocoPipe,
    MobileMathKeyboardComponent,
    ExportButtonComponent,
    ParamSlidersComponent,
  ],
})
export class FourierIntegralComponent implements OnInit {
  readonly api = inject(ApiService);
  readonly mqs = inject(MathquillService);
  readonly userStore = inject(UserStore);
  readonly theme = inject(ThemeService);
  readonly plotter = inject(PlottingService);
  readonly coordTransform = inject(CoordinateTransformService);
  readonly mathUtils = inject(MathUtilsService);
  private readonly transloco = inject(TranslocoService);
  private readonly seo = inject(SeoService);
  readonly destroyRef = inject(DestroyRef);

  showKeyboard = false;

  readonly mobileExtraGroup: KeyBtn[] = [
    { label: '∞', write: '\\infty' },
    { label: '-∞', write: '-\\infty' },
    { label: 'i', typedText: 'i' },
  ];

  readonly keyGroups: KeyBtn[][] = [
    // Row 1: Trig functions
    [
      { label: 'sin(□)', writeWithCursor: '\\sin\\left(\\right)' },
      { label: 'cos(□)', writeWithCursor: '\\cos\\left(\\right)' },
      { label: 'sinh(□)', writeWithCursor: '\\sinh\\left(\\right)' },
      { label: 'cosh(□)', writeWithCursor: '\\cosh\\left(\\right)' },
      { label: 'e^□' },
    ],
    // Row 2: Operators and constants
    [
      { label: '□²' },
      { label: '□^□' },
      { label: '□/□' },
      { label: '√□', cmd: '\\sqrt' },
      { label: '(□)', writeWithCursor: '\\left(\\right)' },
      { label: 'π', typedText: 'pi' },
      { label: '∞', write: '\\infty' },
      { label: '-∞', write: '-\\infty' },
      { label: '−', write: '-' },
      { label: '⌫', keystroke: 'Backspace' },
    ],
  ];

  /** Variant options list for the template. */
  readonly variants: { id: string; label: string }[] = [
    { id: 'trigonometric', label: 'Trigonométrica' },
    { id: 'complex', label: 'Compleja' },
    { id: 'cosine', label: 'Integral Coseno' },
    { id: 'sine', label: 'Integral Seno' },
  ];

  /** Exposed var-pair list for template iteration. */
  readonly varPairs = FI_VAR_PAIRS;

  // ── State ──────────────────────────────────────────────────────────────────

  readonly variant = signal<FourierIntegralVariant>('trigonometric');
  readonly segments = signal<TransformSegmentDraft[]>([defaultSegment()]);
  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly coeffResult = signal<FourierIntegralCoefficientsResponse | null>(null);

  // ── Variable selector ─────────────────────────────────────────────────────
  readonly selectedPairId = signal<string>('v-w');
  readonly customIntVar = signal<string>('v');
  readonly customTransVar = signal<string>('w');

  // ── Reconstruction / slider ────────────────────────────────────────────────
  readonly upperLimit = signal(8);
  readonly upperLimitMin = 1;
  readonly upperLimitMax = 64;
  readonly reconstructPoints = signal<ReconstructPoint[]>([]);
  readonly reconstructLoading = signal(false);
  readonly showReconstruction = signal(false);

  private readonly sliderChange$ = new Subject<number>();

  // ── Canvas settings ───────────────────────────────────────────────────────
  readonly showCanvasSettings = signal(false);
  readonly showOriginal = signal(true);
  readonly showReconstruct = signal(true);
  readonly originalColor = signal('#dc2626');
  readonly reconstructColor = signal('#2563eb');
  readonly originalLineWidth = signal(2);
  readonly reconstructLineWidth = signal(2);
  readonly originalDashed = signal(true);
  readonly reconstructDashed = signal(false);
  readonly xAxisFormat = signal<'pi' | 'e' | 'integer' | 'custom'>('integer');

  // ── Free params ───────────────────────────────────────────────────────────
  readonly paramValues = signal<ParamValues>({});

  readonly activeParams = computed<string[]>(() => this.coeffResult()?.params ?? []);

  /** Name of param used for custom axis unit (null = first param). */
  readonly customConstName = signal<string | null>(null);

  readonly customConst = computed(() => {
    const params = this.activeParams();
    const pv = this.paramValues();
    const name = this.customConstName() ?? params[0];
    if (!name) return { symbol: 'a', value: 1 };
    return { symbol: name, value: pv[name] ?? 1 };
  });

  // ── Fullscreen / share / favorite ─────────────────────────────────────────
  readonly isFullscreen = signal(false);
  readonly urlCopied = signal(false);
  readonly latestHistoryEntry = signal<HistoryEntry | null>(null);
  readonly favoriteLoading = signal(false);
  readonly showFavoriteDialog = signal(false);
  favoriteName = '';

  // ── Canvas / view refs ───────────────────────────────────────────────────
  readonly plotComponent = viewChild(FunctionPlotComponent);
  readonly canvasWrapper = viewChild<ElementRef<HTMLDivElement>>('canvasWrapper');
  readonly paramSliders = viewChild(ParamSlidersComponent);

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly activePair = computed<FiVarPair>(() => {
    const id = this.selectedPairId();
    if (id === 'custom') {
      const iv = this.customIntVar() || 'v';
      const tv = this.customTransVar() || 'w';
      return { id: 'custom', intVar: iv, transVar: tv, intDisplay: iv, transDisplay: tv };
    }
    return FI_VAR_PAIRS.find((p) => p.id === id) ?? FI_VAR_PAIRS[0];
  });

  readonly intVar = computed(() => this.activePair().intVar);
  readonly transVar = computed(() => this.activePair().transVar);

  readonly canCalculate = computed(() =>
    this.segments().every((s) => s.expression.trim() && s.from.trim() && s.to.trim()),
  );

  readonly hasResult = computed(() => this.coeffResult() !== null);
  readonly inputsLocked = computed(() => this.loading() || this.hasResult());

  readonly variantLabel = computed(() => {
    const v = this.variant();
    if (v === 'trigonometric') return 'Trigonométrica';
    if (v === 'complex') return 'Compleja';
    if (v === 'cosine') return 'Integral Coseno';
    return 'Integral Seno';
  });

  /** Live LaTeX preview of the piecewise input function. */
  readonly previewLatex = computed<string | null>(() => {
    const res = this.coeffResult();
    if (res?.fourierIntegralTex) return res.fourierIntegralTex;

    const segs = this.segments();
    const iv = this.intVar();
    if (segs.length === 0) return null;
    const hasContent = segs.some((s) => s.expressionTex || s.fromTex || s.toTex);
    if (!hasContent) return null;

    if (segs.length === 1) {
      const s = segs[0];
      return `f(${iv}) = ${s.expressionTex || '\\square'}, \\quad ${s.fromTex || '\\square'} < ${iv} < ${s.toTex || '\\square'}`;
    }

    const rows = segs
      .map(
        (s) =>
          `${s.expressionTex || '\\square'}, & ${s.fromTex || '\\square'} < ${iv} < ${s.toTex || '\\square'}`,
      )
      .join(' \\\\ ');
    return `f(${iv}) = \\begin{cases} ${rows} \\end{cases}`;
  });

  readonly reconstructionFormulaTex = computed(() => {
    const v = this.variant();
    const a = this.upperLimit();
    const iv = this.intVar();
    const tv = this.transVar();
    if (v === 'complex') {
      return `f(${iv}) \\approx \\int_{-${a}}^{${a}} C(${tv})\\, e^{i${tv}${iv}}\\, d${tv}`;
    }
    if (v === 'cosine') {
      return `f(${iv}) \\approx \\int_{0}^{${a}} A(${tv})\\cos(${tv}${iv})\\, d${tv}`;
    }
    if (v === 'sine') {
      return `f(${iv}) \\approx \\int_{0}^{${a}} B(${tv})\\sin(${tv}${iv})\\, d${tv}`;
    }
    return `f(${iv}) \\approx \\int_{0}^{${a}} \\left[A(${tv})\\cos(${tv}${iv}) + B(${tv})\\sin(${tv}${iv})\\right] d${tv}`;
  });

  // ── Helpers for template type safety ─────────────────────────────────────
  castVariant(v: string): FourierIntegralVariant {
    return v as FourierIntegralVariant;
  }

  // ── Canvas layers ─────────────────────────────────────────────────────────

  readonly layers = computed<PlotLayer[]>(() => {
    const pts = this.reconstructPoints();
    const segs = this.segments();
    const plotter = this.plotter;
    const mathUtils = this.mathUtils;
    const pv = this.paramValues();
    const intVariable = this.intVar();

    const origColor = this.originalColor();
    const recColor = this.reconstructColor();
    const showOrig = this.showOriginal();
    const showRec = this.showReconstruct();
    const origLW = this.originalLineWidth();
    const recLW = this.reconstructLineWidth();
    const origDashed = this.originalDashed();
    const recDashed = this.reconstructDashed();

    const layer: PlotLayer = {
      curves: [],
      onDraw: (ctx, vp) => {
        // Draw original function from segments
        if (showOrig) {
          const finitePieces: { fn: (x: number) => number; from: number; to: number }[] = [];
          for (const seg of segs) {
            if (!seg.expression || !seg.from || !seg.to) continue;
            const from = seg.from === 'minf' || seg.from === '-inf' ? -Infinity : parseFloat(seg.from);
            const to = seg.to === 'inf' ? Infinity : parseFloat(seg.to);
            const fn = mathUtils.compile(seg.expression, intVariable, pv);
            if (!fn) continue;
            if (isFinite(from) && isFinite(to)) {
              finitePieces.push({ fn, from, to });
            } else {
              const gated = (x: number) =>
                x >= (isFinite(from) ? from : -Infinity) && x <= (isFinite(to) ? to : Infinity)
                  ? fn(x)
                  : NaN;
              plotter.plotFn(ctx, gated, vp, { color: origColor, lineWidth: origLW, dashed: origDashed });
            }
          }
          if (finitePieces.length > 0) {
            plotter.plotPiecewise(ctx, finitePieces, vp, { color: origColor, lineWidth: origLW, dashed: origDashed });
          }
        }

        // Draw reconstructed points
        if (showRec && pts.length >= 2) {
          const ct = this.coordTransform;
          ctx.beginPath();
          ctx.strokeStyle = recColor;
          ctx.lineWidth = recLW;
          ctx.setLineDash(recDashed ? [6, 3] : []);
          let started = false;
          for (const pt of pts) {
            const cx = ct.mathToScreenX(pt.x, vp);
            const cy = ct.mathToScreenY(pt.y, vp);
            if (!isFinite(cy) || Math.abs(cy) > 1e6) { started = false; continue; }
            if (!started) { ctx.moveTo(cx, cy); started = true; }
            else ctx.lineTo(cx, cy);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      },
    };

    return [layer];
  });

  constructor() {
    // Sync colors with theme
    effect(() => {
      void this.theme.theme();
      const isDark = this.theme.isDark;
      this.originalColor.set(isDark ? '#f87171' : '#dc2626');
      this.reconstructColor.set(isDark ? '#60a5fa' : '#2563eb');
    });

    // Reset custom axis name when result changes
    effect(() => {
      this.coeffResult();
      this.customConstName.set(null);
    });

    // Track native fullscreen changes
    if (typeof document !== 'undefined') {
      const handler = () => this.isFullscreen.set(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handler);
      this.destroyRef.onDestroy(() => document.removeEventListener('fullscreenchange', handler));
    }
  }

  ngOnInit(): void {
    this.seo.setPage(
      'seo.fourierIntegral.title',
      'seo.fourierIntegral.description',
      'Fourier integral, integral de Fourier, A(w), B(w), C(w), cosine integral, sine integral',
    );

    // Debounce slider → reconstruct call
    this.sliderChange$
      .pipe(
        debounceTime(400),
        switchMap((limit) => {
          if (!this.coeffResult()?.exists) return [];
          this.reconstructLoading.set(true);
          return this.api.calculateFourierIntegralReconstruct({
            segments: this.segments().map((s) => ({
              expression: s.expression,
              from: s.from,
              to: s.to,
            })),
            variant: this.variant(),
            intVar: this.intVar(),
            transVar: this.transVar(),
            upperLimit: limit,
            xMin: -4,
            xMax: 4,
            nPoints: 200,
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res: FourierIntegralReconstructResponse) => {
          this.reconstructPoints.set(res.points);
          this.reconstructLoading.set(false);
          this.plotComponent()?.redraw();
        },
        error: () => this.reconstructLoading.set(false),
      });
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  setVariant(v: FourierIntegralVariant): void {
    if (this.inputsLocked()) return;
    this.variant.set(v);
  }

  addSegment(): void {
    if (this.inputsLocked()) return;
    this.segments.update((segs) => [
      ...segs,
      { ...defaultSegment(), id: mkId(), from: segs.at(-1)?.to ?? '', fromTex: segs.at(-1)?.toTex ?? '' },
    ]);
  }

  removeSegment(id: string): void {
    if (this.inputsLocked()) return;
    this.segments.update((s) => s.filter((seg) => seg.id !== id));
  }

  updateSegment(id: string, changes: Partial<TransformSegmentDraft>): void {
    if (this.inputsLocked()) return;
    this.segments.update((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }

  startNewCalculation(): void {
    this.coeffResult.set(null);
    this.reconstructPoints.set([]);
    this.errorMsg.set(null);
    this.showReconstruction.set(false);
    this.showCanvasSettings.set(false);
    this.paramValues.set({});
    this.paramSliders()?.reset();
    this.latestHistoryEntry.set(null);
    this.favoriteName = '';
    this.showFavoriteDialog.set(false);
    this.urlCopied.set(false);
  }

  calculate(): void {
    if (this.inputsLocked() || !this.canCalculate()) return;

    this.loading.set(true);
    this.errorMsg.set(null);
    this.coeffResult.set(null);
    this.reconstructPoints.set([]);

    this.api
      .calculateFourierIntegralCoefficients({
        segments: this.segments().map((s) => ({
          expression: s.expression,
          from: s.from,
          to: s.to,
        })),
        variant: this.variant(),
        intVar: this.intVar(),
        transVar: this.transVar(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.coeffResult.set(res);
          this.loading.set(false);
          this.showCanvasSettings.set(true);
          this.userStore.refreshQuota();
          if (res.exists) this.triggerReconstruct();
          if (this.userStore.isAuthenticated()) this.fetchLatestEntry();
        },
        error: (e) => {
          this.errorMsg.set(
            formatApiError(
              e,
              this.transloco.translate('errors.generic'),
              (key, params) => this.transloco.translate(key, params ?? {}),
              this.transloco.getActiveLang(),
            ),
          );
          this.loading.set(false);
        },
      });
  }

  onSliderInput(value: number): void {
    this.upperLimit.set(value);
    this.sliderChange$.next(value);
  }

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
    const url = (canvas as HTMLCanvasElement).toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fourier-integral.png';
    a.click();
  }

  async shareUrl(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.urlCopied.set(true);
      setTimeout(() => this.urlCopied.set(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  resetColors(): void {
    const isDark = this.theme.isDark;
    this.originalColor.set(isDark ? '#f87171' : '#dc2626');
    this.reconstructColor.set(isDark ? '#60a5fa' : '#2563eb');
    this.originalLineWidth.set(2);
    this.reconstructLineWidth.set(2);
    this.originalDashed.set(true);
    this.reconstructDashed.set(false);
  }

  // ── Favorites ─────────────────────────────────────────────────────────────

  openFavoriteDialog(): void {
    const entry = this.latestHistoryEntry();
    if (entry) {
      this.doToggle(entry);
    } else {
      this.favoriteLoading.set(true);
      this.fetchLatestEntry(() => {
        this.favoriteLoading.set(false);
        const loaded = this.latestHistoryEntry();
        if (loaded) this.doToggle(loaded);
      });
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  private triggerReconstruct(): void {
    this.showReconstruction.set(true);
    this.sliderChange$.next(this.upperLimit());
  }

  display(tex: string): string {
    return `\\[${tex}\\]`;
  }
}
