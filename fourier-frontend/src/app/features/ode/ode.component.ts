import {
  AfterViewChecked,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';

import { NavComponent } from '../../shared/components/nav/nav.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { MathjaxDirective } from '../../shared/directives/mathjax.directive';
import { MobileMathKeyboardComponent } from '../../shared/components/math-keyboard/mobile-math-keyboard.component';
import { FunctionPlotComponent } from '../../shared/components/function-plot/function-plot.component';
import {
  ParamSlidersComponent,
  type ParamValues,
} from '../../shared/components/param-sliders/param-sliders.component';

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
import { PlottingService } from '../../core/services/canvas/plotting.service';
import { formatApiError } from '../../shared/utils/api-error.utils';

import type { OdeMode, OdeRequest, OdeResponse } from '../../domain';
import type { PlotLayer } from '../../shared/components/function-plot/function-plot.component';

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

interface IvpCondition {
  order: number;   // 0 = y(x₀), 1 = y'(x₀), 2 = y''(x₀)
  value: string;   // Maxima
  valueTex: string;
}

interface BvpCondition {
  x: string;       // point (editable, plain text)
  value: string;   // Maxima
  valueTex: string;
}

interface OdeExample {
  labelKey: string;
  eqTex: string;
  fn: string;
  ivar: string;
  mode: OdeModeTab;
  x0?: string;
  ivpIcs?: IvpCondition[];
  bvpConds?: BvpCondition[];
}

const ODE_EXAMPLES: OdeExample[] = [
  // ── General ──
  { labelKey: 'ode.exSeparable',   eqTex: "y'=xy",                   fn:'y', ivar:'x', mode:'general' },
  { labelKey: 'ode.exBernoulli',   eqTex: "y'+y=y^{2}",              fn:'y', ivar:'x', mode:'general' },
  { labelKey: 'ode.exHomogeneous', eqTex: "y'=\\frac{y}{x}+1",       fn:'y', ivar:'x', mode:'general' },
  { labelKey: 'ode.exExact',       eqTex: "2xy+y^{2}+(x^{2}+2xy)y'=0", fn:'y', ivar:'x', mode:'general' },
  { labelKey: 'ode.exLinear1',     eqTex: "y'+\\frac{2}{x}y=x^{2}",  fn:'y', ivar:'x', mode:'general' },
  { labelKey: 'ode.exEuler',       eqTex: "x^{2}y''+xy'-y=0",        fn:'y', ivar:'x', mode:'general' },
  { labelKey: 'ode.exConstCoeff',  eqTex: "y''-5y'+6y=0",            fn:'y', ivar:'x', mode:'general' },
  { labelKey: 'ode.exUnderdamped', eqTex: "y''+2y'+5y=0",            fn:'y', ivar:'x', mode:'general' },
  { labelKey: 'ode.exThirdOrder',  eqTex: "y'''+y'=0",               fn:'y', ivar:'x', mode:'general' },
  { labelKey: 'ode.exThirdOrder2', eqTex: "y'''-3y''+3y'-y=0",       fn:'y', ivar:'x', mode:'general' },
  // ── IVP ──
  {
    labelKey: 'ode.exIvp1Hom',
    eqTex: "y'+3y=0",
    fn: 'y', ivar: 'x', mode: 'ivp',
    x0: '0',
    ivpIcs: [{ order: 0, value: '1', valueTex: '1' }],
  },
  {
    labelKey: 'ode.exIvp1NonHom',
    eqTex: "y'-2y=4",
    fn: 'y', ivar: 'x', mode: 'ivp',
    x0: '0',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exIvp2Real',
    eqTex: "y''-5y'+6y=0",
    fn: 'y', ivar: 'x', mode: 'ivp',
    x0: '0',
    ivpIcs: [
      { order: 0, value: '0', valueTex: '0' },
      { order: 1, value: '1', valueTex: '1' },
    ],
  },
  {
    labelKey: 'ode.exIvp2Complex',
    eqTex: "y''+2y'+5y=0",
    fn: 'y', ivar: 'x', mode: 'ivp',
    x0: '0',
    ivpIcs: [
      { order: 0, value: '1', valueTex: '1' },
      { order: 1, value: '0', valueTex: '0' },
    ],
  },
  {
    labelKey: 'ode.exIvp2Repeat',
    eqTex: "y''-2y'+y=0",
    fn: 'y', ivar: 'x', mode: 'ivp',
    x0: '0',
    ivpIcs: [
      { order: 0, value: '1', valueTex: '1' },
      { order: 1, value: '0', valueTex: '0' },
    ],
  },
  {
    labelKey: 'ode.exIvp2Sin',
    eqTex: "y''+y=\\sin(x)",
    fn: 'y', ivar: 'x', mode: 'ivp',
    x0: '0',
    ivpIcs: [
      { order: 0, value: '0', valueTex: '0' },
      { order: 1, value: '0', valueTex: '0' },
    ],
  },
  {
    labelKey: 'ode.exIvp2ExpForce',
    eqTex: "y''-3y'+2y=e^{x}",
    fn: 'y', ivar: 'x', mode: 'ivp',
    x0: '0',
    ivpIcs: [
      { order: 0, value: '0', valueTex: '0' },
      { order: 1, value: '0', valueTex: '0' },
    ],
  },
  // ── BVP ──
  {
    labelKey: 'ode.exBvp1',
    eqTex: "y''+y=0",
    fn: 'y', ivar: 'x', mode: 'bvp',
    bvpConds: [
      { x: '0',      value: '0', valueTex: '0' },
      { x: '%pi/2',  value: '1', valueTex: '1' },
    ],
  },
  {
    labelKey: 'ode.exBvp2',
    eqTex: "y''=x\\left(1-x\\right)",
    fn: 'y', ivar: 'x', mode: 'bvp',
    bvpConds: [
      { x: '0', value: '0', valueTex: '0' },
      { x: '1', value: '0', valueTex: '0' },
    ],
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
    NgTemplateOutlet,
    TranslocoPipe,
    MobileMathKeyboardComponent,
    FunctionPlotComponent,
    ParamSlidersComponent,
  ],
})
export class OdeComponent implements OnInit, AfterViewChecked {
  private readonly api        = inject(ApiService);
  private readonly seo        = inject(SeoService);
  private readonly userStore  = inject(UserStore);
  private readonly transloco  = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly mqs                = inject(MathquillService);
  private readonly tex2max    = inject(LatexToMaximaService);
  private readonly mathUtils  = inject(MathUtilsService);
  private readonly plotter    = inject(PlottingService);

