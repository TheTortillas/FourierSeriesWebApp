import {
  Component,
  computed,
  DestroyRef,
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
import type { DftFunctionResponse, DftSegment, DftCoefficient } from '../../../domain/types/dft.types';
import type { CanvasViewport } from '../../../core/services/canvas/canvas.types';

const N_OPTIONS = [16, 32, 64, 128, 256, 512, 1024];
const INT_VARS = ['x', 't', 'u', 's'];

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
  readonly mqs                = inject(MathquillService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly signalPlotRef   = viewChild<FunctionPlotComponent>('signalPlot');
  readonly spectrumPlotRef = viewChild<FunctionPlotComponent>('spectrumPlot');
  readonly specWrapperRef  = viewChild<ElementRef<HTMLDivElement>>('spectrumWrapper');

  // ── Form state ─────────────────────────────────────────────────────────────
  readonly segments = signal<TransformSegmentDraft[]>([defaultSegment()]);
  readonly intVar   = signal('x');
  readonly N        = signal(128);
  readonly nOptions = N_OPTIONS;
  readonly intVars  = INT_VARS;

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
  readonly result  = signal<DftFunctionResponse | null>(null);

  // ── UI toggles ─────────────────────────────────────────────────────────────
  readonly showSamples         = signal(true);
  readonly showReconstruction  = signal(true);
  readonly showCanvasSettings  = signal(false);
  readonly showSpecSettings    = signal(false);

  // ── Spectrum mode ──────────────────────────────────────────────────────────
  readonly specMode  = signal<'amplitude' | 'phase'>('amplitude');
  readonly fftShift  = signal(true);

  // ── Canvas colors ──────────────────────────────────────────────────────────
  readonly samplesColor          = signal('#ea580c');
  readonly reconstructionColor   = signal('#6366f1');
  readonly specAmplitudeColor    = signal('#7c3aed');
  readonly specPhaseColor        = signal('#059669');
  readonly reconstructionLineWidth = signal(1.8);
  readonly samplesRadius         = signal(2.2);
  readonly specStemWidth         = signal(1.6);

  private _customSamplesColor        = false;
  private _customReconstructionColor = false;
  private _customSpecAmpColor        = false;
  private _customSpecPhaseColor      = false;

  // ── Hover / selection ──────────────────────────────────────────────────────
  readonly hoveredCoeff  = signal<DftCoefficient | null>(null);
  readonly selectedCoeff = signal<DftCoefficient | null>(null);

  /** Cached last rendered viewport for spectrum chart — used for mouse→math coord conversion. */
  private _lastSpecVp: CanvasViewport | null = null;

  // ── LaTeX preview ──────────────────────────────────────────────────────────
  readonly previewLatex = computed<string | null>(() => {
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
    void this.theme.isDark; // track for redraws

    return [{
      curves: [],
      onDraw: (ctx: CanvasRenderingContext2D, vp: CanvasViewport) => {
        if (showR) this.drawReconstruction(ctx, vp, res, rColor, rLW);
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

  // ── Derived computed values ────────────────────────────────────────────────

  readonly topCoeffs = computed(() => {
    const res = this.result();
    return res ? [...res.topCoefficients].slice(0, 10) : [];
  });

  readonly stats = computed(() => {
    const res = this.result();
    if (!res) return null;
    const { a, b } = res.interval;
    return { N: res.N, rmsError: res.rmsError, executionTimeMs: res.executionTimeMs, dx: (b - a) / res.N, a, b };
  });

  readonly specColor = computed(() =>
    this.specMode() === 'amplitude' ? this.specAmplitudeColor() : this.specPhaseColor(),
  );

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
    const segs = this.segments();
    if (segs.some((s) => !s.expression.trim() || !s.from.trim() || !s.to.trim())) {
      this.error.set('Completa todos los campos de los tramos.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const body: { segments: DftSegment[]; intVar: string; N: number } = {
      segments: segs.map((s) => ({ expression: s.expression, from: s.from, to: s.to })),
      intVar: this.intVar(),
      N: this.N(),
    };

    this.api.calculateDFTFromFunction(body).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
        this.selectedCoeff.set(null);
        this.hoveredCoeff.set(null);
        this.showCanvasSettings.set(true);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Error al calcular la DFT.');
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

  onSamplesColorInput(v: string): void       { this._customSamplesColor = true;        this.samplesColor.set(v); }
  onReconColorInput(v: string): void         { this._customReconstructionColor = true;  this.reconstructionColor.set(v); }
  onSpecAmpColorInput(v: string): void       { this._customSpecAmpColor = true;         this.specAmplitudeColor.set(v); }
  onSpecPhaseColorInput(v: string): void     { this._customSpecPhaseColor = true;       this.specPhaseColor.set(v); }

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

  // ── Spectrum mouse interaction ─────────────────────────────────────────────

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

  private drawReconstruction(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    res: DftFunctionResponse,
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
