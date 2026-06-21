import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
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
import { MathquillService, KeyBtn } from '../../core/services/math/mathquill.service';
import { CoordinateTransformService } from '../../core/services/canvas/coordinate-transform.service';
import { CanvasViewport, MathPoint } from '../../core/services/canvas/canvas.types';
import { FUNCTION_REGISTRY } from '../../core/services/math/function-registry';

// Single-letter Maxima names that are functions or constants, not free parameters.
// Built from the registry so adding a new function (e.g. besselj) updates this automatically.
const RESERVED_SYMBOLS: ReadonlySet<string> = new Set([
  'x', 'X',          // plot variable
  'e', 'E',          // Euler's number (%e) — may appear bare before backend responds
  'i', 'I',          // imaginary unit (%i)
  ...FUNCTION_REGISTRY
    .flatMap((f) => f.latexNames)
    .filter((n) => n.length === 1),
]);

export interface FnGroup {
  label: string;
  keys: KeyBtn[];
}

export const FN_GROUPS: FnGroup[] = [
  {
    label: 'Trig',
    keys: [
      { label: 'sin', cmd: '\\sin' },
      { label: 'cos', cmd: '\\cos' },
      { label: 'tan', cmd: '\\tan' },
      { label: 'cot', cmd: '\\cot' },
      { label: 'sec', cmd: '\\sec' },
      { label: 'csc', cmd: '\\csc' },
    ],
  },
  {
    label: 'Inv. trig',
    keys: [
      { label: 'arcsin', write: '\\arcsin' },
      { label: 'arccos', write: '\\arccos' },
      { label: 'arctan', write: '\\arctan' },
      { label: 'arccot', write: 'arccot'   },
      { label: 'arcsec', write: 'arcsec'   },
      { label: 'arccsc', write: 'arccsc'   },
    ],
  },
  {
    label: 'Hiperbólicas',
    keys: [
      { label: 'sinh', write: '\\sinh' },
      { label: 'cosh', write: '\\cosh' },
      { label: 'tanh', write: '\\tanh' },
      { label: 'coth', write: 'coth'   },
      { label: 'sech', write: 'sech'   },
      { label: 'csch', write: 'csch'   },
    ],
  },
  {
    label: 'Inv. hiperbólicas',
    keys: [
      { label: 'asinh', write: 'asinh' },
      { label: 'acosh', write: 'acosh' },
      { label: 'atanh', write: 'atanh' },
      { label: 'acoth', write: 'acoth' },
      { label: 'asech', write: 'asech' },
      { label: 'acsch', write: 'acsch' },
    ],
  },
  {
    label: 'Exp / Log',
    keys: [
      { label: 'eˣ',  typedText: 'e', cmd: '^' },
      { label: 'ln',  cmd: '\\ln'   },
      { label: 'log', cmd: '\\log'  },
      { label: 'exp', write: '\\exp' },
    ],
  },
  {
    label: 'Raíces / Potencias',
    keys: [
      { label: '√x',  cmd: '\\sqrt' },
      { label: '∛x',  writeWithCursor: '\\sqrt[3]{}' },
      { label: 'x²',  keystroke: '^ 2 Right' },
      { label: 'xⁿ',  cmd: '^'     },
      { label: 'x/y', cmd: '/'     },
      { label: '|x|', writeWithCursor: '\\left|\\right|' },
    ],
  },
  {
    label: 'Constantes',
    keys: [
      { label: 'π', cmd: '\\pi'      },
      { label: 'e', typedText: 'e'   },
      { label: '∞', write: '\\infty' },
    ],
  },
  {
    label: 'Integrales especiales',
    keys: [
      { label: 'Si',  typedText: 'Si'  },
      { label: 'Ci',  typedText: 'Ci'  },
      { label: 'Shi', typedText: 'Shi' },
      { label: 'Chi', typedText: 'Chi' },
      { label: 'Ei',  typedText: 'Ei'  },
      { label: 'E1',  typedText: 'E1'  },
      { label: 'li',  typedText: 'li'  },
    ],
  },
  {
    label: 'Error / Gamma',
    keys: [
      { label: 'erf',  typedText: 'erf'  },
      { label: 'erfc', typedText: 'erfc' },
      { label: 'Γ',    write: '\\Gamma'  },
    ],
  },
];

export interface GrapherSettings {
  showRoots:         boolean;
  showIntersections: boolean;
  xAxisFormat:       'integer' | 'pi' | 'e';
  initialUnit:       number;
}

const DEFAULT_SETTINGS: GrapherSettings = {
  showRoots:         true,
  showIntersections: true,
  xAxisFormat:       'integer',
  initialUnit:       80,
};

let _idCounter = 0;
function newExpr(colorIdx = 0): GraphExpression {
  return {
    id: `expr-${++_idCounter}`,
    latex: '',
    maxima: '',
    color: GRAPH_PALETTE[colorIdx % GRAPH_PALETTE.length],
    visible: true,
    lineWidth: 2,
    lineDash: 'solid',
  };
}

function bisect(fn: (x: number) => number, a: number, b: number, iters = 12): number {
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2;
    if (fn(a) * fn(m) <= 0) b = m; else a = m;
  }
  return (a + b) / 2;
}

function findRoots(fn: (x: number) => number, xMin: number, xMax: number, steps = 400): number[] {
  const roots: number[] = [];
  const step = (xMax - xMin) / steps;
  let prev = fn(xMin);
  for (let i = 1; i <= steps; i++) {
    const x = xMin + i * step;
    const cur = fn(x);
    if (isFinite(prev) && isFinite(cur) && prev * cur < 0) {
      roots.push(bisect(fn, x - step, x));
    }
    prev = cur;
  }
  return roots;
}

