import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, map, of, switchMap } from 'rxjs';

import { NavComponent } from '../../../shared/components/nav/nav.component';
import { SeoService } from '../../../core/services/seo/seo.service';
import { ApiService } from '../../../core/services/api/api.service';
import { UserStore } from '../../../core/services/auth/user.store';
import { HistoryEntry } from '../../../domain';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { DrawingUtilsService } from '../../../core/services/canvas/drawing-utils.service';
import { CoordinateTransformService } from '../../../core/services/canvas/coordinate-transform.service';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import { DftComputeService } from '../../../core/services/dft/dft-compute.service';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../shared/components/function-plot/function-plot.component';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';
import {
  TransformSegmentComponent,
  TransformSegmentDraft,
} from '../continuous/transform-segment.component';
import { MathquillService, KeyBtn } from '../../../core/services/math/mathquill.service';
import { MobileMathKeyboardComponent } from '../../../shared/components/math-keyboard/mobile-math-keyboard.component';
import type {
  DftCoefficient,
  DftAlgorithm,
  DftInputMode,
  DftPoint,
  DftResponse,
  LocalDftResult,
} from '../../../domain/types/dft.types';
import type { DftSegment } from '../../../domain/types/dft.types';
import type { CanvasViewport, Curve } from '../../../core/services/canvas/canvas.types';

const N_OPTIONS = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
const INT_VARS = ['x', 't', 'u', 's'];
const TOP_LIMIT = 256;

// ── Epicycles helpers ──────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

interface EpicyclePreset { id: string; label: string; points: DftPoint[] }

interface EpicycleState {
  color: string;
  selected: boolean;
  centerX: number; centerY: number;
  endX: number;    endY: number;
  radius: number;
}

type EpicCoeffOrder = 'amplitude' | 'frequency';

interface EpicRenderCoeff extends DftCoefficient {
  kSigned: number;
  amplitudeSafe: number;
  amplitudePercentSafe: number;
  phaseSafe: number;
  phaseInPiSafe: string;
}

function epicCirclePreset(n = 180): DftPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    return { x: Math.cos(t), y: Math.sin(t) };
  });
}

function epicStarPreset(n = 240): DftPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    const r = 1 + 0.35 * Math.cos(5 * t);
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  });
}

function epicLissajousPreset(n = 220): DftPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    return { x: 1.1 * Math.sin(3 * t + Math.PI / 2), y: 1.1 * Math.sin(2 * t) };
  });
}

let _dftSegId = 0;
const mkId = () => `dft-${++_dftSegId}`;

function defaultSegment(v = 'x'): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: `sin(${v})`,
    expressionTex: `\\sin(${v})`,
    from: '-%pi',
    fromTex: '-\\pi',
    to: '%pi',
    toTex: '\\pi',
  };
}

interface DftColorPreset {
  samples: string;
  reconstruction: string;
  specAmplitude: string;
  specPhase: string;
}

function getDftPreset(isDark: boolean): DftColorPreset {
  return isDark
    ? { samples: '#fb923c', reconstruction: '#818cf8', specAmplitude: '#a78bfa', specPhase: '#6ee7b7' }
    : { samples: '#ea580c', reconstruction: '#6366f1', specAmplitude: '#7c3aed', specPhase: '#059669' };
}

// ── Manual mode presets ────────────────────────────────────────────────────────

function makePreset(name: string, fn: (n: number, N: number) => number, N: number): { name: string; values: number[] } {
  return { name, values: Array.from({ length: N }, (_, i) => fn(i, N)) };
}

@Component({
  selector: 'app-dft',
  templateUrl: './dft.component.html',
  imports: [
    NavComponent,
    RouterModule,
    TranslocoPipe,
    FormsModule,
    FunctionPlotComponent,
    MathjaxDirective,
    TransformSegmentComponent,
    MobileMathKeyboardComponent,
    DecimalPipe,
  ],
})
export class DftComponent implements OnInit, OnDestroy {
  private readonly seo        = inject(SeoService);
  private readonly api        = inject(ApiService);
  private readonly theme      = inject(ThemeService);
  private readonly du         = inject(DrawingUtilsService);
  private readonly coords     = inject(CoordinateTransformService);
  private readonly plotter    = inject(PlottingService);
  private readonly mathUtils  = inject(MathUtilsService);
  private readonly dftCompute  = inject(DftComputeService);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly destroyRef  = inject(DestroyRef);
  readonly mqs                 = inject(MathquillService);
  readonly userStore           = inject(UserStore);

  readonly signalPlotRef    = viewChild<FunctionPlotComponent>('signalPlot');
  readonly spectrumPlotRef  = viewChild<FunctionPlotComponent>('spectrumPlot');
  readonly specWrapperRef   = viewChild<ElementRef<HTMLDivElement>>('spectrumWrapper');
  readonly signalWrapperRef = viewChild<ElementRef<HTMLDivElement>>('signalWrapper');
  readonly epicWrapperRef   = viewChild<ElementRef<HTMLDivElement>>('epicWrapper');

  // ── Mode / algorithm ────────────────────────────────────────────────────────
  readonly inputMode = signal<DftInputMode>('function');
  readonly algorithm = signal<DftAlgorithm>('fft');

  // ── Function-mode form state ─────────────────────────────────────────────────
  readonly segments = signal<TransformSegmentDraft[]>([defaultSegment()]);
  readonly intVar   = signal('x');
  readonly N        = signal(128);
  readonly nOptions = N_OPTIONS;
  readonly intVars  = INT_VARS;

  /** Custom N for DFT naive (any value, not limited to powers of 2). */
  readonly dftCustomN = signal(128);

  /** N used for computation — power-of-2 for FFT, free value for DFT. */
  readonly effectiveN = computed(() =>
    this.algorithm() === 'fft' ? this.N() : this.dftCustomN(),
  );

  // ── Manual-mode state ────────────────────────────────────────────────────────
  readonly manualRaw  = signal<string>('1, 0, 0, 0, 0, 0, 0, 0');
  readonly manualN    = signal(8);
  readonly manualNOpts = [4, 8, 16, 32];

  readonly parsedManual = computed<number[]>(() => {
    const raw = this.manualRaw();
    return raw.split(',').map((s) => {
      const n = parseFloat(s.trim());
      return Number.isFinite(n) ? n : 0;
    });
  });

