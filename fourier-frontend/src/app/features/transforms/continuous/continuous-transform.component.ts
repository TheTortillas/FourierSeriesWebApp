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
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, filter, map, of, switchMap, take, tap } from 'rxjs';

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
import { DrawingUtilsService } from '../../../core/services/canvas/drawing-utils.service';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { ParamSlidersComponent } from '../../../shared/components/param-sliders/param-sliders.component';
import type { ParamValues } from '../../../shared/components/param-sliders/param-sliders.component';
import { TransformSegmentComponent, TransformSegmentDraft } from './transform-segment.component';
import { LatexToMaximaService } from '../../../core/services/math/latex-to-maxima.service';
import {
  FourierTransformResponse,
  InverseFourierTransformResponse,
} from '../../../domain/types/transform.types';
import { HistoryEntry } from '../../../domain';

let _nextId = 0;
const mkId = () => `ts-${++_nextId}`;

function emptySegment(): TransformSegmentDraft {
  return { id: mkId(), expression: '', expressionTex: '', from: '', fromTex: '', to: '', toTex: '' };
}

/** Default FT example: sinc function sin(πt)/(πt) */
function defaultSegmentFt(): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: 'sin(%pi*t)/(%pi*t)',
    expressionTex: '\\frac{\\sin\\left(\\pi t\\right)}{\\pi t}',
    from: 'minf',
    fromTex: '-\\infty',
    to: 'inf',
    toTex: '\\infty',
  };
}

/** Default IFT example: 1/(a + iw) — one-sided exponential spectrum */
function defaultSegmentIft(): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: '1/(a+%i*w)',
    expressionTex: '\\frac{1}{a+iw}',
    from: 'minf',
    fromTex: '-\\infty',
    to: 'inf',
    toTex: '\\infty',
  };
}

interface VarPair {
  id: string;
  time: string;
  freq: string;
  timeDisplay: string;
  freqDisplay: string;
}

const VAR_PAIRS: VarPair[] = [
  { id: 't-w', time: 't', freq: 'w', timeDisplay: 't', freqDisplay: 'ω' },
  { id: 't-f', time: 't', freq: 'f', timeDisplay: 't', freqDisplay: 'f' },
  { id: 't-nu', time: 't', freq: 'nu', timeDisplay: 't', freqDisplay: 'ν' },
  { id: 'x-xi', time: 'x', freq: 'xi', timeDisplay: 'x', freqDisplay: 'ξ' },
  { id: 'x-k', time: 'x', freq: 'k', timeDisplay: 'x', freqDisplay: 'k' },
  { id: 'custom', time: '', freq: '', timeDisplay: '', freqDisplay: '' },
];

interface TransformColorPreset {
  original: string;
  result: string;
  imag: string;
  mag: string;
}

function getTransformColorPreset(isDark: boolean, isNeutral: boolean): TransformColorPreset {
  if (!isNeutral && !isDark) {
    return {
      original: '#c14030',
      result: '#2563eb',
      imag: '#d97706',
      mag: '#16a34a',
    };
  }

  if (!isNeutral && isDark) {
    return {
      original: '#e0ad74',
      result: '#7db7e8',
      imag: '#f6b26b',
      mag: '#7dd3a0',
    };
  }

  if (isNeutral && !isDark) {
    return {
      original: '#2563eb',
      result: '#0f766e',
      imag: '#c2410c',
      mag: '#4f46e5',
    };
  }

  return {
    original: '#60a5fa',
    result: '#2dd4bf',
    imag: '#fb923c',
    mag: '#a78bfa',
  };
}

@Component({
  selector: 'app-continuous-transform',
  templateUrl: './continuous-transform.component.html',
  imports: [
    NavComponent,
    MathjaxDirective,
    FunctionPlotComponent,
    TransformSegmentComponent,
    ParamSlidersComponent,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
  ],
})
export class ContinuousTransformComponent implements OnInit {
  readonly api = inject(ApiService);
  readonly userStore  = inject(UserStore);
  private readonly transloco  = inject(TranslocoService);
  private readonly seo        = inject(SeoService);
  private readonly intervalValidator = inject(LatexToMaximaService);

