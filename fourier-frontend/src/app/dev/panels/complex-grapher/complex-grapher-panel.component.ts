import { Component, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComplexPlotComponent, ColorScheme, ComplexPoint } from '../../../shared/components/complex-plot/complex-plot.component';
import { ParamSlidersComponent, ParamValues } from '../../../shared/components/param-sliders/param-sliders.component';

export interface FnEntry { label: string; fn: string; desc?: string; }
export interface FnGroup { id: string; label: string; entries: FnEntry[]; }

@Component({
  selector: 'app-complex-grapher-panel',
  imports: [FormsModule, ComplexPlotComponent, ParamSlidersComponent],
  templateUrl: './complex-grapher-panel.component.html',
})
export class ComplexGrapherPanelComponent {

  readonly plotRef = viewChild(ComplexPlotComponent);

  // ── Canvas settings ────────────────────────────────────────────────────────
  readonly expr         = signal('gamma(z)');
  readonly mode         = signal<'2d' | '3d'>('2d');
  readonly colorScheme  = signal<ColorScheme>('classic');
  readonly showModLines = signal(true);
  readonly showAxes     = signal(true);
  readonly showGrid2d   = signal(true);
  readonly range3d      = signal(4);
  readonly resolution   = signal(80);
  readonly heightScale  = signal(1.0);
  readonly zClip        = signal(5.0);
  readonly showGrid3d   = signal(true);
  readonly wireframe    = signal(false);
  readonly legendStyle  = signal<'strip' | 'circle'>('strip');

  // ── Hover coordinates ──────────────────────────────────────────────────────
  readonly compileError = signal('');
  readonly coordRe  = signal('0.0000');
  readonly coordIm  = signal('+0.0000');
  readonly coordAbs = signal('0.0000');
  readonly coordArg = signal('0.0000');
  readonly coordFz  = signal('—');

  // ── Free parameters ────────────────────────────────────────────────────────
  readonly detectedParams = signal<string[]>([]);
  readonly paramValues    = signal<ParamValues>({});

  // ── Collapsed state per group ──────────────────────────────────────────────
  readonly collapsed = signal<Record<string, boolean>>({});

  toggleGroup(id: string): void {
    this.collapsed.update(s => ({ ...s, [id]: !s[id] }));
  }
  isCollapsed(id: string): boolean {
    return this.collapsed()[id] ?? false;
  }

