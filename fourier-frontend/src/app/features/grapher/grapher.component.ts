import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { SeoService } from '../../core/services/seo/seo.service';
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
import {
  ParamSlidersComponent,
  ParamValues,
} from '../../shared/components/param-sliders/param-sliders.component';
import { PlottingService } from '../../core/services/canvas/plotting.service';
import { DrawingUtilsService } from '../../core/services/canvas/drawing-utils.service';
import { MathUtilsService } from '../../core/services/math/math-utils.service';
import { MathquillService, KeyBtn } from '../../core/services/math/mathquill.service';
import { MobileMathKeyboardComponent } from '../../shared/components/math-keyboard/mobile-math-keyboard.component';
import { CoordinateTransformService } from '../../core/services/canvas/coordinate-transform.service';
import { CanvasViewport, MathPoint } from '../../core/services/canvas/canvas.types';
import { FUNCTION_REGISTRY } from '../../core/services/math/function-registry';
import { MathjaxDirective } from '../../shared/directives/mathjax.directive';

const RESERVED_SYMBOLS: ReadonlySet<string> = new Set([
  'x',
  'X',
  'e',
  'E',
  'i',
  'I',
  ...FUNCTION_REGISTRY.flatMap((f) => f.latexNames).filter((n) => n.length === 1),
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
      { label: 'arccot', write: 'arccot' },
      { label: 'arcsec', write: 'arcsec' },
      { label: 'arccsc', write: 'arccsc' },
    ],
  },
  {
    label: 'grapher.groups.hyp',
    keys: [
      { label: 'sinh', write: '\\sinh' },
      { label: 'cosh', write: '\\cosh' },
      { label: 'tanh', write: '\\tanh' },
      { label: 'coth', write: 'coth' },
      { label: 'sech', write: 'sech' },
      { label: 'csch', write: 'csch' },
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
      { label: 'eˣ', typedText: 'e', cmd: '^' },
      { label: 'ln', cmd: '\\ln' },
      { label: 'log', cmd: '\\log' },
      { label: 'exp', write: '\\exp' },
    ],
  },
  {
    label: 'Raíces / Potencias',
    keys: [
      { label: '√x', cmd: '\\sqrt' },
      { label: '∛x', writeWithCursor: '\\sqrt[3]{}' },
      { label: 'x²', keystroke: '^ 2 Right' },
      { label: 'xⁿ', cmd: '^' },
      { label: 'x/y', cmd: '/' },
      { label: '|x|', writeWithCursor: '\\left|\\right|' },
    ],
  },
  {
    label: 'Constantes',
    keys: [
      { label: 'π', cmd: '\\pi' },
      { label: 'e', typedText: 'e' },
      { label: '∞', write: '\\infty' },
    ],
  },
  {
    label: 'Integrales especiales',
    keys: [
      { label: 'Si', typedText: 'Si' },
      { label: 'Ci', typedText: 'Ci' },
      { label: 'Shi', typedText: 'Shi' },
      { label: 'Chi', typedText: 'Chi' },
      { label: 'Ei', typedText: 'Ei' },
      { label: 'E1', typedText: 'E1' },
      { label: 'li', typedText: 'li' },
    ],
  },
  {
    label: 'Error / Gamma',
    keys: [
      { label: 'erf', typedText: 'erf' },
      { label: 'erfc', typedText: 'erfc' },
      { label: 'Γ(z)', write: '\\Gamma' },
    ],
  },
  {
    label: 'Gamma incompleta / Beta',
    keys: [
      { label: 'GammaU', typedText: 'GammaU' },
      { label: 'GammaL', typedText: 'GammaL' },
      { label: 'GammaQ', typedText: 'GammaQ' },
      { label: 'Beta', typedText: 'Beta' },
    ],
  },
];

export interface LibEntry {
  label: string;
  latex: string;
  maxima: string;
  desc?: string;
}
export interface LibGroup {
  id: string;
  label: string;
  entries: LibEntry[];
}

function e(label: string, latex: string, maxima: string, desc?: string): LibEntry {
  return { label, latex, maxima, desc };
}

