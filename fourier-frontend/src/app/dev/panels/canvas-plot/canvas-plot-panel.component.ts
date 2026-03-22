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
  // Numeric Fourier terms (simulated — would come from backend in production)
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
  private readonly mathUtils    = inject(MathUtilsService);
  private readonly reconstruction = inject(FourierReconstructionService);
  private readonly plotter      = inject(PlottingService);

  readonly presets: FunctionPreset[] = [
    {
      label: 'Onda cuadrada',
      pieces: [
        { maxima: '-1',  from: -Math.PI, to: 0         },
        { maxima: '1',   from:  0,       to: Math.PI   },
      ],
      xFormat: 'pi',
      a0: 0,
      w0: 1,
      terms: this.squareWaveTerms(10),
    },
    {
      label: 'Diente de sierra',
      pieces: [{ maxima: 'x/%pi', from: -Math.PI, to: Math.PI }],
      xFormat: 'pi',
      a0: 0,
      w0: 1,
      terms: this.sawtoothTerms(10),
    },
    {
      label: 'Función lineal a trozos',
      pieces: [
        { maxima: 'x',   from: -Math.PI, to: 0       },
        { maxima: '1',   from:  0,       to: Math.PI },
      ],
      xFormat: 'pi',
      a0: Math.PI / 4,
      w0: 1,
      terms: this.piecewiseLinearTerms(10),
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
    const preset = this.presets[this.selectedPreset()];
    const curves = [];

    // Original function (piecewise)
    if (this.showOriginal()) {
      const pieces = preset.pieces
        .map(({ maxima, from, to }) => {
          const fn = this.mathUtils.compile(maxima);
          return fn ? { fn, from, to } : null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      const stepsPerPiece = 300;
      const pts = this.plotter.samplePiecewise(pieces, stepsPerPiece);
      curves.push({ points: pts, color: '#8b2500', lineWidth: 2.5 });
    }

    // Fourier approximation
    if (this.showApprox()) {
      const approxFn = this.reconstruction.buildTrigonometric(
        preset.a0,
        preset.terms,
        preset.w0,
        this.nTerms(),
      );
      const pts = this.plotter.sampleRange(
        approxFn,
        -2 * Math.PI,
        2 * Math.PI,
        800,
      );
      curves.push({
        points: pts,
        color:  '#1a4a6b',
        lineWidth: 1.75,
        dashed: false,
      });
    }

    this.layers.set([{ curves }]);
  }

  // ── Hardcoded numeric terms (in production these come from the backend) ──

  private squareWaveTerms(n: number) {
    const terms = [];
    for (let k = 1; k <= n; k++) {
      // bn = 4/(nπ) for odd n, 0 for even n
      terms.push({
        n: k,
        anFloat: 0,
        bnFloat: k % 2 === 0 ? 0 : 4 / (k * Math.PI),
      });
    }
    return terms;
  }

  private sawtoothTerms(n: number) {
    const terms = [];
    for (let k = 1; k <= n; k++) {
      // bn = (-1)^(k+1) * 2/(kπ)
      terms.push({
        n: k,
        anFloat: 0,
        bnFloat: (k % 2 === 0 ? -1 : 1) * 2 / (k * Math.PI),
      });
    }
    return terms;
  }

  private piecewiseLinearTerms(n: number) {
    const terms = [];
    for (let k = 1; k <= n; k++) {
      // Numeric approximation for demo purposes
      const an = (Math.cos(k * Math.PI) - 1) / (k * k * Math.PI);
      const bn = -Math.cos(k * Math.PI) / k;
      terms.push({ n: k, anFloat: an, bnFloat: bn });
    }
    return terms;
  }
}