  // ── MathQuill refs ───────────────────────────────────────────────────────────
  @ViewChild('mqEqRef') private mqEqRef!: ElementRef<HTMLElement>;
  private eqField: MathField | null = null;
  private _eqMounted = false;

  // IVP condition MathQuill fields (one per condition row)
  ivpFields:       (MathField | null)[] = [];
  private _ivpInited: boolean[] = [];

  // BVP condition MathQuill fields (fixed 2)
  bvpFields:       (MathField | null)[] = [null, null];
  private _bvpInited = [false, false];

  readonly plotComponent = viewChild(FunctionPlotComponent);

  // ── Modes & options ──────────────────────────────────────────────────────────
  readonly modes: { id: OdeModeTab; labelKey: string }[] = [
    { id: 'general', labelKey: 'ode.modeGeneral' },
    { id: 'ivp',     labelKey: 'ode.modeIvp' },
    { id: 'bvp',     labelKey: 'ode.modeBvp' },
  ];

  readonly ivarOptions = IVAR_OPTIONS;

  readonly mobileExtraGroup: KeyBtn[] = [
    { label: "y'",  write: "y'" },
    { label: "y''", write: "y''" },
    { label: '=',   cmd: '=' },
  ];

  // ── State signals ────────────────────────────────────────────────────────────
  readonly mode    = signal<OdeModeTab>('general');
  readonly fnName  = signal('y');
  readonly ivarId  = signal('x');
  readonly ivar    = computed(() => IVAR_OPTIONS.find((o) => o.id === this.ivarId())?.maxima ?? 'x');

  readonly eqTex   = signal("y''+y=0");
  readonly equation = signal('');

  // IVP: shared x₀ + dynamic condition list
  readonly ivpX0   = signal('0');
  readonly ivpIcs  = signal<IvpCondition[]>([
    { order: 0, value: '0', valueTex: '0' },
    { order: 1, value: '0', valueTex: '0' },
  ]);

  // BVP: two fixed boundary conditions with independent x
  readonly bvpConds = signal<BvpCondition[]>([
    { x: '0', value: '0', valueTex: '0' },
    { x: '1', value: '0', valueTex: '0' },
  ]);

  // Result & UI state
  readonly result    = signal<OdeResponse | null>(null);
  readonly loading   = signal(false);
  readonly errorMsg  = signal('');
  showKeyboard = false;
  readonly showCanvasSettings = signal(false);

