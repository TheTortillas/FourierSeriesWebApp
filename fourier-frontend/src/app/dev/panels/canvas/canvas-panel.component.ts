import { Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AxisConst, FunctionPlotComponent, PlotLayer } from '../../../shared/components/function-plot/function-plot.component';
import { PlottingService } from '../../../core/services/canvas/plotting.service';

// No X/Y (axes) and no W/w (reserved for Fourier transform frequency)
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVZ'.split(''); // no W, X, Y
const LOWER = 'abcdefghijklmnopqrstuvz'.split(''); // no w, x, y
const PI = Math.PI;
const E  = Math.E;

@Component({
  selector: 'app-canvas-panel',
  imports: [FunctionPlotComponent, FormsModule],
  templateUrl: './canvas-panel.component.html',
})
export class CanvasPanelComponent {
  private readonly plotter = inject(PlottingService);
  readonly plotRef = viewChild(FunctionPlotComponent);

  readonly xFormats     = ['integer', 'pi', 'e', 'custom'] as const;
  readonly upperSymbols = UPPER;
  readonly lowerSymbols = LOWER;
  readonly PI = PI;
  readonly E  = E;

  xFormat     = signal<'integer' | 'pi' | 'e' | 'custom'>('pi');
  customConst = signal<AxisConst>({ symbol: 'T', value: Math.PI });

  readonly layers = signal<PlotLayer[]>(this.buildLayers());

  private buildLayers(): PlotLayer[] {
    const plotter = this.plotter;
    return [{
      curves: [],
      onDraw(ctx, vp) {
        plotter.plotFn(ctx, Math.sin, vp, { color: '#8b2500', lineWidth: 2 });
        plotter.plotFn(ctx, Math.cos, vp, { color: '#1a4a6b', lineWidth: 1.5, dashed: true });
        plotter.plotFn(ctx, Math.tan, vp, { color: '#2d5a27', lineWidth: 1.5 });
        plotter.plotFn(ctx, (x) => x * x / 10, vp, { color: '#b8860b', lineWidth: 1.5 });
      },
    }];
  }

  setFormat(fmt: typeof this.xFormats[number]): void {
    this.xFormat.set(fmt);
  }

  setSymbol(sym: string): void {
    this.customConst.update((c) => ({ ...c, symbol: sym }));
  }

  setConstValue(v: number): void {
    this.customConst.update((c) => ({ ...c, value: v }));
  }

  resetView(): void {
    this.plotRef()?.resetView();
  }
}