  ngOnInit(): void {
    this.seo.setPage('seo.transforms.title', 'seo.transforms.description');
  }
  readonly plotter = inject(PlottingService);
  private readonly drawingUtils = inject(DrawingUtilsService);
  private readonly mathUtils = inject(MathUtilsService);
  readonly theme = inject(ThemeService);
  readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly mode = signal<'ft' | 'ift'>('ft');
  readonly varPairId = signal<string>('t-w');
  readonly customTime = signal('t');
  readonly customFreq = signal('w');
  readonly segments = signal<TransformSegmentDraft[]>([defaultSegmentFt()]);
  readonly continuityErrors = signal<(string | null)[]>([null]);
  readonly orderErrors = signal<boolean[]>([false]);
  readonly continuityValidating = signal(false);
  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly ftResult = signal<FourierTransformResponse | null>(null);
  readonly iftResult = signal<InverseFourierTransformResponse | null>(null);

  // ── Canvas layer toggles ─────────────────────────────────────────────────
  readonly showOriginal = signal(true);
  readonly showReal = signal(true);
  readonly showImag = signal(true);
  readonly showMag = signal(false);

  // ── Canvas style settings ────────────────────────────────────────────────
  readonly xAxisFormat = signal<'integer' | 'pi' | 'e' | 'custom'>('integer');
  readonly originalColor = signal('#c14030');
  readonly resultColor = signal('#2563eb');
  readonly imagColor = signal('#d97706');
  readonly magColor = signal('#16a34a');
  readonly customOriginalColor = signal(false);
  readonly customResultColor = signal(false);
  readonly customImagColor = signal(false);
  readonly customMagColor = signal(false);
  readonly originalLineWidth = signal(2);
  readonly resultLineWidth = signal(2);
  readonly showCanvasSettings = signal(false);

  // ── Favorites ─────────────────────────────────────────────────────────────
  readonly latestHistoryEntry = signal<HistoryEntry | null>(null);
  readonly favoriteLoading    = signal(false);
  readonly showFavoriteDialog = signal(false);
  favoriteName = '';

  // ── Free parameter sliders ────────────────────────────────────────────────
  readonly paramValues = signal<ParamValues>({});

  readonly activeParams = computed<string[]>(() => {
    const ft = this.ftResult();
    const ift = this.iftResult();
    return (ft ?? ift)?.params ?? [];
  });

  /** Name of the param currently used for the custom axis unit (null = first param). */
  readonly customConstName = signal<string | null>(null);

  /** Axis constant used when xAxisFormat === 'custom'. */
  readonly customConst = computed(() => {
    const params = this.activeParams();
    const pv = this.paramValues();
    const name = this.customConstName() ?? params[0];
    if (!name) return { symbol: 'a', value: 1 };
    return { symbol: name, value: pv[name] ?? 1 };
  });

  // ── Share / fullscreen ────────────────────────────────────────────────────
  readonly showShareDialog = signal(false);
  readonly urlCopied = signal(false);
  readonly isFullscreen = signal(false);

  readonly canvasWrapper = viewChild<ElementRef<HTMLDivElement>>('canvasWrapper');
  readonly plotComponent = viewChild(FunctionPlotComponent);
  readonly paramSliders = viewChild(ParamSlidersComponent);

  readonly varPairs = VAR_PAIRS;

  private urlPopulated = false;

