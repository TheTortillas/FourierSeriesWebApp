import {
  AfterViewChecked,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';

import { NavComponent } from '../../shared/components/nav/nav.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { MathjaxDirective } from '../../shared/directives/mathjax.directive';
import { MobileMathKeyboardComponent } from '../../shared/components/math-keyboard/mobile-math-keyboard.component';
import { FunctionPlotComponent } from '../../shared/components/function-plot/function-plot.component';

import { ApiService } from '../../core/services/api/api.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { UserStore } from '../../core/services/auth/user.store';
import {
  MathquillService,
  type KeyBtn,
  type MathField,
} from '../../core/services/math/mathquill.service';
import { LatexToMaximaService } from '../../core/services/math/latex-to-maxima.service';
import { MathUtilsService } from '../../core/services/math/math-utils.service';
import { formatApiError } from '../../shared/utils/api-error.utils';

import type { OdeMode, OdeRequest, OdeResponse } from '../../domain';
import type { PlotLayer } from '../../shared/components/function-plot/function-plot.component';
import { PlottingService } from '../../core/services/canvas/plotting.service';

export type OdeModeTab = OdeMode;

interface IVarOption {
  id: string;
  display: string;
  maxima: string;
}

const IVAR_OPTIONS: IVarOption[] = [
  { id: 'x', display: 'x', maxima: 'x' },
  { id: 't', display: 't', maxima: 't' },
  { id: 'tau', display: 'τ', maxima: 'tau' },
  { id: 'r', display: 'r', maxima: 'r' },
];

interface OdeExample {
  labelKey: string;
  eqTex: string;
  fn: string;
  ivar: string;
  mode: OdeModeTab;
  x0?: string;
  y0?: string;
  dy0?: string;
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
}

const ODE_EXAMPLES: OdeExample[] = [
  // ── General ──
  { labelKey: 'ode.exSeparable', eqTex: "y'=xy", fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exBernoulli', eqTex: "y'+y=y^{2}", fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exEuler', eqTex: "x^{2}y''+xy'-y=0", fn: 'y', ivar: 'x', mode: 'general' },
  // ── PVI 1er orden ──
  {
    labelKey: 'ode.exIvp1Hom',
    eqTex: "y'+3y=0",
    fn: 'y',
    ivar: 'x',
    mode: 'ivp',
    x0: '0',
    y0: '1',
  },
  {
    labelKey: 'ode.exIvp1NonHom',
    eqTex: "y'-2y=4",
    fn: 'y',
    ivar: 'x',
    mode: 'ivp',
    x0: '0',
    y0: '0',
  },
  // ── PVI 2do orden ──
  {
    labelKey: 'ode.exIvp2Real',
    eqTex: "y''-5y'+6y=0",
    fn: 'y',
    ivar: 'x',
    mode: 'ivp',
    x0: '0',
    y0: '0',
    dy0: '1',
  },
  {
    labelKey: 'ode.exIvp2Complex',
    eqTex: "y''+2y'+5y=0",
    fn: 'y',
    ivar: 'x',
    mode: 'ivp',
    x0: '0',
    y0: '1',
    dy0: '0',
  },
  {
    labelKey: 'ode.exIvp2Repeat',
    eqTex: "y''-2y'+y=0",
    fn: 'y',
    ivar: 'x',
    mode: 'ivp',
    x0: '0',
    y0: '1',
    dy0: '0',
  },
  {
    labelKey: 'ode.exIvp2Sin',
    eqTex: "y''+y=\\sin(x)",
    fn: 'y',
    ivar: 'x',
    mode: 'ivp',
    x0: '0',
    y0: '0',
    dy0: '0',
  },
  // ── Frontera ──
  {
    labelKey: 'ode.exBvp1',
    eqTex: "y''+y=0",
    fn: 'y',
    ivar: 'x',
    mode: 'bvp',
    x1: '0',
    y1: '0',
    x2: '%pi/2',
    y2: '1',
  },
  {
    labelKey: 'ode.exBvp2',
    eqTex: "y''=x\\left(1-x\\right)",
    fn: 'y',
    ivar: 'x',
    mode: 'bvp',
    x1: '0',
    y1: '0',
    x2: '1',
    y2: '0',
  },
];

@Component({
  selector: 'app-ode',
  templateUrl: './ode.component.html',
  imports: [
    NavComponent,
    FooterComponent,
    MathjaxDirective,
    FormsModule,
    TranslocoPipe,
    MobileMathKeyboardComponent,
    FunctionPlotComponent,
  ],
})
export class OdeComponent implements OnInit, AfterViewChecked {
  private readonly api = inject(ApiService);
  private readonly seo = inject(SeoService);
  private readonly userStore = inject(UserStore);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly mqs = inject(MathquillService);
  private readonly tex2max = inject(LatexToMaximaService);
  private readonly mathUtils = inject(MathUtilsService);
  private readonly plotter = inject(PlottingService);
  // ── MathQuill refs ──────────────────────────────────────────────────────────
  @ViewChild('mqEqRef') private mqEqRef!: ElementRef<HTMLElement>;
  private eqField: MathField | null = null;
  private _eqMounted = false;

  readonly plotComponent = viewChild(FunctionPlotComponent);

  // ── Modes & options ──────────────────────────────────────────────────────────
  readonly modes: { id: OdeModeTab; labelKey: string }[] = [
    { id: 'general', labelKey: 'ode.modeGeneral' },
    { id: 'ivp', labelKey: 'ode.modeIvp' },
    { id: 'bvp', labelKey: 'ode.modeBvp' },
  ];

  readonly ivarOptions = IVAR_OPTIONS;
  readonly examples = ODE_EXAMPLES;

  readonly mobileExtraGroup: KeyBtn[] = [
    { label: "y'", write: "y'" },
    { label: "y''", write: "y''" },
    { label: '=', cmd: '=' },
  ];

  // ── State signals ────────────────────────────────────────────────────────────
  readonly mode = signal<OdeModeTab>('general');
  readonly fnName = signal('y');
  readonly ivarId = signal('x');
  readonly ivar = computed(() => IVAR_OPTIONS.find((o) => o.id === this.ivarId())?.maxima ?? 'x');
  readonly dy0Label = computed(() => `\\(${this.fnName()}'(${this.ivar()}_0) =\\)`);

  readonly eqTex = signal("y''+y=0");
  readonly equation = signal(''); // Maxima form

  // IVP fields
  readonly x0 = signal('0');
  readonly y0 = signal('0');
  readonly dy0 = signal('0');

  // BVP fields
  readonly x1 = signal('0');
  readonly y1 = signal('0');
  readonly x2 = signal('1');
  readonly y2 = signal('0');

  // Result & UI state
  readonly result = signal<OdeResponse | null>(null);
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  showKeyboard = false;

  // Plot
  readonly layers        = signal<PlotLayer[]>([]);
  readonly canvasMounted = signal(false);

  private readonly submit$ = new Subject<void>();

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.transloco
      .selectTranslation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this._updateSeo());

    this.submit$
      .pipe(
        debounceTime(50),
        switchMap(() => {
          this.loading.set(true);
          this.errorMsg.set('');
          this.result.set(null);
          this.layers.set([]);

          const eq = this.equation().trim();
          if (!eq) {
            this.loading.set(false);
            this.errorMsg.set(this.transloco.translate('ode.errorNoEq'));
            return of(null);
          }

          const body: OdeRequest = {
            equation: eq,
            equationTex: this.eqTex(),
            unknown: this.fnName(),
            ivar: this.ivar(),
            mode: this.mode(),
            x0: this.x0(),
            y0: this.y0(),
            dy0: this.dy0(),
            x1: this.x1(),
            y1: this.y1(),
            x2: this.x2(),
            y2: this.y2(),
          };

          return this.api.calculateOde(body).pipe(
            catchError((err) => {
              this.errorMsg.set(formatApiError(err, 'Error al calcular'));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (!res) return;
        this.result.set(res);
        this.userStore.refreshQuota();
        if (res.exists && res.solution) this._buildPlot(res);
      });

    // Trigger initial equation parse after MathQuill mounts
    setTimeout(() => {
      this._parseEquation(this.eqTex());
    }, 300);
  }

  ngAfterViewChecked(): void {
    if (this.mqEqRef && !this._eqMounted) {
      this._eqMounted = true;
      this._mountEqField();
    }
  }

  // ── Calculation ──────────────────────────────────────────────────────────────
  calculate(): void {
    this.submit$.next();
  }

  // ── Examples ─────────────────────────────────────────────────────────────────
  loadExample(labelKey: string): void {
    const ex = ODE_EXAMPLES.find((e) => e.labelKey === labelKey);
    if (!ex) return;
    this.mode.set(ex.mode);
    this.fnName.set(ex.fn);
    this.ivarId.set(ex.ivar);
    this.eqTex.set(ex.eqTex);
    this._parseEquation(ex.eqTex);
    if (ex.mode === 'ivp') {
      this.x0.set(ex.x0 ?? '0');
      this.y0.set(ex.y0 ?? '0');
      this.dy0.set(ex.dy0 ?? '0');
    }
    if (ex.mode === 'bvp') {
      this.x1.set(ex.x1 ?? '0');
      this.y1.set(ex.y1 ?? '0');
      this.x2.set(ex.x2 ?? '1');
      this.y2.set(ex.y2 ?? '0');
    }
    this._eqMounted = false; // force remount to update MathQuill display
  }

  // ── MathQuill ────────────────────────────────────────────────────────────────
  private async _mountEqField(): Promise<void> {
    const el = this.mqEqRef?.nativeElement;
    if (!el) return;

    const wrapperDiv = el.querySelector<HTMLElement>('[data-mq-eq]');
    if (!wrapperDiv) return;

    this.eqField = await this.mqs.createField(wrapperDiv, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (field: MathField) => {
          const latex = field.latex();
          this.eqTex.set(latex);
          this._parseEquation(latex);
        },
      },
    });

    wrapperDiv.addEventListener('focusin', () => {
      if (this.eqField) this.mqs.setActiveField(this.eqField, `${this.fnName()}(${this.ivar()})`);
    });
    wrapperDiv.addEventListener('focusout', () => this.mqs.clearActiveField());

    if (this.eqTex()) this.eqField?.latex(this.eqTex());
  }

  private _parseEquation(latex: string): void {
    if (!latex.trim()) {
      this.equation.set('');
      return;
    }
    const r = this.tex2max.convertOdeForOde2(latex, this.fnName(), this.ivar());
    this.equation.set(r.ok ? r.maxima : '');
  }

  // ── Plot ──────────────────────────────────────────────────────────────────────
  private _buildPlot(res: OdeResponse): void {
    const sol = res.solution!;
    const rhs = sol.maxima.includes('=')
      ? sol.maxima.split('=').slice(1).join('=').trim()
      : sol.maxima;

    // Only plot if solution is explicit (no remaining fn name on RHS)
    if (rhs.includes(this.fnName())) return;

    const ivar = this.ivar();
    const fn = this.mathUtils.compile(rhs, ivar);
    if (!fn) return;

    const plotter = this.plotter;
    const layer: PlotLayer = {
      curves: [],
      onDraw: (ctx, vp) => {
        plotter.plotFn(ctx, fn, vp, { color: '#3b82f6', lineWidth: 2 });
      },
    };
    this.layers.set([layer]);
    this.canvasMounted.set(true);
    setTimeout(() => this.plotComponent()?.resetView(), 50);
  }

  private _updateSeo(): void {
    this.seo.setPage('ode.seoTitle', 'ode.seoDescription', this.transloco.translate('ode.seoKeywords'));
  }
}