function drawOpenCircle(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string, r = 4): void {
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();
}

function drawFilledCircle(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string, r = 4): void {
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

@Component({
  selector: 'app-grapher',
  templateUrl: './grapher.component.html',
  imports: [NavComponent, GrapherExpressionComponent, FunctionPlotComponent, ParamSlidersComponent, DecimalPipe, TranslocoPipe],
})
export class GrapherComponent {
  private readonly plotter   = inject(PlottingService);
  private readonly mathUtils = inject(MathUtilsService);
  private readonly mqs       = inject(MathquillService);
  private readonly coords    = inject(CoordinateTransformService);

  readonly expressions    = signal<GraphExpression[]>([newExpr(0)]);
  readonly paramValues    = signal<ParamValues>({});
  readonly hoveredPoint   = signal<MathPoint | null>(null);
  readonly settings       = signal<GrapherSettings>({ ...DEFAULT_SETTINGS });
  readonly settingsOpen   = signal(false);
  readonly keyboardOpen   = signal(false);
  readonly canvasMounted  = signal(true);
  readonly fnGroups       = FN_GROUPS;

  constructor() {
    let prev = this.settings().initialUnit;
    effect(() => {
      const next = this.settings().initialUnit;
      if (next !== prev) {
        prev = next;
        untracked(() => {
          this.canvasMounted.set(false);
          // One microtask is enough — Angular will re-render on the next CD cycle.
          Promise.resolve().then(() => this.canvasMounted.set(true));
        });
      }
    });
  }

  readonly detectedParams = computed<string[]>(() => {
    const seen = new Set<string>();
    for (const e of this.expressions()) {
      if (!e.visible || !e.maxima) continue;
      for (const m of e.maxima.matchAll(/\b([a-zA-Z])\b/g)) {
        if (!RESERVED_SYMBOLS.has(m[1])) seen.add(m[1]);
      }
    }
    return [...seen].sort();
  });

  readonly layers = computed<PlotLayer[]>(() => {
    const exprs    = this.expressions();
    const params   = this.paramValues();
    const cfg      = this.settings();
    const plotter  = this.plotter;
    const math     = this.mathUtils;
    const coords   = this.coords;

    return [{
      curves: [],
      onDraw: (ctx: CanvasRenderingContext2D, vp: CanvasViewport) => {
        const compiled: { fn: (x: number) => number; expr: GraphExpression }[] = [];

        for (const e of exprs) {
          if (!e.visible || !e.maxima) continue;
          const fn = math.compile(e.maxima, 'x', params);
          if (!fn) continue;
          compiled.push({ fn, expr: e });
          plotter.plotFn(ctx, fn, vp, {
            color: e.color,
            lineWidth: e.lineWidth,
            dashed: e.lineDash !== 'solid',
            dashPattern: e.lineDash === 'dotted' ? [2, 4] : [8, 5],
          });
        }

        if (compiled.length === 0) return;

        const xMin = vp.originMath.x - vp.cssWidth  / (2 * vp.unit * vp.scaleX);
        const xMax = vp.originMath.x + vp.cssWidth  / (2 * vp.unit * vp.scaleX);
        const yMin = vp.originMath.y - vp.cssHeight / (2 * vp.unit * vp.scaleY);
        const yMax = vp.originMath.y + vp.cssHeight / (2 * vp.unit * vp.scaleY);

        if (cfg.showRoots) {
          for (const { fn, expr } of compiled) {
            const roots = findRoots(fn, xMin, xMax);
            for (const rx of roots) {
              const ry = fn(rx);
              if (!isFinite(ry) || Math.abs(ry) > 1e-4 * (yMax - yMin + 1)) continue;
              const { x: sx, y: sy } = coords.mathToScreen({ x: rx, y: 0 }, vp);
              drawOpenCircle(ctx, sx, sy, expr.color);
            }
          }
        }

        if (cfg.showIntersections && compiled.length >= 2) {
          let count = 0;
          outer: for (let i = 0; i < compiled.length - 1; i++) {
            for (let j = i + 1; j < compiled.length; j++) {
              const diff = (x: number) => compiled[i].fn(x) - compiled[j].fn(x);
              const pts = findRoots(diff, xMin, xMax);
              for (const ix of pts) {
                if (count >= 20) break outer;
                const iy = compiled[i].fn(ix);
                if (!isFinite(iy)) continue;
                const { x: sx, y: sy } = coords.mathToScreen({ x: ix, y: iy }, vp);
                drawFilledCircle(ctx, sx, sy, compiled[i].expr.color);
                count++;
              }
            }
          }
        }
      },
    }];
  });

  // ── Expression list ────────────────────────────────────────────────────────

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

  // ── Pointer / params ───────────────────────────────────────────────────────

  onParamChange(values: ParamValues): void {
    this.paramValues.set(values);
  }

  onPointerMove(pt: MathPoint | null): void {
    this.hoveredPoint.set(pt);
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  toggleSettings(): void {
    this.settingsOpen.update((v) => !v);
  }

  setSetting<K extends keyof GrapherSettings>(key: K, value: GrapherSettings[K]): void {
    this.settings.update((s) => ({ ...s, [key]: value }));
  }

  // ── Function keyboard ──────────────────────────────────────────────────────

  toggleKeyboard(): void {
    this.keyboardOpen.update((v) => !v);
  }

  insertKey(btn: KeyBtn): void {
    this.mqs.insertKey(btn);
  }
}