  // Curve style (for settings panel)
  readonly curveColor     = signal('#3b82f6');
  readonly curveLineWidth = signal(2);
  readonly curveDashed    = signal(false);

  // Free-constant sliders
  readonly freeParams  = signal<string[]>([]);
  readonly paramValues = signal<ParamValues>({});

  // Plot
  readonly layers        = signal<PlotLayer[]>([]);
  readonly canvasMounted = signal(false);

  // Examples filtered by current mode
  readonly filteredExamples = computed(() =>
    ODE_EXAMPLES.filter((e) => e.mode === this.mode()),
  );

  private readonly submit$ = new Subject<void>();

  constructor() {
    // Rebuild plot when slider values or curve style changes
    effect(() => {
      const pv    = this.paramValues();
      const res   = this.result();
      const color = this.curveColor();
      const lw    = this.curveLineWidth();
      const dash  = this.curveDashed();
      void [color, lw, dash]; // track style signals
      if (res?.exists && res.solution) {
        this._buildPlot(res, pv);
      }
    });
  }

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
          this.freeParams.set([]);

          const eq = this.equation().trim();
          if (!eq) {
            this.loading.set(false);
            this.errorMsg.set(this.transloco.translate('ode.errorNoEq'));
            return of(null);
          }

          const ics = this.ivpIcs();
          const bvp = this.bvpConds();
          const body: OdeRequest = {
            equation:    eq,
            equationTex: this.eqTex(),
            unknown:     this.fnName(),
            ivar:        this.ivar(),
            mode:        this.mode(),
            // IVP
            x0:  this.ivpX0(),
            y0:  ics[0]?.value ?? '0',
            dy0: ics[1]?.value ?? '0',
            // BVP
            x1:  bvp[0]?.x ?? '0',
            y1:  bvp[0]?.value ?? '0',
            x2:  bvp[1]?.x ?? '1',
            y2:  bvp[1]?.value ?? '0',
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
        if (res.exists && res.solution) {
          this.freeParams.set(res.params ?? []);
          // Effect handles plot rebuild (also triggered when params=[])
        }
      });

    setTimeout(() => this._parseEquation(this.eqTex()), 300);
  }

  ngAfterViewChecked(): void {
    // Equation field
    if (this.mqEqRef && !this._eqMounted) {
      this._eqMounted = true;
      void this._mountEqField();
    }
    // IVP condition fields
    for (let i = 0; i < this.ivpIcs().length; i++) {
      if (!this._ivpInited[i]) {
        const el = document.querySelector(`[data-mq-ivp="${i}"]`) as HTMLElement | null;
        if (el) {
          this._ivpInited[i] = true;
          void this._mountIvpField(el, i);
        }
      }
    }
    // BVP value fields
    for (let i = 0; i < 2; i++) {
      if (!this._bvpInited[i]) {
        const el = document.querySelector(`[data-mq-bvp="${i}"]`) as HTMLElement | null;
        if (el) {
          this._bvpInited[i] = true;
          void this._mountBvpField(el, i);
        }
      }
    }
  }

  // ── Calculation ──────────────────────────────────────────────────────────────
  calculate(): void {
    this.submit$.next();
  }

  onParamValuesChange(pv: ParamValues): void {
    this.paramValues.set(pv);
  }

  // ── IVP condition management ──────────────────────────────────────────────────
  addIvpIc(): void {
    const nextOrder = this.ivpIcs().length;
    this.ivpIcs.update((ics) => [...ics, { order: nextOrder, value: '0', valueTex: '0' }]);
    this._ivpInited.push(false);
    this.ivpFields.push(null);
  }

  removeIvpIc(index: number): void {
    this.ivpIcs.update((ics) => ics.filter((_, i) => i !== index));
    this._ivpInited.splice(index, 1);
    this.ivpFields.splice(index, 1);
  }

  updateIvpIcValue(index: number, value: string, valueTex: string): void {
    this.ivpIcs.update((ics) =>
      ics.map((ic, i) => (i === index ? { ...ic, value, valueTex } : ic)),
    );
  }

  // Label: y(x₀)=, y'(x₀)=, y''(x₀)=
  ivpIcLabel(order: number): string {
    const fn = this.fnName();
    const x  = this.ivar();
    const primes = "'".repeat(order);
    return `${fn}${primes}(${x}_0)`;
  }

  // ── BVP condition management ──────────────────────────────────────────────────
  updateBvpX(index: number, x: string): void {
    this.bvpConds.update((cs) =>
      cs.map((c, i) => (i === index ? { ...c, x } : c)),
    );
  }

  updateBvpValue(index: number, value: string, valueTex: string): void {
    this.bvpConds.update((cs) =>
      cs.map((c, i) => (i === index ? { ...c, value, valueTex } : c)),
    );
  }

  bvpLabel(index: number): string {
    const fn = this.fnName();
    const x  = this.ivar();
    return `${fn}(${x}_${index + 1})`;
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
    this.result.set(null);
    this.layers.set([]);
    this.freeParams.set([]);

    if (ex.mode === 'ivp' && ex.ivpIcs) {
      this.ivpX0.set(ex.x0 ?? '0');
      this.ivpIcs.set(ex.ivpIcs.map((ic) => ({ ...ic })));
      this._ivpInited = ex.ivpIcs.map(() => false);
      this.ivpFields  = ex.ivpIcs.map(() => null);
    }
    if (ex.mode === 'bvp' && ex.bvpConds) {
      this.bvpConds.set(ex.bvpConds.map((c) => ({ ...c })));
      this._bvpInited = [false, false];
      this.bvpFields  = [null, null];
    }

    this._eqMounted = false; // force MathQuill remount for equation field
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

  private async _mountIvpField(el: HTMLElement, index: number): Promise<void> {
    const ic = this.ivpIcs()[index];
    const field = await this.mqs.createField(el, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf) => {
          const latex = mf.latex();
          const r = this.tex2max.convertOdeForOde2(latex, this.fnName(), this.ivar());
          this.updateIvpIcValue(index, r.ok ? r.maxima : latex, latex);
        },
        enter: () => this.calculate(),
      },
    });
    this.ivpFields[index] = field;
    if (field) field.latex(ic.valueTex ?? ic.value);
    el.addEventListener('focusin', () => {
      if (this.ivpFields[index]) this.mqs.setActiveField(this.ivpFields[index]!, 'valor');
    });
    el.addEventListener('focusout', () => this.mqs.clearActiveField());
  }

  private async _mountBvpField(el: HTMLElement, index: number): Promise<void> {
    const cond = this.bvpConds()[index];
    const field = await this.mqs.createField(el, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf) => {
          const latex = mf.latex();
          const r = this.tex2max.convertOdeForOde2(latex, this.fnName(), this.ivar());
          this.updateBvpValue(index, r.ok ? r.maxima : latex, latex);
        },
        enter: () => this.calculate(),
      },
    });
    this.bvpFields[index] = field;
    if (field) field.latex(cond.valueTex ?? cond.value);
    el.addEventListener('focusin', () => {
      if (this.bvpFields[index]) this.mqs.setActiveField(this.bvpFields[index]!, 'valor');
    });
    el.addEventListener('focusout', () => this.mqs.clearActiveField());
  }

  private _parseEquation(latex: string): void {
    if (!latex.trim()) { this.equation.set(''); return; }
    const r = this.tex2max.convertOdeForOde2(latex, this.fnName(), this.ivar());
    this.equation.set(r.ok ? r.maxima : '');
  }

  // ── Plot ──────────────────────────────────────────────────────────────────────
  private _buildPlot(res: OdeResponse, pv: ParamValues): void {
    const sol = res.solution!;
    const rhs = sol.maxima.includes('=')
      ? sol.maxima.split('=').slice(1).join('=').trim()
      : sol.maxima;

    if (rhs.includes(this.fnName())) return;

    // Substitute free constants (%c, %k1, %k2) — longest first to avoid partial matches
    let expr = rhs;
    for (const [name, value] of Object.entries(pv).sort((a, b) => b[0].length - a[0].length)) {
      expr = expr.split(name).join(`(${value})`);
    }

    const ivar   = this.ivar();
    const fn     = this.mathUtils.compile(expr, ivar);
    if (!fn) return;

    const plotter   = this.plotter;
    const color     = this.curveColor();
    const lineWidth = this.curveLineWidth();
    const dashed    = this.curveDashed();

    const layer: PlotLayer = {
      curves: [],
      onDraw: (ctx, vp) => {
        plotter.plotFn(ctx, fn, vp, { color, lineWidth, dashed });
      },
    };
    this.layers.set([layer]);
    this.canvasMounted.set(true);
    setTimeout(() => this.plotComponent()?.resetView(), 50);
  }

  private _updateSeo(): void {
    this.seo.setPage(
      'ode.seoTitle',
      'ode.seoDescription',
      this.transloco.translate('ode.seoKeywords'),
    );
  }
}
