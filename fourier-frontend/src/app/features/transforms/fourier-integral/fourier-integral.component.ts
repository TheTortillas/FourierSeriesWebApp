import {
  Component,
  OnInit,
  NgZone,
  computed,
  effect,
  inject,
  signal,
  DestroyRef,
  viewChild,
  ElementRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, filter, map, of, Subject, switchMap, take, tap, timer } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { LatexToMaximaService } from '../../../core/services/math/latex-to-maxima.service';

import { NavComponent } from '../../../shared/components/nav/nav.component';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../shared/components/function-plot/function-plot.component';
import { Curve } from '../../../core/services/canvas/canvas.types';
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
  ReconstructPoint,
  SimplifyRequest,
  SimplifyResponse,
} from '../../../domain/types/transform.types';
import { HistoryEntry } from '../../../domain';
import { forkJoin } from 'rxjs';

export interface AltForm {
  labelKey: string;
  tex: string;
  maxima: string;
}

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

function emptySegment(): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: '',
    expressionTex: '',
    from: '',
    fromTex: '',
    to: '',
    toTex: '',
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
  { id: 't-w',  intVar: 't', transVar: 'w',   intDisplay: 't', transDisplay: 'ω' },
  { id: 'v-w',  intVar: 'v', transVar: 'w',   intDisplay: 'v', transDisplay: 'ω' },
  { id: 'x-k',  intVar: 'x', transVar: 'k',   intDisplay: 'x', transDisplay: 'k' },
  { id: 'x-xi', intVar: 'x', transVar: 'xi',  intDisplay: 'x', transDisplay: 'ξ' },
  { id: 'custom', intVar: '', transVar: '',    intDisplay: '', transDisplay: '' },
];