  readonly manualValid = computed(() => {
    const vals = this.parsedManual();
    const n = this.manualN();
    return vals.length === n && vals.every((v) => Number.isFinite(v));
  });

  // ── Math keyboard ──────────────────────────────────────────────────────────
  showKeyboard = false;

  readonly mobileExtraGroup: KeyBtn[] = [
    { label: 'sin', typedText: 'sin(' },
    { label: 'cos', typedText: 'cos(' },
    { label: 'exp', typedText: 'exp(' },
    { label: 'π', typedText: 'pi' },
  ];

  readonly keyGroups: KeyBtn[][] = [
    [
      { label: 'sin', typedText: 'sin(' },
      { label: 'cos', typedText: 'cos(' },
      { label: 'tan', typedText: 'tan(' },
      { label: 'sinh', typedText: 'sinh(' },
      { label: 'cosh', typedText: 'cosh(' },
      { label: 'tanh', typedText: 'tanh(' },
    ],
    [
      { label: 'asin', typedText: 'asin(' },
      { label: 'acos', typedText: 'acos(' },
      { label: 'atan', typedText: 'atan(' },
    ],
    [
      { label: 'log', typedText: 'log(' },
      { label: 'exp', typedText: 'exp(' },
      { label: '√·', cmd: '\\sqrt' },
      { label: 'π', typedText: 'pi' },
      { label: 'eˣ' },
      { label: 'xⁿ', cmd: '^' },
      { label: '(', typedText: '(' },
      { label: ')', typedText: ')' },
      { label: '−', write: '-' },
      { label: '/', typedText: '/' },
      { label: '⌫', keystroke: 'Backspace' },
    ],
  ];

  // ── Request state ──────────────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);
  readonly result  = signal<LocalDftResult | null>(null);

  // ── UI toggles ─────────────────────────────────────────────────────────────
  readonly showSamples         = signal(true);
  readonly showReconstruction  = signal(true);
  readonly showCanvasSettings  = signal(false);
  readonly showSpecSettings    = signal(false);

  // ── Spectrum mode ──────────────────────────────────────────────────────────
  readonly specMode = signal<'amplitude' | 'phase'>('amplitude');
  readonly fftShift = signal(true);

  // ── Canvas colors ──────────────────────────────────────────────────────────
  readonly samplesColor            = signal('#ea580c');
  readonly reconstructionColor     = signal('#6366f1');
  readonly specAmplitudeColor      = signal('#7c3aed');
  readonly specPhaseColor          = signal('#059669');
  readonly reconstructionLineWidth = signal(1.8);
  readonly samplesRadius           = signal(2.2);
  readonly specStemWidth           = signal(1.6);

  private _customSamplesColor        = false;
  private _customReconstructionColor = false;
  private _customSpecAmpColor        = false;
  private _customSpecPhaseColor      = false;

  // ── Hover / selection ──────────────────────────────────────────────────────
  readonly hoveredCoeff  = signal<DftCoefficient | null>(null);
  readonly selectedCoeff = signal<DftCoefficient | null>(null);

  private _lastSpecVp: CanvasViewport | null = null;

  // ── Share / URL ─────────────────────────────────────────────────────────────
  readonly showShareDialog  = signal(false);
  readonly urlCopied        = signal(false);
  private urlPopulated      = false;

  // ── Favorites ──────────────────────────────────────────────────────────────
  readonly latestHistoryEntry = signal<HistoryEntry | null>(null);
  readonly showFavoriteDialog = signal(false);
  readonly favoriteLoading    = signal(false);
  favoriteName = '';

  // ── Signal canvas X-axis format ─────────────────────────────────────────────
  readonly signalXAxisFormat = signal<'integer' | 'pi' | 'e'>('integer');

  // ── Epicycles mode ────────────────────────────────────────────────────────
  private _epicTimerId: ReturnType<typeof setInterval> | null = null;

  readonly epicPresets: EpicyclePreset[] = [
    { id: 'circle',    label: 'transforms.dft.epicycles.presetCircle',    points: epicCirclePreset() },
    { id: 'star',      label: 'transforms.dft.epicycles.presetStar',      points: epicStarPreset() },
    { id: 'lissajous', label: 'transforms.dft.epicycles.presetLissajous', points: epicLissajousPreset() },
  ];

  readonly epicRawPoints      = signal('');
  readonly epicLoading        = signal(false);
  readonly epicError          = signal<string | null>(null);
  readonly epicResult         = signal<DftResponse | null>(null);
  readonly epicSourcePoints   = signal<DftPoint[]>([]);

  readonly epicTopK           = signal(18);
  readonly epicCoeffOrder     = signal<EpicCoeffOrder>('amplitude');
  readonly epicSpeed          = signal(0.03);
  readonly epicTime           = signal(0);
  readonly epicFrameTick      = signal(0);
  readonly epicIsAnimating    = signal(false);

  readonly epicShowOriginal   = signal(true);
  readonly epicShowApprox     = signal(true);
  readonly epicShowTrace      = signal(true);
  readonly epicShowSampled    = signal(false);
  readonly epicShowChains     = signal(true);
  readonly epicSelectedK      = signal<number | null>(null);

  readonly epicAutoNormalize  = signal(true);
  readonly epicCenterScale    = signal(true);
  readonly epicNormInfo       = signal<{ applied: boolean; centered: boolean; centerX: number; centerY: number; scale: number } | null>(null);

  /** Exact points restored from history — bypass textarea parsing to preserve float precision for deduplication. Cleared after first use. */
  private _epicRestoredPoints: DftPoint[] | null = null;

  readonly epicTrace          = signal<DftPoint[]>([]);

  readonly showEpicSettings   = signal(false);

  // Draw dialog
  readonly epicDrawDialogOpen = signal(false);
  readonly epicDrawPoints     = signal<DftPoint[]>([]);
  private _epicDrawing        = false;
  private _epicDrawCtx: CanvasRenderingContext2D | null = null;

