import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { SeoService } from '../../core/services/seo/seo.service';
import { NavComponent } from '../../shared/components/nav/nav.component';
import { ComplexPlotComponent } from '../../shared/components/complex-plot/complex-plot.component';
import { ParamSlidersComponent, ParamValues } from '../../shared/components/param-sliders/param-sliders.component';
import { MathjaxDirective } from '../../shared/directives/mathjax.directive';
import { MathquillService, MathField } from '../../core/services/math/mathquill.service';
import { LatexToMaximaService } from '../../core/services/math/latex-to-maxima.service';
import type { ColorScheme } from '../../core/services/canvas/canvas.types';

// ── Library ────────────────────────────────────────────────────────────────────

export interface CLibEntry {
  label: string;
  latex: string;      // Used for MathJax render in the sidebar
  mqLatex?: string;   // Used when writing into MathQuill (if different from latex)
  maxima: string;
  desc?: string;
}

export interface CLibGroup {
  id: string;
  label: string;
  entries: CLibEntry[];
}

function e(label: string, latex: string, maxima: string, desc?: string, mqLatex?: string): CLibEntry {
  return { label, latex, mqLatex, maxima, desc };
}

export const COMPLEX_LIBRARY_GROUPS: CLibGroup[] = [
  {
    id: 'poly',
    label: 'complex.groups.poly',
    entries: [
      e('z', 'z', 'z', 'Identidad'),
      e('z²', 'z^{2}', 'z^2'),
      e('z³', 'z^{3}', 'z^3'),
      e('1/z', '\\frac{1}{z}', '1/z', 'Polo en 0'),
      e('1/z²', '\\frac{1}{z^{2}}', '1/z^2'),
      e('z+1/z', 'z+\\frac{1}{z}', 'z+1/z', 'Joukowski'),
      e('(z−1)/(z+1)', '\\frac{z-1}{z+1}', '(z-1)/(z+1)', 'Möbius'),
      e('(z−i)/(z+i)', '\\frac{z-i}{z+i}', '(z-%i)/(z+%i)', 'Disco→semiplano'),
      e('z²−1', 'z^{2}-1', 'z^2-1'),
      e('z³−1', 'z^{3}-1', 'z^3-1', 'Raíces cúbicas'),
      e('z⁴−1', 'z^{4}-1', 'z^4-1'),
      e('1/(z²+1)', '\\frac{1}{z^{2}+1}', '1/(z^2+1)', 'Polos en ±i'),
      e('1/(z⁴−1)', '\\frac{1}{z^{4}-1}', '1/(z^4-1)', '4 polos'),
      e('z²+c', 'z^{2}+c', 'z^2+c', 'Mandelbrot (libre c)'),
    ],
  },
  {
    id: 'pow',
    label: 'complex.groups.pow',
    entries: [
      e('√z', '\\sqrt{z}', 'sqrt(z)', 'Raíz cuadrada'),
      e('z^(1/3)', 'z^{1/3}', 'z^(1/3)', 'Raíz cúbica'),
      e('z^(2/3)', 'z^{2/3}', 'z^(2/3)'),
      e('z^z', 'z^{z}', 'z^z', 'Auto-potencia'),
      e('z^i', 'z^{i}', 'z^%i'),
      e('z^(1+i)', 'z^{1+i}', 'z^(1+%i)'),
      e('z^(a+bi)', 'z^{a+bi}', 'z^(a+b*%i)', 'Potencia libre ℂ'),
      e('|z|', '\\left|z\\right|', 'abs(z)'),
      e('arg(z)', '\\arg\\left(z\\right)', 'arg(z)', 'Argumento principal'),
      e('conj(z)', '\\overline{z}', 'conj(z)', 'Conjugado'),
      e('Re(z)', '\\operatorname{Re}\\left(z\\right)', 're(z)', 'Parte real'),
      e('Im(z)', '\\operatorname{Im}\\left(z\\right)', 'im(z)', 'Parte imaginaria'),
    ],
  },
  {
    id: 'explog',
    label: 'complex.groups.explog',
    entries: [
      e('exp(z)', 'e^{z}', 'exp(z)', 'Exponencial compleja'),
      e('exp(iz)', 'e^{iz}', 'exp(%i*z)', 'Euler: cos+i·sin'),
      e('exp(z²)', 'e^{z^{2}}', 'exp(z^2)'),
      e('exp(−z²)', 'e^{-z^{2}}', 'exp(-z^2)', 'Gaussiana compleja'),
      e('exp(1/z)', 'e^{1/z}', 'exp(1/z)', 'Singularidad esencial'),
      e('exp(1/z²)', 'e^{1/z^{2}}', 'exp(1/z^2)'),
      e('ln(z)', '\\ln\\left(z\\right)', 'log(z)', 'Rama principal'),
      e('ln(z²+1)', '\\ln\\left(z^{2}+1\\right)', 'log(z^2+1)'),
      e('ln(z+i)', '\\ln\\left(z+i\\right)', 'log(z+%i)'),
      e('ln(ln(z))', '\\ln\\ln\\left(z\\right)', 'log(log(z))', 'Log iterado'),
      e('z·exp(−|z|²)', 'z\\,e^{-\\left|z\\right|^{2}}', 'z*exp(-abs(z)^2)'),
      e('exp(z)/z', '\\frac{e^{z}}{z}', 'exp(z)/z'),
    ],
  },
  {
    id: 'trig',
    label: 'complex.groups.trig',
    entries: [
      e('sin(z)', '\\sin\\left(z\\right)', 'sin(z)'),
      e('cos(z)', '\\cos\\left(z\\right)', 'cos(z)'),
      e('tan(z)', '\\tan\\left(z\\right)', 'tan(z)', 'Polos en π/2+nπ'),
      e('sin(z)/z', '\\frac{\\sin\\left(z\\right)}{z}', 'sin(z)/z', 'sinc complejo'),
      e('sin(z²)', '\\sin\\left(z^{2}\\right)', 'sin(z^2)'),
      e('sin(1/z)', '\\sin\\left(\\frac{1}{z}\\right)', 'sin(1/z)', 'Sing. esencial en 0'),
      e('cos(1/z)', '\\cos\\left(\\frac{1}{z}\\right)', 'cos(1/z)'),
      e('tan(1/z)', '\\tan\\left(\\frac{1}{z}\\right)', 'tan(1/z)'),
      e('1/sin(z)', '\\frac{1}{\\sin\\left(z\\right)}', '1/sin(z)', 'csc(z)'),
      e('1/tan(z)', '\\frac{1}{\\tan\\left(z\\right)}', '1/tan(z)', 'cot(z)'),
      e('sin(z)·cos(z)', '\\sin\\left(z\\right)\\cos\\left(z\\right)', 'sin(z)*cos(z)'),
      e('asin(z)', '\\arcsin\\left(z\\right)', 'asin(z)', 'Arcoseno'),
      e('acos(z)', '\\arccos\\left(z\\right)', 'acos(z)'),
      e('atan(z)', '\\arctan\\left(z\\right)', 'atan(z)'),
    ],
  },
  {
    id: 'hyp',
    label: 'complex.groups.hyp',
    entries: [
      e('sinh(z)', '\\sinh\\left(z\\right)', 'sinh(z)'),
      e('cosh(z)', '\\cosh\\left(z\\right)', 'cosh(z)'),
      e('tanh(z)', '\\tanh\\left(z\\right)', 'tanh(z)'),
      e('sinh(z)/z', '\\frac{\\sinh\\left(z\\right)}{z}', 'sinh(z)/z'),
      e('1/sinh(z)', '\\frac{1}{\\sinh\\left(z\\right)}', '1/sinh(z)'),
      e('1/tanh(z)', '\\frac{1}{\\tanh\\left(z\\right)}', '1/tanh(z)', 'coth(z)'),
      e('tanh(1/z)', '\\tanh\\left(\\frac{1}{z}\\right)', 'tanh(1/z)'),
      e('cosh(z)·sinh(z)', '\\cosh\\left(z\\right)\\sinh\\left(z\\right)', 'cosh(z)*sinh(z)'),
      e('tanh(z²)', '\\tanh\\left(z^{2}\\right)', 'tanh(z^2)'),
    ],
  },
  {
    id: 'gamma',
    label: 'complex.groups.gamma',
    entries: [
      e('Γ(z)', '\\Gamma\\left(z\\right)', 'gamma(z)', 'Función Gamma'),
      e('1/Γ(z)', '\\frac{1}{\\Gamma\\left(z\\right)}', '1/gamma(z)', 'Función entera'),
      e('ln|Γ(z)|', '\\ln\\left|\\Gamma\\left(z\\right)\\right|', 'log(abs(gamma(z)))'),
      e('Γ(z)·Γ(1−z)', '\\Gamma\\left(z\\right)\\Gamma\\left(1-z\\right)', 'gamma(z)*gamma(1-z)', '= π/sin(πz)'),
      e('Γ(z+½)', '\\Gamma\\left(z+\\frac{1}{2}\\right)', 'gamma(z+0.5)'),
      e('Γ(iz)', '\\Gamma\\left(iz\\right)', 'gamma(%i*z)'),
      e('ζ(z)', '\\zeta\\left(z\\right)', 'zeta(z)', 'Función Zeta de Riemann'),
      e('ζ(z+2)', '\\zeta\\left(z+2\\right)', 'zeta(z+2)', 'Alejada del polo'),
      e('Γ(z)/Γ(2z)', '\\frac{\\Gamma\\left(z\\right)}{\\Gamma\\left(2z\\right)}', 'gamma(z)/gamma(2*z)'),
      e('z·Γ(z)', 'z\\,\\Gamma\\left(z\\right)', 'z*gamma(z)', '= Γ(z+1)'),
    ],
  },
  {
    id: 'gamma-extra',
    label: 'complex.groups.gammaExtra',
    entries: [
      e('z!', 'z!', 'factorial(z)', 'Factorial complejo = Γ(z+1)', '\\operatorname{factorial}\\left(z\\right)'),
      e('B(z,2)', 'B\\left(z,2\\right)', 'beta(z,2)', 'Beta compleja, b=2', '\\operatorname{Beta}\\left(z,2\\right)'),
      e('B(z,½)', 'B\\left(z,\\frac{1}{2}\\right)', 'beta(z,0.5)', 'B(z,½) = √π·Γ(z)/Γ(z+½)', '\\operatorname{Beta}\\left(z,\\frac{1}{2}\\right)'),
      e('B(z,z)', 'B\\left(z,z\\right)', 'beta(z,z)', undefined, '\\operatorname{Beta}\\left(z,z\\right)'),
      e('B(z,1−z)', 'B\\left(z,1-z\\right)', 'beta(z,1-z)', 'Fórmula de reflexión', '\\operatorname{Beta}\\left(z,1-z\\right)'),
      e('1/z!', '\\frac{1}{z!}', '1/factorial(z)', undefined, '\\frac{1}{\\operatorname{factorial}\\left(z\\right)}'),
      e('z!·sin(πz)', 'z!\\sin\\left(\\pi z\\right)', 'factorial(z)*sin(%pi*z)', 'Relacionada con Γ', '\\operatorname{factorial}\\left(z\\right)\\sin\\left(\\pi z\\right)'),
    ],
  },
  {
    id: 'mobius',
    label: 'complex.groups.mobius',
    entries: [
      e('(z−1)/(z+1)', '\\frac{z-1}{z+1}', '(z-1)/(z+1)', 'Disk→halfplane'),
      e('(az+b)/(cz+d)', '\\frac{az+b}{cz+d}', '(a*z+b)/(c*z+d)', 'Möbius general'),
      e('1/(1−z)', '\\frac{1}{1-z}', '1/(1-z)', 'Polo en 1'),
      e('(z+1)²/z', '\\frac{\\left(z+1\\right)^{2}}{z}', '(z+1)^2/z'),
      e('z/(z²+1)', '\\frac{z}{z^{2}+1}', 'z/(z^2+1)', 'Polos ±i'),
      e('z²/(z²+1)', '\\frac{z^{2}}{z^{2}+1}', 'z^2/(z^2+1)'),
      e('(z²−1)/(z²+1)', '\\frac{z^{2}-1}{z^{2}+1}', '(z^2-1)/(z^2+1)'),
    ],
  },
  {
    id: 'error',
    label: 'complex.groups.error',
    entries: [
      e('erf(z)', '\\operatorname{erf}\\left(z\\right)', 'erf(z)', 'Función error compleja'),
      e('erfc(z)', '\\operatorname{erfc}\\left(z\\right)', 'erfc(z)', '1 − erf(z)'),
      e('erfi(z)', '\\operatorname{erfi}\\left(z\\right)', 'erfi(z)', '−i·erf(iz)'),
      e('erf(z²)', '\\operatorname{erf}\\left(z^{2}\\right)', 'erf(z^2)'),
      e('erf(z)/z', '\\frac{\\operatorname{erf}\\left(z\\right)}{z}', 'erf(z)/z'),
      e('exp(z²)·erfc(z)', 'e^{z^{2}}\\operatorname{erfc}\\left(z\\right)', 'exp(z^2)*erfc(z)', 'Función de Mills'),
      e('1/erf(z)', '\\frac{1}{\\operatorname{erf}\\left(z\\right)}', '1/erf(z)'),
      e('erf(z)·Γ(z)', '\\operatorname{erf}\\left(z\\right)\\Gamma\\left(z\\right)', 'erf(z)*gamma(z)'),
    ],
  },
  {
    id: 'integral',
    label: 'complex.groups.integral',
    entries: [
      e('Si(z)', '\\operatorname{Si}\\left(z\\right)', 'Si(z)', 'Seno integral'),
      e('si(z)', '\\operatorname{si}\\left(z\\right)', 'si(z)', 'si = Si − π/2'),
      e('Ci(z)', '\\operatorname{Ci}\\left(z\\right)', 'Ci(z)', 'Coseno integral'),
      e('Cin(z)', '\\operatorname{Cin}\\left(z\\right)', 'Cin(z)', 'Cin: variante entera'),
      e('Shi(z)', '\\operatorname{Shi}\\left(z\\right)', 'Shi(z)', 'Seno hiperbólico integral'),
      e('Chi(z)', '\\operatorname{Chi}\\left(z\\right)', 'Chi(z)', 'Coseno hiperbólico integral'),
      e('Si(z)/z', '\\frac{\\operatorname{Si}\\left(z\\right)}{z}', 'Si(z)/z'),
      e('Si(z)·Ci(z)', '\\operatorname{Si}\\left(z\\right)\\operatorname{Ci}\\left(z\\right)', 'Si(z)*Ci(z)'),
      e('Si(z)+i·Ci(z)', '\\operatorname{Si}\\left(z\\right)+i\\operatorname{Ci}\\left(z\\right)', 'Si(z)+%i*Ci(z)', 'Relacionada con Ei'),
      e('Shi(z)+i·Chi(z)', '\\operatorname{Shi}\\left(z\\right)+i\\operatorname{Chi}\\left(z\\right)', 'Shi(z)+%i*Chi(z)'),
    ],
  },
  {
    id: 'fresnel',
    label: 'complex.groups.fresnel',
    entries: [
      e('fresnelC(z)', '\\operatorname{fresnelC}\\left(z\\right)', 'fresnelC(z)', 'Fresnel C = Re K(z)'),
      e('fresnelS(z)', '\\operatorname{fresnelS}\\left(z\\right)', 'fresnelS(z)', 'Fresnel S = Im K(z)'),
      e('fresnelK(z)', '\\operatorname{fresnelK}\\left(z\\right)', 'fresnelK(z)', 'K = ∫₀ᶻ exp(−iξ²)dξ'),
      e('fresnelC(z)+i·fresnelS(z)', '\\operatorname{fresnelC}\\left(z\\right)+i\\,\\operatorname{fresnelS}\\left(z\\right)', 'fresnelC(z)+%i*fresnelS(z)', 'Espiral de Cornu'),
      e('fresnelK(z²)', '\\operatorname{fresnelK}\\left(z^{2}\\right)', 'fresnelK(z^2)'),
      e('fresnelK(iz)', '\\operatorname{fresnelK}\\left(iz\\right)', 'fresnelK(%i*z)', 'K en eje imaginario'),
      e('fresnelK(z)/z', '\\frac{\\operatorname{fresnelK}\\left(z\\right)}{z}', 'fresnelK(z)/z'),
      e('fresnelK(z)·exp(iz²)', '\\operatorname{fresnelK}\\left(z\\right)e^{iz^{2}}', 'fresnelK(z)*exp(%i*z^2)', 'Modulación cuadrática'),
      e('fresnelC(z²)', '\\operatorname{fresnelC}\\left(z^{2}\\right)', 'fresnelC(z^2)'),
    ],
  },
  {
    id: 'expint',
    label: 'complex.groups.expint',
    entries: [
      e('Ei(z)', '\\operatorname{Ei}\\left(z\\right)', 'expintegral_ei(z)', 'Integral exponencial'),
      e('E₁(z)', 'E_{1}\\left(z\\right)', 'expintegral_e1(z)', 'Función E₁', '\\operatorname{E1}\\left(z\\right)'),
      e('exp(z)·E₁(z)', 'e^{z}E_{1}\\left(z\\right)', 'exp(z)*expintegral_e1(z)', undefined, 'e^{z}\\operatorname{E1}\\left(z\\right)'),
      e('Ei(z)/z', '\\frac{\\operatorname{Ei}\\left(z\\right)}{z}', 'expintegral_ei(z)/z'),
      e('Ei(z²)', '\\operatorname{Ei}\\left(z^{2}\\right)', 'expintegral_ei(z^2)'),
      e('E₁(z²)', 'E_{1}\\left(z^{2}\\right)', 'expintegral_e1(z^2)', undefined, '\\operatorname{E1}\\left(z^{2}\\right)'),
    ],
  },
  {
    id: 'composed',
    label: 'complex.groups.composed',
    entries: [
      e('exp(sin(z))', 'e^{\\sin\\left(z\\right)}', 'exp(sin(z))'),
      e('sin(exp(z))', '\\sin\\left(e^{z}\\right)', 'sin(exp(z))', 'Franja periódica'),
      e('z·sin(1/z)', 'z\\sin\\left(\\frac{1}{z}\\right)', 'z*sin(1/z)'),
      e('sin(z)/cos(z²)', '\\frac{\\sin\\left(z\\right)}{\\cos\\left(z^{2}\\right)}', 'sin(z)/cos(z^2)'),
      e('Γ(z)·sin(πz)', '\\Gamma\\left(z\\right)\\sin\\left(\\pi z\\right)', 'gamma(z)*sin(%pi*z)', '= π/Γ(1−z)'),
      e('ζ(z)·Γ(z)', '\\zeta\\left(z\\right)\\Gamma\\left(z\\right)', 'zeta(z)*gamma(z)'),
      e('ln(Γ(z))', '\\ln\\Gamma\\left(z\\right)', 'log(gamma(z))'),
      e('ln(Γ(z))/z', '\\frac{\\ln\\Gamma\\left(z\\right)}{z}', 'log(gamma(z))/z'),
      e('erf(z)/z', '\\frac{\\operatorname{erf}\\left(z\\right)}{z}', 'erf(z)/z'),
      e('tanh(Γ(z))', '\\tanh\\left(\\Gamma\\left(z\\right)\\right)', 'tanh(gamma(z))'),
      e('z^z/Γ(z)', '\\frac{z^{z}}{\\Gamma\\left(z\\right)}', 'z^z/gamma(z)'),
      e('sin(z)^z', '\\sin^{z}\\left(z\\right)', 'sin(z)^z'),
      e('ln(sin(z))', '\\ln\\sin\\left(z\\right)', 'log(sin(z))'),
      e('ln(tan(z))', '\\ln\\tan\\left(z\\right)', 'log(tan(z))'),
      e('Si(z)·exp(iz)', '\\operatorname{Si}\\left(z\\right)e^{iz}', 'Si(z)*exp(%i*z)'),
      e('exp(z²)/(z²+1)', '\\frac{e^{z^{2}}}{z^{2}+1}', 'exp(z^2)/(z^2+1)'),
      e('sin(z)/Γ(z)', '\\frac{\\sin\\left(z\\right)}{\\Gamma\\left(z\\right)}', 'sin(z)/gamma(z)'),
      e('z·exp(z)/(z+1)²', '\\frac{z\\,e^{z}}{\\left(z+1\\right)^{2}}', 'z*exp(z)/(z+1)^2'),
      e('(a+bi)·z+c', '\\left(a+bi\\right)z+c', '(a+b*%i)*z+c', 'Mapa afín libre'),
    ],
  },
];

