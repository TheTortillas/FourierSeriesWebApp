import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FunctionPlotComponent, PlotLayer } from '../../../shared/components/function-plot/function-plot.component';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import { FourierReconstructionService } from '../../../core/services/canvas/fourier-reconstruction.service';
import { PlottingService } from '../../../core/services/canvas/plotting.service';

interface FunctionPreset {
  label: string;
  pieces: { maxima: string; from: number; to: number }[];
  xFormat: 'integer' | 'pi' | 'e';
  a0: number;
  terms: { n: number; anFloat: number; bnFloat: number }[];
  w0: number;
}

@Component({
  selector: 'app-canvas-plot-panel',
  imports: [FunctionPlotComponent, FormsModule],
  templateUrl: './canvas-plot-panel.component.html',
})
export class CanvasPlotPanelComponent {
  private readonly mathUtils      = inject(MathUtilsService);
  private readonly reconstruction = inject(FourierReconstructionService);
  private readonly plotter        = inject(PlottingService);

  readonly presets: FunctionPreset[] = [
    {
      label: 'Onda cuadrada',
      pieces: [
        { maxima: '-1',    from: -Math.PI, to: 0       },
        { maxima: '1',     from:  0,       to: Math.PI },
      ],
      xFormat: 'pi', a0: 0, w0: 1,
      terms: this.squareWaveTerms(20),
    },
    {
      label: 'Diente de sierra',
      pieces: [{ maxima: 'x/%pi', from: -Math.PI, to: Math.PI }],
      xFormat: 'pi', a0: 0, w0: 1,
      terms: this.sawtoothTerms(20),
    },
    {
      label: 'Lineal a trozos',
      pieces: [
        { maxima: 'x', from: -Math.PI, to: 0       },
        { maxima: '1', from:  0,       to: Math.PI },
      ],
      xFormat: 'pi', a0: Math.PI / 4, w0: 1,
      terms: this.piecewiseLinearTerms(20),
    },
  ];

  selectedPreset  = signal(0);
  nTerms          = signal(5);
  showOriginal    = signal(true);
  showApprox      = signal(true);

  sandboxExpr     = signal('');
  sandboxError    = signal('');

  readonly layers = signal<PlotLayer[]>([]);

  constructor() {
    this.updatePlot();
  }

  selectPreset(i: number): void {
    this.selectedPreset.set(i);
    this.updatePlot();
  }

  setTerms(n: number): void {
    this.nTerms.set(n);
    this.updatePlot();
  }

  toggleOriginal(): void {
    this.showOriginal.update((v) => !v);
    this.updatePlot();
  }

  toggleApprox(): void {
    this.showApprox.update((v) => !v);
    this.updatePlot();
  }

  applySandbox(): void {
    this.updatePlot();
  }

  clearSandbox(): void {
    this.sandboxExpr.set('');
    this.sandboxError.set('');
    this.updatePlot();
  }

  private updatePlot(): void {
    const preset       = this.presets[this.selectedPreset()];
    const showOriginal = this.showOriginal();
    const showApprox   = this.showApprox();
    const nTerms       = this.nTerms();
    const plotter      = this.plotter;

    // Build compiled pieces once (not every frame)
    const compiledPieces = preset.pieces
      .map(({ maxima, from, to }) => {
        const fn = this.mathUtils.compile(maxima);
        return fn ? { fn, from, to } : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Build Fourier approximation function once
    const approxFn = this.reconstruction.buildTrigonometric(
      preset.a0, preset.terms, preset.w0, nTerms,
    );

    // Compile sandbox expression
    const rawSandbox = this.sandboxExpr().trim();
    let sandboxFn: ((x: number) => number) | null = null;
    if (rawSandbox) {
      sandboxFn = this.mathUtils.compile(rawSandbox);
      this.sandboxError.set(sandboxFn ? '' : 'Expresión inválida');
    } else {
      this.sandboxError.set('');
    }

    this.layers.set([
      {
        curves: [],
        onDraw(ctx, vp) {
          if (showOriginal) {
            for (const piece of compiledPieces) {
              plotter.plotFnRange(ctx, piece.fn, piece.from, piece.to, 400, vp,
                { color: '#8b2500', lineWidth: 2.5 });
            }
          }

          if (showApprox) {
            plotter.plotFn(ctx, approxFn, vp, { color: '#1a4a6b', lineWidth: 1.75 });
          }

          if (sandboxFn) {
            plotter.plotFn(ctx, sandboxFn, vp, { color: '#a855f7', lineWidth: 2 });
          }
        },
      },
    ]);
  }

  // ── Hardcoded numeric terms (in production these come from the backend) ───

  private squareWaveTerms(n: number) {
    return Array.from({ length: n }, (_, k) => ({
      n: k + 1,
      anFloat: 0,
      bnFloat: (k + 1) % 2 === 0 ? 0 : 4 / ((k + 1) * Math.PI),
    }));
  }

  private sawtoothTerms(n: number) {
    return Array.from({ length: n }, (_, k) => ({
      n: k + 1,
      anFloat: 0,
      bnFloat: ((k + 1) % 2 === 0 ? -1 : 1) * 2 / ((k + 1) * Math.PI),
    }));
  }

  private piecewiseLinearTerms(n: number) {
    return Array.from({ length: n }, (_, k) => {
      const m = k + 1;
      return {
        n: m,
        anFloat: (Math.cos(m * Math.PI) - 1) / (m * m * Math.PI),
        bnFloat: -Math.cos(m * Math.PI) / m,
      };
    });
  }
}
