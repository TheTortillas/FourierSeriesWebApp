import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  DestroyRef,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  filter,
  forkJoin,
  map,
  of,
  pairwise,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';

import { NavComponent } from '../../../shared/components/nav/nav.component';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../shared/components/function-plot/function-plot.component';
import { ApiService } from '../../../core/services/api/api.service';
import { UserStore } from '../../../core/services/auth/user.store';
import { FeedbackService } from '../../../core/services/feedback/feedback.service';
import { SurveyService } from '../../../core/services/survey/survey.service';
import { formatApiError } from '../../../shared/utils/api-error.utils';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { DrawingUtilsService } from '../../../core/services/canvas/drawing-utils.service';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import type { ParamValues } from '../../../shared/components/param-sliders/param-sliders.component';
import { TransformSegmentComponent, TransformSegmentDraft } from './transform-segment.component';
import { LatexToMaximaService } from '../../../core/services/math/latex-to-maxima.service';
import { MathquillService, KeyBtn } from '../../../core/services/math/mathquill.service';
import { MobileMathKeyboardComponent } from '../../../shared/components/math-keyboard/mobile-math-keyboard.component';
import { ExportButtonComponent } from '../../../shared/components/export-button/export-button.component';
import { CanvasShellComponent } from '../../../shared/components/canvas-shell/canvas-shell.component';
import {
  FourierTransformResponse,
  InverseFourierTransformResponse,
  NormalizationConvention,
  SimplifyRequest,
  SimplifyResponse,
} from '../../../domain/types/transform.types';
import { HistoryEntry } from '../../../domain';

export interface AltForm {
  labelKey: string;
  tex: string;
  maxima: string;
}

let _nextId = 0;
const mkId = () => `ts-${++_nextId}`;

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
  originalImag: string;
  originalMag: string;
  result: string;
  imag: string;
  mag: string;
}

function getTransformColorPreset(isDark: boolean, isNeutral: boolean): TransformColorPreset {
  if (!isNeutral && !isDark) {
    return {
      original: '#dc2626', // red-600   — Re f(t)
      originalImag: '#9333ea', // purple-600 — Im f(t)
      originalMag: '#0891b2', // cyan-600   — |f(t)|
      result: '#2563eb', // blue-600   — Re F(w)
      imag: '#d97706', // amber-600  — Im F(w)
      mag: '#16a34a', // green-600  — |F(w)|
    };
  }

  if (!isNeutral && isDark) {
    return {
      original: '#f87171', // red-400
      originalImag: '#c084fc', // purple-400
      originalMag: '#22d3ee', // cyan-400
      result: '#60a5fa', // blue-400
      imag: '#fbbf24', // amber-400
      mag: '#4ade80', // green-400
    };
  }

  if (isNeutral && !isDark) {
    return {
      original: '#2563eb', // blue-600
      originalImag: '#7c3aed', // violet-600
      originalMag: '#0891b2', // cyan-600
      result: '#0f766e', // teal-700
      imag: '#c2410c', // orange-700
      mag: '#4f46e5', // indigo-600
    };
  }

  return {
    original: '#60a5fa', // blue-400
    originalImag: '#a78bfa', // violet-400
    originalMag: '#22d3ee', // cyan-400
    result: '#2dd4bf', // teal-400
    imag: '#fb923c', // orange-400
    mag: '#818cf8', // indigo-400
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
    FormsModule,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    MobileMathKeyboardComponent,
    ExportButtonComponent,
    CanvasShellComponent,
  ],
})
export class ContinuousTransformComponent implements OnInit {
  readonly api = inject(ApiService);
  readonly mqs = inject(MathquillService);
  readonly userStore = inject(UserStore);
  private readonly feedbackSvc = inject(FeedbackService);
  private readonly surveySvc = inject(SurveyService);
  private readonly transloco = inject(TranslocoService);

  showKeyboard = false;

  /** Extra buttons passed to the mobile keyboard (transforms-specific). */
  readonly mobileExtraGroup: KeyBtn[] = [
    { label: 'δ(□)', writeWithCursor: '\\delta\\left(\\right)' },
    { label: 'u(□)', writeWithCursor: '\\operatorname{u}\\left(\\right)' },
    { label: 'sgn(□)', writeWithCursor: '\\operatorname{sgn}\\left(\\right)' },
    { label: 'abs(□)', writeWithCursor: '\\operatorname{abs}\\left(\\right)' },
    { label: '|□|', writeWithCursor: '\\left|\\right|' },
    { label: 'i', typedText: 'i' },
    { label: '∞', write: '\\infty' },
    { label: '-∞', write: '-\\infty' },
  ];

  readonly keyGroups: KeyBtn[][] = [
    // Row 1: Especiales
    [
      { label: 'δ(□)', writeWithCursor: '\\delta\\left(\\right)' },
      { label: 'u(□)', writeWithCursor: '\\operatorname{u}\\left(\\right)' },
      { label: 'sgn(□)', writeWithCursor: '\\operatorname{sgn}\\left(\\right)' },
      { label: 'abs(□)', writeWithCursor: '\\operatorname{abs}\\left(\\right)' },
      { label: '|□|', writeWithCursor: '\\left|\\right|' },
    ],
    // Row 2: Trig + hiperbólicas comunes + atan
    [
      { label: 'sin(□)', writeWithCursor: '\\sin\\left(\\right)' },
      { label: 'cos(□)', writeWithCursor: '\\cos\\left(\\right)' },
      { label: 'sinh(□)', writeWithCursor: '\\sinh\\left(\\right)' },
      { label: 'cosh(□)', writeWithCursor: '\\cosh\\left(\\right)' },
      { label: 'atan(□)', writeWithCursor: '\\operatorname{atan}\\left(\\right)' },
    ],
    // Row 3: Operadores y constantes
    [
      { label: 'e^□' },
      { label: '□²' },
      { label: '□^□' },
      { label: '□/□' },
      { label: '√□', cmd: '\\sqrt' },
      { label: '(□)', writeWithCursor: '\\left(\\right)' },
      { label: 'π', typedText: 'pi' },
      { label: 'i', typedText: 'i' },
      { label: '∞', write: '\\infty' },
      { label: '-∞', write: '-\\infty' },
      { label: '−', write: '-' },
      { label: '⌫', keystroke: 'Backspace' },
    ],
  ];
  private readonly seo = inject(SeoService);
  private readonly intervalValidator = inject(LatexToMaximaService);

