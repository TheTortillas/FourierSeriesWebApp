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
  latex: string;
  maxima: string;
  desc?: string;
}

export interface CLibGroup {
  id: string;
  label: string;
  entries: CLibEntry[];
}

function e(label: string, latex: string, maxima: string, desc?: string): CLibEntry {
  return { label, latex, maxima, desc };
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
      e('z²+c', 'z^{2}+c', 'z^2+c', 'Mandelbrot (libre c)'),
    ],
  },
  {
    id: 'explog',
    label: 'complex.groups.explog',
    entries: [
      e('exp(z)', 'e^{z}', 'exp(z)', 'Exponencial compleja'),
      e('exp(iz)', 'e^{iz}', 'exp(%i*z)', 'Euler: cos+i·sin'),
      e('exp(z²)', 'e^{z^{2}}', 'exp(z^2)'),
      e('exp(1/z)', 'e^{1/z}', 'exp(1/z)', 'Singularidad esencial'),
      e('ln(z)', '\\ln\\left(z\\right)', 'log(z)', 'Rama principal'),
      e('ln(z²+1)', '\\ln\\left(z^{2}+1\\right)', 'log(z^2+1)'),
      e('ln(z+i)', '\\ln\\left(z+i\\right)', 'log(z+%i)'),
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
      e('cosh(z)', '\\cosh\\left(z\\right)', 'cosh(z)'),
      e('sinh(z)', '\\sinh\\left(z\\right)', 'sinh(z)'),
      e('tanh(z)', '\\tanh\\left(z\\right)', 'tanh(z)'),
      e('1/sin(z)', '\\frac{1}{\\sin\\left(z\\right)}', '1/sin(z)', 'csc(z)'),
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
      e('ζ(z)', '\\zeta\\left(z\\right)', 'zeta(z)', 'Función Zeta de Riemann'),
      e('ζ(z+2)', '\\zeta\\left(z+2\\right)', 'zeta(z+2)', 'Alejada del polo'),
      e('Γ(z)/Γ(2z)', '\\frac{\\Gamma\\left(z\\right)}{\\Gamma\\left(2z\\right)}', 'gamma(z)/gamma(2*z)'),
      e('z·Γ(z)', 'z\\,\\Gamma\\left(z\\right)', 'z*gamma(z)', '= Γ(z+1)'),
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
    id: 'composed',
    label: 'complex.groups.composed',
    entries: [
      e('exp(sin(z))', 'e^{\\sin\\left(z\\right)}', 'exp(sin(z))'),
      e('sin(exp(z))', '\\sin\\left(e^{z}\\right)', 'sin(exp(z))', 'Franja periódica'),
      e('Γ(z)·sin(πz)', '\\Gamma\\left(z\\right)\\sin\\left(\\pi z\\right)', 'gamma(z)*sin(%pi*z)', '= π/Γ(1−z)'),
      e('ζ(z)·Γ(z)', '\\zeta\\left(z\\right)\\Gamma\\left(z\\right)', 'zeta(z)*gamma(z)'),
      e('ln(Γ(z))', '\\ln\\Gamma\\left(z\\right)', 'log(gamma(z))'),
      e('exp(z²)/(z²+1)', '\\frac{e^{z^{2}}}{z^{2}+1}', 'exp(z^2)/(z^2+1)'),
      e('sin(z)/Γ(z)', '\\frac{\\sin\\left(z\\right)}{\\Gamma\\left(z\\right)}', 'sin(z)/gamma(z)'),
      e('z·exp(z)/(z+1)²', '\\frac{z\\,e^{z}}{\\left(z+1\\right)^{2}}', 'z*exp(z)/(z+1)^2'),
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
        switchMap((latex) => this.tex2max.convertWithSpecialFns(latex)),
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
    this.exprLatex.set(entry.latex);
    this.exprMaxima.set(entry.maxima);
    this.conversionError.set(null);
    this.syncLatex.set(entry.latex);
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
