import {
  Component,
  computed,
  effect,
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
import type { DftFunctionResponse, DftSegment, DftCoefficient } from '../../../domain/types/dft.types';
import type { CanvasViewport } from '../../../core/services/canvas/canvas.types';

interface Segment {
  expression: string;
  from: string;
  to: string;
}

const N_OPTIONS = [16, 32, 64, 128, 256, 512, 1024];
const INT_VARS = ['x', 't', 'u', 's'];

@Component({
  selector: 'app-dft',
  templateUrl: './dft.component.html',
  imports: [
    NavComponent,
    RouterModule,
    TranslocoPipe,
    FormsModule,
    FunctionPlotComponent,
    DecimalPipe,
  ],
})
export class DftComponent implements OnInit {
  private readonly seo    = inject(SeoService);
  private readonly api    = inject(ApiService);
  private readonly theme  = inject(ThemeService);
  private readonly du     = inject(DrawingUtilsService);
  private readonly coords = inject(CoordinateTransformService);

  readonly plotRef = viewChild(FunctionPlotComponent);

  // ── Form state ─────────────────────────────────────────────────────────────
  readonly segments  = signal<Segment[]>([{ expression: 'sin(x)', from: '-%pi', to: '%pi' }]);
  readonly intVar    = signal('x');
  readonly N         = signal(128);
  readonly nOptions  = N_OPTIONS;
  readonly intVars   = INT_VARS;

  // ── Request state ──────────────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);
  readonly result  = signal<DftFunctionResponse | null>(null);

  // ── Spectrum display ───────────────────────────────────────────────────────
  readonly specMode = signal<'amplitude' | 'phase'>('amplitude');

  // ── Computed layers for plots ──────────────────────────────────────────────

  readonly signalLayers = computed<PlotLayer[]>(() => {
    const res = this.result();
    if (!res) return [];
    const isDark = this.theme.isDark;

    return [
      {
        curves: [],
        onDraw: (ctx: CanvasRenderingContext2D, vp: CanvasViewport) => {
          this.drawSignal(ctx, vp, res, isDark);
        },
      },
    ];
  });

  readonly spectrumLayers = computed<PlotLayer[]>(() => {
    const res = this.result();
    if (!res) return [];
    const mode = this.specMode();
    const isDark = this.theme.isDark;

    return [
      {
        curves: [],
        onDraw: (ctx: CanvasRenderingContext2D, vp: CanvasViewport) => {
          this.drawSpectrum(ctx, vp, res.coefficients, res.N, mode, isDark);
        },
      },
    ];
  });

  // ── Top coefficients table ─────────────────────────────────────────────────
  readonly topCoeffs = computed(() => {
    const res = this.result();
    if (!res) return [];
    return [...res.topCoefficients].slice(0, 10);
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  readonly stats = computed(() => {
    const res = this.result();
    if (!res) return null;
    const { a, b } = res.interval;
    const dx = (b - a) / res.N;
    const fs = 1 / dx;
    return { N: res.N, rmsError: res.rmsError, executionTimeMs: res.executionTimeMs, fs, dx, a, b };
  });

  constructor() {
    // Re-render plots when theme changes
    effect(() => {
      void this.theme.isDark;
      this.plotRef()?.redraw();
    });
  }

  ngOnInit(): void {
    this.seo.setPage('seo.dft.title', 'seo.dft.description');
  }

  // ── Form helpers ───────────────────────────────────────────────────────────

  addSegment(): void {
    const segs = this.segments();
    const last = segs[segs.length - 1];
    this.segments.set([...segs, { expression: '0', from: last?.to ?? '0', to: '1' }]);
  }

  removeSegment(i: number): void {
    if (this.segments().length <= 1) return;
    this.segments.update((s) => s.filter((_, idx) => idx !== i));
  }

  updateSegment(i: number, field: keyof Segment, value: string): void {
    this.segments.update((s) =>
      s.map((seg, idx) => (idx === i ? { ...seg, [field]: value } : seg)),
    );
  }

  setIntVar(v: string): void { this.intVar.set(v); }
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
    this.segments.set([{ expression: 'sin(x)', from: '-%pi', to: '%pi' }]);
    this.intVar.set('x');
    this.N.set(128);
  }

  // ── Canvas drawing ─────────────────────────────────────────────────────────

  private drawSignal(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    res: DftFunctionResponse,
    isDark: boolean,
  ): void {
    const samples = res.sampledPoints;
    const reconstructed = res.reconstructed;

    // Draw reconstruction as connected polyline
    const recColor = isDark ? '#818cf8' : '#6366f1';
    ctx.save();
    ctx.strokeStyle = recColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    let first = true;
    for (const p of reconstructed) {
      const sx = this.coords.mathToScreenX(p.x, vp) / vp.dpr;
      const sy = this.coords.mathToScreenY(p.y, vp) / vp.dpr;
      if (first) { ctx.moveTo(sx, sy); first = false; }
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();

    // Draw sample dots on top
    const dotColor = isDark ? '#fb923c' : '#ea580c';
    this.du.drawPoints(ctx, vp, samples, dotColor, 2.2);
  }

  private drawSpectrum(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    coefficients: DftCoefficient[],
    N: number,
    mode: 'amplitude' | 'phase',
    isDark: boolean,
  ): void {
    const color = mode === 'amplitude'
      ? (isDark ? '#a78bfa' : '#7c3aed')
      : (isDark ? '#6ee7b7' : '#059669');

    for (const c of coefficients) {
      // Center the spectrum: map k > N/2 to negative frequencies
      const kDisplay = c.k <= N / 2 ? c.k : c.k - N;
      const val = mode === 'amplitude' ? c.amplitude : c.phase;
      this.du.drawStem(ctx, vp, kDisplay, val, color, 1.6, 3);
    }
  }
}
