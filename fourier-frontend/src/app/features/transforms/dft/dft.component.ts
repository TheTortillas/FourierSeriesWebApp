import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { NavComponent } from '../../../shared/components/nav/nav.component';
import { SeoService } from '../../../core/services/seo/seo.service';
import { ApiService } from '../../../core/services/api/api.service';
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
  LocalDftResult,
} from '../../../domain/types/dft.types';
import type { DftSegment } from '../../../domain/types/dft.types';
import type { CanvasViewport } from '../../../core/services/canvas/canvas.types';

const N_OPTIONS = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
const INT_VARS = ['x', 't', 'u', 's'];
const TOP_LIMIT = 256;

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
export class DftComponent implements OnInit {
  private readonly seo        = inject(SeoService);
  private readonly api        = inject(ApiService);
  private readonly theme      = inject(ThemeService);
  private readonly du         = inject(DrawingUtilsService);
  private readonly coords     = inject(CoordinateTransformService);
  private readonly plotter    = inject(PlottingService);
  private readonly mathUtils  = inject(MathUtilsService);
  private readonly dftCompute = inject(DftComputeService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  readonly mqs                = inject(MathquillService);

  readonly signalPlotRef    = viewChild<FunctionPlotComponent>('signalPlot');
  readonly spectrumPlotRef  = viewChild<FunctionPlotComponent>('spectrumPlot');
  readonly specWrapperRef   = viewChild<ElementRef<HTMLDivElement>>('spectrumWrapper');
  readonly signalWrapperRef = viewChild<ElementRef<HTMLDivElement>>('signalWrapper');

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

  // ── Signal canvas X-axis format ─────────────────────────────────────────────
  readonly signalXAxisFormat = signal<'integer' | 'pi' | 'e'>('integer');

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
      this.compute();
    }
  }

  // ── Mode helpers ───────────────────────────────────────────────────────────

  switchMode(mode: DftInputMode): void {
    if (this.inputsLocked()) return;
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
      };
      if (s.mode === 'function' || s.mode === 'manual') this.inputMode.set(s.mode);
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

  // ── Canvas drawing ─────────────────────────────────────────────────────────

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
