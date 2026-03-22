import { Component, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FunctionPlotComponent, PlotLayer } from '../../../shared/components/function-plot/function-plot.component';

/**
 * Dev panel: basic canvas smoke-test.
 * Draws axes, grid, and a few hardcoded curves to verify:
 *   - DPR sharpness
 *   - Zoom / pan
 *   - Theme switching
 *   - Discontinuity handling (tan)
 */
@Component({
  selector: 'app-canvas-panel',
  imports: [FunctionPlotComponent, FormsModule],
  templateUrl: './canvas-panel.component.html',
})
export class CanvasPanelComponent {
  readonly plotRef = viewChild(FunctionPlotComponent);

  readonly xFormats: CanvasXFormat[] = ['integer', 'pi', 'e'];
  xFormat = signal<'integer' | 'pi' | 'e'>('pi');

  readonly layers = signal<PlotLayer[]>(this.buildLayers());

  private buildLayers(): PlotLayer[] {
    return [
      {
        curves: [
          {
            points: this.sample(Math.sin, -4 * Math.PI, 4 * Math.PI, 800),
            color: '#8b2500',
            lineWidth: 2,
          },
          {
            points: this.sample(Math.cos, -4 * Math.PI, 4 * Math.PI, 800),
            color: '#1a4a6b',
            lineWidth: 1.5,
            dashed: true,
          },
          {
            points: this.sample(Math.tan, -2 * Math.PI, 2 * Math.PI, 1200),
            color: '#2d5a27',
            lineWidth: 1.5,
          },
          {
            points: this.sample((x) => x * x / 10, -10, 10, 400),
            color: '#b8860b',
            lineWidth: 1.5,
          },
        ],
      },
    ];
  }

  private sample(
    fn: (x: number) => number,
    from: number,
    to: number,
    steps: number,
  ) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const x = from + (i / steps) * (to - from);
      try {
        const y = fn(x);
        pts.push({ x, y: isFinite(y) ? y : NaN });
      } catch {
        pts.push({ x, y: NaN });
      }
    }
    return pts;
  }

  setFormat(fmt: 'integer' | 'pi' | 'e'): void {
    this.xFormat.set(fmt);
  }

  resetView(): void {
    this.plotRef()?.resetView();
  }
}

type CanvasXFormat = 'integer' | 'pi' | 'e';
