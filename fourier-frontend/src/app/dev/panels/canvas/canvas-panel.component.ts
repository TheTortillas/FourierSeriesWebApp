import { Component, inject, signal, viewChild } from '@angular/core';
import { FunctionPlotComponent, PlotLayer } from '../../../shared/components/function-plot/function-plot.component';
import { PlottingService } from '../../../core/services/canvas/plotting.service';

/**
 * Dev panel: basic canvas smoke-test.
 * Curves are sampled dynamically every frame via onDraw → always fill the screen.
 */
@Component({
  selector: 'app-canvas-panel',
  imports: [FunctionPlotComponent],
  templateUrl: './canvas-panel.component.html',
})
export class CanvasPanelComponent {
  private readonly plotter = inject(PlottingService);
  readonly plotRef = viewChild(FunctionPlotComponent);

  readonly xFormats = ['integer', 'pi', 'e'] as const;
  xFormat = signal<'integer' | 'pi' | 'e'>('pi');

  readonly layers = signal<PlotLayer[]>(this.buildLayers());

  private buildLayers(): PlotLayer[] {
    const plotter = this.plotter;
    return [
      {
        curves: [],
        onDraw(ctx, vp) {
          // sampled dynamically → always fills the visible range
          plotter.plotFn(ctx, Math.sin, vp, { color: '#8b2500', lineWidth: 2 });
          plotter.plotFn(ctx, Math.cos, vp, { color: '#1a4a6b', lineWidth: 1.5, dashed: true });
          plotter.plotFn(ctx, Math.tan, vp, { color: '#2d5a27', lineWidth: 1.5 });
          plotter.plotFn(ctx, (x) => x * x / 10, vp, { color: '#b8860b', lineWidth: 1.5 });
        },
      },
    ];
  }

  setFormat(fmt: 'integer' | 'pi' | 'e'): void {
    this.xFormat.set(fmt);
  }

  resetView(): void {
    this.plotRef()?.resetView();
  }
}