// All groups collapsed by default
const INITIAL_COLLAPSED = Object.fromEntries(COMPLEX_LIBRARY_GROUPS.map((g) => [g.id, true]));

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-complex-plotter',
  templateUrl: './complex-plotter.component.html',
  imports: [NavComponent, ComplexPlotComponent, ParamSlidersComponent, MathjaxDirective, TranslocoPipe],
})
export class ComplexPlotterComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mqExpr') mqExprRef!: ElementRef<HTMLElement>;

  private readonly mqs      = inject(MathquillService);
  private readonly tex2max  = inject(LatexToMaximaService);
  private readonly seo      = inject(SeoService);

  readonly libraryGroups = COMPLEX_LIBRARY_GROUPS;
  readonly collapsed     = signal<Record<string, boolean>>(INITIAL_COLLAPSED);

  // ── Expression ──────────────────────────────────────────────────────────────
  readonly exprMaxima     = signal('gamma(z)');
  readonly exprLatex      = signal('\\Gamma\\left(z\\right)');
  readonly conversionError = signal<string | null>(null);

  // ── Render settings ─────────────────────────────────────────────────────────
  readonly plotMode       = signal<'2d' | '3d'>('2d');
  readonly colorScheme    = signal<ColorScheme>('classic');
  readonly showModLines   = signal(true);
  readonly invertMod      = signal(false);
  readonly legendStyle    = signal<'strip' | 'circle'>('strip');
  readonly wireframe      = signal(false);
  readonly showGrid3d     = signal(true);
  readonly resolution     = signal(80);
  readonly range3d        = signal(4);
  readonly heightScale    = signal(1.0);
  readonly zClip          = signal(5.0);
  readonly settingsOpen   = signal(false);

  // ── Params ───────────────────────────────────────────────────────────────────
  readonly detectedParams = signal<string[]>([]);
  readonly paramValues    = signal<ParamValues>({});

  // ── Sync: library click → MathQuill ─────────────────────────────────────────
  readonly syncLatex      = signal<string | null>(null);

  private field: MathField | null = null;
  private _syncing = false;
  private readonly _editSubject = new Subject<string>();
  private readonly _subs = new Subscription();
  private readonly _caretCapture = this.mqs.createCaretCapture(() => this.field);

  constructor() {
    this.seo.setPage('seo.complexPlotter.title', 'seo.complexPlotter.description');

    effect(() => {
      const lat = this.syncLatex();
      if (lat && this.field && !this._syncing) {
        this._syncing = true;
        this.field.latex(lat);
        this._syncing = false;
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    this.mqExprRef.nativeElement.addEventListener('keydown', this._caretCapture, true);

    this.field = await this.mqs.createField(this.mqExprRef.nativeElement, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf: MathField) => {
          if (this._syncing) return;
          const latex = mf.latex();
          if (!latex.trim()) {
            this.conversionError.set(null);
            this.exprLatex.set('');
            this.exprMaxima.set('');
            return;
          }
          this.exprLatex.set(latex);
          this._editSubject.next(latex);
        },
      },
    });

    if (this.field) {
      this._syncing = true;
      this.field.latex(this.exprLatex());
      this._syncing = false;
    }

    this._subs.add(
      this._editSubject.pipe(
        debounceTime(350),
        switchMap((latex) => this.tex2max.convertClientSide(latex)),
      ).subscribe((result) => {
        if (result.ok) {
          this.conversionError.set(null);
          this.exprMaxima.set(result.maxima);
        } else {
          this.conversionError.set(result.error ?? null);
          this.exprMaxima.set('');
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.mqExprRef?.nativeElement.removeEventListener('keydown', this._caretCapture, true);
    this._subs.unsubscribe();
    this._editSubject.complete();
    if (this.mqExprRef?.nativeElement) this.mqExprRef.nativeElement.innerHTML = '';
  }

  // ── Library ──────────────────────────────────────────────────────────────────

  toggleGroup(id: string): void {
    this.collapsed.update((s) => ({ ...s, [id]: !s[id] }));
  }

  isCollapsed(id: string): boolean {
    return this.collapsed()[id] ?? true;
  }

  loadExample(entry: CLibEntry): void {
    const mqLat = entry.mqLatex ?? entry.latex;
    this.exprLatex.set(mqLat);
    this.exprMaxima.set(entry.maxima);
    this.conversionError.set(null);
    this.syncLatex.set(mqLat);
    requestAnimationFrame(() => requestAnimationFrame(() => this.syncLatex.set(null)));
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  onParamsDetected(params: string[]): void {
    this.detectedParams.set(params);
  }

  onParamChange(values: ParamValues): void {
    this.paramValues.set(values);
  }

  onFocus(): void {
    this.mqs.setActiveField(this.field, 'f(z)');
  }

  toggleSettings(): void {
    this.settingsOpen.update((v) => !v);
  }
}