  // ── Function library ───────────────────────────────────────────────────────
  readonly groups: FnGroup[] = [
    {
      id: 'poly',
      label: 'Polinomios y racionales',
      entries: [
        { label: 'z',              fn: 'z',                desc: 'Identidad' },
        { label: 'z²',             fn: 'z^2',              desc: 'Cuadrado' },
        { label: 'z³',             fn: 'z^3',              desc: 'Cubo' },
        { label: 'z⁻¹',           fn: '1/z',              desc: 'Inversión' },
        { label: 'z⁻²',           fn: '1/z^2' },
        { label: '(z−1)/(z+1)',    fn: '(z-1)/(z+1)',      desc: 'Möbius' },
        { label: '(z²−1)/(z²+1)', fn: '(z^2-1)/(z^2+1)' },
        { label: '(z³−1)/(z³+1)', fn: '(z^3-1)/(z^3+1)' },
        { label: '1/(z²+1)',       fn: '1/(z^2+1)',        desc: 'Polos en ±i' },
        { label: '1/(z⁴−1)',       fn: '1/(z^4-1)',        desc: '4 polos' },
        { label: 'z/(z²+1)',       fn: 'z/(z^2+1)' },
        { label: '(z²+1)/(z²−1)', fn: '(z^2+1)/(z^2-1)' },
      ],
    },
    {
      id: 'pow',
      label: 'Potencias y raíces',
      entries: [
        { label: '√z',             fn: 'sqrt(z)',          desc: 'Raíz cuadrada' },
        { label: 'z^(1/3)',        fn: 'z^(1/3)',          desc: 'Raíz cúbica' },
        { label: 'z^(2/3)',        fn: 'z^(2/3)' },
        { label: 'z^z',            fn: 'z^z',              desc: 'Auto-potencia' },
        { label: 'z^i',            fn: 'z^i' },
        { label: 'z^(1+i)',        fn: 'z^(1+i)' },
        { label: 'z^(a+b*i)',      fn: 'z^(a+b*i)',        desc: 'Potencia libre ℂ' },
        { label: '|z|',            fn: 'abs(z)' },
        { label: 'arg(z)',         fn: 'arg(z)',            desc: 'Argumento principal' },
        { label: 'conj(z)',        fn: 'conj(z)',           desc: 'Conjugado' },
        { label: 're(z)',          fn: 're(z)',             desc: 'Parte real' },
        { label: 'im(z)',          fn: 'im(z)',             desc: 'Parte imaginaria' },
      ],
    },
    {
      id: 'exp',
      label: 'Exponencial y logaritmo',
      entries: [
        { label: 'exp(z)',         fn: 'exp(z)',           desc: 'eˢ' },
        { label: 'log(z)',         fn: 'log(z)',           desc: 'Logaritmo natural' },
        { label: 'exp(1/z)',       fn: 'exp(1/z)',         desc: 'Singularidad esencial' },
        { label: 'log(z²+1)',      fn: 'log(z^2+1)' },
        { label: 'log(z+1)/z',    fn: 'log(z+1)/z' },
        { label: 'z·exp(−|z|²)',  fn: 'z*exp(-abs(z)^2)' },
        { label: 'exp(z²)',        fn: 'exp(z^2)' },
        { label: 'exp(−z²)',       fn: 'exp(-z^2)',        desc: 'Gaussiana compleja' },
        { label: 'exp(1/z²)',      fn: 'exp(1/z^2)' },
        { label: 'log(log(z))',    fn: 'log(log(z))',      desc: 'Log iterado' },
      ],
    },
    {
      id: 'trig',
      label: 'Trigonométricas',
      entries: [
        { label: 'sin(z)',         fn: 'sin(z)' },
        { label: 'cos(z)',         fn: 'cos(z)' },
        { label: 'tan(z)',         fn: 'tan(z)' },
        { label: 'sin(z)/z',       fn: 'sin(z)/z',        desc: 'sinc complejo' },
        { label: 'sin(z²)',        fn: 'sin(z^2)' },
        { label: 'sin(1/z)',       fn: 'sin(1/z)',         desc: 'Sing. esencial' },
        { label: 'cos(1/z)',       fn: 'cos(1/z)' },
        { label: 'tan(1/z)',       fn: 'tan(1/z)' },
        { label: '1/sin(z)',       fn: '1/sin(z)',         desc: 'Polos en nπ' },
        { label: '1/tan(z)',       fn: '1/tan(z)' },
        { label: 'sin(z)·cos(z)',  fn: 'sin(z)*cos(z)' },
        { label: 'asin(z)',        fn: 'asin(z)',          desc: 'Arcoseno' },
        { label: 'acos(z)',        fn: 'acos(z)' },
        { label: 'atan(z)',        fn: 'atan(z)' },
      ],
    },
    {
      id: 'hyp',
      label: 'Hiperbólicas',
      entries: [
        { label: 'sinh(z)',        fn: 'sinh(z)' },
        { label: 'cosh(z)',        fn: 'cosh(z)' },
        { label: 'tanh(z)',        fn: 'tanh(z)' },
        { label: 'sinh(z)/z',      fn: 'sinh(z)/z' },
        { label: '1/sinh(z)',      fn: '1/sinh(z)' },
        { label: '1/tanh(z)',      fn: '1/tanh(z)',        desc: 'Coth' },
        { label: 'tanh(1/z)',      fn: 'tanh(1/z)' },
        { label: 'cosh(z)·sinh(z)',fn: 'cosh(z)*sinh(z)' },
        { label: 'tanh(z²)',       fn: 'tanh(z^2)' },
      ],
    },
    {
      id: 'gamma',
      label: 'Función Gamma',
      entries: [
        { label: 'Γ(z)',           fn: 'gamma(z)',         desc: 'Gamma de Euler' },
        { label: 'Γ(z+1)',         fn: 'gamma(z+1)',       desc: 'z·Γ(z)' },
        { label: '1/Γ(z)',         fn: '1/gamma(z)',       desc: 'Entera' },
        { label: 'Γ(z)/Γ(z+½)',   fn: 'gamma(z)/gamma(z+0.5)' },
        { label: 'Γ(z)·Γ(1−z)',   fn: 'gamma(z)*gamma(1-z)', desc: 'Fórmula reflexión' },
        { label: 'log Γ(z)',       fn: 'log(gamma(z))',    desc: 'Log-Gamma' },
        { label: 'Γ(z²)',          fn: 'gamma(z^2)' },
        { label: 'Γ(iz)',          fn: 'gamma(i*z)' },
        { label: 'Γ(½+z)',        fn: 'gamma(0.5+z)' },
        { label: 'z·Γ(z−1)',      fn: 'z*gamma(z-1)' },
      ],
    },
    {
      id: 'erf',
      label: 'Error y variantes',
      entries: [
        { label: 'erf(z)',         fn: 'erf(z)',           desc: 'Error function' },
        { label: 'erfc(z)',        fn: 'erfc(z)',          desc: '1 − erf(z)' },
        { label: 'erfi(z)',        fn: 'erfi(z)',          desc: 'Error imaginaria' },
        { label: 'erf(z²)',        fn: 'erf(z^2)' },
        { label: 'erf(iz)/i',      fn: 'erf(i*z)/i',      desc: '= erfi(z)' },
        { label: '1/erf(z)',       fn: '1/erf(z)' },
        { label: 'erf(z)·Γ(z)',    fn: 'erf(z)*gamma(z)' },
        { label: 'exp(z²)·erfc(z)',fn: 'exp(z^2)*erfc(z)', desc: 'Función w(z)' },
      ],
    },
    {
      id: 'integral',
      label: 'Integrales seno/coseno',
      entries: [
        { label: 'Si(z)',          fn: 'Si(z)',            desc: 'Seno integral' },
        { label: 'si(z)',          fn: 'si(z)',            desc: 'si(z) = Si(z)−π/2' },
        { label: 'Ci(z)',          fn: 'Ci(z)',            desc: 'Coseno integral' },
        { label: 'Cin(z)',         fn: 'Cin(z)',           desc: 'Cin: variante entera' },
        { label: 'Si(z)/z',        fn: 'Si(z)/z' },
        { label: 'Si(z²)',         fn: 'Si(z^2)',          desc: 'Fresnel-like' },
        { label: 'Ci(z)·Si(z)',    fn: 'Ci(z)*Si(z)' },
        { label: 'Si(z)+i·Ci(z)', fn: 'Si(z)+i*Ci(z)',   desc: 'Exponencial integral' },
        { label: 'exp(iz)/z',      fn: 'exp(i*z)/z',      desc: 'Relacionada con Ei' },
      ],
    },
    {
      id: 'composed',
      label: 'Compuestas y curiosas',
      entries: [
        { label: 'sin(z)/cos(z²)', fn: 'sin(z)/cos(z^2)' },
        { label: 'Γ(z)·sin(πz)',   fn: 'gamma(z)*sin(3.14159*z)', desc: 'Fórmula reflexión' },
        { label: 'erf(z)/z',       fn: 'erf(z)/z' },
        { label: 'log(Γ(z))/z',    fn: 'log(gamma(z))/z' },
        { label: 'Si(z)·exp(iz)',   fn: 'Si(z)*exp(i*z)' },
        { label: 'tanh(Γ(z))',     fn: 'tanh(gamma(z))' },
        { label: 'z^z / Γ(z)',     fn: 'z^z/gamma(z)' },
        { label: 'sin(z)^z',       fn: 'sin(z)^z' },
        { label: 'log(sin(z))',     fn: 'log(sin(z))' },
        { label: 'log(tan(z))',     fn: 'log(tan(z))' },
        { label: 'exp(sin(z))',     fn: 'exp(sin(z))' },
        { label: 'sin(exp(z))',     fn: 'sin(exp(z))',     desc: 'Caos en Re→∞' },
        { label: 'z·sin(1/z)',      fn: 'z*sin(1/z)' },
        { label: '(a+b·i)·z + c',  fn: '(a+b*i)*z+c',    desc: 'Mapa afín libre' },
      ],
    },
  ];