  readonly epicNormalizedCoeffs = computed<EpicRenderCoeff[]>(() => {
    const res = this.epicResult();
    if (!res || !Array.isArray(res.coefficients)) return [];
    const n = Math.max(1, res.N || res.coefficients.length || 1);
    const withAmp = res.coefficients.map((c) => {
      const re = this._epicFinite(c.re);
      const im = this._epicFinite(c.im);
      const amp = Number.isFinite(c.amplitude) && c.amplitude > 0
        ? this._epicFinite(c.amplitude) : Math.hypot(re, im);
      const kSigned = c.k > n / 2 ? c.k - n : c.k;
      const phase = amp < 1e-12 ? 0 : (this._epicFinite(c.phase) || Math.atan2(im, re));
      return { ...c, re, im, kSigned, amplitudeSafe: amp, amplitudePercentSafe: 0, phaseSafe: phase, phaseInPiSafe: this._epicPiLabel(phase) };
    });
    const total = withAmp.reduce((s, c) => s + c.amplitudeSafe, 0);
    return withAmp.map((c) => ({ ...c, amplitudePercentSafe: total > 0 ? (c.amplitudeSafe / total) * 100 : 0 }));
  });

  readonly epicOrderedCoeffs = computed<EpicRenderCoeff[]>(() => {
    const c = this.epicNormalizedCoeffs();
    if (this.epicCoeffOrder() === 'frequency') {
      return [...c].sort((a, b) => { const d = Math.abs(a.kSigned) - Math.abs(b.kSigned); return d !== 0 ? d : a.kSigned - b.kSigned; });
    }
    return [...c].sort((a, b) => { const d = b.amplitudeSafe - a.amplitudeSafe; return d !== 0 ? d : Math.abs(a.kSigned) - Math.abs(b.kSigned); });
  });

  readonly epicMaxTopK     = computed(() => this.epicOrderedCoeffs().length);
  readonly epicVisibleCoeffs = computed(() => this.epicOrderedCoeffs().slice(0, 240));
  readonly epicSelectedCoeffs = computed(() => {
    const c = this.epicOrderedCoeffs();
    return c.slice(0, Math.max(1, Math.min(this.epicTopK(), c.length || 1)));
  });
  readonly epicCoverage    = computed(() => this.epicSelectedCoeffs().reduce((s, c) => s + c.amplitudePercentSafe, 0));
  readonly epicEndpoint    = computed(() => {
    const states = this.epicStates();
    if (!states.length) return null;
    const last = states[states.length - 1];
    return { x: last.endX, y: last.endY };
  });
  readonly epicApproxCurve = computed<DftPoint[]>(() => {
    const coeffs = this.epicSelectedCoeffs();
    if (!coeffs.length) return [];
    return Array.from({ length: 421 }, (_, i) => this._epicEvalPoint(coeffs, (i / 420) * TAU));
  });
  readonly epicStates      = computed<EpicycleState[]>(() => this._epicComputeStates(this.epicSelectedCoeffs(), this.epicTime()));

  readonly epicPlotLayers  = computed<PlotLayer[]>(() => {
    void this.epicFrameTick();
    void this.epicStates();
    const original = this.epicSourcePoints();
    const approx   = this.epicApproxCurve();
    const trace    = this.epicTrace();
    const curves: Curve[] = [];

    if (this.epicShowOriginal() && original.length > 1) {
      curves.push({ points: this._epicClose(original), color: this.theme.isDark ? '#9ca3af' : '#6b7280', lineWidth: 1.2, dashed: true });
    }
    if (this.epicShowApprox() && approx.length > 1) {
      curves.push({ points: approx, color: '#22c55e', lineWidth: 2 });
    }
    if (this.epicShowTrace() && trace.length > 1) {
      curves.push({ points: trace, color: '#60a5fa', lineWidth: 2.1 });
    }
    return [{ curves, onDraw: (ctx, vp) => this._epicDrawOverlay(ctx, vp) }];
  });

  // ── LaTeX preview (function mode) ─────────────────────────────────────────
  readonly previewLatex = computed<string | null>(() => {
    if (this.inputMode() !== 'function') return null;
    const segs = this.segments();
    const v = this.intVar();
    if (!segs.some((s) => s.expressionTex || s.fromTex || s.toTex)) return null;
    if (segs.length === 1) {
      const s = segs[0];
      return `f(${v}) = ${s.expressionTex || '\\square'}, \\quad ${s.fromTex || '\\square'} \\leq ${v} \\leq ${s.toTex || '\\square'}`;
    }
    const rows = segs
      .map((s) => `${s.expressionTex || '\\square'}, & ${s.fromTex || '\\square'} \\leq ${v} \\leq ${s.toTex || '\\square'}`)
      .join(' \\\\ ');
    return `f(${v}) = \\begin{cases} ${rows} \\end{cases}`;
  });

  readonly inputsLocked = computed(() => this.loading() || this.result() !== null);

  // ── Computed canvas layers ─────────────────────────────────────────────────

  readonly signalLayers = computed<PlotLayer[]>(() => {
    const res   = this.result();
    if (!res) return [];
    const showS = this.showSamples();
    const showR = this.showReconstruction();
    const sColor = this.samplesColor();
    const rColor = this.reconstructionColor();
    const rLW    = this.reconstructionLineWidth();
    const sRad   = this.samplesRadius();
    void this.theme.isDark;

    return [{
      curves: [],
      onDraw: (ctx: CanvasRenderingContext2D, vp: CanvasViewport) => {
        if (showR) this._drawReconstruction(ctx, vp, res, rColor, rLW);
        if (showS) this.du.drawPoints(ctx, vp, res.sampledPoints, sColor, sRad);
      },
    }];
  });

