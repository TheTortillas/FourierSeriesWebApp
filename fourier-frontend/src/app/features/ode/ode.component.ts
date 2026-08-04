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
import { catchError, debounceTime, forkJoin, of, Subject, switchMap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { NavComponent } from '../../shared/components/nav/nav.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { MathjaxDirective } from '../../shared/directives/mathjax.directive';
import { MobileMathKeyboardComponent } from '../../shared/components/math-keyboard/mobile-math-keyboard.component';
import { FunctionPlotComponent } from '../../shared/components/function-plot/function-plot.component';
import {
  ParamSlidersComponent,
  type ParamValues,
} from '../../shared/components/param-sliders/param-sliders.component';
import { ExportButtonComponent } from '../../shared/components/export-button/export-button.component';

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
import type {
  LaplaceIcCondition,
  LaplaceOdeResponse,
  SimplifyRequest,
} from '../../domain/types/transform.types';
import type { PlotLayer } from '../../shared/components/function-plot/function-plot.component';

export type OdeModeTab = OdeMode | 'laplace';

export interface AltForm { labelKey: string; tex: string; maxima: string; }

interface IVarOption {
  id: string;
  display: string;
  maxima: string;
}

const IVAR_OPTIONS: IVarOption[] = [
  { id: 'x',   display: 'x',   maxima: 'x' },
  { id: 't',   display: 't',   maxima: 't' },
  { id: 'tau', display: 'τ',   maxima: 'tau' },
  { id: 'r',   display: 'r',   maxima: 'r' },
];

interface IvpCondition {
  order: number;
  value: string;
  valueTex: string;
}

interface BvpCondition {
  x: string;
  xTex: string;
  value: string;
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
  // ivpIcs also used for Laplace ICs (same structure, always at t=0)
}

const ODE_EXAMPLES: OdeExample[] = [
  // ── General ──
  { labelKey: 'ode.exSeparable',   eqTex: "y'=xy",                      fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exBernoulli',   eqTex: "y'+y=y^{2}",                 fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exHomogeneous', eqTex: "y'=\\frac{y}{x}+1",          fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exExact',       eqTex: "2xy+y^{2}+(x^{2}+2xy)y'=0", fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exLinear1',     eqTex: "y'+\\frac{2}{x}y=x^{2}",     fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exEuler',       eqTex: "x^{2}y''+xy'-y=0",           fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exConstCoeff',  eqTex: "y''-5y'+6y=0",               fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exUnderdamped', eqTex: "y''+2y'+5y=0",               fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exThirdOrder',  eqTex: "y'''+y'=0",                  fn: 'y', ivar: 'x', mode: 'general' },
  { labelKey: 'ode.exThirdOrder2', eqTex: "y'''-3y''+3y'-y=0",          fn: 'y', ivar: 'x', mode: 'general' },
  // ── IVP ──
  {
    labelKey: 'ode.exIvp1Hom', eqTex: "y'+3y=0", fn: 'y', ivar: 'x', mode: 'ivp', x0: '0',
    ivpIcs: [{ order: 0, value: '1', valueTex: '1' }],
  },
  {
    labelKey: 'ode.exIvp1NonHom', eqTex: "y'-2y=4", fn: 'y', ivar: 'x', mode: 'ivp', x0: '0',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exIvp2Real', eqTex: "y''-5y'+6y=0", fn: 'y', ivar: 'x', mode: 'ivp', x0: '0',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '1', valueTex: '1' }],
  },
  {
    labelKey: 'ode.exIvp2Complex', eqTex: "y''+2y'+5y=0", fn: 'y', ivar: 'x', mode: 'ivp', x0: '0',
    ivpIcs: [{ order: 0, value: '1', valueTex: '1' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exIvp2Repeat', eqTex: "y''-2y'+y=0", fn: 'y', ivar: 'x', mode: 'ivp', x0: '0',
    ivpIcs: [{ order: 0, value: '1', valueTex: '1' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exIvp2Sin', eqTex: "y''+y=\\sin\\left(x\\right)", fn: 'y', ivar: 'x', mode: 'ivp', x0: '0',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exIvp2ExpForce', eqTex: "y''-3y'+2y=e^{x}", fn: 'y', ivar: 'x', mode: 'ivp', x0: '0',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exIvp2PolyForce', eqTex: "y''+4y=t^{2}", fn: 'y', ivar: 't', mode: 'ivp', x0: '0',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exIvp2CompoundForce', eqTex: "y''+3y'+2y=t\\cdot e^{-t}", fn: 'y', ivar: 't', mode: 'ivp', x0: '0',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exIvp3rdOrder', eqTex: "y'''-6y''+11y'-6y=0", fn: 'y', ivar: 't', mode: 'ivp', x0: '0',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '1', valueTex: '1' }, { order: 2, value: '0', valueTex: '0' }],
  },
  // ── Laplace (desolve) — clásicos ──
  {
    labelKey: 'ode.exLap1Hom', eqTex: "y'+3y=0", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '1', valueTex: '1' }],
  },
  {
    labelKey: 'ode.exLap1NonHom', eqTex: "y'-2y=4", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLap2Real', eqTex: "y''-5y'+6y=0", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '1', valueTex: '1' }],
  },
  {
    labelKey: 'ode.exLap2Complex', eqTex: "y''+2y'+5y=0", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '1', valueTex: '1' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLap2Repeat', eqTex: "y''-2y'+y=0", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '1', valueTex: '1' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLap2Sin', eqTex: "y''+y=\\sin\\left(t\\right)", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLap2Exp', eqTex: "y''-3y'+2y=e^{t}", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLap2Poly', eqTex: "y''+4y=t^{2}", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLap2Compound', eqTex: "y''+3y'+2y=t\\cdot e^{-t}", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLap3rd', eqTex: "y'''-6y''+11y'-6y=0", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '1', valueTex: '1' }, { order: 2, value: '0', valueTex: '0' }],
  },
  // ── Laplace (desolve) — δ y u ──
  {
    labelKey: 'ode.exLapDirac1', eqTex: "y''+2y'+y=\\delta\\left(t\\right)", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLapDirac2', eqTex: "y''+4y=\\delta\\left(t-\\pi\\right)", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLapStep1', eqTex: "y''+y=u\\left(t-\\pi\\right)", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLapStep2', eqTex: "y'+y=u\\left(t\\right)-u\\left(t-2\\right)", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '0', valueTex: '0' }],
  },
  {
    labelKey: 'ode.exLapImpulse', eqTex: "y''+2y'+5y=\\delta\\left(t\\right)", fn: 'y', ivar: 't', mode: 'laplace',
    ivpIcs: [{ order: 0, value: '1', valueTex: '1' }, { order: 1, value: '0', valueTex: '0' }],
  },
  // ── BVP ──
  {
    labelKey: 'ode.exBvp1', eqTex: "y''+y=0", fn: 'y', ivar: 'x', mode: 'bvp',
    bvpConds: [
      { x: '0', xTex: '0', value: '0', valueTex: '0' },
      { x: '%pi/2', xTex: '\\frac{\\pi}{2}', value: '1', valueTex: '1' },
    ],
  },
  {
    labelKey: 'ode.exBvp2', eqTex: "y''=x\\left(1-x\\right)", fn: 'y', ivar: 'x', mode: 'bvp',
    bvpConds: [
      { x: '0', xTex: '0', value: '0', valueTex: '0' },
      { x: '1', xTex: '1', value: '0', valueTex: '0' },
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
    ExportButtonComponent,
  ],
})
export class OdeComponent implements OnInit, AfterViewChecked {
  private readonly api        = inject(ApiService);
  private readonly seo        = inject(SeoService);
  private readonly userStore  = inject(UserStore);
  private readonly transloco  = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  readonly mqs                = inject(MathquillService);
  private readonly tex2max    = inject(LatexToMaximaService);
  private readonly mathUtils  = inject(MathUtilsService);
  private readonly plotter    = inject(PlottingService);

  // ── Canvas ref for fullscreen/download ───────────────────────────────────────
  @ViewChild('canvasWrapperRef') private canvasWrapperRef!: ElementRef<HTMLElement>;

  // ── MathQuill refs ───────────────────────────────────────────────────────────
  @ViewChild('mqEqRef') private mqEqRef!: ElementRef<HTMLElement>;
  eqField: MathField | null = null;
  private _eqMounted = false;

  ivpFields:    (MathField | null)[] = [];
  private _ivpInited: boolean[] = [];
  x0Field:            MathField | null = null;
  private _x0Mounted = false;

  bvpFields:    (MathField | null)[] = [null, null];
  bvpXFields:   (MathField | null)[] = [null, null];
  private _bvpInited  = [false, false];
  private _bvpXInited = [false, false];

  readonly plotComponent = viewChild(FunctionPlotComponent);

  // ── Modes & options ──────────────────────────────────────────────────────────
  readonly modes: { id: OdeModeTab; labelKey: string }[] = [
    { id: 'general', labelKey: 'ode.modeGeneral' },
    { id: 'ivp',     labelKey: 'ode.modeIvp' },
    { id: 'bvp',     labelKey: 'ode.modeBvp' },
    { id: 'laplace', labelKey: 'ode.modeLaplace' },
  ];

  readonly ivarOptions = IVAR_OPTIONS;

  readonly mobileExtraGroup: KeyBtn[] = [
    { label: "y'",   write: "y'" },
    { label: "y''",  write: "y''" },
    { label: '=',    cmd: '=' },
    { label: 'δ(□)', writeWithCursor: '\\operatorname{delta}\\left(\\right)' },
    { label: 'u(□)', writeWithCursor: '\\operatorname{u}\\left(\\right)' },
    { label: '∞',    write: '\\infty' },
    { label: '-∞',   write: '-\\infty' },
  ];

  readonly keyGroups: KeyBtn[][] = [
    // Row 1: Notación ODE + funciones especiales
    [
      { label: "y'",   write: "y'" },
      { label: "y''",  write: "y''" },
      { label: "y'''", write: "y'''" },
      { label: '=',    cmd: '=' },
      { label: 'δ(□)', writeWithCursor: '\\operatorname{delta}\\left(\\right)' },
      { label: 'u(□)', writeWithCursor: '\\operatorname{u}\\left(\\right)' },
    ],
    // Row 2: Trig + hiperbólicas
    [
      { label: 'sin(□)',  writeWithCursor: '\\sin\\left(\\right)' },
      { label: 'cos(□)',  writeWithCursor: '\\cos\\left(\\right)' },
      { label: 'sinh(□)', writeWithCursor: '\\sinh\\left(\\right)' },
      { label: 'cosh(□)', writeWithCursor: '\\cosh\\left(\\right)' },
      { label: 'atan(□)', writeWithCursor: '\\operatorname{atan}\\left(\\right)' },
      { label: 'ln(□)',   writeWithCursor: '\\ln\\left(\\right)' },
    ],
    // Row 3: Operadores y constantes
    [
      { label: 'e^□' },
      { label: '□²' },
      { label: '□^□' },
      { label: '□/□' },
      { label: '√□', cmd: '\\sqrt' },
      { label: '(□)', writeWithCursor: '\\left(\\right)' },
      { label: 'π', typedText: 'pi' },
      { label: '∞', write: '\\infty' },
      { label: '-∞', write: '-\\infty' },
      { label: '−', write: '-' },
      { label: '⌫', keystroke: 'Backspace' },
    ],
  ];

  showKeyboard = false;

  // ── State signals ────────────────────────────────────────────────────────────
  readonly mode    = signal<OdeModeTab>('general');
  readonly fnName  = signal('y');
  readonly ivarId  = signal('x');
  readonly ivar    = computed(() => IVAR_OPTIONS.find((o) => o.id === this.ivarId())?.maxima ?? 'x');

  readonly eqTex   = signal("y''+y=0");
  readonly equation = signal('');

  readonly ivpX0    = signal('0');
  readonly ivpX0Tex = signal('0');
  readonly ivpIcs = signal<IvpCondition[]>([
    { order: 0, value: '0', valueTex: '0' },
    { order: 1, value: '0', valueTex: '0' },
  ]);

  readonly bvpConds = signal<BvpCondition[]>([
    { x: '0', xTex: '0', value: '0', valueTex: '0' },
    { x: '1', xTex: '1', value: '0', valueTex: '0' },
  ]);

  // ── Laplace-mode signals ─────────────────────────────────────────────────────
  readonly laplaceIcs = signal<IvpCondition[]>([
    { order: 0, value: '0', valueTex: '0' },
    { order: 1, value: '0', valueTex: '0' },
  ]);
  readonly laplaceResult = signal<LaplaceOdeResponse | null>(null);
  laplaceIcFields: (MathField | null)[] = [];
  private _laplaceIcInited: boolean[] = [];

  // ── Result & UI state ────────────────────────────────────────────────────────
  readonly result   = signal<OdeResponse | null>(null);
  readonly loading  = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly hasComputedResult = computed(
    () => this.result() !== null || this.laplaceResult() !== null,
  );
  readonly inputsLocked = computed(() => this.loading() || this.hasComputedResult());

  readonly showCanvasSettings = signal(false);
  readonly isFullscreen       = signal(false);

  // ── Curve style ──────────────────────────────────────────────────────────────
  readonly curveColor     = signal('#3b82f6');
  readonly curveLineWidth = signal(2);
  readonly curveDashed    = signal(false);

  resetLineStyles(): void {
    this.curveColor.set('#3b82f6');
    this.curveLineWidth.set(2);
    this.curveDashed.set(false);
  }

  // ── Free-constant sliders ────────────────────────────────────────────────────
  readonly freeParams  = signal<string[]>([]);
  readonly paramValues = signal<ParamValues>({});

  // ── Alt forms ────────────────────────────────────────────────────────────────
  readonly altForms        = signal<AltForm[]>([]);
  readonly altFormsLoading = signal(false);
  readonly altFormsOpen    = signal(false);

  // ── Plot layers ──────────────────────────────────────────────────────────────
  readonly layers = computed<PlotLayer[]>(() => {
    const res        = this.result();
    const laplaceRes = this.laplaceResult();
    const pv         = this.evaluationParams();
    const color      = this.curveColor();
    const lw         = this.curveLineWidth();
    const dash       = this.curveDashed();
    const ivar       = this.ivar();
    const plotter    = this.plotter;
    const math       = this.mathUtils;
    const fnName     = this.fnName();

    const layer: PlotLayer = {
      curves: [],
      onDraw: (ctx, vp) => {
        // ode2 result
        if (res?.exists && res.solution?.maxima) {
          const sol = res.solution.maxima;
          const rhs = sol.includes('=') ? sol.split('=').slice(1).join('=').trim() : sol;
          if (!rhs.includes(fnName)) {
            let expr = rhs;
            for (const [name, value] of Object.entries(pv).sort((a, b) => b[0].length - a[0].length)) {
              expr = expr.split(name).join(`(${value})`);
            }
            const fn = math.compile(expr, ivar);
            if (fn) plotter.plotFn(ctx, fn, vp, { color, lineWidth: lw, dashed: dash });
          }
        }
        // desolve result
        if (laplaceRes?.exists && laplaceRes.solution?.maxima) {
          const sol = laplaceRes.solution.maxima;
          const fn  = math.compile(sol, ivar);
          if (fn) plotter.plotFn(ctx, fn, vp, { color, lineWidth: lw, dashed: dash });
        }
      },
    };
    return [layer];
  });

  readonly evaluationParams = computed<ParamValues>(() => {
    const names = this.freeParams();
    const pv = this.paramValues();
    const merged: ParamValues = { ...pv };
    for (const name of names) {
      if (!Number.isFinite(merged[name])) merged[name] = 1;
    }
    return merged;
  });

  // ── Examples ─────────────────────────────────────────────────────────────────
  readonly filteredExamples = computed(() =>
    ODE_EXAMPLES.filter((e) => e.mode === this.mode()),
  );

  private readonly submit$ = new Subject<void>();
  private _urlPopulated  = false;
  private _restoredFromUrl = false;

  constructor() {
    // Re-parse equation whenever ivar changes
    effect(() => {
      const ivar = this.ivar();
      const tex  = this.eqTex();
      if (tex.trim()) {
        const r = this.tex2max.convertOdeForOde2(tex, this.fnName(), ivar);
        this.equation.set(r.ok ? r.maxima : '');
      }
    });

    // Sync result → URL
    effect(() => {
      if (this.result() || this.laplaceResult()) {
        this._urlPopulated = true;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { s: this._encodeState() },
          replaceUrl: true,
        });
      } else if (this._urlPopulated) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      }
    });

    // Load first example when mode changes (unless coming from URL or result is active)
    effect(() => {
      const m = this.mode();
      if (this._restoredFromUrl || this.hasComputedResult()) return;
      const first = ODE_EXAMPLES.find((e) => e.mode === m);
      if (first) this.loadExample(first.labelKey);
    });

    // Restore from URL
    const encoded = this.route.snapshot.queryParamMap.get('s');
    if (encoded) { this._restoreState(encoded); this._restoredFromUrl = true; }

    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'laplace') { this.mode.set('laplace'); this._restoredFromUrl = true; }

    if (typeof window !== 'undefined') {
      document.addEventListener('fullscreenchange', () => {
        this.isFullscreen.set(!!document.fullscreenElement);
      });
    }
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
          this.errorMsg.set(null);
          this.freeParams.set([]);
          this.paramValues.set({});

          const m  = this.mode();
          const eq = this.equation().trim();
          if (!eq) {
            this.loading.set(false);
            this.errorMsg.set(this.transloco.translate('ode.errorNoEq'));
            return of(null);
          }

          // ── Laplace (desolve) ──────────────────────────────────────────────
          if (m === 'laplace') {
            const unknown  = `${this.fnName()}(${this.ivar()})`;
            const laplaceEq = this.tex2max.convertOde(this.eqTex(), this.fnName(), this.ivar());
            if (!laplaceEq.ok) {
              this.loading.set(false);
              this.errorMsg.set(this.transloco.translate('ode.errorNoEq'));
              return of(null);
            }
            const lIcs: LaplaceIcCondition[] = this.laplaceIcs().map(ic => ({
              order:    ic.order,
              value:    ic.value || '0',
              valueTex: ic.valueTex,
            }));
            return this.api.calculateLaplaceOde({
              equation:          laplaceEq.maxima,
              equationTex:       this.eqTex(),
              unknown,
              timeVar:           this.ivar(),
              initialConditions: lIcs,
            }).pipe(
              catchError(err => { this.errorMsg.set(formatApiError(err, 'Error al calcular')); return of(null); }),
            );
          }

          // ── ode2 (general / ivp / bvp) ────────────────────────────────────
          const ics = this.ivpIcs();
          const bvp = this.bvpConds();
          const body: OdeRequest = {
            equation:    eq,
            equationTex: this.eqTex(),
            unknown:     this.fnName(),
            ivar:        this.ivar(),
            mode:        m as OdeMode,
            x0:    this.ivpX0(),
            x0Tex: this.ivpX0Tex(),
            y0:    ics[0]?.value    ?? '0',
            y0Tex: ics[0]?.valueTex ?? '0',
            dy0:    ics[1]?.value    ?? '0',
            dy0Tex: ics[1]?.valueTex ?? '0',
            x1:    bvp[0]?.x        ?? '0',
            x1Tex: bvp[0]?.xTex     ?? '0',
            y1:    bvp[0]?.value     ?? '0',
            y1Tex: bvp[0]?.valueTex  ?? '0',
            x2:    bvp[1]?.x         ?? '1',
            x2Tex: bvp[1]?.xTex      ?? '1',
            y2:    bvp[1]?.value      ?? '0',
            y2Tex: bvp[1]?.valueTex   ?? '0',
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
        this.userStore.refreshQuota();

        if (this.mode() === 'laplace') {
          const r = res as LaplaceOdeResponse;
          this.laplaceResult.set(r);
          this.altForms.set([]);
          this.altFormsOpen.set(false);
          if (r.exists && r.solution) {
            this._runAltForms(r.solution);
            this.plotComponent()?.resetView();
          }
        } else {
          const r = res as OdeResponse;
          this.result.set(r);
          if (r.exists && r.solution) {
            this.freeParams.set(r.params ?? []);
            this.altForms.set([]);
            this.altFormsOpen.set(false);
            this._runAltForms(r.solution);
            this.plotComponent()?.resetView();
          }
        }
      });

    setTimeout(() => this._parseEquation(this.eqTex()), 300);
  }

  ngAfterViewChecked(): void {
    if (this.mqEqRef && !this._eqMounted) {
      this._eqMounted = true;
      void this._mountEqField();
    }
    if (!this._x0Mounted) {
      const el = document.querySelector('[data-mq-x0]') as HTMLElement | null;
      if (el) { this._x0Mounted = true; void this._mountX0Field(el); }
    }
    for (let i = 0; i < this.ivpIcs().length; i++) {
      if (!this._ivpInited[i]) {
        const el = document.querySelector(`[data-mq-ivp="${i}"]`) as HTMLElement | null;
        if (el) { this._ivpInited[i] = true; void this._mountIvpField(el, i); }
      }
    }
    for (let i = 0; i < this.laplaceIcs().length; i++) {
      if (!this._laplaceIcInited[i]) {
        const el = document.querySelector(`[data-mq-laplace-ic="${i}"]`) as HTMLElement | null;
        if (el) { this._laplaceIcInited[i] = true; void this._mountLaplaceIcField(el, i); }
      }
    }
    for (let i = 0; i < 2; i++) {
      if (!this._bvpXInited[i]) {
        const el = document.querySelector(`[data-mq-bvp-x="${i}"]`) as HTMLElement | null;
        if (el) { this._bvpXInited[i] = true; void this._mountBvpXField(el, i); }
      }
      if (!this._bvpInited[i]) {
        const el = document.querySelector(`[data-mq-bvp="${i}"]`) as HTMLElement | null;
        if (el) { this._bvpInited[i] = true; void this._mountBvpField(el, i); }
      }
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  calculate(): void { this.submit$.next(); }

  startNewCalculation(): void {
    this.result.set(null);
    this.laplaceResult.set(null);
    this.errorMsg.set(null);
    this.freeParams.set([]);
    this.paramValues.set({});
    this.altForms.set([]);
    this.showCanvasSettings.set(false);
    this.resetLineStyles();
  }

  onParamValuesChange(pv: ParamValues): void { this.paramValues.set(pv); }

  toggleFullscreen(): void {
    const el = this.canvasWrapperRef?.nativeElement;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }

  downloadCanvas(): void {
    const canvas = this.canvasWrapperRef?.nativeElement?.querySelector('canvas');
    if (!canvas) return;
    const url = (canvas as HTMLCanvasElement).toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ode-solution.png';
    a.click();
  }

  // ── IVP management ───────────────────────────────────────────────────────────
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

  ivpIcLabel(order: number): string {
    const fn = this.fnName();
    const x  = this.ivar();
    return `${fn}${"'".repeat(order)}(${x}_0)`;
  }

  // ── BVP management ───────────────────────────────────────────────────────────
  updateBvpX(index: number, x: string, xTex: string): void {
    this.bvpConds.update((cs) =>
      cs.map((c, i) => (i === index ? { ...c, x, xTex } : c)),
    );
  }

  updateBvpValue(index: number, value: string, valueTex: string): void {
    this.bvpConds.update((cs) =>
      cs.map((c, i) => (i === index ? { ...c, value, valueTex } : c)),
    );
  }

  bvpLabel(index: number): string {
    return `${this.fnName()}(${this.ivar()}_${index + 1})`;
  }

  // ── Laplace-mode IC management ───────────────────────────────────────────────
  addLaplaceIc(): void {
    const nextOrder = this.laplaceIcs().length;
    this.laplaceIcs.update(ics => [...ics, { order: nextOrder, value: '0', valueTex: '0' }]);
    this._laplaceIcInited.push(false);
    this.laplaceIcFields.push(null);
  }

  removeLaplaceIc(index: number): void {
    this.laplaceIcs.update(ics => ics.filter((_, i) => i !== index));
    this._laplaceIcInited.splice(index, 1);
    this.laplaceIcFields.splice(index, 1);
  }

  updateLaplaceIcValue(index: number, value: string, valueTex: string): void {
    this.laplaceIcs.update(ics =>
      ics.map((ic, i) => (i === index ? { ...ic, value, valueTex } : ic)),
    );
  }

  laplaceIcLabel(order: number): string {
    const fn = this.fnName();
    const x  = this.ivar();
    return `${fn}${"'".repeat(order)}(${x}_0)`;
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
    this.laplaceResult.set(null);
    this.freeParams.set([]);
    this.altForms.set([]);
    this.errorMsg.set(null);

    if (ex.mode === 'ivp' && ex.ivpIcs) {
      const x0 = ex.x0 ?? '0';
      this.ivpX0.set(x0);
      this.ivpX0Tex.set(x0);
      this.x0Field?.latex(x0);
      this._x0Mounted = false;
      this.ivpIcs.set(ex.ivpIcs.map((ic) => ({ ...ic })));
      this._ivpInited = ex.ivpIcs.map(() => false);
      this.ivpFields  = ex.ivpIcs.map(() => null);
    }
    if (ex.mode === 'bvp' && ex.bvpConds) {
      this.bvpConds.set(ex.bvpConds.map((c) => ({ ...c })));
      this._bvpInited  = [false, false];
      this._bvpXInited = [false, false];
      this.bvpFields   = [null, null];
      this.bvpXFields  = [null, null];
    }
    if (ex.mode === 'laplace' && ex.ivpIcs) {
      this.laplaceIcs.set(ex.ivpIcs.map(ic => ({ ...ic })));
      this._laplaceIcInited = ex.ivpIcs.map(() => false);
      this.laplaceIcFields  = ex.ivpIcs.map(() => null);
    }
    this._eqMounted = false;
  }

  // ── Alt forms ────────────────────────────────────────────────────────────────
  private _runAltForms(main: { maxima: string; tex: string }): void {
    this.altForms.set([]);
    this.altFormsLoading.set(true);
    const profiles: Array<{ labelKey: string; req: SimplifyRequest }> = [
      { labelKey: 'transforms.altFormFactor', req: { expression: main.maxima, profile: 'complete', functions: ['factor'] } },
      { labelKey: 'transforms.altFormExpand', req: { expression: main.maxima, profile: 'complete', functions: ['expand'] } },
      { labelKey: 'transforms.altFormTrig',   req: { expression: main.maxima, profile: 'complete', functions: ['trigreduce'], displayFlags: { demoivre: true } } },
      { labelKey: 'transforms.altFormExp',    req: { expression: main.maxima, profile: 'complete', functions: ['radcan', 'expand', 'combine'], displayFlags: { exponentialize: true } } },
    ];
    forkJoin(profiles.map(({ req }) => this.api.simplify(req).pipe(catchError(() => of(null)))))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => {
        const normalize = (s: string) => s.replace(/\s+/g, '');
        const seenTex = new Set<string>([main.tex ? normalize(main.tex) : '']);
        const forms: AltForm[] = [];
        results.forEach((r, i) => {
          if (!r) return;
          const { tex, maxima } = (r as { simplified: { tex: string; maxima: string } }).simplified;
          if (!tex || !maxima) return;
          const key = normalize(tex);
          if (seenTex.has(key)) return;
          seenTex.add(key);
          forms.push({ labelKey: profiles[i].labelKey, tex, maxima });
        });
        this.altForms.set(forms);
        this.altFormsLoading.set(false);
      });
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
        enter: () => this.calculate(),
      },
    });
    wrapperDiv.addEventListener('focusin', () => {
      if (this.eqField) this.mqs.setActiveField(this.eqField, `${this.fnName()}(${this.ivar()})`);
    });
    wrapperDiv.addEventListener('focusout', () => this.mqs.clearActiveField());
    if (this.eqTex()) this.eqField?.latex(this.eqTex());
  }

  private async _mountX0Field(el: HTMLElement): Promise<void> {
    const field = await this.mqs.createField(el, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf) => {
          const latex = mf.latex();
          const r = this.tex2max.convertOdeForOde2(latex, this.fnName(), this.ivar());
          this.ivpX0.set(r.ok ? r.maxima : latex);
          this.ivpX0Tex.set(latex);
        },
        enter: () => this.calculate(),
      },
    });
    this.x0Field = field;
    if (field) field.latex(this.ivpX0Tex());
    el.addEventListener('focusin', () => {
      if (this.x0Field) this.mqs.setActiveField(this.x0Field, 'punto');
    });
    el.addEventListener('focusout', () => this.mqs.clearActiveField());
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

  private async _mountBvpXField(el: HTMLElement, index: number): Promise<void> {
    const cond = this.bvpConds()[index];
    const field = await this.mqs.createField(el, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf) => {
          const latex = mf.latex();
          const r = this.tex2max.convertOdeForOde2(latex, this.fnName(), this.ivar());
          this.updateBvpX(index, r.ok ? r.maxima : latex, latex);
        },
        enter: () => this.calculate(),
      },
    });
    this.bvpXFields[index] = field;
    if (field) field.latex(cond.xTex ?? cond.x);
    el.addEventListener('focusin', () => {
      if (this.bvpXFields[index]) this.mqs.setActiveField(this.bvpXFields[index]!, 'punto');
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

  private async _mountLaplaceIcField(el: HTMLElement, index: number): Promise<void> {
    const ic = this.laplaceIcs()[index];
    const field = await this.mqs.createField(el, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf) => {
          const latex = mf.latex();
          const r = this.tex2max.convertOdeForOde2(latex, this.fnName(), this.ivar());
          this.updateLaplaceIcValue(index, r.ok ? r.maxima : latex, latex);
        },
        enter: () => this.calculate(),
      },
    });
    this.laplaceIcFields[index] = field;
    if (field) field.latex(ic.valueTex ?? ic.value);
    el.addEventListener('focusin', () => {
      if (this.laplaceIcFields[index]) this.mqs.setActiveField(this.laplaceIcFields[index]!, 'valor');
    });
    el.addEventListener('focusout', () => this.mqs.clearActiveField());
  }

  private _parseEquation(latex: string): void {
    if (!latex.trim()) { this.equation.set(''); return; }
    const r = this.tex2max.convertOdeForOde2(latex, this.fnName(), this.ivar());
    this.equation.set(r.ok ? r.maxima : '');
  }

  // ── URL state ────────────────────────────────────────────────────────────────
  private _encodeState(): string {
    try {
      const state: Record<string, unknown> = {
        mode:  this.mode(),
        ivar:  this.ivarId(),
        fn:    this.fnName(),
        eq:    this.equation(),
        eqTex: this.eqTex(),
        x0:    this.ivpX0(),
        x0Tex: this.ivpX0Tex(),
        ics:   this.ivpIcs(),
        bvp:   this.bvpConds(),
      };
      return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    } catch { return ''; }
  }

  private _restoreState(encoded: string): void {
    try {
      const s = JSON.parse(decodeURIComponent(escape(atob(encoded)))) as Record<string, unknown>;
      if (typeof s['mode']  === 'string') this.mode.set(s['mode'] as OdeModeTab);
      if (typeof s['ivar']  === 'string') this.ivarId.set(s['ivar']);
      if (typeof s['fn']    === 'string') this.fnName.set(s['fn']);
      if (typeof s['eqTex'] === 'string') this.eqTex.set(s['eqTex']);
      if (typeof s['eq']    === 'string') this.equation.set(s['eq']);
      if (typeof s['x0']    === 'string') { this.ivpX0.set(s['x0']); this.ivpX0Tex.set(typeof s['x0Tex'] === 'string' ? s['x0Tex'] : s['x0']); }
      if (Array.isArray(s['ics'])) this.ivpIcs.set(s['ics'] as IvpCondition[]);
      if (Array.isArray(s['bvp'])) this.bvpConds.set(s['bvp'] as BvpCondition[]);
    } catch { /* ignore */ }
  }

  private _updateSeo(): void {
    this.seo.setPage(
      'ode.seoTitle',
      'ode.seoDescription',
      this.transloco.translate('ode.seoKeywords'),
    );
  }
}