  // ── Handlers ───────────────────────────────────────────────────────────────
  loadExample(fn: string): void {
    this.expr.set(fn);
    this.paramValues.set({});
  }

  onCompileError(msg: string): void  { this.compileError.set(msg); }

  onParamsDetected(params: string[]): void {
    this.detectedParams.set(params);
    const pv = this.paramValues();
    const next: ParamValues = {};
    for (const p of params) next[p] = pv[p] ?? 1;
    this.paramValues.set(next);
  }

  onParamChange(pv: ParamValues): void { this.paramValues.set(pv); }

  onPointerMove(pt: ComplexPoint | null): void {
    if (!pt) { this.coordFz.set('—'); return; }
    this.coordRe.set(pt.re.toFixed(4));
    this.coordIm.set((pt.im >= 0 ? '+' : '') + pt.im.toFixed(4));
    this.coordAbs.set(pt.fAbs.toFixed(4));
    this.coordArg.set((pt.fArg >= 0 ? '+' : '') + pt.fArg.toFixed(4));
    const fc = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(3);
    this.coordFz.set(isFinite(pt.fAbs) ? `${pt.fRe.toFixed(3)}${fc(pt.fIm)}i` : '∞');
  }

  resetView(): void {
    if (this.mode() === '2d') this.plotRef()?.resetView2D();
    else this.plotRef()?.resetView3D();
  }
}