export const LIBRARY_GROUPS: LibGroup[] = [
  {
    id: 'basic',
    label: 'grapher.groups.basic',
    entries: [
      e('x', 'x', 'x'),
      e('x²', 'x^{2}', 'x^2'),
      e('x³', 'x^{3}', 'x^3'),
      e('|x|', '\\left|x\\right|', 'abs(x)', 'Valor absoluto'),
      e('√x', '\\sqrt{x}', 'sqrt(x)'),
      e('1/x', '\\frac{1}{x}', '1/x'),
      e('1/x²', '\\frac{1}{x^{2}}', '1/x^2'),
      e('x·|x|', 'x\\left|x\\right|', 'x*abs(x)'),
      e('sign(x)', '\\operatorname{sgn}\\left(x\\right)', 'sgn(x)'),
      e('floor(x)', '\\lfloor x\\rfloor', 'floor(x)'),
      e('x−floor(x)', 'x-\\lfloor x\\rfloor', 'x-floor(x)', 'Parte fraccionaria'),
    ],
  },
  {
    id: 'explog',
    label: 'grapher.groups.explog',
    entries: [
      e('exp(x)', 'e^{x}', 'exp(x)'),
      e('exp(−x)', 'e^{-x}', 'exp(-x)'),
      e('exp(−x²)', 'e^{-x^{2}}', 'exp(-x^2)', 'Gaussiana'),
      e('exp(−|x|)', 'e^{-\\left|x\\right|}', 'exp(-abs(x))', 'Laplaciana'),
      e('ln(x)', '\\ln\\left(x\\right)', 'log(x)', 'Logaritmo natural'),
      e('ln(|x|)', '\\ln\\left(\\left|x\\right|\\right)', 'log(abs(x))'),
      e('log₂(x)', '\\log_{2}\\left(x\\right)', 'log2(x)'),
      e('log₁₀(x)', '\\log_{10}\\left(x\\right)', 'log10(x)'),
      e('x·exp(−x)', 'xe^{-x}', 'x*exp(-x)', 'Máximo en x=1'),
      e('x²·exp(−x²)', 'x^{2}e^{-x^{2}}', 'x^2*exp(-x^2)'),
      e('ln(1+x²)', '\\ln\\left(1+x^{2}\\right)', 'log(1+x^2)'),
      e('li(x)', '\\operatorname{li}\\left(x\\right)', 'expintegral_li(x)', 'Integral logarítmica'),
    ],
  },
  {
    id: 'trig',
    label: 'grapher.groups.trig',
    entries: [
      e('sin(x)', '\\sin\\left(x\\right)', 'sin(x)'),
      e('cos(x)', '\\cos\\left(x\\right)', 'cos(x)'),
      e('tan(x)', '\\tan\\left(x\\right)', 'tan(x)'),
      e('cot(x)', '\\cot\\left(x\\right)', 'cot(x)'),
      e('sec(x)', '\\sec\\left(x\\right)', 'sec(x)'),
      e('csc(x)', '\\csc\\left(x\\right)', 'csc(x)'),
      e('sin(x)/x', '\\frac{\\sin x}{x}', 'sin(x)/x', 'sinc no normalizado'),
      e('sin(x²)', '\\sin\\left(x^{2}\\right)', 'sin(x^2)', 'Fresnel-like'),
      e('sin(1/x)', '\\sin\\left(\\frac{1}{x}\\right)', 'sin(1/x)', 'Oscilación infinita'),
      e('x·sin(x)', 'x\\sin\\left(x\\right)', 'x*sin(x)'),
      e('arcsin(x)', '\\arcsin\\left(x\\right)', 'asin(x)'),
      e('arccos(x)', '\\arccos\\left(x\\right)', 'acos(x)'),
      e('arctan(x)', '\\arctan\\left(x\\right)', 'atan(x)', 'Mapea ℝ → (−π/2, π/2)'),
    ],
  },
  {
    id: 'hyp',
    label: 'grapher.groups.hyp',
    entries: [
      e('sinh(x)', '\\sinh\\left(x\\right)', 'sinh(x)'),
      e('cosh(x)', '\\cosh\\left(x\\right)', 'cosh(x)'),
      e('tanh(x)', '\\tanh\\left(x\\right)', 'tanh(x)', 'Mapea ℝ → (−1, 1)'),
      e('coth(x)', '\\coth\\left(x\\right)', 'coth(x)'),
      e('sech(x)', '\\operatorname{sech}\\left(x\\right)', 'sech(x)', 'Solitón'),
      e('csch(x)', '\\operatorname{csch}\\left(x\\right)', 'csch(x)'),
      e('arcsinh(x)', '\\operatorname{arcsinh}\\left(x\\right)', 'asinh(x)'),
      e('arccosh(x)', '\\operatorname{arccosh}\\left(x\\right)', 'acosh(x)'),
      e('arctanh(x)', '\\operatorname{arctanh}\\left(x\\right)', 'atanh(x)', 'Solo |x|<1'),
      e('x·tanh(x)', 'x\\tanh\\left(x\\right)', 'x*tanh(x)'),
      e('sech²(x)', '\\operatorname{sech}^{2}\\left(x\\right)', 'sech(x)^2', 'Derivada de tanh'),
    ],
  },
  {
    id: 'gamma',
    label: 'grapher.groups.gamma',
    entries: [
      e('Γ(x)', '\\Gamma\\left(x\\right)', 'gamma(x)', 'Función Gamma de Euler'),
      e('1/Γ(x)', '\\frac{1}{\\Gamma\\left(x\\right)}', '1/gamma(x)', 'Función entera'),
      e(
        'ln|Γ(x)|',
        '\\ln\\left|\\Gamma\\left(x\\right)\\right|',
        'log(abs(gamma(x)))',
        'Log-Gamma',
      ),
      e('Γ(x+1)', '\\Gamma\\left(x+1\\right)', 'gamma(x+1)', 'x·Γ(x)'),
      e('Γ(x+½)', '\\Gamma\\left(x+\\frac{1}{2}\\right)', 'gamma(x+0.5)'),
      e(
        'Γ(x)·Γ(1−x)',
        '\\Gamma\\left(x\\right)\\Gamma\\left(1-x\\right)',
        'gamma(x)*gamma(1-x)',
        '= π/sin(πx)',
      ),
      e('x!', 'x!', 'factorial(x)', 'Factorial continuo'),
      e('Γ(2,x)', '\\Gamma\\left(2,x\\right)', 'gamma_incomplete(2,x)', 'Gamma superior'),
      e('γ(2,x)', '\\gamma\\left(2,x\\right)', 'gamma_incomplete_lower(2,x)', 'Gamma inferior'),
      e('Q(2,x)', 'Q\\left(2,x\\right)', 'gamma_incomplete_regularized(2,x)', 'Gamma regularizada'),
      e('B(x,2)', 'B\\left(x,2\\right)', 'beta(x,2)', 'Función Beta'),
      e('B(x,½)', 'B\\left(x,\\frac{1}{2}\\right)', 'beta(x,0.5)'),
    ],
  },
  {
    id: 'error',
    label: 'grapher.groups.error',
    entries: [
      e('erf(x)', '\\operatorname{erf}\\left(x\\right)', 'erf(x)', 'Error function'),
      e('erfc(x)', '\\operatorname{erfc}\\left(x\\right)', 'erfc(x)', '1 − erf(x)'),
      e('erf(x)²', '\\operatorname{erf}^{2}\\left(x\\right)', 'erf(x)^2'),
      e('x·erf(x)', 'x\\operatorname{erf}\\left(x\\right)', 'x*erf(x)'),
      e(
        'exp(x²)·erfc(x)',
        'e^{x^{2}}\\operatorname{erfc}\\left(x\\right)',
        'exp(x^2)*erfc(x)',
        'Función de Mills',
      ),
      e('erf(√x)', '\\operatorname{erf}\\left(\\sqrt{x}\\right)', 'erf(sqrt(x))', 'CDF chi² df=1'),
      e('ln(erfc(x))', '\\ln\\left(\\operatorname{erfc}\\left(x\\right)\\right)', 'log(erfc(x))'),
    ],
  },
  {
    id: 'integral',
    label: 'grapher.groups.integral',
    entries: [
      e('Si(x)', '\\operatorname{Si}\\left(x\\right)', 'expintegral_si(x)', 'Seno integral'),
      e('Ci(x)', '\\operatorname{Ci}\\left(x\\right)', 'expintegral_ci(x)', 'Coseno integral'),
      e(
        'si(x)',
        '\\operatorname{si}\\left(x\\right)',
        'expintegral_si(x)-3.14159265/2',
        'si = Si − π/2',
      ),
      e(
        'Shi(x)',
        '\\operatorname{Shi}\\left(x\\right)',
        'expintegral_shi(x)',
        'Seno hiperbólico integral',
      ),
      e(
        'Chi(x)',
        '\\operatorname{Chi}\\left(x\\right)',
        'expintegral_chi(x)',
        'Coseno hiperbólico integral',
      ),
      e('Si(x)/x', '\\frac{\\operatorname{Si}\\left(x\\right)}{x}', 'expintegral_si(x)/x'),
      e('x·Si(x)', 'x\\operatorname{Si}\\left(x\\right)', 'x*expintegral_si(x)'),
      e(
        'Ci²+Si²',
        '\\operatorname{Ci}^{2}+\\operatorname{Si}^{2}',
        'expintegral_ci(x)^2+expintegral_si(x)^2',
      ),
    ],
  },
  {
    id: 'fresnel',
    label: 'grapher.groups.fresnel',
    entries: [
      e('C(x)', 'C\\left(x\\right)', 'fresnelC(x)', 'Fresnel C(x)'),
      e('S(x)', 'S\\left(x\\right)', 'fresnelS(x)', 'Fresnel S(x)'),
      e('K(x)', 'K\\left(x\\right)', 'fresnelK(x)', 'Fresnel K'),
      e('C²(x)', 'C^{2}\\left(x\\right)', 'fresnelC(x)^2'),
      e('S²(x)', 'S^{2}\\left(x\\right)', 'fresnelS(x)^2'),
      e('C(x)+S(x)', 'C\\left(x\\right)+S\\left(x\\right)', 'fresnelC(x)+fresnelS(x)'),
      e('C²+S²', 'C^{2}+S^{2}', 'fresnelC(x)^2+fresnelS(x)^2', 'Radio² espiral de Cornu'),
      e('x·C(x)', 'x\\cdot C\\left(x\\right)', 'x*fresnelC(x)'),
      e('C(√x)', 'C\\left(\\sqrt{x}\\right)', 'fresnelC(sqrt(x))', 'Variable cuadrática'),
    ],
  },
  {
    id: 'expint',
    label: 'grapher.groups.expint',
    entries: [
      e('Ei(x)', '\\operatorname{Ei}\\left(x\\right)', 'expintegral_ei(x)', 'Integral exponencial'),
      e('E₁(x)', 'E_{1}\\left(x\\right)', 'expintegral_e1(x)', 'E₁ = −Ei(−x) para x>0'),
      e('li(x)', '\\operatorname{li}\\left(x\\right)', 'expintegral_li(x)', 'Integral logarítmica'),
      e('Ei(−x)', '\\operatorname{Ei}\\left(-x\\right)', 'expintegral_ei(-x)'),
      e('exp(x)·E₁(x)', 'e^{x}E_{1}\\left(x\\right)', 'exp(x)*expintegral_e1(x)'),
      e(
        'Ei(x)−ln|x|',
        '\\operatorname{Ei}\\left(x\\right)-\\ln\\left|x\\right|',
        'expintegral_ei(x)-log(abs(x))',
      ),
      e('x·E₁(x)', 'xE_{1}\\left(x\\right)', 'x*expintegral_e1(x)'),
    ],
  },
  {
    id: 'sgnal',
    label: 'grapher.groups.sgnal',
    entries: [
      e('u(x)', '\\operatorname{u}\\left(x\\right)', 'u(x)', 'Escalón Heaviside'),
      e('rect(x)', '\\operatorname{rect}\\left(x\\right)', 'rect(x)', 'Pulso rectangular'),
      e('tri(x)', '\\operatorname{tri}\\left(x\\right)', 'tri(x)', 'Triangular'),
      e('sinc(x)', '\\operatorname{sinc}\\left(x\\right)', 'sinc(x)', 'sinc normalizado'),
      e(
        'u(x)·exp(−x)',
        '\\operatorname{u}\\left(x\\right)e^{-x}',
        'u(x)*exp(-x)',
        'Exponencial causal',
      ),
      e(
        'rect(x)·cos(x)',
        '\\operatorname{rect}\\left(x\\right)\\cos\\left(x\\right)',
        'rect(x)*cos(x)',
        'Pulso modulado',
      ),
      e('tri(x/2)', '\\operatorname{tri}\\left(\\frac{x}{2}\\right)', 'tri(x/2)'),
    ],
  },
  {
    id: 'composed',
    label: 'grapher.groups.composed',
    entries: [
      e(
        'sin(x)·erf(x)',
        '\\sin\\left(x\\right)\\operatorname{erf}\\left(x\\right)',
        'sin(x)*erf(x)',
      ),
      e(
        'Γ(x)·sin(πx)',
        '\\Gamma\\left(x\\right)\\sin\\left(\\pi x\\right)',
        'gamma(x)*sin(3.14159*x)',
        '= π (reflexión)',
      ),
      e(
        'Si(x)·cos(x)',
        '\\operatorname{Si}\\left(x\\right)\\cos\\left(x\\right)',
        'expintegral_si(x)*cos(x)',
      ),
      e(
        'tanh(x)·Si(x)',
        '\\tanh\\left(x\\right)\\operatorname{Si}\\left(x\\right)',
        'tanh(x)*expintegral_si(x)',
      ),
      e('erf(x)/x', '\\frac{\\operatorname{erf}\\left(x\\right)}{x}', 'erf(x)/x'),
      e('Ei(−x²)', '\\operatorname{Ei}\\left(-x^{2}\\right)', 'expintegral_ei(-x^2)'),
      e('√x·exp(−x)', '\\sqrt{x}\\,e^{-x}', 'sqrt(x)*exp(-x)'),
      e('x/sin(x)', '\\frac{x}{\\sin\\left(x\\right)}', 'x/sin(x)', 'Polos en nπ'),
      e('arctan(1/x)', '\\arctan\\left(\\frac{1}{x}\\right)', 'atan(1/x)', 'Cotangente inversa'),
      e(
        'ln(1+erf(x))',
        '\\ln\\left(1+\\operatorname{erf}\\left(x\\right)\\right)',
        'log(1+erf(x))',
      ),
      e('ln(Γ(x))/x', '\\frac{\\ln\\Gamma\\left(x\\right)}{x}', 'log(gamma(x))/x'),
      e(
        'Si(x)/Γ(x)',
        '\\frac{\\operatorname{Si}\\left(x\\right)}{\\Gamma\\left(x\\right)}',
        'expintegral_si(x)/gamma(x)',
      ),
    ],
  },
];