  ngOnInit(): void {
    this.seo.setPage(
      'seo.transforms.title',
      'seo.transforms.description',
      'Fourier Web Calculator, Fourier transform calculator, calculadora transformada de Fourier, inverse Fourier transform, transformada inversa de Fourier, transformada de Fourier directa, direct Fourier transform, IFT, FT, amplitude spectrum, espectro de amplitud, phase spectrum, espectro de fase, frequency domain, dominio de la frecuencia, piecewise function, función a trozos, symbolic Fourier transform, transformada simbólica, Fourier transform of piecewise, transformada de Fourier de funciones a trozos, rectangular pulse, pulso rectangular, Gaussian, exponential decay, decaimiento exponencial, convolution theorem, teorema de convolución, online Fourier transform, transformada de Fourier en línea',
    );
  }
  readonly plotter = inject(PlottingService);
  private readonly drawingUtils = inject(DrawingUtilsService);
  private readonly mathUtils = inject(MathUtilsService);
  readonly theme = inject(ThemeService);
  readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly mode = signal<'ft' | 'ift'>('ft');
  readonly convention = signal<NormalizationConvention>('engineering');
  readonly varPairId = signal<string>('t-w');
  readonly customTime = signal('t');
  readonly customFreq = signal('w');
  readonly segments = signal<TransformSegmentDraft[]>([defaultSegmentFt()]);
  readonly continuityErrors = signal<(string | null)[]>([null]);
  readonly orderErrors = signal<boolean[]>([false]);
  readonly continuityValidating = signal(false);
  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly ftResult  = signal<FourierTransformResponse | null>(null);
  readonly iftResult = signal<InverseFourierTransformResponse | null>(null);
  readonly hasResult = computed(() => this.ftResult() !== null || this.iftResult() !== null);
  readonly lang      = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  // ── Alt forms — main result ────────────────────────────────────────────────
  readonly altFormsFt = signal<AltForm[]>([]);
  readonly altFormsIft = signal<AltForm[]>([]);
  readonly altFormsLoadingFt = signal(false);
  readonly altFormsLoadingIft = signal(false);
  readonly altFormsOpenFt = signal(false);
  readonly altFormsOpenIft = signal(false);

  // ── Alt forms — IFT piecewise segments ────────────────────────────────────
  readonly altFormsIftUForm = signal<AltForm[]>([]);
  readonly altFormsIftPositive = signal<AltForm[]>([]);
  readonly altFormsIftNegative = signal<AltForm[]>([]);
  readonly altFormsLoadingIftUForm = signal(false);
  readonly altFormsLoadingIftPositive = signal(false);
  readonly altFormsLoadingIftNegative = signal(false);
  readonly altFormsOpenIftUForm = signal(false);
  readonly altFormsOpenIftPositive = signal(false);
  readonly altFormsOpenIftNegative = signal(false);

  // ── Alt forms — Re/Im cards ────────────────────────────────────────────────
  readonly altFormsFtReal = signal<AltForm[]>([]);
  readonly altFormsFtImag = signal<AltForm[]>([]);
  readonly altFormsIftReal = signal<AltForm[]>([]);
  readonly altFormsIftImag = signal<AltForm[]>([]);
  readonly altFormsLoadingFtReal = signal(false);
  readonly altFormsLoadingFtImag = signal(false);
  readonly altFormsLoadingIftReal = signal(false);
  readonly altFormsLoadingIftImag = signal(false);
  readonly altFormsOpenFtReal = signal(false);
  readonly altFormsOpenFtImag = signal(false);
  readonly altFormsOpenIftReal = signal(false);
  readonly altFormsOpenIftImag = signal(false);

  // ── Canvas layer toggles ─────────────────────────────────────────────────
  readonly showOriginalReal = signal(true);
  readonly showOriginalImag = signal(false);
  readonly showOriginalMag = signal(false);
  readonly showReal = signal(true);
  readonly showImag = signal(true);
  readonly showMag = signal(false);

  // ── Canvas style settings ────────────────────────────────────────────────
  readonly xAxisFormat = signal<'integer' | 'pi' | 'e' | 'custom'>('integer');
  readonly originalColor = signal('#dc2626');
  readonly originalImagColor = signal('#9333ea');
  readonly originalMagColor = signal('#0891b2');
  readonly resultColor = signal('#2563eb');
  readonly imagColor = signal('#d97706');
  readonly magColor = signal('#16a34a');
  readonly customOriginalColor = signal(false);
  readonly customOriginalImagColor = signal(false);
  readonly customOriginalMagColor = signal(false);
  readonly customResultColor = signal(false);
  readonly customImagColor = signal(false);
  readonly customMagColor = signal(false);
  readonly originalLineWidth = signal(2);
  readonly resultLineWidth = signal(2);
  readonly originalDashed = signal(false);
  readonly resultDashed = signal(false);
  readonly showCanvasSettings = signal(false);

  readonly Math = Math;

  // ── Favorites ─────────────────────────────────────────────────────────────
  readonly latestHistoryEntry = signal<HistoryEntry | null>(null);
  readonly favoriteLoading = signal(false);
  readonly showFavoriteDialog = signal(false);
  favoriteName = '';

  // ── Free parameter sliders ────────────────────────────────────────────────
  readonly paramValues = signal<ParamValues>({});
  private readonly paramSliderMins = signal<Record<string, number>>({});
  private readonly paramSliderMaxs = signal<Record<string, number>>({});

  readonly activeParams = computed<string[]>(() => {
    const ft = this.ftResult();
    const ift = this.iftResult();
    return (ft ?? ift)?.params ?? [];
  });

  /** Params used on canvas — defaults to 1 for any param not yet moved by the user. */
  readonly evaluationParams = computed<ParamValues>(() => {
    const names = this.activeParams();
    const pv = this.paramValues();
    const merged: ParamValues = { ...pv };
    for (const name of names) {
      if (!Number.isFinite(merged[name])) merged[name] = 1;
    }
    return merged;
  });

