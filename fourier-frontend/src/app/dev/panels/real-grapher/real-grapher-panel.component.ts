import { Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../shared/components/function-plot/function-plot.component';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { CanvasViewport } from '../../../core/services/canvas/canvas.types';

export interface RealFnEntry { label: string; expr: string; desc?: string; }
export interface RealFnGroup { id: string; label: string; entries: RealFnEntry[]; }

const COLOR = '#818cf8'; // indigo-400

@Component({
  selector: 'app-real-grapher-panel',
  imports: [FormsModule, FunctionPlotComponent],
  templateUrl: './real-grapher-panel.component.html',
})
export class RealGrapherPanelComponent {
  private readonly math    = inject(MathUtilsService);
  private readonly plotter = inject(PlottingService);

  readonly plotRef = viewChild(FunctionPlotComponent);

  // ── Estado ────────────────────────────────────────────────────────────────
  readonly expr      = signal('gamma(x)');
  readonly inputExpr = signal('gamma(x)');
  readonly error     = signal('');
  readonly layers    = signal<PlotLayer[]>(this.buildLayers('gamma(x)'));

  readonly xAxisFormat = signal<CanvasViewport['xAxisFormat']>('integer');

  // ── Grupos: todos abiertos por defecto (collapsed = false) ────────────────
  readonly collapsed = signal<Record<string, boolean>>({});
  toggleGroup(id: string): void { this.collapsed.update(s => ({ ...s, [id]: !s[id] })); }
  isCollapsed(id: string): boolean { return this.collapsed()[id] ?? false; }

  // ── Construcción de capa ──────────────────────────────────────────────────
  private buildLayers(exprStr: string): PlotLayer[] {
    const fn = this.math.compile(exprStr, 'x');
    if (!fn) { this.error.set('Error al compilar'); return [{ curves: [] }]; }
    this.error.set('');
    const plotter = this.plotter;
    return [{
      curves: [],
      onDraw(ctx: CanvasRenderingContext2D, vp: CanvasViewport) {
        plotter.plotFn(ctx, (x) => fn(x) ?? NaN, vp, { color: COLOR, lineWidth: 2 });
      },
    }];
  }

  loadExample(expr: string): void {
    this.expr.set(expr);
    this.inputExpr.set(expr);
    this.layers.set(this.buildLayers(expr));
  }

  plot(): void {
    const trimmed = this.inputExpr().trim();
    if (!trimmed) return;
    this.expr.set(trimmed);
    this.layers.set(this.buildLayers(trimmed));
  }

  resetView(): void { this.plotRef()?.resetView(); }

  // ── Biblioteca ────────────────────────────────────────────────────────────
  readonly groups: RealFnGroup[] = [
    {
      id: 'basic',
      label: 'Básicas',
      entries: [
        { label: 'x',            expr: 'x',              desc: 'Identidad' },
        { label: 'x²',           expr: 'x^2' },
        { label: 'x³',           expr: 'x^3' },
        { label: '|x|',          expr: 'abs(x)',          desc: 'Valor absoluto' },
        { label: '√x',           expr: 'sqrt(x)' },
        { label: '1/x',          expr: '1/x' },
        { label: '1/x²',         expr: '1/x^2' },
        { label: 'x·|x|',        expr: 'x*abs(x)' },
        { label: 'sign(x)',       expr: 'sign(x)' },
        { label: 'floor(x)',      expr: 'floor(x)' },
        { label: 'x − floor(x)', expr: 'x-floor(x)',     desc: 'Parte fraccionaria' },
      ],
    },
    {
      id: 'explog',
      label: 'Exponencial y logaritmo',
      entries: [
        { label: 'exp(x)',        expr: 'exp(x)' },
        { label: 'exp(−x)',       expr: 'exp(-x)' },
        { label: 'exp(−x²)',      expr: 'exp(-x^2)',      desc: 'Gaussiana' },
        { label: 'exp(−|x|)',     expr: 'exp(-abs(x))',   desc: 'Laplaciana' },
        { label: 'log(x)',        expr: 'log(x)',          desc: 'Logaritmo natural' },
        { label: 'log(|x|)',      expr: 'log(abs(x))' },
        { label: 'log₂(x)',       expr: 'log2(x)' },
        { label: 'log₁₀(x)',      expr: 'log10(x)' },
        { label: 'x·exp(−x)',     expr: 'x*exp(-x)',      desc: 'Máximo en x=1' },
        { label: 'x²·exp(−x²)',   expr: 'x^2*exp(-x^2)' },
        { label: 'log(1+x²)',     expr: 'log(1+x^2)' },
        { label: 'li(x)',         expr: 'expintegral_li(x)', desc: 'Integral logarítmica' },
      ],
    },
    {
      id: 'trig',
      label: 'Trigonométricas',
      entries: [
        { label: 'sin(x)',        expr: 'sin(x)' },
        { label: 'cos(x)',        expr: 'cos(x)' },
        { label: 'tan(x)',        expr: 'tan(x)' },
        { label: 'cot(x)',        expr: 'cot(x)' },
        { label: 'sec(x)',        expr: 'sec(x)' },
        { label: 'csc(x)',        expr: 'csc(x)' },
        { label: 'sin(x)/x',      expr: 'sin(x)/x',       desc: 'sinc no normalizado' },
        { label: 'sin(x²)',       expr: 'sin(x^2)',        desc: 'Fresnel-like' },
        { label: 'sin(1/x)',      expr: 'sin(1/x)',        desc: 'Oscilación infinita' },
        { label: 'x·sin(x)',      expr: 'x*sin(x)' },
        { label: 'arcsin(x)',     expr: 'asin(x)' },
        { label: 'arccos(x)',     expr: 'acos(x)' },
        { label: 'arctan(x)',     expr: 'atan(x)',         desc: 'Mapea ℝ → (−π/2, π/2)' },
      ],
    },
    {
      id: 'hyp',
      label: 'Hiperbólicas',
      entries: [
        { label: 'sinh(x)',       expr: 'sinh(x)' },
        { label: 'cosh(x)',       expr: 'cosh(x)' },
        { label: 'tanh(x)',       expr: 'tanh(x)',         desc: 'Mapea ℝ → (−1, 1)' },
        { label: 'coth(x)',       expr: 'coth(x)' },
        { label: 'sech(x)',       expr: 'sech(x)',         desc: 'Solitón' },
        { label: 'csch(x)',       expr: 'csch(x)' },
        { label: 'arcsinh(x)',    expr: 'asinh(x)' },
        { label: 'arccosh(x)',    expr: 'acosh(x)' },
        { label: 'arctanh(x)',    expr: 'atanh(x)',        desc: 'Solo |x|<1' },
        { label: 'x·tanh(x)',     expr: 'x*tanh(x)' },
        { label: 'sech(x)²',     expr: 'sech(x)^2',      desc: 'Derivada de tanh' },
      ],
    },
    {
      id: 'gamma',
      label: 'Función Gamma',
      entries: [
        { label: 'Γ(x)',          expr: 'gamma(x)',        desc: 'Función Gamma de Euler' },
        { label: '1/Γ(x)',        expr: '1/gamma(x)',      desc: 'Función entera' },
        { label: 'log|Γ(x)|',    expr: 'log(abs(gamma(x)))', desc: 'Log-Gamma' },
        { label: 'Γ(x+1)',        expr: 'gamma(x+1)',      desc: 'x·Γ(x)' },
        { label: 'Γ(x+½)',       expr: 'gamma(x+0.5)' },
        { label: 'Γ(x)·Γ(1−x)', expr: 'gamma(x)*gamma(1-x)', desc: '= π/sin(πx)' },
        { label: 'x!',            expr: 'factorial(x)',    desc: 'Factorial continuo' },
        { label: 'Γ(2,x)',        expr: 'gamma_incomplete(2,x)',             desc: 'Gamma superior' },
        { label: 'γ(2,x)',        expr: 'gamma_incomplete_lower(2,x)',       desc: 'Gamma inferior' },
        { label: 'Q(2,x)',        expr: 'gamma_incomplete_regularized(2,x)', desc: 'Gamma regularizada' },
        { label: 'B(x,2)',        expr: 'beta(x,2)',       desc: 'Función Beta' },
        { label: 'B(x,½)',       expr: 'beta(x,0.5)' },
      ],
    },
    {
      id: 'error',
      label: 'Función error',
      entries: [
        { label: 'erf(x)',        expr: 'erf(x)',          desc: 'Error function' },
        { label: 'erfc(x)',       expr: 'erfc(x)',         desc: '1 − erf(x)' },
        { label: 'erf(x)²',      expr: 'erf(x)^2' },
        { label: 'x·erf(x)',      expr: 'x*erf(x)' },
        { label: 'exp(x²)·erfc(x)', expr: 'exp(x^2)*erfc(x)', desc: 'Función de Mills' },
        { label: 'erf(√x)',       expr: 'erf(sqrt(x))',   desc: 'CDF chi² df=1' },
        { label: 'log(erfc(x))', expr: 'log(erfc(x))' },
      ],
    },
    {
      id: 'integral',
      label: 'Integrales seno/coseno',
      entries: [
        { label: 'Si(x)',         expr: 'expintegral_si(x)',                           desc: 'Seno integral' },
        { label: 'Ci(x)',         expr: 'expintegral_ci(x)',                           desc: 'Coseno integral' },
        { label: 'si(x)',         expr: 'expintegral_si(x)-3.14159265/2',             desc: 'si = Si − π/2' },
        { label: 'Shi(x)',        expr: 'expintegral_shi(x)',                          desc: 'Seno hiperbólico integral' },
        { label: 'Chi(x)',        expr: 'expintegral_chi(x)',                          desc: 'Coseno hiperbólico integral' },
        { label: 'Si(x)/x',       expr: 'expintegral_si(x)/x' },
        { label: 'x·Si(x)',       expr: 'x*expintegral_si(x)' },
        { label: 'Ci²+Si²',      expr: 'expintegral_ci(x)^2+expintegral_si(x)^2' },
      ],
    },
    {
      id: 'fresnel',
      label: 'Integrales de Fresnel',
      entries: [
        { label: 'C(x)',          expr: 'fresnelC(x)',        desc: 'Fresnel C(x) = ∫₀ˣ cos(πt²/2)dt' },
        { label: 'S(x)',          expr: 'fresnelS(x)',        desc: 'Fresnel S(x) = ∫₀ˣ sin(πt²/2)dt' },
        { label: 'K(x)',          expr: 'fresnelK(x)',        desc: 'Fresnel K = C (núcleo exp)' },
        { label: 'C(x)²',        expr: 'fresnelC(x)^2' },
        { label: 'S(x)²',        expr: 'fresnelS(x)^2' },
        { label: 'C(x)+S(x)',    expr: 'fresnelC(x)+fresnelS(x)' },
        { label: 'C²(x)+S²(x)', expr: 'fresnelC(x)^2+fresnelS(x)^2',  desc: 'Radio² espiral de Cornu' },
        { label: 'x·C(x)',       expr: 'x*fresnelC(x)' },
        { label: 'C(√x)',        expr: 'fresnelC(sqrt(x))',  desc: 'Variable cuadrática' },
      ],
    },
    {
      id: 'expint',
      label: 'Integrales exponenciales',
      entries: [
        { label: 'Ei(x)',         expr: 'expintegral_ei(x)',                desc: 'Integral exponencial' },
        { label: 'E₁(x)',         expr: 'expintegral_e1(x)',                desc: 'E₁ = −Ei(−x) para x>0' },
        { label: 'li(x)',         expr: 'expintegral_li(x)',                desc: 'Integral logarítmica' },
        { label: 'Ei(−x)',        expr: 'expintegral_ei(-x)' },
        { label: 'exp(x)·E₁(x)', expr: 'exp(x)*expintegral_e1(x)' },
        { label: 'Ei(x)−log|x|', expr: 'expintegral_ei(x)-log(abs(x))' },
        { label: 'x·E₁(x)',      expr: 'x*expintegral_e1(x)' },
      ],
    },
    {
      id: 'signal',
      label: 'Señales',
      entries: [
        { label: 'u(x)',          expr: 'u(x)',            desc: 'Escalón Heaviside' },
        { label: 'rect(x)',       expr: 'rect(x)',         desc: 'Pulso rectangular' },
        { label: 'tri(x)',        expr: 'tri(x)',          desc: 'Triangular' },
        { label: 'sinc(x)',       expr: 'sinc(x)',         desc: 'sinc normalizado' },
        { label: 'u(x)·exp(−x)', expr: 'u(x)*exp(-x)',   desc: 'Exponencial causal' },
        { label: 'rect(x)·cos(x)',expr: 'rect(x)*cos(x)', desc: 'Pulso modulado' },
        { label: 'tri(x/2)',      expr: 'tri(x/2)' },
      ],
    },
    {
      id: 'composed',
      label: 'Compuestas',
      entries: [
        { label: 'sin(x)·erf(x)',  expr: 'sin(x)*erf(x)' },
        { label: 'Γ(x)·sin(πx)',  expr: 'gamma(x)*sin(3.14159*x)', desc: '= π (reflexión)' },
        { label: 'Si(x)·cos(x)',  expr: 'expintegral_si(x)*cos(x)' },
        { label: 'tanh(x)·Si(x)', expr: 'tanh(x)*expintegral_si(x)' },
        { label: 'erf(x)/x',      expr: 'erf(x)/x' },
        { label: 'Ei(−x²)',       expr: 'expintegral_ei(-x^2)' },
        { label: '√x·exp(−x)',    expr: 'sqrt(x)*exp(-x)' },
        { label: 'x/sin(x)',      expr: 'x/sin(x)',        desc: 'Polos en nπ' },
        { label: 'atan(1/x)',     expr: 'atan(1/x)',       desc: 'Cotangente inversa' },
        { label: 'log(1+erf(x))', expr: 'log(1+erf(x))' },
        { label: 'log(Γ(x))/x',  expr: 'log(gamma(x))/x' },
        { label: 'Si(x)/Γ(x)',   expr: 'expintegral_si(x)/gamma(x)' },
      ],
    },
  ];
}