@Component({
  selector: 'app-fourier-integral',
  templateUrl: './fourier-integral.component.html',
  imports: [
    NgTemplateOutlet,
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
  private readonly intervalValidator = inject(LatexToMaximaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly ngZone = inject(NgZone);
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
  readonly variants: { id: string; labelKey: string }[] = [
    { id: 'trigonometric', labelKey: 'fourier-integral.trigonometric' },
    { id: 'cosine',        labelKey: 'fourier-integral.cosine' },
    { id: 'sine',          labelKey: 'fourier-integral.sine' },
    { id: 'complex',       labelKey: 'fourier-integral.complex' },
  ];

  /** Exposed var-pair list for template iteration. */
  readonly varPairs = FI_VAR_PAIRS;

  // ── State ──────────────────────────────────────────────────────────────────

  readonly variant = signal<FourierIntegralVariant>('trigonometric');
  readonly segments = signal<TransformSegmentDraft[]>([defaultSegment()]);
  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly coeffResult = signal<FourierIntegralCoefficientsResponse | null>(null);

  // ── Alt forms ─────────────────────────────────────────────────────────────
  readonly altFormsA = signal<AltForm[]>([]);
  readonly altFormsB = signal<AltForm[]>([]);
  readonly altFormsC = signal<AltForm[]>([]);
  readonly altFormsLoadingA = signal(false);
  readonly altFormsLoadingB = signal(false);
  readonly altFormsLoadingC = signal(false);
  readonly altFormsOpenA = signal(false);
  readonly altFormsOpenB = signal(false);
  readonly altFormsOpenC = signal(false);

  // ── Variable selector ─────────────────────────────────────────────────────
  readonly selectedPairId = signal<string>('t-w');
  readonly customIntVar = signal<string>('v');
  readonly customTransVar = signal<string>('w');

  // ── Reconstruction / slider ────────────────────────────────────────────────
  readonly upperLimit = signal(8);
  readonly upperLimitMin = 1;
  readonly upperLimitMax = 64;
  readonly showReconstruction = signal(false);
  readonly reconstructPoints = signal<ReconstructPoint[]>([]);
  readonly reconstructFn = signal<((x: number) => number) | null>(null);

  // ── Interval validation ───────────────────────────────────────────────────
  readonly continuityErrors = signal<(string | null)[]>([null]);
  readonly orderErrors = signal<boolean[]>([false]);
  readonly continuityValidating = signal(false);

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

  readonly evaluationParams = computed<ParamValues>(() => {
    const names = this.activeParams();
    const pv = this.paramValues();
    const merged: ParamValues = { ...pv };
    for (const name of names) {
      if (!Number.isFinite(merged[name])) merged[name] = 1;
    }
    return merged;
  });

  /** Name of param used for custom axis unit (null = first param). */
  readonly customConstName = signal<string | null>(null);

  readonly customConst = computed(() => {
    const params = this.activeParams();
    const pv = this.paramValues();
    const name = this.customConstName() ?? params[0];
    if (!name) return { symbol: 'a', value: 1 };
    return { symbol: name, value: pv[name] ?? 1 };
  });

  // ── Fullscreen / share / favorite / mobile ────────────────────────────────
  readonly isMobile = signal(typeof window !== 'undefined' && window.innerWidth < 1024);
  readonly isFullscreen = signal(false);
  readonly urlCopied = signal(false);
  readonly showShareDialog = signal(false);
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
    this.segments().every((s) => s.expression.trim() && s.from.trim() && s.to.trim()) &&
    !this.continuityValidating() &&
    this.continuityErrors().every((e) => e === null) &&
    this.orderErrors().every((e) => !e),
  );

  readonly hasResult = computed(() => this.coeffResult() !== null);
  readonly inputsLocked = computed(() => this.loading() || this.hasResult());

  readonly variantLabelKey = computed(() => {
    const v = this.variant();
    if (v === 'trigonometric') return 'fourier-integral.variantTrigonometric';
    if (v === 'complex') return 'fourier-integral.variantComplex';
    if (v === 'cosine') return 'fourier-integral.variantCosine';
    return 'fourier-integral.variantSine';
  });

  /** Live LaTeX preview of the piecewise input function — always shows f(v), never the integral result. */
  readonly previewLatex = computed<string | null>(() => {
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
    return `f(${iv}) \\approx \\int_{0}^{${a}} \\left(A(${tv})\\cos(${tv}${iv}) + B(${tv})\\sin(${tv}${iv})\\right) d${tv}`;
  });

  // ── Helpers for template type safety ─────────────────────────────────────
  castVariant(v: string): FourierIntegralVariant {
    return v as FourierIntegralVariant;
  }

  // ── Canvas layers ─────────────────────────────────────────────────────────

  readonly layers = computed<PlotLayer[]>(() => {
    const pts     = this.reconstructPoints();
    const segs    = this.segments();
    const pv      = this.evaluationParams();
    const intVariable = this.intVar();
    const origColor  = this.originalColor();
    const recColor   = this.reconstructColor();
    const showOrig   = this.showOriginal();
    const showRec    = this.showReconstruct();
    const origLW     = this.originalLineWidth();
    const recLW      = this.reconstructLineWidth();
    const origDashed = this.originalDashed();
    const recDashed  = this.reconstructDashed();

    // Pre-sampled MathPoints passed as a Curve: drawCurve converts to screen coords
    // on every frame so zoom works correctly without recomputing the Riemann sum.
    const recCurves: Curve[] = (showRec && pts.length >= 2)
      ? [{ points: pts, color: recColor, lineWidth: recLW, dashed: recDashed }]
      : [];

    return [{
      curves: recCurves,
      onDraw: (ctx, vp) => {
        if (!showOrig) return;
        const evalBound = (v: string): number => {
          const fn = this.mathUtils.compile(v, '_', pv);
          if (!fn) return NaN;
          try { const r = fn(0); return isFinite(r) ? r : NaN; } catch { return NaN; }
        };
        const pieces: { fn: (x: number) => number; from: number; to: number }[] = [];
        for (const seg of segs) {
          if (!seg.expression || !seg.from || !seg.to) continue;
          const from = seg.from === 'minf' || seg.from === '-inf'
            ? -Infinity
            : evalBound(seg.from);
          const to = seg.to === 'inf'
            ? Infinity
            : evalBound(seg.to);
          const fn = this.mathUtils.compile(seg.expression, intVariable, pv);
          if (!fn) continue;
          if (isFinite(from) && isFinite(to)) {
            pieces.push({ fn, from, to });
          } else {
            const gated = (x: number) =>
              x >= (isFinite(from) ? from : -Infinity) && x <= (isFinite(to) ? to : Infinity) ? fn(x) : NaN;
            this.plotter.plotFn(ctx, gated, vp, { color: origColor, lineWidth: origLW, dashed: origDashed });
          }
        }
        if (pieces.length > 0) {
          this.plotter.plotPiecewise(ctx, pieces, vp, { color: origColor, lineWidth: origLW, dashed: origDashed });
        }
      },
    }];
  });

  private urlPopulated = false;

  constructor() {
    // ── 1. Restore state from router navigation state or URL ──────────────
    const navState = this.router.getCurrentNavigation()?.extras.state as
      | { restoreInput?: Record<string, unknown> }
      | undefined;
    const encoded = this.route.snapshot.queryParamMap.get('s');
    let needsCalculate = false;
    if (navState?.restoreInput) {
      this.restoreFromInput(navState.restoreInput);
      needsCalculate = true;
    } else if (encoded) {
      needsCalculate = this.restoreState(encoded);
    }

    // ── 2. Auto-calculate once auth is initialized ────────────────────────
    const canCalculate$ = toObservable(this.canCalculate);
    if (needsCalculate) {
      toObservable(this.userStore.initialized)
        .pipe(
          filter(Boolean),
          take(1),
          switchMap(() => timer(0)),
          switchMap(() => canCalculate$.pipe(filter(Boolean), take(1))),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => this.calculate());
    }

    // ── 3. Sync result → URL ──────────────────────────────────────────────
    effect(() => {
      const res = this.coeffResult();
      if (res) {
        this.urlPopulated = true;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { s: this.encodeState() },
          replaceUrl: true,
        });
      } else if (this.urlPopulated) {
        this.urlPopulated = false;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      }
    });

    // Riemann reconstruction — re-runs reactively when any input changes,
    // debounced 80ms so continuous slider drag doesn't block the UI thread.
    let _rTimer: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      const res = this.coeffResult();
      const limit = this.upperLimit();
      const show = this.showReconstruction();
      const pv = this.evaluationParams();
      const tv = this.transVar();
      const iv = this.intVar();
      const variant = this.variant();
      const segs = this.segments();

      if (_rTimer) clearTimeout(_rTimer);

      if (!res?.exists || !show) {
        this.reconstructFn.set(null);
        this.reconstructPoints.set([]);
        return;
      }

      // Compute a dense table of MathPoints once. drawCurve handles the
      // math→screen transform on every redraw, so zoom works correctly
      // without recomputing. NX=1500 gives smooth curves at any resolution.
      this.ngZone.runOutsideAngular(() => {
        _rTimer = setTimeout(() => {
          const aFn   = (variant !== 'sine'   && res.A?.maxima)        ? this.mathUtils.compile(res.A.maxima,        tv, pv) : null;
          const bFn   = (variant !== 'cosine' && res.B?.maxima)        ? this.mathUtils.compile(res.B.maxima,        tv, pv) : null;
          const cReFn = res.realPart?.maxima ? this.mathUtils.compile(res.realPart.maxima, tv, pv) : null;
          const cImFn = res.imagPart?.maxima ? this.mathUtils.compile(res.imagPart.maxima, tv, pv) : null;

          // Keep dw ≤ 0.05 regardless of limit so the Riemann sum stays accurate
          // at high A values and doesn't produce spurious Gibbs spikes.
          const NW  = Math.max(600, Math.ceil(limit / 0.05));
          const NX  = 1500;

          // Precompute w-grid values into typed arrays (evaluated once per coefficient change)
          let wArr: Float64Array, reA: Float64Array, imA: Float64Array;
          if (variant === 'complex') {
            const dw2 = (2 * limit) / NW;
            wArr = new Float64Array(NW + 1);
            reA  = new Float64Array(NW + 1);
            imA  = new Float64Array(NW + 1);
            for (let j = 0; j <= NW; j++) {
              const w    = -limit + j * dw2;
              const absW = Math.abs(w) < 1e-10 ? 1e-10 : Math.abs(w);
              const wt   = (j === 0 || j === NW) ? dw2 * 0.5 : dw2;
              wArr[j] = w;
              reA[j]  = (cReFn ? cReFn(absW) : 0) * wt;
              imA[j]  = (cImFn ? cImFn(absW) : 0) * Math.sign(w) * wt;
            }
          } else {
            // Use midpoint rule: shift grid by dw/2 so w=0 is never evaluated.
            // This avoids 1/w singularities in A(w) and B(w).
            const dw = limit / NW;
            wArr = new Float64Array(NW);
            reA  = new Float64Array(NW);
            imA  = new Float64Array(NW);
            for (let j = 0; j < NW; j++) {
              const w = (j + 0.5) * dw;
              wArr[j] = w;
              reA[j]  = (aFn ? (aFn(w) || 0) : 0) * dw;
              imA[j]  = (bFn ? (bFn(w) || 0) : 0) * dw;
            }
          }

          // Fixed wide range so reconstruction is visible at any typical zoom level.
          // The Fourier integral converges on all of ℝ, not just over the segment.
          const evalB = (v: string) => {
            const fn = this.mathUtils.compile(v, '_', pv);
            if (!fn) return NaN;
            try { const r = fn(0); return isFinite(r) ? r : NaN; } catch { return NaN; }
          };
          const segMins = segs.map(s => evalB(s.from)).filter(isFinite);
          const segMaxs = segs.map(s => evalB(s.to)).filter(isFinite);
          const allBounds = [...segMins, ...segMaxs];
          const segSpan = segMins.length && segMaxs.length
            ? (Math.max(...segMaxs) - Math.min(...segMins)) : 2;
          const pad  = Math.max(10, segSpan * 1.5);
          const mid  = allBounds.length
            ? (Math.min(...allBounds) + Math.max(...allBounds)) / 2 : 0;
          const xMin = mid - pad;
          const xMax = mid + pad;

          // Estimate Y range from original segments to clip Gibbs overshoots.
          // For infinite bounds, clamp to a finite sampling window.
          let yAbsMax = 1;
          for (const seg of segs) {
            let fFrom = evalB(seg.from);
            let fTo   = evalB(seg.to);
            if (!isFinite(fFrom)) fFrom = xMin;
            if (!isFinite(fTo))   fTo   = xMax;
            const fn = this.mathUtils.compile(seg.expression, iv, pv);
            if (!fn) continue;
            for (let k = 0; k <= 20; k++) {
              const xk = fFrom + (k / 20) * (fTo - fFrom);
              try {
                const yk = fn(xk);
                if (isFinite(yk)) yAbsMax = Math.max(yAbsMax, Math.abs(yk));
              } catch { /* skip */ }
            }
          }
          const yClip = yAbsMax * 4;

          // Sample reconstruction at NX evenly-spaced x points
          const points: ReconstructPoint[] = [];
          for (let xi = 0; xi < NX; xi++) {
            const x = xMin + (xi / (NX - 1)) * (xMax - xMin);
            let y = 0;
            if (variant === 'complex') {
              for (let j = 0; j <= NW; j++) {
                const w = wArr[j];
                const c = reA[j] * Math.cos(w * x) - imA[j] * Math.sin(Math.abs(w) * x);
                if (isFinite(c)) y += c;
              }
            } else {
              for (let j = 0; j < NW; j++) {
                const c = reA[j] * Math.cos(wArr[j] * x) + imA[j] * Math.sin(wArr[j] * x);
                if (isFinite(c)) y += c;
              }
            }
            if (isFinite(y) && Math.abs(y) <= yClip) points.push({ x, y });
          }

          this.ngZone.run(() => {
            this.reconstructFn.set(null);
            this.reconstructPoints.set(points);
            this.plotComponent()?.redraw();
          });
        }, 80);
      });
    });

    // ── Interval validation (continuity + order) ─────────────────────────
    toObservable(this.segments)
      .pipe(
        tap((segs) => {
          if (segs.some((s) => s.from && s.to) || segs.length > 1)
            this.continuityValidating.set(true);
        }),
        debounceTime(600),
        switchMap((segs) => {
          const pairIndices: number[] = [];
          const pairs: Array<{ a: string; b: string }> = [];
          for (let i = 0; i < segs.length - 1; i++) {
            if (segs[i].to && segs[i + 1].from) {
              pairIndices.push(i);
              pairs.push({ a: segs[i].to, b: segs[i + 1].from });
            }
          }
          const orderIndices: number[] = [];
          const orderPairs: Array<{ a: string; b: string }> = [];
          for (let i = 0; i < segs.length; i++) {
            if (segs[i].from && segs[i].to) {
              orderIndices.push(i);
              orderPairs.push({ a: segs[i].from, b: segs[i].to });
            }
          }
          if (pairs.length === 0 && orderPairs.length === 0) {
            return of({
              continuity: segs.map(() => null as string | null),
              order: segs.map(() => false),
            });
          }
          return this.intervalValidator.validateBoundaries({ pairs, orderPairs }).pipe(
            switchMap((res) => {
              const continuity: (string | null)[] = segs.map(() => null);
              res.results.forEach((r, ri) => {
                if (r === 'different') continuity[pairIndices[ri]] = 'calculator.segment.continuityGap';
              });
              const order: boolean[] = segs.map(() => false);
              res.orderResults.forEach((r, ri) => {
                if (r === 'invalid') order[orderIndices[ri]] = true;
              });
              return of({ continuity, order });
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ continuity, order }) => {
        this.continuityErrors.set(continuity);
        this.orderErrors.set(order);
        this.continuityValidating.set(false);
      });

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

    // Track viewport width for mobile panel layout
    if (typeof window !== 'undefined') {
      const onResize = () => this.isMobile.set(window.innerWidth < 1024);
      window.addEventListener('resize', onResize);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
    }
  }

  ngOnInit(): void {
    this.seo.setPage(
      'seo.fourierIntegral.title',
      'seo.fourierIntegral.description',
      'Fourier integral, integral de Fourier, A(w), B(w), C(w), cosine integral, sine integral',
    );

    // reconstruction is now a computed signal — no explicit trigger needed
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
      {
        ...emptySegment(),
        from: segs.at(-1)?.to ?? '',
        fromTex: segs.at(-1)?.toTex ?? '',
      },
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
    this.reconstructFn.set(null);
    this.reconstructPoints.set([]);
    this.errorMsg.set(null);
    this.showReconstruction.set(false);
    this.showCanvasSettings.set(false);
    this.showShareDialog.set(false);
    this.paramValues.set({});
    this.paramSliders()?.reset();
    this.latestHistoryEntry.set(null);
    this.favoriteName = '';
    this.showFavoriteDialog.set(false);
    this.urlCopied.set(false);
    this.altFormsA.set([]); this.altFormsOpenA.set(false);
    this.altFormsB.set([]); this.altFormsOpenB.set(false);
    this.altFormsC.set([]); this.altFormsOpenC.set(false);
  }

  calculate(): void {
    if (this.inputsLocked() || !this.canCalculate()) return;

    this.loading.set(true);
    this.errorMsg.set(null);
    this.coeffResult.set(null);

    this.api
      .calculateFourierIntegralCoefficients({
        segments: this.segments().map((s) => ({
          expression: s.expression,
          expressionTex: s.expressionTex,
          from: s.from,
          fromTex: s.fromTex,
          to: s.to,
          toTex: s.toTex,
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
          if (res.exists) this.showReconstruction.set(true);
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

  get shareHref(): string {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }

  openShareDialog(): void {
    this.showShareDialog.set(true);
  }

  async copyShareUrl(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.urlCopied.set(true);
      setTimeout(() => this.urlCopied.set(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  // ── Alt forms ─────────────────────────────────────────────────────────────

  toggleAltForms(coeff: 'A' | 'B' | 'C'): void {
    const openSig = coeff === 'A' ? this.altFormsOpenA : coeff === 'B' ? this.altFormsOpenB : this.altFormsOpenC;
    const formsSig = coeff === 'A' ? this.altFormsA : coeff === 'B' ? this.altFormsB : this.altFormsC;
    const loadSig  = coeff === 'A' ? this.altFormsLoadingA : coeff === 'B' ? this.altFormsLoadingB : this.altFormsLoadingC;
    const nowOpen = !openSig();
    openSig.set(nowOpen);
    if (!nowOpen || formsSig().length > 0) return;
    const res = this.coeffResult();
    if (!res) return;
    const expr = coeff === 'A' ? res.A : coeff === 'B' ? res.B : res.C;
    if (!expr?.maxima) return;
    loadSig.set(true);
    this.runAltForms(expr, (forms) => { formsSig.set(forms); loadSig.set(false); });
  }

  private runAltForms(
    main: { maxima: string; tex: string },
    done: (forms: AltForm[]) => void,
  ): void {
    const mainExpr = main.maxima;
    const profiles: Array<{ labelKey: string; req: SimplifyRequest }> = [
      { labelKey: 'transforms.altFormFactor', req: { expression: mainExpr, profile: 'complete', functions: ['factor'] } },
      { labelKey: 'transforms.altFormExpand', req: { expression: mainExpr, profile: 'complete', functions: ['expand'] } },
      { labelKey: 'transforms.altFormTrig',   req: { expression: mainExpr, profile: 'complete', functions: ['trigreduce'], displayFlags: { demoivre: true } } },
      { labelKey: 'transforms.altFormRect',   req: { expression: mainExpr, profile: 'complete', functions: ['rectform'] } },
      { labelKey: 'transforms.altFormExp',    req: { expression: mainExpr, profile: 'complete', functions: ['radcan', 'expand', 'combine'], displayFlags: { exponentialize: true } } },
    ];
    forkJoin(profiles.map(({ req }) => this.api.simplify(req).pipe(catchError(() => of(null)))))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results: (SimplifyResponse | null)[]) => {
        const normalize = (s: string) => s.replace(/\s+/g, '');
        const seen = new Set<string>();
        if (main.tex) seen.add(normalize(main.tex));
        const forms: AltForm[] = [];
        results.forEach((r, i) => {
          if (!r) return;
          const { tex, maxima } = r.simplified;
          if (!tex || !maxima) return;
          const norm = normalize(tex);
          if (seen.has(norm)) return;
          seen.add(norm);
          forms.push({ labelKey: profiles[i].labelKey, tex, maxima });
        });
        done(forms);
      });
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

  display(tex: string): string {
    return `\\[${tex}\\]`;
  }

  // ── State encode / restore (share URL + history) ──────────────────────────

  encodeState(): string {
    const state = {
      v: this.variant(),
      vp: this.selectedPairId(),
      civ: this.customIntVar(),
      ctv: this.customTransVar(),
      seg: this.segments().map((s) => ({
        e: s.expression,
        et: s.expressionTex,
        f: s.from,
        ft: s.fromTex,
        t: s.to,
        tt: s.toTex,
      })),
    };
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    } catch {
      return '';
    }
  }

  restoreState(encoded: string): boolean {
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const s = JSON.parse(json) as {
        v?: string;
        vp?: string;
        civ?: string;
        ctv?: string;
        seg: Array<{ e: string; et: string; f: string; ft: string; t: string; tt: string }>;
      };
      if (!Array.isArray(s.seg) || !s.seg.length) return false;

      const validVariants: FourierIntegralVariant[] = ['trigonometric', 'complex', 'cosine', 'sine'];
      if (s.v && validVariants.includes(s.v as FourierIntegralVariant)) {
        this.variant.set(s.v as FourierIntegralVariant);
      }
      if (s.vp) this.selectedPairId.set(s.vp);
      if (s.civ) this.customIntVar.set(s.civ);
      if (s.ctv) this.customTransVar.set(s.ctv);
      this.segments.set(
        s.seg.map((seg) => ({
          id: mkId(),
          expression: seg.e ?? '',
          expressionTex: seg.et ?? '',
          from: seg.f ?? '',
          fromTex: seg.ft ?? '',
          to: seg.t ?? '',
          toTex: seg.tt ?? '',
        })),
      );
      return true;
    } catch {
      return false;
    }
  }

  restoreFromInput(input: Record<string, unknown>): void {
    const rawSegs = input['segments'] as
      | Array<{
          expression: string;
          expressionTex?: string;
          from: string;
          fromTex?: string;
          to: string;
          toTex?: string;
        }>
      | undefined;
    if (!rawSegs?.length) return;

    const variant = input['variant'] as FourierIntegralVariant | undefined;
    if (variant) this.variant.set(variant);

    const intVar = input['intVar'] as string | undefined;
    const transVar = input['transVar'] as string | undefined;
    if (intVar && transVar) {
      const match = FI_VAR_PAIRS.find((p) => p.intVar === intVar && p.transVar === transVar);
      if (match) {
        this.selectedPairId.set(match.id);
      } else {
        this.selectedPairId.set('custom');
        this.customIntVar.set(intVar);
        this.customTransVar.set(transVar);
      }
    }

    this.segments.set(
      rawSegs.map((seg) => ({
        id: mkId(),
        expression: seg.expression ?? '',
        expressionTex: seg.expressionTex ?? seg.expression ?? '',
        from: seg.from ?? '',
        fromTex: seg.fromTex ?? seg.from ?? '',
        to: seg.to ?? '',
        toTex: seg.toTex ?? seg.to ?? '',
      })),
    );
  }
}