  readonly spectrumLayers = computed<PlotLayer[]>(() => {
    const res = this.result();
    if (!res) return [];
    const mode     = this.specMode();
    const shift    = this.fftShift();
    const color    = mode === 'amplitude' ? this.specAmplitudeColor() : this.specPhaseColor();
    const lw       = this.specStemWidth();
    const hovered  = this.hoveredCoeff();
    const selected = this.selectedCoeff();
    void this.theme.isDark;

    return [{
      curves: [],
      onDraw: (ctx: CanvasRenderingContext2D, vp: CanvasViewport) => {
        this._lastSpecVp = vp;
        for (const c of res.coefficients) {
          const kDisplay = shift ? (c.k <= res.N / 2 ? c.k : c.k - res.N) : c.k;
          const val = mode === 'amplitude' ? c.amplitude : c.phase;
          const highlighted = hovered?.k === c.k || selected?.k === c.k;
          this.du.drawStem(
            ctx, vp, kDisplay, val,
            highlighted ? (this.theme.isDark ? '#fbbf24' : '#d97706') : color,
            highlighted ? lw * 2 : lw,
            highlighted ? 5 : 3,
          );
        }
      },
    }];
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  readonly topCoeffs = computed(() => {
    const res = this.result();
    return res ? [...res.topCoefficients].slice(0, 10) : [];
  });

  readonly stats = computed(() => {
    const res = this.result();
    if (!res) return null;
    return {
      N:             res.N,
      algorithm:     res.algorithm,
      rmsError:      res.rmsError,
      computeTimeMs: res.computeTimeMs,
      samplingTimeMs: res.samplingTimeMs,
      interval:      res.interval,
    };
  });

  readonly specColor = computed(() =>
    this.specMode() === 'amplitude' ? this.specAmplitudeColor() : this.specPhaseColor(),
  );

  /**
   * Main signal canvas layers — always visible in the right panel.
   * Before compute: shows a function curve preview (function mode) or discrete
   * stems preview (manual mode). After compute: shows sampled points + IDFT.
   */
  readonly mainSignalLayers = computed<PlotLayer[]>(() => {
    if (this.result()) return this.signalLayers();
    return this.inputMode() === 'function'
      ? this.functionPreviewLayers()
      : this.manualPreviewLayers();
  });

  /** Live stem preview of the manually entered sequence. */
  readonly manualPreviewLayers = computed<PlotLayer[]>(() => {
    if (this.inputMode() !== 'manual') return [];
    const values = this.parsedManual();
    if (values.length === 0) return [];
    const color = this.samplesColor();
    const lw    = this.specStemWidth();
    void this.theme.isDark;
    return [{
      curves: [],
      onDraw: (ctx: CanvasRenderingContext2D, vp: CanvasViewport) => {
        for (let n = 0; n < values.length; n++) {
          this.du.drawStem(ctx, vp, n, values[n] ?? 0, color, lw, 3);
        }
      },
    }];
  });

  /** Live curve preview of the piecewise function (function mode, before compute). */
  readonly functionPreviewLayers = computed<PlotLayer[]>(() => {
    if (this.inputMode() !== 'function' || this.result() !== null) return [];
    const segs = this.segments();
    const v = this.intVar();
    const color = this.samplesColor();
    void this.theme.isDark;
    const plotter = this.plotter;
    const mathUtils = this.mathUtils;
    const parseLimit = this._parseLimit.bind(this);
    return [{
      curves: [],
      onDraw: (ctx: CanvasRenderingContext2D, vp: CanvasViewport) => {
        for (const seg of segs) {
          const fn = mathUtils.compile(seg.expression, v);
          const from = parseLimit(seg.from);
          const to = parseLimit(seg.to);
          if (!fn || !isFinite(from) || !isFinite(to)) continue;
          plotter.plotFnRange(ctx, fn, from, to, 400, vp, { color, lineWidth: 1.8 });
        }
      },
    }];
  });

  private _parseLimit(s: string): number {
    if (!s.trim()) return NaN;
    const fn = this.mathUtils.compile(s, '_');
    if (fn) { try { const r = fn(0); if (isFinite(r)) return r; } catch { /* */ } }
    return this.mathUtils.evaluate(s, 0, '_');
  }

  // ── Manual presets ─────────────────────────────────────────────────────────

  manualPresets(N: number) {
    return [
      makePreset('δ[n]',    (_n) => _n === 0 ? 1 : 0,                        N),
      makePreset('u[n]',    () => 1,                                          N),
      makePreset('□',       (_n) => _n < N / 2 ? 1 : -1,                     N),
      makePreset('cos',     (_n) => Math.cos(2 * Math.PI * _n / N),          N),
      makePreset('sin',     (_n) => Math.sin(2 * Math.PI * _n / N),          N),
    ];
  }

  applyPreset(values: number[]): void {
    this.manualRaw.set(values.map((v) => +v.toFixed(4)).join(', '));
  }

  setManualN(n: number): void {
    if (this.inputsLocked()) return;
    this.manualN.set(n);
    const current = this.parsedManual();
    const extended = Array.from({ length: n }, (_, i) => current[i] ?? 0);
    this.manualRaw.set(extended.map((v) => +v.toFixed(4)).join(', '));
  }

  // ── Constructor ────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const preset = getDftPreset(this.theme.isDark);
      if (!this._customSamplesColor)        this.samplesColor.set(preset.samples);
      if (!this._customReconstructionColor) this.reconstructionColor.set(preset.reconstruction);
      if (!this._customSpecAmpColor)        this.specAmplitudeColor.set(preset.specAmplitude);
      if (!this._customSpecPhaseColor)      this.specPhaseColor.set(preset.specPhase);
      this.signalPlotRef()?.redraw();
      this.spectrumPlotRef()?.redraw();
    });

