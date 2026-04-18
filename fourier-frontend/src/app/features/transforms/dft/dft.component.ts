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
import { RouterModule } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { NavComponent } from '../../../shared/components/nav/nav.component';
import { SeoService } from '../../../core/services/seo/seo.service';
import { ApiService } from '../../../core/services/api/api.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { DrawingUtilsService } from '../../../core/services/canvas/drawing-utils.service';
import { CoordinateTransformService } from '../../../core/services/canvas/coordinate-transform.service';
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

const N_OPTIONS = [16, 32, 64, 128, 256, 512, 1024];
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
  private readonly seo     = inject(SeoService);
  private readonly api     = inject(ApiService);
  private readonly theme   = inject(ThemeService);
  private readonly du      = inject(DrawingUtilsService);
  private readonly coords  = inject(CoordinateTransformService);
  private readonly dftCompute = inject(DftComputeService);
  readonly mqs             = inject(MathquillService);

  readonly signalPlotRef   = viewChild<FunctionPlotComponent>('signalPlot');
  readonly spectrumPlotRef = viewChild<FunctionPlotComponent>('spectrumPlot');
  readonly specWrapperRef  = viewChild<ElementRef<HTMLDivElement>>('spectrumWrapper');

  // ── Mode / algorithm ────────────────────────────────────────────────────────
  readonly inputMode = signal<DftInputMode>('function');
  readonly algorithm = signal<DftAlgorithm>('fft');

  // ── Function-mode form state ─────────────────────────────────────────────────
  readonly segments = signal<TransformSegmentDraft[]>([defaultSegment()]);
  readonly intVar   = signal('x');
  readonly N        = signal(128);
  readonly nOptions = N_OPTIONS;
  readonly intVars  = INT_VARS;

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
  }

  ngOnInit(): void {
    this.seo.setPage('seo.dft.title', 'seo.dft.description');
  }

  // ── Mode helpers ───────────────────────────────────────────────────────────

  switchMode(mode: DftInputMode): void {
    if (this.inputsLocked()) return;
    this.inputMode.set(mode);
    this.error.set(null);
  }

  switchAlgorithm(alg: DftAlgorithm): void {
    this.algorithm.set(alg);
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
      N: this.N(),
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
    this.segments.set([defaultSegment(this.intVar())]);
    this.N.set(128);
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
    const mathX = this.coords.cssToMathX(event.clientX - rect.left, this._lastSpecVp);
    const shift = this.fftShift();

    let nearest: DftCoefficient | null = null;
    let minDist = Infinity;
    for (const c of res.coefficients) {
      const kDisplay = shift ? (c.k <= res.N / 2 ? c.k : c.k - res.N) : c.k;
      const d = Math.abs(kDisplay - mathX);
      if (d < minDist) { minDist = d; nearest = c; }
    }
    this.hoveredCoeff.set(minDist < 1.5 ? nearest : null);
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