export interface GrapherSettings {
  showRoots: boolean;
  showIntersections: boolean;
  xAxisFormat: 'integer' | 'pi' | 'e';
  initialUnit: number;
}

const DEFAULT_SETTINGS: GrapherSettings = {
  showRoots: true,
  showIntersections: true,
  xAxisFormat: 'integer',
  initialUnit: 80,
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
    if (fn(a) * fn(m) <= 0) b = m;
    else a = m;
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

@Component({
  selector: 'app-grapher',
  templateUrl: './grapher.component.html',
  imports: [
    NavComponent,
    GrapherExpressionComponent,
    FunctionPlotComponent,
    ParamSlidersComponent,
    DecimalPipe,
    TranslocoPipe,
    MobileMathKeyboardComponent,
    MathjaxDirective,
  ],
})
export class GrapherComponent {
  private readonly plotter = inject(PlottingService);
  private readonly drawingUtils = inject(DrawingUtilsService);
  private readonly mathUtils = inject(MathUtilsService);
  private readonly mqs = inject(MathquillService);
  private readonly coords = inject(CoordinateTransformService);
  private readonly seo = inject(SeoService);
  private readonly transloco = inject(TranslocoService);

  readonly expressions = signal<GraphExpression[]>([newExpr(0)]);
  readonly paramValues = signal<ParamValues>({});
  readonly hoveredPoint = signal<MathPoint | null>(null);
  readonly settings = signal<GrapherSettings>({ ...DEFAULT_SETTINGS });
  readonly settingsOpen = signal(false);
  readonly keyboardOpen = signal(false);
  readonly canvasMounted = signal(true);
  readonly fnGroups = FN_GROUPS;
  readonly libraryGroups = LIBRARY_GROUPS;
  readonly collapsed = signal<Record<string, boolean>>(
    Object.fromEntries(LIBRARY_GROUPS.map((g) => [g.id, true])),
  );
  /** Maps expression id → latex string to sync into its MathQuill field. Cleared after one render. */
  readonly syncMap = signal<Record<string, string | null>>({});

  /** The expression currently active in the MathQuill field (last non-empty visible one). */
  readonly activeExprLatex = computed<string | null>(() => {
    const exprs = this.expressions();
    const last = [...exprs].reverse().find((e) => e.visible && e.latex.trim());
    return last?.latex ?? null;
  });

  constructor() {
    this.seo.setPage('seo.grapher.title', 'seo.grapher.description');

    let prev = this.settings().initialUnit;
    effect(() => {
      const next = this.settings().initialUnit;
      if (next !== prev) {
        prev = next;
        untracked(() => {
          this.canvasMounted.set(false);
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
    const exprs = this.expressions();
    const params = this.paramValues();
    const cfg = this.settings();
    const plotter = this.plotter;
    const math = this.mathUtils;
    const coords = this.coords;
    const drawing = this.drawingUtils;

    return [
      {
        curves: [],
        onDraw: (ctx: CanvasRenderingContext2D, vp: CanvasViewport) => {
          const compiled: { fn: (x: number) => number; expr: GraphExpression }[] = [];

          for (const e of exprs) {
            if (!e.visible || !e.maxima) continue;
            for (const { pos, weight } of math.parseDeltaTerms(e.maxima, 'x', params)) {
              drawing.drawImpulse(ctx, vp, pos, weight, e.color, e.lineWidth);
            }
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

          const xMin = vp.originMath.x - vp.cssWidth / (2 * vp.unit * vp.scaleX);
          const xMax = vp.originMath.x + vp.cssWidth / (2 * vp.unit * vp.scaleX);
          const yMin = vp.originMath.y - vp.cssHeight / (2 * vp.unit * vp.scaleY);
          const yMax = vp.originMath.y + vp.cssHeight / (2 * vp.unit * vp.scaleY);

          if (cfg.showRoots) {
            for (const { fn, expr } of compiled) {
              const roots = findRoots(fn, xMin, xMax);
              for (const rx of roots) {
                const ry = fn(rx);
                if (!isFinite(ry) || Math.abs(ry) > 1e-4 * (yMax - yMin + 1)) continue;
                const { x: sx, y: sy } = coords.mathToCss({ x: rx, y: 0 }, vp);
                drawing.drawOpenCircle(ctx, sx, sy, expr.color);
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
                  const { x: sx, y: sy } = coords.mathToCss({ x: ix, y: iy }, vp);
                  drawing.drawFilledCircle(ctx, sx, sy, compiled[i].expr.color);
                  count++;
                }
              }
            }
          }
        },
      },
    ];
  });

  // ── Library ────────────────────────────────────────────────────────────────

  toggleGroup(id: string): void {
    this.collapsed.update((s) => ({ ...s, [id]: !s[id] }));
  }

  isCollapsed(id: string): boolean {
    return this.collapsed()[id] ?? false;
  }

  loadExample(entry: LibEntry): void {
    const exprs = this.expressions();
    const emptyIdx = exprs.findIndex((e) => !e.latex.trim());
    if (emptyIdx >= 0) {
      const target = exprs[emptyIdx];
      const updated: GraphExpression = { ...target, latex: entry.latex, maxima: entry.maxima };
      this.expressions.update((list) => list.map((e, i) => (i === emptyIdx ? updated : e)));
      // Schedule sync into the MathQuill field — cleared by the field after it applies
      this.syncMap.update((m) => ({ ...m, [target.id]: entry.latex }));
      // Clear after two frames so the field has time to pick it up
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          this.syncMap.update((m) => {
            const n = { ...m };
            delete n[target.id];
            return n;
          });
        }),
      );
    } else {
      const id = `expr-${++_idCounter}`;
      const newE: GraphExpression = {
        id,
        latex: entry.latex,
        maxima: entry.maxima,
        color: GRAPH_PALETTE[exprs.length % GRAPH_PALETTE.length],
        visible: true,
        lineWidth: 2,
        lineDash: 'solid',
      };
      this.expressions.update((list) => [...list, newE]);
      // New field initializes with latex from expr() — no sync needed
    }
  }

  // ── Expression list ────────────────────────────────────────────────────────

  addExpression(): void {
    this.expressions.update((list) => [...list, newExpr(list.length)]);
  }

  updateExpression(updated: GraphExpression): void {
    this.expressions.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
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