  constructor() {
    effect(() => {
      void this.theme.theme();
      void this.theme.palette();
      const preset = this.currentColorPreset();
      if (!this.customOriginalColor()) this.originalColor.set(preset.original);
      if (!this.customResultColor()) this.resultColor.set(preset.result);
      if (!this.customImagColor()) this.imagColor.set(preset.imag);
      if (!this.customMagColor()) this.magColor.set(preset.mag);
    });

    // ── Interval validation (continuity + order) ─────────────────────────
    toObservable(this.segments).pipe(
      tap((segs) => {
        if (segs.some((s) => s.from && s.to) || segs.length > 1) this.continuityValidating.set(true);
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
          return of({ continuity: segs.map(() => null as string | null), order: segs.map(() => false) });
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
    ).subscribe(({ continuity, order }) => {
      this.continuityErrors.set(continuity);
      this.orderErrors.set(order);
      this.continuityValidating.set(false);
    });

    // Track native fullscreen changes
    if (typeof document !== 'undefined') {
      const handler = () => this.isFullscreen.set(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handler);
      this.destroyRef.onDestroy(() => document.removeEventListener('fullscreenchange', handler));
    }

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
    // Wait for initFromStorage() to complete so the Bearer token is in memory
    // before the API call goes out. Using afterNextRender caused a race condition
    // where the calculate request was sent unauthenticated → false 429.
    if (needsCalculate) {
      toObservable(this.userStore.initialized)
        .pipe(filter(Boolean), take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.calculate();
        });
    }

    // ── 3. Reset custom axis when result changes ──────────────────────────
    effect(() => {
      this.ftResult();
      this.iftResult(); // track both
      this.customConstName.set(null);
    });

    // ── 4. Sync result → URL ──────────────────────────────────────────────
    effect(() => {
      const ft = this.ftResult();
      const ift = this.iftResult();
      if (ft || ift) {
        this.urlPopulated = true;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { s: this.encodeState() },
          replaceUrl: true,
        });
      } else if (this.urlPopulated) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      }
    });
  }

  readonly currentColorPreset = computed(() =>
    getTransformColorPreset(this.theme.isDark, this.theme.isNeutral),
  );

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly activePair = computed<VarPair>(() => {
    const id = this.varPairId();
    if (id === 'custom') {
      const t = this.customTime() || 't';
      const f = this.customFreq() || 'w';
      return { id: 'custom', time: t, freq: f, timeDisplay: t, freqDisplay: f };
    }
    return VAR_PAIRS.find((p) => p.id === id) ?? VAR_PAIRS[0];
  });

  readonly intVar = computed(() => {
    const p = this.activePair();
    return this.mode() === 'ft' ? p.time : p.freq;
  });

  readonly transVar = computed(() => {
    const p = this.activePair();
    return this.mode() === 'ft' ? p.freq : p.time;
  });

  readonly inputFnLabel = computed(() => {
    const p = this.activePair();
    const v = this.mode() === 'ft' ? p.timeDisplay : p.freqDisplay;
    return this.mode() === 'ft' ? `f(${v})` : `F(${v})`;
  });

  readonly resultVarDisplay = computed(() => {
    const p = this.activePair();
    return this.mode() === 'ft' ? p.freqDisplay : p.timeDisplay;
  });

  readonly canCalculate = computed(() =>
    this.segments().every((s) => s.expression.trim() && s.from.trim() && s.to.trim()) &&
    !this.continuityValidating() &&
    this.continuityErrors().every((e) => e === null) &&
    this.orderErrors().every((e) => !e),
  );

  /** True when any input segment contains the imaginary unit (%i). */
  readonly hasComplexInputs = computed(() =>
    this.segments().some((s) => s.expression.includes('%i')),
  );

  readonly hasComputedResult = computed(
    () => this.ftResult() !== null || this.iftResult() !== null,
  );
  readonly inputsLocked = computed(() => this.loading() || this.hasComputedResult());

  // ── Canvas layers ─────────────────────────────────────────────────────────

  readonly layers = computed<PlotLayer[]>(() => {
    const ft = this.ftResult();
    const ift = this.iftResult();
    const segs = this.segments();
    const intVariable = this.intVar();
    const transVariable = this.transVar();

    const showOrig = this.showOriginal();
    const showRe = this.showReal();
    const showIm = this.showImag();
    const showM = this.showMag();

    const origColor = this.originalColor();
    const reColor = this.resultColor();
    const imColor = this.imagColor();
    const mgColor = this.magColor();
    const origLW = this.originalLineWidth();
    const resLW = this.resultLineWidth();

    const plotter = this.plotter;
    const pv = this.paramValues();

    const layer: PlotLayer = {
      curves: [],
      onDraw: (ctx, vp) => {
        // ── Input function preview (FT and IFT modes) ────────────────────
        // In FT mode intVariable = time var (t); in IFT mode = freq var (w).
        // compile() returns null for complex-valued expressions, so those
        // segments are silently skipped — the template shows a notice instead.
        if (showOrig) {
          for (const seg of segs) {
            const fn = this.mathUtils.compile(seg.expression, intVariable, pv);
            const from = this.parseLimit(seg.from, pv);
            const to = this.parseLimit(seg.to, pv);
            if (!fn) continue;
            if (isFinite(from) && isFinite(to)) {
              plotter.plotFnRange(ctx, fn, from, to, 400, vp, {
                color: origColor,
                lineWidth: origLW,
              });
            } else {
              const gated = (x: number) => (x >= from && x <= to ? fn(x) : NaN);
              plotter.plotFn(ctx, gated, vp, { color: origColor, lineWidth: origLW });
            }
            // Draw Dirac delta terms (FT mode only — IFT inputs are rarely delta)
            if (this.mode() === 'ft') {
              for (const { pos, weight } of this.mathUtils.parseDeltaTerms(
                seg.expression,
                intVariable,
                pv,
              )) {
                if (pos >= from && pos <= to) {
                  this.drawingUtils.drawImpulse(ctx, vp, pos, weight, origColor, origLW);
                }
              }
            }
          }
        }

        // ── FT result layers ─────────────────────────────────────────────
        if (ft?.exists) {
          const reFn =
            showRe && ft.realPart?.maxima
              ? this.mathUtils.compile(ft.realPart.maxima, transVariable, pv)
              : null;
          const imFn =
            showIm && ft.imagPart?.maxima
              ? this.mathUtils.compile(ft.imagPart.maxima, transVariable, pv)
              : null;
          const magFn =
            showM && ft.realPart?.maxima && ft.imagPart?.maxima
              ? this.buildMagFn(ft.realPart.maxima, ft.imagPart.maxima, transVariable, pv)
              : null;

          if (reFn) plotter.plotFn(ctx, reFn, vp, { color: reColor, lineWidth: resLW });
          if (imFn) plotter.plotFn(ctx, imFn, vp, { color: imColor, lineWidth: resLW });
          if (magFn) plotter.plotFn(ctx, magFn, vp, { color: mgColor, lineWidth: resLW });

          // ── Dirac delta impulses ───────────────────────────────────────
          // compile() already replaces delta(…) with 0, so plotFn produces
          // a flat zero for those terms. We parse delta positions/weights
          // separately and render them as vertical arrows.
          if (showRe && ft.realPart?.maxima) {
            for (const { pos, weight } of this.mathUtils.parseDeltaTerms(
              ft.realPart.maxima,
              transVariable,
              pv,
            )) {
              this.drawingUtils.drawImpulse(ctx, vp, pos, weight, reColor, resLW);
            }
          }
          if (showIm && ft.imagPart?.maxima) {
            for (const { pos, weight } of this.mathUtils.parseDeltaTerms(
              ft.imagPart.maxima,
              transVariable,
              pv,
            )) {
              this.drawingUtils.drawImpulse(ctx, vp, pos, weight, imColor, resLW);
            }
          }
        }

        // ── IFT layers ────────────────────────────────────────────────────
        if (ift?.exists) {
          // Result f(t): keep as independent layer/toggle (showOrig).
          if (showOrig) {
            if (ift.fPositive?.maxima) {
              const raw = this.mathUtils.compile(ift.fPositive.maxima, transVariable, pv);
              const fn = raw ? (x: number) => (x >= 0 ? raw(x) : NaN) : null;
              if (fn) plotter.plotFn(ctx, fn, vp, { color: origColor, lineWidth: origLW });
            }
            if (ift.fNegative?.maxima) {
              const raw = this.mathUtils.compile(ift.fNegative.maxima, transVariable, pv);
              const fn = raw ? (x: number) => (x <= 0 ? raw(x) : NaN) : null;
              if (fn) plotter.plotFn(ctx, fn, vp, { color: origColor, lineWidth: origLW });
            }
          }

          // Input F(ω) split into Re/Im/|F| for inverse mode controls.
          if (showRe && ift.inputRealPart?.maxima) {
            const fn = this.mathUtils.compile(ift.inputRealPart.maxima, intVariable, pv);
            if (fn) plotter.plotFn(ctx, fn, vp, { color: reColor, lineWidth: resLW });
            for (const { pos, weight } of this.mathUtils.parseDeltaTerms(
              ift.inputRealPart.maxima,
              intVariable,
              pv,
            )) {
              this.drawingUtils.drawImpulse(ctx, vp, pos, weight, reColor, resLW);
            }
          }
          if (showIm && ift.inputImagPart?.maxima) {
            const fn = this.mathUtils.compile(ift.inputImagPart.maxima, intVariable, pv);
            if (fn) plotter.plotFn(ctx, fn, vp, { color: imColor, lineWidth: resLW });
            for (const { pos, weight } of this.mathUtils.parseDeltaTerms(
              ift.inputImagPart.maxima,
              intVariable,
              pv,
            )) {
              this.drawingUtils.drawImpulse(ctx, vp, pos, weight, imColor, resLW);
            }
          }

          if (showM) {
            const realExpr = ift.inputRealPart?.maxima ?? '0';
            const imagExpr = ift.inputImagPart?.maxima ?? '0';
            const magFn = this.buildMagFn(realExpr, imagExpr, intVariable, pv);
            if (magFn) plotter.plotFn(ctx, magFn, vp, { color: mgColor, lineWidth: resLW });
          }
        }
      },
    };

    return [layer];
  });

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

    const type = input['type'] as string | undefined;
    if (type === 'inverse_fourier_transform') this.mode.set('ift');
    else this.mode.set('ft');

    const intVar = input['intVar'] as string | undefined;
    const transVar = input['transVar'] as string | undefined;
    if (intVar && transVar) {
      const match = VAR_PAIRS.find((p) => p.time === intVar && p.freq === transVar);
      if (match) {
        this.varPairId.set(match.id);
      } else {
        this.varPairId.set('custom');
        this.customTime.set(intVar);
        this.customFreq.set(transVar);
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

  // ── Mode / var actions ────────────────────────────────────────────────────

  startNewCalculation(): void {
    this.ftResult.set(null);
    this.iftResult.set(null);
    this.errorMsg.set(null);
    this.showCanvasSettings.set(false);
    this.showShareDialog.set(false);
    this.urlCopied.set(false);
    this.paramValues.set({});
    this.paramSliders()?.reset();
    this.latestHistoryEntry.set(null);
    this.favoriteName = '';
    this.showFavoriteDialog.set(false);
  }

  setMode(m: 'ft' | 'ift'): void {
    if (this.inputsLocked()) return;
    this.mode.set(m);
    this.segments.set([m === 'ft' ? defaultSegmentFt() : defaultSegmentIft()]);
    this.ftResult.set(null);
    this.iftResult.set(null);
    this.errorMsg.set(null);
  }

  // ── Segment actions ───────────────────────────────────────────────────────

  addSegment(): void {
    if (this.inputsLocked()) return;
    this.segments.update((s) => [...s, emptySegment()]);
  }

  removeSegment(id: string): void {
    if (this.inputsLocked()) return;
    this.segments.update((s) => s.filter((seg) => seg.id !== id));
  }

  updateSegment(id: string, changes: Partial<TransformSegmentDraft>): void {
    if (this.inputsLocked()) return;
    this.segments.update((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }

  // ── Calculate ─────────────────────────────────────────────────────────────

  calculate(): void {
    if (this.inputsLocked() || !this.canCalculate()) return;

    const segs = this.segments().map((s) => ({
      expression: s.expression,
      expressionTex: s.expressionTex,
      from: s.from,
      fromTex: s.fromTex,
      to: s.to,
      toTex: s.toTex,
    }));
    const intVar = this.intVar();
    const transVar = this.transVar();

    this.loading.set(true);
    this.errorMsg.set(null);
    this.ftResult.set(null);
    this.iftResult.set(null);

    const payload = { segments: segs, intVar, transVar };
    console.log('[transforms] payload →', JSON.stringify(payload, null, 2));

    if (this.mode() === 'ft') {
      this.api
        .calculateFourierTransform(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            console.log('[transforms] FT result ←', res);
            this.ftResult.set(res);
            this.showCanvasSettings.set(true);
            this.loading.set(false);
            this.plotComponent()?.resetView();
            this.userStore.refreshQuota();
            if (this.userStore.isAuthenticated()) this.fetchLatestEntry();
          },
          error: (e) => {
            this.errorMsg.set(formatApiError(
              e,
              this.transloco.translate('errors.generic'),
              (key, params) => this.transloco.translate(key, params ?? {}),
              this.transloco.getActiveLang(),
            ));
            this.loading.set(false);
          },
        });
    } else {
      this.api
        .calculateInverseFourierTransform(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            console.log('[transforms] IFT result ←', res);
            this.iftResult.set(res);
            this.showCanvasSettings.set(true);
            this.loading.set(false);
            this.plotComponent()?.resetView();
            this.userStore.refreshQuota();
            if (this.userStore.isAuthenticated()) this.fetchLatestEntry();
          },
          error: (e) => {
            this.errorMsg.set(formatApiError(
              e,
              this.transloco.translate('errors.generic'),
              (key, params) => this.transloco.translate(key, params ?? {}),
              this.transloco.getActiveLang(),
            ));
            this.loading.set(false);
          },
        });
    }
  }

  // ── URL state persistence ─────────────────────────────────────────────────

  encodeState(): string {
    const state = {
      m: this.mode(),
      vp: this.varPairId(),
      ct: this.customTime(),
      cf: this.customFreq(),
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
        m?: string;
        vp?: string;
        ct?: string;
        cf?: string;
        seg: Array<{ e: string; et: string; f: string; ft: string; t: string; tt: string }>;
      };
      if (!Array.isArray(s.seg) || !s.seg.length) return false;

      if (s.m === 'ft' || s.m === 'ift') this.mode.set(s.m);
      if (s.vp) this.varPairId.set(s.vp);
      if (s.ct) this.customTime.set(s.ct);
      if (s.cf) this.customFreq.set(s.cf);
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

  // ── Share ──────────────────────────────────────────────────────────────────

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
      // clipboard not available
    }
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
    a.download = 'fourier-transform.png';
    a.click();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  display(tex: string): string {
    return `\\[${tex}\\]`;
  }

  onOriginalColorInput(value: string): void {
    this.customOriginalColor.set(true);
    this.originalColor.set(value);
  }

  onResultColorInput(value: string): void {
    this.customResultColor.set(true);
    this.resultColor.set(value);
  }

  onImagColorInput(value: string): void {
    this.customImagColor.set(true);
    this.imagColor.set(value);
  }

  onMagColorInput(value: string): void {
    this.customMagColor.set(true);
    this.magColor.set(value);
  }

  resetLineColorsToPreset(): void {
    const preset = this.currentColorPreset();
    this.customOriginalColor.set(false);
    this.customResultColor.set(false);
    this.customImagColor.set(false);
    this.customMagColor.set(false);
    this.originalColor.set(preset.original);
    this.resultColor.set(preset.result);
    this.imagColor.set(preset.imag);
    this.magColor.set(preset.mag);
  }

  private buildMagFn(
    reExpr: string,
    imExpr: string,
    variable: string,
    params?: ParamValues,
  ): ((x: number) => number) | null {
    const reFn = this.mathUtils.compile(reExpr, variable, params);
    const imFn = this.mathUtils.compile(imExpr, variable, params);
    if (!reFn || !imFn) return null;
    return (x: number) => {
      const re = reFn(x);
      const im = imFn(x);
      return isFinite(re) && isFinite(im) ? Math.sqrt(re * re + im * im) : NaN;
    };
  }

  /** Convert a Maxima limit string (inf, minf, %pi, numbers, param exprs) to a JS number. */
  parseLimit(s: string, params?: ParamValues): number {
    if (!s?.trim()) return NaN;
    if (s === 'inf' || s === '+inf') return Infinity;
    if (s === 'minf' || s === '-inf') return -Infinity;
    // When params are provided, try to resolve symbolic bounds (e.g. -T/2).
    if (params && Object.keys(params).length > 0) {
      const fn = this.mathUtils.compile(s, '_', params);
      const v = fn?.(0);
      if (v !== undefined && isFinite(v)) return v;
    }
    // Fallback: constant expression (%pi, %e, numbers).
    const result = this.mathUtils.evaluate(s, 0, '_');
    return isFinite(result) ? result : NaN;
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
}
