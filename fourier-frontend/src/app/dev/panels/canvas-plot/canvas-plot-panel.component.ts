import { Component, inject, signal } from '@angular/core';
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
  imports: [FunctionPlotComponent],
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

  selectedPreset = signal(0);
  nTerms         = signal(5);
  showOriginal   = signal(true);
  showApprox     = signal(true);

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

    this.layers.set([
      {
        curves: [],
        onDraw(ctx, vp) {
          // Original: bounded to piece intervals — intentional
          if (showOriginal) {
            plotter.samplePiecewise(compiledPieces, 400).reduce<null>((_, pt, i, arr) => {
              // Use drawCurve per-piece so discontinuities at boundaries are clean
              void pt; void i; void arr; return null;
            }, null);
            for (const piece of compiledPieces) {
              plotter.plotFnRange(ctx, piece.fn, piece.from, piece.to, 400, vp,
                { color: '#8b2500', lineWidth: 2.5 });
            }
          }

          // Approximation: fills visible range (periodic series)
          if (showApprox) {
            plotter.plotFn(ctx, approxFn, vp, { color: '#1a4a6b', lineWidth: 1.75 });
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