    // Sync result → URL query param
    effect(() => {
      if (this.result()) {
        this.urlPopulated = true;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { s: this._encodeState() },
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

  ngOnInit(): void {
    this.seo.setPage('seo.dft.title', 'seo.dft.description');
    const encoded = this.route.snapshot.queryParamMap.get('s');
    if (encoded && this._restoreState(encoded)) {
      if (this.inputMode() !== 'epicycles') {
        this.compute();
      }
      // Epicycles: state is pre-populated — user triggers compute manually to avoid re-saving to history
    }
  }

  // ── Mode helpers ───────────────────────────────────────────────────────────

  switchMode(mode: DftInputMode): void {
    if (this.inputsLocked()) return;
    if (mode !== 'epicycles') this._epicStopAnimation();
    this.inputMode.set(mode);
    this.error.set(null);
  }

  switchAlgorithm(alg: DftAlgorithm): void {
    if (alg === 'fft') {
      // Round current DFT N to the nearest power of 2 within nOptions
      const cur = this.dftCustomN();
      const nearest = N_OPTIONS.reduce((best, n) =>
        Math.abs(n - cur) < Math.abs(best - cur) ? n : best,
      );
      this.N.set(nearest);
    } else {
      this.dftCustomN.set(this.N());
    }
    this.algorithm.set(alg);
  }

  phaseInDeg(phase: number): string {
    return (phase * 180 / Math.PI).toFixed(1);
  }

  setDftCustomN(raw: number): void {
    const n = Math.max(4, Math.min(4096, raw || 4));
    this.dftCustomN.set(n);
  }

  // ── Segment helpers ────────────────────────────────────────────────────────

  addSegment(): void {
    if (this.inputsLocked()) return;
    const last = this.segments().at(-1);
    this.segments.update((s) => [
      ...s,
      { id: mkId(), expression: '0', expressionTex: '0', from: last?.to ?? '0', fromTex: last?.toTex ?? '0', to: '1', toTex: '1' },
    ]);
  }

  removeSegment(id: string): void {
    if (this.inputsLocked() || this.segments().length <= 1) return;
    this.segments.update((s) => s.filter((seg) => seg.id !== id));
  }

  updateSegment(id: string, changes: Partial<TransformSegmentDraft>): void {
    if (this.inputsLocked()) return;
    this.segments.update((s) => s.map((seg) => (seg.id === id ? { ...seg, ...changes } : seg)));
  }

  setIntVar(v: string): void {
    if (this.inputsLocked()) return;
    this.intVar.set(v);
  }

  setN(n: number): void { this.N.set(n); }

  // ── Compute ────────────────────────────────────────────────────────────────

  compute(): void {
    if (this.loading()) return;
    if (this.inputMode() === 'manual') {
      this._computeManual();
    } else {
      this._computeFromFunction();
    }
  }

  private _computeManual(): void {
    if (this.userStore.isQuotaExceeded()) {
      this.error.set('weekly_limit_reached');
      return;
    }

    const values = this.parsedManual();
    const N = this.manualN();
    if (values.length !== N) {
      this.error.set(`Se necesitan exactamente ${N} valores separados por coma.`);
      return;
    }

    this.error.set(null);

    const alg = this.algorithm();
    const { coefficients, timeMs } = alg === 'fft'
      ? this.dftCompute.computeFft(values)
      : this.dftCompute.computeDft(values);

    const topCoefficients = this.dftCompute.topCoefficients(coefficients, TOP_LIMIT);
    const sampledPoints = values.map((y, x) => ({ x, y }));
    const reconstructed = this.dftCompute.reconstruct(coefficients, N);
    const rmsError = this.dftCompute.rmsError(values, reconstructed);

    this.result.set({
      inputMode: 'manual',
      algorithm: alg,
      N,
      sampledPoints,
      coefficients,
      topCoefficients,
      reconstructed,
      rmsError,
      computeTimeMs: timeMs,
    });

    this.selectedCoeff.set(null);
    this.hoveredCoeff.set(null);
    this.showCanvasSettings.set(true);

    // Track quota on backend (manual compute is client-side, so we fire a lightweight call)
    this.api.calculateDFT({ points: sampledPoints, mode: 'signal' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.userStore.refreshQuota();
          if (this.userStore.isAuthenticated()) this.fetchLatestEntry();
        },
        error: (err) => {
          // 429 = quota exhausted — roll back the result so it doesn't appear as "computed"
          if (err?.status === 429) {
            this.result.set(null);
            this.error.set(err?.error?.error ?? 'Weekly calculation limit reached');
            this.userStore.refreshQuota();
          }
        },
      });
  }

  private _computeFromFunction(): void {
    const segs = this.segments();
    if (segs.some((s) => !s.expression.trim() || !s.from.trim() || !s.to.trim())) {
      this.error.set('Completa todos los campos de los tramos.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const body = {
      segments: segs.map((s): DftSegment => ({ expression: s.expression, from: s.from, to: s.to })),
      intVar: this.intVar(),
      N: this.effectiveN(),
    };

    this.api.sampleDFTFunction(body).subscribe({
      next: (sample) => {
        const ys = sample.sampledPoints.map((p) => p.y);
        const alg = this.algorithm();
        const { coefficients, timeMs } = alg === 'fft'
          ? this.dftCompute.computeFft(ys)
          : this.dftCompute.computeDft(ys);

        const topCoefficients = this.dftCompute.topCoefficients(coefficients, TOP_LIMIT);
        const reconstructed = this.dftCompute.reconstruct(coefficients, sample.sampledPoints.length, sample.sampledPoints.map((p) => p.x));
        const rmsError = this.dftCompute.rmsError(ys, reconstructed);

        this.result.set({
          inputMode: 'function',
          algorithm: alg,
          N: sample.sampledPoints.length,
          sampledPoints: sample.sampledPoints,
          coefficients,
          topCoefficients,
          reconstructed,
          rmsError,
          computeTimeMs: timeMs,
          samplingTimeMs: sample.samplingTimeMs,
          interval: sample.interval,
        });

        this.loading.set(false);
        this.selectedCoeff.set(null);
        this.hoveredCoeff.set(null);
        this.showCanvasSettings.set(true);
        this.userStore.refreshQuota();
        if (this.userStore.isAuthenticated()) this.fetchLatestEntry();
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Error al evaluar la función.');
        this.loading.set(false);
      },
    });
  }

  reset(): void {
    this.result.set(null);
    this.error.set(null);
    this.showCanvasSettings.set(false);
    this.showSpecSettings.set(false);
    this.selectedCoeff.set(null);
    this.hoveredCoeff.set(null);
    this.latestHistoryEntry.set(null);
    this.showFavoriteDialog.set(false);
  }

  // ── Color controls ─────────────────────────────────────────────────────────

  onSamplesColorInput(v: string): void   { this._customSamplesColor = true;        this.samplesColor.set(v); }
  onReconColorInput(v: string): void     { this._customReconstructionColor = true;  this.reconstructionColor.set(v); }
  onSpecAmpColorInput(v: string): void   { this._customSpecAmpColor = true;         this.specAmplitudeColor.set(v); }
  onSpecPhaseColorInput(v: string): void { this._customSpecPhaseColor = true;       this.specPhaseColor.set(v); }

  resetSignalColors(): void {
    const p = getDftPreset(this.theme.isDark);
    this._customSamplesColor = this._customReconstructionColor = false;
    this.samplesColor.set(p.samples);
    this.reconstructionColor.set(p.reconstruction);
  }

  resetSpecColors(): void {
    const p = getDftPreset(this.theme.isDark);
    this._customSpecAmpColor = this._customSpecPhaseColor = false;
    this.specAmplitudeColor.set(p.specAmplitude);
    this.specPhaseColor.set(p.specPhase);
  }

  // ── Spectrum interaction ───────────────────────────────────────────────────

  onSpecMouseMove(event: MouseEvent): void {
    const res = this.result();
    if (!res || !this._lastSpecVp) return;
    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    const vp = this._lastSpecVp;
    const mathX = this.coords.cssToMathX(event.clientX - rect.left, vp);
    const mathY = this.coords.cssToMathY(event.clientY - rect.top, vp);
    const shift = this.fftShift();
    const mode  = this.specMode();

    // Stem width in math units — half a unit gap between stems
    const xTol = 0.35;

    let hit: DftCoefficient | null = null;
    for (const c of res.coefficients) {
      const kDisplay = shift ? (c.k <= res.N / 2 ? c.k : c.k - res.N) : c.k;
      if (Math.abs(kDisplay - mathX) > xTol) continue;

      // Check Y: cursor must be between 0 and the stem value (with small margin)
      const val = mode === 'amplitude' ? c.amplitude : c.phase;
      const yMin = Math.min(0, val) - 0.02;
      const yMax = Math.max(0, val) + 0.02;
      if (mathY < yMin || mathY > yMax) continue;

      hit = c;
      break;
    }
    this.hoveredCoeff.set(hit);
  }

  onSpecMouseLeave(): void { this.hoveredCoeff.set(null); }

  selectCoeff(c: DftCoefficient): void {
    this.selectedCoeff.set(this.selectedCoeff()?.k === c.k ? null : c);
  }

  kDisplay(c: DftCoefficient): number {
    const res = this.result();
    if (!res || !this.fftShift()) return c.k;
    return c.k <= res.N / 2 ? c.k : c.k - res.N;
  }

  // ── Canvas drawing ─────────────────────────────────────────────────────────

  // ── URL state ──────────────────────────────────────────────────────────────

  private _encodeState(): string {
    const state = {
      mode: this.inputMode(),
      alg:  this.algorithm(),
      v:    this.intVar(),
      N:    this.N(),
      dN:   this.dftCustomN(),
      seg:  this.segments().map((s) => ({
        e: s.expression, et: s.expressionTex,
        f: s.from, ft: s.fromTex,
        t: s.to, tt: s.toTex,
      })),
      mr: this.inputMode() === 'manual' ? this.manualRaw() : undefined,
      mN: this.inputMode() === 'manual' ? this.manualN()  : undefined,
    };
    try {
      const json = JSON.stringify(state);
      return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))));
    } catch { return ''; }
  }

  private _restoreState(encoded: string): boolean {
    try {
      const json = decodeURIComponent(atob(encoded).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
      const s = JSON.parse(json) as {
        mode?: string; alg?: string; v?: string; N?: number; dN?: number;
        seg?: Array<{ e: string; et: string; f: string; ft: string; t: string; tt: string }>;
        mr?: string; mN?: number;
        pts?: string; // epicycles raw textarea content
      };
      if (s.mode === 'function' || s.mode === 'manual' || s.mode === 'epicycles') {
        this.inputMode.set(s.mode as DftInputMode);
      }
      if (s.alg === 'fft' || s.alg === 'dft') this.algorithm.set(s.alg);
      if (s.v && INT_VARS.includes(s.v)) this.intVar.set(s.v);
      if (s.N && N_OPTIONS.includes(s.N)) this.N.set(s.N);
      if (s.dN && s.dN >= 4 && s.dN <= 4096) this.dftCustomN.set(s.dN);
      if (Array.isArray(s.seg) && s.seg.length) {
        this.segments.set(s.seg.map((seg) => ({
          id: mkId(),
          expression: seg.e ?? '', expressionTex: seg.et ?? '',
          from: seg.f ?? '', fromTex: seg.ft ?? '',
          to: seg.t ?? '', toTex: seg.tt ?? '',
        })));
      }
      if (s.mr !== undefined) this.manualRaw.set(s.mr);
      if (s.mN !== undefined) this.manualN.set(s.mN);
      if (s.pts !== undefined) {
        this.epicRawPoints.set(s.pts);
        // Parse exact floats now and stash them so epicCalculate bypasses the
        // lossy textarea round-trip, preserving the original SHA-256 hash.
        try {
          this._epicRestoredPoints = this._epicParsePoints(s.pts);
        } catch { this._epicRestoredPoints = null; }
        this.epicAutoNormalize.set(false);
      }
      return true;
    } catch { return false; }
  }

  // ── Share ──────────────────────────────────────────────────────────────────

  get shareHref(): string {
    return typeof window !== 'undefined' ? window.location.href : '';
  }

  openShareDialog(): void { this.showShareDialog.set(true); }

  async copyShareUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.urlCopied.set(true);
      setTimeout(() => this.urlCopied.set(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  // ── Download ───────────────────────────────────────────────────────────────

  downloadCanvas(wrapperRef: ElementRef<HTMLDivElement> | undefined, filename: string): void {
    const canvas = wrapperRef?.nativeElement?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename;
    a.click();
  }

  // ── Favorites ─────────────────────────────────────────────────────────────

  openFavoriteDialog(): void {
    this.favoriteLoading.set(true);
    this.fetchLatestEntry(() => {
      this.favoriteLoading.set(false);
      const loaded = this.latestHistoryEntry();
      if (loaded) this.doToggle(loaded);
    });
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

  // ── Canvas drawing ─────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    this._epicStopAnimation();
  }

  // ── Epicycles: public methods ──────────────────────────────────────────────

  epicLoadPreset(id: string): void {
    const preset = this.epicPresets.find((p) => p.id === id);
    if (!preset) return;
    this.epicRawPoints.set(this._epicFormatPoints(preset.points));
    this.epicSourcePoints.set(preset.points);
    this.epicResult.set(null);
    this.epicError.set(null);
    this.epicTrace.set([]);
    this.epicTime.set(0);
    this.epicSelectedK.set(null);
    this.epicDrawPoints.set([]);
  }

  async epicCalculate(): Promise<void> {
    if (this.epicLoading()) return;
    this.epicError.set(null);

    let parsed: DftPoint[];
    try {
      // Use stashed exact points when restoring from history to preserve float
      // precision and match the original SHA-256 deduplication hash.
      parsed = this._epicRestoredPoints ?? this._epicParsePoints(this.epicRawPoints());
      this._epicRestoredPoints = null;
    } catch (err) {
      this.epicError.set(err instanceof Error ? err.message : 'Invalid input.');
      return;
    }

    const prepared = this.epicAutoNormalize() ? this._epicNormalizePoints(parsed) : null;
    const effectivePts = prepared?.points ?? parsed;
    this.epicNormInfo.set(prepared?.info ?? null);

    this.epicLoading.set(true);
    try {
      const res = await firstValueFrom(this.api.calculateDFT({ points: effectivePts, mode: 'epicycles' }));
      this.epicSourcePoints.set(effectivePts);
      this.epicResult.set(res);
      this.epicTopK.set(Math.min(22, Math.max(1, res.coefficients.length)));
      this.epicTime.set(0);
      this.epicTrace.set([]);
      this.epicSelectedK.set(null);
      this.userStore.refreshQuota();
      if (this.userStore.isAuthenticated()) this.fetchLatestEntry();
    } catch (err) {
      const e = err as { error?: { error?: string }; message?: string };
      this.epicError.set(e?.error?.error ?? e?.message ?? 'Could not compute DFT.');
      this.epicResult.set(null);
    } finally {
      this.epicLoading.set(false);
    }
  }

  epicToggleAnimation(): void {
    if (this.epicIsAnimating()) { this._epicStopAnimation(); return; }
    if (typeof window === 'undefined' || !this.epicResult()) return;
    this.epicIsAnimating.set(true);
    this._epicTimerId = setInterval(() => {
      this.epicTime.update((t) => { const n = t + this.epicSpeed(); return n >= TAU ? n - TAU : n; });
      this.epicFrameTick.update((v) => v + 1);
      const end = this.epicEndpoint();
      if (end && this.epicShowTrace()) {
        this.epicTrace.update((pts) => {
          const next = [...pts, end];
          return next.length > 1600 ? next.slice(next.length - 1600) : next;
        });
      }
    }, 16);
  }

  epicResetAnimation(): void {
    this.epicTime.set(0);
    this.epicTrace.set([]);
  }

  epicToggleSelectedK(k: number): void {
    this.epicSelectedK.update((cur) => (cur === k ? null : k));
  }

  epicOpenDrawDialog(): void {
    this.epicDrawPoints.set([]);
    this._epicDrawCtx = null;
    this._epicDrawing = false;
    this.epicDrawDialogOpen.set(true);
  }

  epicCloseDrawDialog(): void {
    this.epicDrawDialogOpen.set(false);
    this._epicDrawCtx = null;
    this._epicDrawing = false;
  }

  epicConfirmDraw(): void {
    const pts = this.epicDrawPoints();
    if (pts.length < 3) { this.epicError.set('At least 3 points required.'); return; }
    this.epicRawPoints.set(this._epicFormatPoints(pts));
    this.epicDrawDialogOpen.set(false);
    this._epicDrawCtx = null;
    this._epicDrawing = false;
    void this.epicCalculate();
  }

  epicClearDrawCanvas(canvas: HTMLCanvasElement): void {
    this.epicDrawPoints.set([]);
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  epicStopAnimation(): void {
    this._epicStopAnimation();
  }

  epicDialogMouseDown(event: MouseEvent, canvas: HTMLCanvasElement): void {
    this._epicDrawing = true;
    this._epicDrawCtx = canvas.getContext('2d');
    this._epicDrawOnCanvas(event.offsetX, event.offsetY, canvas, true);
  }

  epicDialogMouseMove(event: MouseEvent, canvas: HTMLCanvasElement): void {
    if (!this._epicDrawing) return;
    this._epicDrawOnCanvas(event.offsetX, event.offsetY, canvas, false);
  }

  epicDialogMouseUp(): void {
    this._epicDrawing = false;
  }

  epicDialogTouchStart(event: TouchEvent, canvas: HTMLCanvasElement): void {
    event.preventDefault();
    this._epicDrawing = true;
    this._epicDrawCtx = canvas.getContext('2d');
    const t = event.touches[0];
    if (t) {
      const rect = canvas.getBoundingClientRect();
      this._epicDrawOnCanvas(t.clientX - rect.left, t.clientY - rect.top, canvas, true);
    }
  }

  epicDialogTouchMove(event: TouchEvent, canvas: HTMLCanvasElement): void {
    event.preventDefault();
    if (!this._epicDrawing) return;
    const t = event.touches[0];
    if (t) {
      const rect = canvas.getBoundingClientRect();
      this._epicDrawOnCanvas(t.clientX - rect.left, t.clientY - rect.top, canvas, false);
    }
  }

  epicDialogTouchEnd(): void {
    this._epicDrawing = false;
  }

  // ── Epicycles: private helpers ─────────────────────────────────────────────

  private _epicStopAnimation(): void {
    this.epicIsAnimating.set(false);
    if (this._epicTimerId !== null) { clearInterval(this._epicTimerId); this._epicTimerId = null; }
  }

  private _epicDrawOnCanvas(offsetX: number, offsetY: number, canvas: HTMLCanvasElement, isStart: boolean): void {
    const ctx = this._epicDrawCtx ?? canvas.getContext('2d');
    if (!ctx) return;

    // Normalize to [-1, 1] centered
    const nx = (offsetX / canvas.width)  * 2 - 1;
    const ny = (1 - offsetY / canvas.height) * 2 - 1;

    this.epicDrawPoints.update((pts) => {
      const last = pts[pts.length - 1];
      if (!isStart && last && Math.hypot(nx - last.x, ny - last.y) < 0.012) return pts;
      return [...pts, { x: nx, y: ny }];
    });

    // Draw stroke on the canvas for immediate visual feedback
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.theme.isDark ? '#f59e0b' : '#d97706';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (isStart) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
    } else {
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
    }
  }

  private _epicParsePoints(raw: string): DftPoint[] {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) throw new Error('At least 3 x,y points required.');
    return lines.map((line, i) => {
      const parts = line.split(/[\s,;]+/).filter(Boolean);
      if (parts.length < 2) throw new Error(`Line ${i + 1}: use x,y format.`);
      const x = Number(parts[0]), y = Number(parts[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Line ${i + 1}: invalid numbers.`);
      return { x, y };
    });
  }

  private _epicFormatPoints(pts: DftPoint[]): string {
    return pts.map((p) => `${p.x}, ${p.y}`).join('\n');
  }

  private _epicEvalPoint(coeffs: EpicRenderCoeff[], time: number): DftPoint {
    let x = 0, y = 0;
    for (const c of coeffs) {
      const a = c.kSigned * time;
      x += c.re * Math.cos(a) - c.im * Math.sin(a);
      y += c.re * Math.sin(a) + c.im * Math.cos(a);
    }
    return { x, y };
  }

  private _epicComputeStates(coeffs: EpicRenderCoeff[], time: number): EpicycleState[] {
    const states: EpicycleState[] = [];
    const selK = this.epicSelectedK();
    const total = Math.max(1, coeffs.length);
    let cx = 0, cy = 0;
    for (let i = 0; i < coeffs.length; i++) {
      const c = coeffs[i];
      if (!c) continue;
      const a = c.kSigned * time;
      const vx = c.re * Math.cos(a) - c.im * Math.sin(a);
      const vy = c.re * Math.sin(a) + c.im * Math.cos(a);
      states.push({ color: this._epicHarmonicColor(i, total), selected: selK === c.k, centerX: cx, centerY: cy, endX: cx + vx, endY: cy + vy, radius: c.amplitudeSafe });
      cx += vx; cy += vy;
    }
    return states;
  }

  private _epicDrawOverlay(ctx: CanvasRenderingContext2D, vp: CanvasViewport): void {
    if (this.epicShowSampled()) {
      this.du.drawPoints(ctx, vp, this.epicSourcePoints(), 'rgba(248,250,252,0.75)', 1.8);
    }
    if (!this.epicShowChains()) return;
    const states = this.epicStates();
    if (!states.length) return;
    const toX = (x: number) => this.coords.mathToScreenX(x, vp) / vp.dpr;
    const toY = (y: number) => this.coords.mathToScreenY(y, vp) / vp.dpr;
    const pxPerUnit = vp.unit * ((vp.scaleX + vp.scaleY) / 2);
    const hasSel = states.some((s) => s.selected);
    for (const s of states) {
      const cx = toX(s.centerX), cy = toY(s.centerY), ex = toX(s.endX), ey = toY(s.endY);
      const dimmed = hasSel && !s.selected;
      this.du.drawCircle(ctx, cx, cy, Math.max(1.5, s.radius * pxPerUnit), this.du.withAlpha(s.color, s.selected ? 0.42 : dimmed ? 0.12 : 0.28), 1);
      this.du.drawLine(ctx, cx, cy, ex, ey, this.du.withAlpha(s.color, s.selected ? 1 : dimmed ? 0.22 : 0.88), s.selected ? 2.4 : 1.5);
      this.du.drawArrowHead(ctx, cx, cy, ex, ey, this.du.withAlpha(s.color, s.selected ? 1 : dimmed ? 0.26 : 0.9), s.selected ? 8 : 6);
    }
    const last = states[states.length - 1];
    if (last) this.du.drawCircle(ctx, toX(last.endX), toY(last.endY), 3.1, null, 1, hasSel ? this.du.withAlpha('#f8fafc', 0.95) : '#f59e0b');
  }

  private _epicNormalizePoints(pts: DftPoint[]): { points: DftPoint[]; info: { applied: boolean; centered: boolean; centerX: number; centerY: number; scale: number } } {
    if (!pts.length) return { points: pts, info: { applied: false, centered: this.epicCenterScale(), centerX: 0, centerY: 0, scale: 1 } };
    const centered = this.epicCenterScale();
    let sumX = 0, sumY = 0;
    for (const p of pts) { sumX += p.x; sumY += p.y; }
    const cx = centered ? sumX / pts.length : 0;
    const cy = centered ? sumY / pts.length : 0;
    let maxR = 0;
    for (const p of pts) { const r = Math.hypot(p.x - cx, p.y - cy); if (r > maxR) maxR = r; }
    const scale = maxR > 0 ? 1 / maxR : 1;
    return { points: pts.map((p) => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale })), info: { applied: true, centered, centerX: cx, centerY: cy, scale } };
  }

  private _epicClose(pts: DftPoint[]): DftPoint[] {
    if (pts.length < 2) return pts;
    const f = pts[0], l = pts[pts.length - 1];
    return f.x === l.x && f.y === l.y ? pts : [...pts, f];
  }

  private _epicFinite(v: unknown): number {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
    return 0;
  }

  private _epicPiLabel(phase: number): string {
    const r = phase / Math.PI;
    if (!Number.isFinite(r)) return '0';
    const table: [number, string][] = [[0,'0'],[1,'1'],[-1,'-1'],[0.5,'1/2'],[-0.5,'-1/2'],[1/3,'1/3'],[-1/3,'-1/3'],[2/3,'2/3'],[-2/3,'-2/3'],[1/4,'1/4'],[-1/4,'-1/4'],[3/4,'3/4'],[-3/4,'-3/4']];
    for (const [t, l] of table) { if (Math.abs(r - t) < 1e-4) return l; }
    return Number(r.toFixed(4)).toString();
  }

  private _epicHarmonicColor(index: number, total: number): string {
    const hue = (200 + (total <= 1 ? 0 : index / (total - 1)) * 300) % 360;
    return `hsl(${hue.toFixed(1)} 90% 62%)`;
  }

  private _drawReconstruction(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    res: LocalDftResult,
    color: string,
    lineWidth: number,
  ): void {
    const pts = res.reconstructed;
    if (pts.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    let first = true;
    for (const p of pts) {
      const sx = this.coords.mathToScreenX(p.x, vp) / vp.dpr;
      const sy = this.coords.mathToScreenY(p.y, vp) / vp.dpr;
      if (first) { ctx.moveTo(sx, sy); first = false; } else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();
  }
}