  paramSliderMin(p: string): number { return this.paramSliderMins()[p] ?? -5; }
  paramSliderMax(p: string): number { return this.paramSliderMaxs()[p] ?? 5; }

  setParamMin(p: string, v: number): void {
    if (!isFinite(v)) return;
    this.paramSliderMins.update(m => ({ ...m, [p]: v }));
  }
  setParamMax(p: string, v: number): void {
    if (!isFinite(v)) return;
    this.paramSliderMaxs.update(m => ({ ...m, [p]: v }));
  }
  onParamSliderInput(p: string, v: number): void {
    if (!isFinite(v)) return;
    this.paramValues.update(pv => ({ ...pv, [p]: v }));
  }

  /** LaTeX preview of the piecewise input function, mirroring calculator's previewLatex. */
  readonly previewLatex = computed<string | null>(() => {
    const segs = this.segments();
    const v = this.maximaVarToTeX(this.intVar());
    if (segs.length === 0) return null;
    const hasContent = segs.some((s) => s.expressionTex || s.fromTex || s.toTex);
    if (!hasContent) return null;
    if (segs.length === 1) {
      const s = segs[0];
      return `f(${v}) = ${s.expressionTex || '\\square'}, \\quad ${s.fromTex || '\\square'} < ${v} < ${s.toTex || '\\square'}`;
    }
    const rows = segs
      .map(
        (s) =>
          `${s.expressionTex || '\\square'}, & ${s.fromTex || '\\square'} < ${v} < ${s.toTex || '\\square'}`,
      )
      .join(' \\\\ ');
    return `f(${v}) = \\begin{cases} ${rows} \\end{cases}`;
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

  // ── Share ─────────────────────────────────────────────────────────────────
  readonly showShareDialog = signal(false);
  readonly urlCopied = signal(false);

  readonly plotComponent = viewChild(FunctionPlotComponent);

  readonly varPairs = VAR_PAIRS;

  private urlPopulated = false;

  constructor() {
    effect(() => {
      void this.theme.theme();
      void this.theme.palette();
      const preset = this.currentColorPreset();
      if (!this.customOriginalColor()) this.originalColor.set(preset.original);
      if (!this.customOriginalImagColor()) this.originalImagColor.set(preset.originalImag);
      if (!this.customOriginalMagColor()) this.originalMagColor.set(preset.originalMag);
      if (!this.customResultColor()) this.resultColor.set(preset.result);
      if (!this.customImagColor()) this.imagColor.set(preset.imag);
      if (!this.customMagColor()) this.magColor.set(preset.mag);
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
                if (r === 'different')
                  continuity[pairIndices[ri]] = 'calculator.segment.continuityGap';
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

    // ── Auto-replace integration variable when pair changes ───────────────
    toObservable(this.varPairId)
      .pipe(pairwise(), takeUntilDestroyed(this.destroyRef))
      .subscribe(([oldId, newId]) => {
        const oldPair = VAR_PAIRS.find((p) => p.id === oldId);
        const newPair = VAR_PAIRS.find((p) => p.id === newId);
        if (!oldPair || !newPair) return;
        const oldVar = this.mode() === 'ft' ? oldPair.time : oldPair.freq;
        const newVar = this.mode() === 'ft' ? newPair.time : newPair.freq;
        if (!oldVar || !newVar || oldVar === newVar) return;
        this.segments.update((segs) =>
          segs.map((s) => ({
            ...s,
            expression: this.replaceVarMaxima(s.expression, oldVar, newVar),
            expressionTex: this.replaceVarTeX(s.expressionTex, oldVar, newVar),
            from: this.replaceVarMaxima(s.from, oldVar, newVar),
            fromTex: this.replaceVarTeX(s.fromTex, oldVar, newVar),
            to: this.replaceVarMaxima(s.to, oldVar, newVar),
            toTex: this.replaceVarTeX(s.toTex, oldVar, newVar),
          })),
        );
      });

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
    //
    // We also wait for boundary validation to settle (600ms debounce) before
    // calling calculate(), otherwise canCalculate() is false and it bails out.
    // canCalculate$ must be created here (injection context) so toObservable
    // captures the injector before the switchMap callback runs outside it.
    const canCalculate$ = toObservable(this.canCalculate);
    if (needsCalculate) {
      toObservable(this.userStore.initialized)
        .pipe(
          filter(Boolean),
          take(1),
          switchMap(() => timer(0)), // one macrotask → let effects set continuityValidating=true
          switchMap(() => canCalculate$.pipe(filter(Boolean), take(1))),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => this.calculate());
    }

    // ── 3. Reset custom axis when result changes ──────────────────────────
    effect(() => {
      this.ftResult();
      this.iftResult(); // track both
      this.customConstName.set(null);
    });

    // ── 4. Sync result → URL + feedback/survey prompt trigger ────────────
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
        const tryPrompts = () => {
          setTimeout(() => this.feedbackSvc.tryOpenModal(), 4000);
          setTimeout(() => this.surveySvc.tryPrompt(), 8000);
        };
        if (this.userStore.initialized()) {
          tryPrompts();
        } else {
          toObservable(this.userStore.initialized)
            .pipe(filter(Boolean), take(1))
            .subscribe(tryPrompts);
        }
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

  /** Display factor string for the current convention and mode. */
  readonly conventionFactor = computed(() => {
    const c = this.convention();
    if (this.mode() === 'ft') {
      return c === 'physics' ? '1/√(2π)' : '1';
    } else {
      if (c === 'engineering') return '1/(2π)';
      if (c === 'physics') return '1/√(2π)';
      return '1';
    }
  });

  readonly canCalculate = computed(
    () =>
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

    const showOrigRe = this.showOriginalReal();
    const showOrigIm = this.showOriginalImag();
    const showOrigM = this.showOriginalMag();
    const showRe = this.showReal();
    const showIm = this.showImag();
    const showM = this.showMag();

    const origReColor = this.originalColor();
    const origImColor = this.originalImagColor();
    const origMgColor = this.originalMagColor();
    const reColor = this.resultColor();
    const imColor = this.imagColor();
    const mgColor = this.magColor();
    const origLW = this.originalLineWidth();
    const resLW = this.resultLineWidth();
    const origDashed = this.originalDashed();
    const resDashed = this.resultDashed();

    const plotter = this.plotter;
    const pv = this.evaluationParams();

    const inputJumpStyle = 'solid' as const; // f(t) piecewise boundaries (explicit, zero perf cost)
    const resultJumpStyle = 'solid' as const; // F(w) result curves — heuristic tracking too costly

    const layer: PlotLayer = {
      curves: [],
      onDraw: (ctx, vp) => {
        // ── Input function preview ───────────────────────────────────────
        // FT: keep live preview until a calculation returns normalized
        // input Re/Im parts. After that, prefer backend symbolic parts so
        // complex inputs can still be plotted post-calculation.
        // IFT: preview F(w) only before a result exists, to avoid overlap
        // with reconstructed f(t) under the same toggle.
        const hasFtComputedInput =
          this.mode() === 'ft' &&
          !!ft?.exists &&
          (!!ft.inputRealPart?.maxima || !!ft.inputImagPart?.maxima);
        // IFT: never draw a raw preview for complex inputs — the "imaginary values" warning
        // already informs the user, and compile() would map %i→0 producing a wrong curve.
        const iftInputIsComplex = this.mode() === 'ift' && this.hasComplexInputs();
        const shouldDrawInputPreview =
          (this.mode() === 'ft' && !hasFtComputedInput) ||
          (this.mode() === 'ift' && !ift?.exists && !iftInputIsComplex);
        if ((showOrigRe || showOrigM) && shouldDrawInputPreview) {
          // Compile all segments up-front and partition by bound type.
          // Finite-bound pieces go through plotPiecewise (single canvas path,
          // NaN-sentinel between pieces → no spurious vertical lines at boundaries).
          // Infinite-bound pieces use a gated plotFn as before.
          const compiled = segs
            .map((seg) => ({
              fn: this.mathUtils.compile(seg.expression, intVariable, pv),
              from: this.parseLimit(seg.from, pv),
              to: this.parseLimit(seg.to, pv),
              expression: seg.expression,
            }))
            .filter((s) => !!s.fn);

          const finitePieces = compiled.filter((s) => isFinite(s.from) && isFinite(s.to));
          const infinitePieces = compiled.filter((s) => !isFinite(s.from) || !isFinite(s.to));

          // ── Finite pieces: draw together via plotPiecewise ──────────────
          if (finitePieces.length > 0) {
            if (showOrigRe) {
              plotter.plotPiecewise(
                ctx,
                finitePieces.map((s) => ({ fn: s.fn!, from: s.from, to: s.to })),
                vp,
                { color: origReColor, lineWidth: origLW, jumpStyle: inputJumpStyle, dashed: origDashed },
              );
            }
            if (showOrigM) {
              plotter.plotPiecewise(
                ctx,
                finitePieces.map((s) => ({
                  fn: (x: number) => {
                    const y = s.fn!(x);
                    return isFinite(y) ? Math.abs(y) : NaN;
                  },
                  from: s.from,
                  to: s.to,
                })),
                vp,
                { color: origMgColor, lineWidth: origLW, jumpStyle: inputJumpStyle, dashed: origDashed },
              );
            }
          }

          // ── Infinite pieces: gated plotFn (existing behaviour) ──────────
          for (const s of infinitePieces) {
            if (showOrigRe) {
              const gated = (x: number) => (x >= s.from && x <= s.to ? s.fn!(x) : NaN);
              plotter.plotFn(ctx, gated, vp, { color: origReColor, lineWidth: origLW, dashed: origDashed });
            }
            if (showOrigM) {
              const gatedAbs = (x: number) => {
                if (x < s.from || x > s.to) return NaN;
                const y = s.fn!(x);
                return isFinite(y) ? Math.abs(y) : NaN;
              };
              plotter.plotFn(ctx, gatedAbs, vp, { color: origMgColor, lineWidth: origLW, dashed: origDashed });
            }
          }

          // ── Dirac delta terms (FT mode only, per segment) ───────────────
          if (this.mode() === 'ft' && showOrigRe) {
            for (const s of compiled) {
              for (const { pos, weight } of this.mathUtils.parseDeltaTerms(
                s.expression,
                intVariable,
                pv,
              )) {
                if (pos >= s.from && pos <= s.to) {
                  this.drawingUtils.drawImpulse(ctx, vp, pos, weight, origReColor, origLW);
                }
              }
            }
          }
        }

        // ── FT input decomposition (post-calc) ──────────────────────────
        if ((showOrigRe || showOrigIm || showOrigM) && hasFtComputedInput && ft) {
          const inputRealExpr = ft.inputRealPart?.maxima?.trim();
          const inputImagExpr = ft.inputImagPart?.maxima?.trim();

          const inputReFn =
            showOrigRe && inputRealExpr
              ? this.mathUtils.compile(inputRealExpr, intVariable, pv)
              : null;
          if (inputReFn) {
            plotter.plotFn(ctx, inputReFn, vp, { color: origReColor, lineWidth: origLW, dashed: origDashed });
          }

          const hasInputImag = !!inputImagExpr && !this.isZeroExpression(inputImagExpr);
          const inputImFn =
            showOrigIm && hasInputImag
              ? this.mathUtils.compile(inputImagExpr!, intVariable, pv)
              : null;
          if (inputImFn) {
            plotter.plotFn(ctx, inputImFn, vp, {
              color: origImColor,
              lineWidth: Math.max(1, origLW - 0.25),
              dashed: origDashed,
            });
          }

          const inputMagFn =
            showOrigM && (inputRealExpr || inputImagExpr)
              ? this.buildMagFn(
                  inputRealExpr ?? '0',
                  this.isZeroExpression(inputImagExpr ?? '') ? '0' : (inputImagExpr ?? '0'),
                  intVariable,
                  pv,
                )
              : null;
          if (inputMagFn) {
            plotter.plotFn(ctx, inputMagFn, vp, { color: origMgColor, lineWidth: origLW, dashed: origDashed });
          }

          if (showOrigRe && inputRealExpr) {
            for (const { pos, weight } of this.mathUtils.parseDeltaTerms(
              inputRealExpr,
              intVariable,
              pv,
            )) {
              this.drawingUtils.drawImpulse(ctx, vp, pos, weight, origReColor, origLW);
            }
          }
          if (showOrigIm && hasInputImag && inputImagExpr) {
            for (const { pos, weight } of this.mathUtils.parseDeltaTerms(
              inputImagExpr,
              intVariable,
              pv,
            )) {
              this.drawingUtils.drawImpulse(ctx, vp, pos, weight, origImColor, origLW);
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

          if (reFn)
            plotter.plotFn(ctx, reFn, vp, {
              color: reColor,
              lineWidth: resLW,
              jumpStyle: resultJumpStyle,
              dashed: resDashed,
            });
          if (imFn)
            plotter.plotFn(ctx, imFn, vp, {
              color: imColor,
              lineWidth: resLW,
              jumpStyle: resultJumpStyle,
              dashed: resDashed,
            });
          if (magFn)
            plotter.plotFn(ctx, magFn, vp, {
              color: mgColor,
              lineWidth: resLW,
              jumpStyle: resultJumpStyle,
              dashed: resDashed,
            });

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
          if (showOrigRe || showOrigIm || showOrigM) {
            const outputRealExpr = ift.outputRealPart?.maxima?.trim();
            const outputImagExpr = ift.outputImagPart?.maxima?.trim();

            const outputReFn =
              showOrigRe && outputRealExpr
                ? this.mathUtils.compile(outputRealExpr, transVariable, pv)
                : null;
            const hasOutputImag = !!outputImagExpr && !this.isZeroExpression(outputImagExpr);
            const outputImFn =
              showOrigIm && hasOutputImag
                ? this.mathUtils.compile(outputImagExpr!, transVariable, pv)
                : null;
            const outputMagFn =
              showOrigM && (outputRealExpr || outputImagExpr)
                ? this.buildMagFn(
                    outputRealExpr ?? '0',
                    this.isZeroExpression(outputImagExpr ?? '') ? '0' : (outputImagExpr ?? '0'),
                    transVariable,
                    pv,
                  )
                : null;

            if (outputReFn || outputImFn || outputMagFn) {
              if (outputReFn) {
                plotter.plotFn(ctx, outputReFn, vp, {
                  color: origReColor,
                  lineWidth: origLW,
                  jumpStyle: resultJumpStyle,
                  dashed: origDashed,
                });
              }
              if (outputImFn) {
                plotter.plotFn(ctx, outputImFn, vp, {
                  color: origImColor,
                  lineWidth: Math.max(1, origLW - 0.25),
                  jumpStyle: resultJumpStyle,
                  dashed: origDashed,
                });
              }
              if (outputMagFn) {
                plotter.plotFn(ctx, outputMagFn, vp, {
                  color: origMgColor,
                  lineWidth: origLW,
                  jumpStyle: resultJumpStyle,
                  dashed: origDashed,
                });
              }
              if (showOrigRe && outputRealExpr) {
                for (const { pos, weight } of this.mathUtils.parseDeltaTerms(
                  outputRealExpr,
                  transVariable,
                  pv,
                )) {
                  this.drawingUtils.drawImpulse(ctx, vp, pos, weight, origReColor, origLW);
                }
              }
              if (showOrigIm && hasOutputImag && outputImagExpr) {
                for (const { pos, weight } of this.mathUtils.parseDeltaTerms(
                  outputImagExpr,
                  transVariable,
                  pv,
                )) {
                  this.drawingUtils.drawImpulse(ctx, vp, pos, weight, origImColor, origLW);
                }
              }
            } else {
              if (showOrigRe && ift.fPositive?.maxima) {
                const raw = this.mathUtils.compile(ift.fPositive.maxima, transVariable, pv);
                const fn = raw ? (x: number) => (x >= 0 ? raw(x) : NaN) : null;
                if (fn) plotter.plotFn(ctx, fn, vp, { color: origReColor, lineWidth: origLW, dashed: origDashed });
                if (showOrigM && fn) {
                  plotter.plotFn(
                    ctx,
                    (x) => { const y = fn(x); return isFinite(y) ? Math.abs(y) : NaN; },
                    vp,
                    { color: origMgColor, lineWidth: origLW, dashed: origDashed },
                  );
                }
              }
              if (showOrigRe && ift.fNegative?.maxima) {
                const raw = this.mathUtils.compile(ift.fNegative.maxima, transVariable, pv);
                const fn = raw ? (x: number) => (x <= 0 ? raw(x) : NaN) : null;
                if (fn) plotter.plotFn(ctx, fn, vp, { color: origReColor, lineWidth: origLW, dashed: origDashed });
                if (showOrigM && fn) {
                  plotter.plotFn(
                    ctx,
                    (x) => { const y = fn(x); return isFinite(y) ? Math.abs(y) : NaN; },
                    vp,
                    { color: origMgColor, lineWidth: origLW, dashed: origDashed },
                  );
                }
              }
            }
          }

          // Input F(ω) split into Re/Im/|F| for inverse mode controls.
          if (showRe && ift.inputRealPart?.maxima) {
            const fn = this.mathUtils.compile(ift.inputRealPart.maxima, intVariable, pv);
            if (fn)
              plotter.plotFn(ctx, fn, vp, {
                color: reColor,
                lineWidth: resLW,
                jumpStyle: resultJumpStyle,
                dashed: resDashed,
              });
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
            if (fn)
              plotter.plotFn(ctx, fn, vp, {
                color: imColor,
                lineWidth: resLW,
                jumpStyle: resultJumpStyle,
                dashed: resDashed,
              });
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
            if (magFn)
              plotter.plotFn(ctx, magFn, vp, {
                color: mgColor,
                lineWidth: resLW,
                jumpStyle: resultJumpStyle,
                dashed: resDashed,
              });
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
      // intVar = integration variable: time var for FT, freq var for IFT
      // transVar = result variable:    freq var for FT, time var for IFT
      const isIft = type === 'inverse_fourier_transform';
      const timeVar = isIft ? transVar : intVar;
      const freqVar = isIft ? intVar : transVar;
      const match = VAR_PAIRS.find((p) => p.time === timeVar && p.freq === freqVar);
      if (match) {
        this.varPairId.set(match.id);
      } else {
        this.varPairId.set('custom');
        this.customTime.set(timeVar);
        this.customFreq.set(freqVar);
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
    this.paramSliderMins.set({});
    this.paramSliderMaxs.set({});
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

  // ── Variable replacement helpers ─────────────────────────────────────────

  /**
   * Replace `from` with `to` in a Maxima expression string.
   * Uses strict word-boundary lookbehind/lookahead — safe because Maxima
   * always separates operands with explicit operators (* + - etc.).
   */
  private replaceVarMaxima(expr: string, from: string, to: string): string {
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return expr.replace(new RegExp(`(?<![a-zA-Z])${esc}(?![a-zA-Z0-9])`, 'g'), to);
  }

  private maximaVarToTeX(name: string): string {
    const greekMap: Record<string, string> = {
      pi: '\\pi',
      xi: '\\xi',
      nu: '\\nu',
      omega: '\\omega',
      π: '\\pi',
      ξ: '\\xi',
      ν: '\\nu',
      ω: '\\omega',
    };
    const key = name.trim();
    return greekMap[key] ?? key;
  }

  /**
   * Replace `from` with `to` in a LaTeX TeX string.
   * LaTeX allows implicit multiplication (e.g. `iw` = i·w), so we cannot
   * use a strict left-side lookbehind. Strategy:
   *   1. Temporarily replace all \commands with placeholders so their
   *      letters won't be touched.
   *   2. Replace `from` when NOT followed by [a-zA-Z0-9] (handles `iw`
   *      because after protection there are no multi-letter command names).
   *   3. Restore the placeholders.
   */
  private replaceVarTeX(tex: string, from: string, to: string): string {
    const toTex = this.maximaVarToTeX(to);
    const fromTex = this.maximaVarToTeX(from);

    let normalized = tex;
    if (fromTex.startsWith('\\')) {
      const escFromTex = fromTex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      normalized = normalized.replace(new RegExp(`${escFromTex}(?![a-zA-Z])`, 'g'), toTex);
    }

    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cmds: string[] = [];
    const safe = normalized.replace(/\\[a-zA-Z]+/g, (m) => {
      cmds.push(m);
      return `\x01${cmds.length - 1}\x01`;
    });
    const replaced = safe.replace(new RegExp(`${esc}(?![a-zA-Z0-9])`, 'g'), toTex);
    return replaced.replace(/\x01(\d+)\x01/g, (_, i) => cmds[+i]);
  }

  // ── Segment actions ───────────────────────────────────────────────────────

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

  // ── Alt forms ─────────────────────────────────────────────────────────────

  private readonly _iftNormMain = computed(() => {
    const ift = this.iftResult();
    const t = (ift?.fCombined ?? ift?.fOutUForm)?.tex ?? '';
    return t.replace(/\s+/g, '');
  });

  readonly iftPosEqMain = computed(() => {
    const seg = this.iftResult()?.fPositive?.tex ?? '';
    const main = this._iftNormMain();
    return !!seg && !!main && seg.replace(/\s+/g, '') === main;
  });

  readonly iftNegEqMain = computed(() => {
    const seg = this.iftResult()?.fNegative?.tex ?? '';
    const main = this._iftNormMain();
    return !!seg && !!main && seg.replace(/\s+/g, '') === main;
  });

  readonly iftUFormEqMain = computed(() => {
    const seg = this.iftResult()?.fOutUForm?.tex ?? '';
    const main = this._iftNormMain();
    return !!seg && !!main && seg.replace(/\s+/g, '') === main;
  });

  /** True when outputRealPartPositive is identical to outputRealPart (no new info). */
  readonly iftRealPosEqMain = computed(() => {
    const ift = this.iftResult();
    const pos  = ift?.outputRealPartPositive?.tex?.replace(/\s+/g, '') ?? '';
    const main = ift?.outputRealPart?.tex?.replace(/\s+/g, '') ?? '';
    return !!pos && !!main && pos === main;
  });

  /** True when outputRealPartNegative is identical to outputRealPart. */
  readonly iftRealNegEqMain = computed(() => {
    const ift = this.iftResult();
    const neg  = ift?.outputRealPartNegative?.tex?.replace(/\s+/g, '') ?? '';
    const main = ift?.outputRealPart?.tex?.replace(/\s+/g, '') ?? '';
    return !!neg && !!main && neg === main;
  });

  /** True when outputImagPartPositive is identical to outputImagPart. */
  readonly iftImagPosEqMain = computed(() => {
    const ift = this.iftResult();
    const pos  = ift?.outputImagPartPositive?.tex?.replace(/\s+/g, '') ?? '';
    const main = ift?.outputImagPart?.tex?.replace(/\s+/g, '') ?? '';
    return !!pos && !!main && pos === main;
  });

  /** True when outputImagPartNegative is identical to outputImagPart. */
  readonly iftImagNegEqMain = computed(() => {
    const ift = this.iftResult();
    const neg  = ift?.outputImagPartNegative?.tex?.replace(/\s+/g, '') ?? '';
    const main = ift?.outputImagPart?.tex?.replace(/\s+/g, '') ?? '';
    return !!neg && !!main && neg === main;
  });

  toggleAltForms(mode: 'ft' | 'ift'): void {
    if (mode === 'ft') {
      const nowOpen = !this.altFormsOpenFt();
      this.altFormsOpenFt.set(nowOpen);
      if (nowOpen && this.altFormsFt().length === 0) this.loadAltForms('ft');
    } else {
      const nowOpen = !this.altFormsOpenIft();
      this.altFormsOpenIft.set(nowOpen);
      if (nowOpen && this.altFormsIft().length === 0) this.loadAltForms('ift');
    }
  }

  toggleAltFormsIftSegment(seg: 'uForm' | 'positive' | 'negative'): void {
    const openSig = {
      uForm: this.altFormsOpenIftUForm,
      positive: this.altFormsOpenIftPositive,
      negative: this.altFormsOpenIftNegative,
    }[seg];
    const formsSig = {
      uForm: this.altFormsIftUForm,
      positive: this.altFormsIftPositive,
      negative: this.altFormsIftNegative,
    }[seg];
    const nowOpen = !openSig();
    openSig.set(nowOpen);
    if (!nowOpen || formsSig().length > 0) return;
    const ift = this.iftResult();
    const symbolic =
      seg === 'uForm' ? ift?.fOutUForm : seg === 'positive' ? ift?.fPositive : ift?.fNegative;
    if (symbolic?.maxima) {
      const loadingSig = {
        uForm: this.altFormsLoadingIftUForm,
        positive: this.altFormsLoadingIftPositive,
        negative: this.altFormsLoadingIftNegative,
      }[seg];
      // Seed with the tex of the main IFT result so forms identical to the
      // general result are not shown again inside a piecewise segment.
      const mainTex = (ift?.fCombined ?? ift?.fOutUForm)?.tex ?? '';
      loadingSig.set(true);
      this.runAltForms(
        symbolic,
        (forms) => {
          formsSig.set(forms);
          loadingSig.set(false);
        },
        [mainTex],
      );
    }
  }

  toggleAltFormsCard(card: 'ft-real' | 'ft-imag' | 'ift-real' | 'ift-imag'): void {
    const openSig = {
      'ft-real': this.altFormsOpenFtReal,
      'ft-imag': this.altFormsOpenFtImag,
      'ift-real': this.altFormsOpenIftReal,
      'ift-imag': this.altFormsOpenIftImag,
    }[card];
    const formsSig = {
      'ft-real': this.altFormsFtReal,
      'ft-imag': this.altFormsFtImag,
      'ift-real': this.altFormsIftReal,
      'ift-imag': this.altFormsIftImag,
    }[card];
    const nowOpen = !openSig();
    openSig.set(nowOpen);
    if (nowOpen && formsSig().length === 0) {
      const sym = this.getCardSymbolic(card);
      if (sym) this.loadAltFormsInto(sym, card);
    }
  }

  private getCardSymbolic(
    card: 'ft-real' | 'ft-imag' | 'ift-real' | 'ift-imag',
  ): { maxima: string; tex: string } | undefined {
    const ft = this.ftResult();
    const ift = this.iftResult();
    switch (card) {
      case 'ft-real':
        return ft?.realPart;
      case 'ft-imag':
        return ft?.imagPart;
      case 'ift-real':
        return ift?.outputRealPart;
      case 'ift-imag':
        return ift?.outputImagPart;
    }
  }

  private loadAltForms(mode: 'ft' | 'ift'): void {
    const res = mode === 'ft' ? this.ftResult() : this.iftResult();
    if (!res?.exists) return;

    // Use the same priority as the template: fCombined → fOutUForm → fPositive
    const mainSymbolic =
      mode === 'ft'
        ? (res as FourierTransformResponse).F
        : ((res as InverseFourierTransformResponse).fCombined ??
          (res as InverseFourierTransformResponse).fOutUForm ??
          (res as InverseFourierTransformResponse).fPositive);

    if (!mainSymbolic?.maxima) return;
    if (mode === 'ft') this.altFormsLoadingFt.set(true);
    else this.altFormsLoadingIft.set(true);

    // For FT: prepend the backend-provided alternate form (sech / sinh/(cosh+1))
    // if it exists and differs from the principal. This is the canonical "Otras formas"
    // entry derived directly from the Maxima computation, not from simplification.
    const ftAlt = mode === 'ft' ? (res as FourierTransformResponse).FAlt : undefined;
    const altSeed: AltForm | undefined =
      ftAlt?.tex && ftAlt.tex !== mainSymbolic.tex
        ? { labelKey: 'transforms.altFormAlt', tex: ftAlt.tex, maxima: ftAlt.maxima }
        : undefined;

    this.runAltForms(
      mainSymbolic,
      (forms) => {
        const allForms = altSeed ? [altSeed, ...forms] : forms;
        if (mode === 'ft') {
          this.altFormsFt.set(allForms);
          this.altFormsLoadingFt.set(false);
        } else {
          this.altFormsIft.set(allForms);
          this.altFormsLoadingIft.set(false);
        }
      },
      altSeed ? [altSeed.tex] : [],
    );
  }

  private loadAltFormsInto(
    expr: { maxima: string; tex: string },
    card: 'ft-real' | 'ft-imag' | 'ift-real' | 'ift-imag',
  ): void {
    const loadingSig = {
      'ft-real': this.altFormsLoadingFtReal,
      'ft-imag': this.altFormsLoadingFtImag,
      'ift-real': this.altFormsLoadingIftReal,
      'ift-imag': this.altFormsLoadingIftImag,
    }[card];
    const formsSig = {
      'ft-real': this.altFormsFtReal,
      'ft-imag': this.altFormsFtImag,
      'ift-real': this.altFormsIftReal,
      'ift-imag': this.altFormsIftImag,
    }[card];
    loadingSig.set(true);
    this.runAltForms(expr, (forms) => {
      formsSig.set(forms);
      loadingSig.set(false);
    });
  }

  private runAltForms(
    main: { maxima: string; tex: string },
    done: (forms: AltForm[]) => void,
    extraSeeds: string[] = [],
  ): void {
    const mainExpr = main.maxima;
    const convention = this.convention();
    const profiles: Array<{ labelKey: string; req: SimplifyRequest }> = [
      {
        labelKey: 'transforms.altFormFactor',
        req: { expression: mainExpr, profile: 'complete', functions: ['factor'], convention },
      },
      {
        labelKey: 'transforms.altFormExpand',
        req: { expression: mainExpr, profile: 'complete', functions: ['expand'], convention },
      },
      {
        labelKey: 'transforms.altFormTrig',
        req: {
          expression: mainExpr,
          profile: 'complete',
          functions: ['trigreduce'],
          displayFlags: { demoivre: true },
          convention,
        },
      },
      {
        labelKey: 'transforms.altFormRect',
        req: { expression: mainExpr, profile: 'complete', functions: ['rectform'], convention },
      },
      {
        labelKey: 'transforms.altFormExp',
        req: {
          expression: mainExpr,
          profile: 'complete',
          functions: ['radcan', 'expand', 'combine'],
          displayFlags: { exponentialize: true },
          convention,
        },
      },
    ];

    forkJoin(profiles.map(({ req }) => this.api.simplify(req).pipe(catchError(() => of(null)))))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => {
        const normalize = (s: string) => s.replace(/\s+/g, '');
        // Deduplicate by rendered tex only — the backend returns equivalent
        // symbolic expressions that may have different maxima strings but look
        // identical when rendered (e.g. "2+2" vs "6-2"). Comparing tex is the
        // only reliable way to detect visual duplicates.
        const seenTex = new Set<string>();
        if (main.tex) seenTex.add(normalize(main.tex));
        for (const s of extraSeeds) if (s) seenTex.add(normalize(s));
        const forms: AltForm[] = [];
        results.forEach((r: SimplifyResponse | null, i) => {
          if (!r) return;
          const { tex, maxima } = r.simplified;
          if (!tex || !maxima) return;
          const normTex = normalize(tex);
          if (seenTex.has(normTex)) return;
          seenTex.add(normTex);
          forms.push({ labelKey: profiles[i].labelKey, tex, maxima });
        });
        done(forms);
      });
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
    this.altFormsFt.set([]);
    this.altFormsIft.set([]);
    this.altFormsOpenFt.set(false);
    this.altFormsOpenIft.set(false);
    this.altFormsFtReal.set([]);
    this.altFormsFtImag.set([]);
    this.altFormsIftReal.set([]);
    this.altFormsIftImag.set([]);
    this.altFormsOpenFtReal.set(false);
    this.altFormsOpenFtImag.set(false);
    this.altFormsOpenIftReal.set(false);
    this.altFormsOpenIftImag.set(false);
    this.altFormsIftUForm.set([]);
    this.altFormsIftPositive.set([]);
    this.altFormsIftNegative.set([]);
    this.altFormsOpenIftUForm.set(false);
    this.altFormsOpenIftPositive.set(false);
    this.altFormsOpenIftNegative.set(false);

    const payload = { segments: segs, intVar, transVar, convention: this.convention() };

    if (this.mode() === 'ft') {
      this.api
        .calculateFourierTransform(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.ftResult.set(res);
            this.showCanvasSettings.set(typeof window !== 'undefined' && window.innerWidth >= 1024);
            this.loading.set(false);
            this.plotComponent()?.resetView();
            this.userStore.refreshQuota();
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
    } else {
      this.api
        .calculateInverseFourierTransform(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.iftResult.set(res);
            this.showCanvasSettings.set(typeof window !== 'undefined' && window.innerWidth >= 1024);
            this.loading.set(false);
            this.plotComponent()?.resetView();
            this.userStore.refreshQuota();
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

  // ── Test-case export ────────────────────────────────────────────────────────
  readonly exportCopied = signal(false);

  exportTestCase(): void {
    const mode = this.mode();
    const ft = this.ftResult();
    const ift = this.iftResult();
    const segs = this.segments();
    const intV = this.intVar();
    const trV = this.transVar();
    const conv = this.convention();

    if (!ft && !ift) return;

    // Build segment list in fixture format
    const segments = segs.map((s) => ({
      expression: s.expression,
      from: s.from,
      to: s.to,
    }));

    let testCase: Record<string, unknown>;

    if (mode === 'ft' && ft) {
      testCase = {
        id: 'XX00',
        type: 'FT',
        convention: conv,
        intVar: intV,
        transVar: trV,
        segments,
        expected: {
          exists: ft.exists,
          ...(ft.F?.maxima ? { F: ft.F.maxima } : {}),
          ...(ft.realPart?.maxima ? { realPart: ft.realPart.maxima } : {}),
          ...(ft.imagPart?.maxima ? { imagPart: ft.imagPart.maxima } : {}),
        },
      };
    } else if (mode === 'ift' && ift) {
      testCase = {
        id: 'XX00',
        type: 'IFT',
        convention: conv,
        intVar: intV,
        transVar: trV,
        segments,
        expected: {
          exists: ift.exists,
          ...(ift.fCombined?.maxima ? { fCombined: ift.fCombined.maxima } : {}),
          ...(ift.fPositive?.maxima ? { fPositive: ift.fPositive.maxima } : {}),
          ...(ift.fNegative?.maxima ? { fNegative: ift.fNegative.maxima } : {}),
          ...(ift.fOutUForm?.maxima ? { fOutUForm: ift.fOutUForm.maxima } : {}),
        },
      };
    } else {
      return;
    }

    const json = JSON.stringify(testCase, null, 2);

    // Print to browser console for easy copy
    console.group('📋 Test case export');
    console.log(json);
    console.groupEnd();

    // Also copy to clipboard
    navigator.clipboard
      .writeText(json)
      .then(() => {
        this.exportCopied.set(true);
        setTimeout(() => this.exportCopied.set(false), 2500);
      })
      .catch(() => {
        // clipboard unavailable — user can copy from console
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  display(tex: string): string {
    return `\\[${tex}\\]`;
  }

  onOriginalColorInput(value: string): void {
    this.customOriginalColor.set(true);
    this.originalColor.set(value);
  }

  onOriginalImagColorInput(value: string): void {
    this.customOriginalImagColor.set(true);
    this.originalImagColor.set(value);
  }

  onOriginalMagColorInput(value: string): void {
    this.customOriginalMagColor.set(true);
    this.originalMagColor.set(value);
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
    this.customOriginalImagColor.set(false);
    this.customOriginalMagColor.set(false);
    this.customResultColor.set(false);
    this.customImagColor.set(false);
    this.customMagColor.set(false);
    this.originalColor.set(preset.original);
    this.originalImagColor.set(preset.originalImag);
    this.originalMagColor.set(preset.originalMag);
    this.resultColor.set(preset.result);
    this.imagColor.set(preset.imag);
    this.magColor.set(preset.mag);
    this.originalDashed.set(false);
    this.resultDashed.set(false);
  }

  private isZeroExpression(expr: string): boolean {
    const normalized = expr.replace(/\s+/g, '');
    return normalized === '0' || normalized === '(0)' || normalized === '0.0';
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
