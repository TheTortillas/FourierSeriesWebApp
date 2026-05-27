import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NavComponent } from '../../shared/components/nav/nav.component';
import {
  GrapherExpressionComponent,
  GraphExpression,
  GRAPH_PALETTE,
} from './grapher-expression.component';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../shared/components/function-plot/function-plot.component';
import { ParamSlidersComponent, ParamValues } from '../../shared/components/param-sliders/param-sliders.component';
import { PlottingService } from '../../core/services/canvas/plotting.service';
import { MathUtilsService } from '../../core/services/math/math-utils.service';
import { CanvasViewport, MathPoint } from '../../core/services/canvas/canvas.types';

let _idCounter = 0;
function newExpr(colorIdx = 0): GraphExpression {
  return {
    id: `expr-${++_idCounter}`,
    latex: '',
    maxima: '',
    color: GRAPH_PALETTE[colorIdx % GRAPH_PALETTE.length],
    visible: true,
    lineWidth: 2,
  };
}

@Component({
  selector: 'app-grapher',
  templateUrl: './grapher.component.html',
  imports: [NavComponent, GrapherExpressionComponent, FunctionPlotComponent, ParamSlidersComponent, DecimalPipe],
})
export class GrapherComponent {
  private readonly plotter   = inject(PlottingService);
  private readonly mathUtils = inject(MathUtilsService);

  readonly expressions = signal<GraphExpression[]>([newExpr(0)]);
  readonly paramValues = signal<ParamValues>({});
  readonly hoveredPoint = signal<MathPoint | null>(null);
  readonly viewport = signal<CanvasViewport | null>(null);

  /** Single-letter identifiers found in all visible maxima strings, excluding 'x'. */
  readonly detectedParams = computed<string[]>(() => {
    const seen = new Set<string>();
    for (const e of this.expressions()) {
      if (!e.visible || !e.maxima) continue;
      for (const m of e.maxima.matchAll(/\b([a-wyzA-WYZ])\b/g)) {
        seen.add(m[1]);
      }
    }
    return [...seen].sort();
  });

  readonly layers = computed<PlotLayer[]>(() => {
    const exprs  = this.expressions();
    const params = this.paramValues();
    const plotter = this.plotter;
    const math = this.mathUtils;

    return [{
      curves: [],
      onDraw: (ctx, vp) => {
        for (const e of exprs) {
          if (!e.visible || !e.maxima) continue;
          const fn = math.compile(e.maxima, 'x', params);
          if (!fn) continue;
          plotter.plotFn(ctx, fn, vp, { color: e.color, lineWidth: e.lineWidth });
        }
      },
    }];
  });

  addExpression(): void {
    this.expressions.update((list) => [...list, newExpr(list.length)]);
  }

  updateExpression(updated: GraphExpression): void {
    this.expressions.update((list) =>
      list.map((e) => (e.id === updated.id ? updated : e)),
    );
  }

  removeExpression(id: string): void {
    this.expressions.update((list) => list.filter((e) => e.id !== id));
  }

  onParamChange(values: ParamValues): void {
    this.paramValues.set(values);
  }

  onPointerMove(pt: MathPoint | null): void {
    this.hoveredPoint.set(pt);
  }

  onViewportChange(vp: CanvasViewport): void {
    this.viewport.set(vp);
  }
}
