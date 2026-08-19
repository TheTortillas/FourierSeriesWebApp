import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  DestroyRef,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanvasShellComponent } from '../../../shared/components/canvas-shell/canvas-shell.component';
import { CanvasColorService } from '../../../core/services/canvas/canvas-color.service';
import { ShareDialogComponent } from '../../../shared/components/share-dialog/share-dialog.component';
import { FavoriteDialogComponent } from '../../../shared/components/favorite-dialog/favorite-dialog.component';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, filter, forkJoin, map, of, Subject, switchMap, take, timer } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { NavComponent } from '../../../shared/components/nav/nav.component';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';
import { ApiService } from '../../../core/services/api/api.service';
import { UserStore } from '../../../core/services/auth/user.store';
import { SeoService } from '../../../core/services/seo/seo.service';
import { formatApiError } from '../../../shared/utils/api-error.utils';
import { TransformSegmentComponent, TransformSegmentDraft } from '../continuous/transform-segment.component';
import { MathquillService, type KeyBtn, type MathField } from '../../../core/services/math/mathquill.service';
import { LatexToMaximaService } from '../../../core/services/math/latex-to-maxima.service';
import { MobileMathKeyboardComponent } from '../../../shared/components/math-keyboard/mobile-math-keyboard.component';
import {
  FunctionPlotComponent,
  type PlotLayer,
} from '../../../shared/components/function-plot/function-plot.component';
import { ParamSlidersComponent, type ParamValues } from '../../../shared/components/param-sliders/param-sliders.component';
import { ComplexPlotComponent } from '../../../shared/components/complex-plot/complex-plot.component';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import type {
  LaplaceDirectResponse,
  LaplaceInverseResponse,
  LaplaceOdeResponse,
  LaplacePoleZeroResponse,
  LaplaceIcCondition,
  SimplifyRequest,
  SimplifyResponse,
} from '../../../domain/types/transform.types';

export interface AltForm { labelKey: string; tex: string; maxima: string; }
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { ExportButtonComponent } from '../../../shared/components/export-button/export-button.component';
import { HistoryEntry } from '../../../domain';

export type LaplaceMode = 'direct' | 'inverse' | 'ode';

let _nextId = 0;
const mkId = () => `lp-${++_nextId}`;

function defaultSegment(): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: 'sin(t)',
    expressionTex: '\\sin(t)',
    from: 'minf',
    fromTex: '-\\infty',
    to: 'inf',
    toTex: '\\infty',
  };
}

interface VarPair {
  id: string;
  time: string;
  freq: string;
  timeDisplay: string;
  freqDisplay: string;
}

const VAR_PAIRS: VarPair[] = [
  { id: 't-s',   time: 't',   freq: 's', timeDisplay: 't', freqDisplay: 's' },
  { id: 'x-s',   time: 'x',   freq: 's', timeDisplay: 'x', freqDisplay: 's' },
  { id: 'tau-s', time: 'tau', freq: 's', timeDisplay: 'τ', freqDisplay: 's' },
];

@Component({
  selector: 'app-laplace',
  templateUrl: './laplace.component.html',
  imports: [
    NavComponent,
    MathjaxDirective,
    CanvasShellComponent,
    ShareDialogComponent,
    FavoriteDialogComponent,
    TransformSegmentComponent,
    FormsModule,
    TranslocoPipe,
    MobileMathKeyboardComponent,
    FunctionPlotComponent,
    ParamSlidersComponent,
    FooterComponent,
    ExportButtonComponent,
    RouterLink,
    ComplexPlotComponent,
  ],
})
export class LaplaceComponent implements OnInit, AfterViewChecked, OnDestroy {
  readonly api        = inject(ApiService);
  readonly userStore  = inject(UserStore);
  readonly colors     = inject(CanvasColorService);
  private readonly transloco  = inject(TranslocoService);
  private readonly seo        = inject(SeoService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  readonly destroyRef = inject(DestroyRef);
  readonly mqs                = inject(MathquillService);
  private readonly tex2max    = inject(LatexToMaximaService);
  private readonly plotter    = inject(PlottingService);
  private readonly mathUtils  = inject(MathUtilsService);

  @ViewChild('mqInverseExpr')   private mqInverseRef!:   ElementRef<HTMLElement>;
  @ViewChild('mqOdeEquation')   private mqOdeEqRef!:     ElementRef<HTMLElement>;
  readonly plotComponent    = viewChild(FunctionPlotComponent);
  readonly complexPlotRef   = viewChild(ComplexPlotComponent);
  readonly complexPlotCapture = computed(() => {
    const ref = this.complexPlotRef();
    return ref ? () => ref.captureImage() : null;
  });

  inverseField:  MathField | null = null;
  odeEqField:    MathField | null = null;
  odeIcFields:   (MathField | null)[] = [];

  private _mqInverseInited = false;
  private _mqOdeEqInited   = false;
  private _mqOdeIcInited: boolean[] = [];
  private _urlPopulated = false;

  constructor() {

    // ── 1. Restore state from URL and auto-calculate ──────────────────────
    const encoded = this.route.snapshot.queryParamMap.get('s');
    if (encoded) {
      this.restoreState(encoded);
      toObservable(this.userStore.initialized)
        .pipe(
          filter(Boolean),
          take(1),
          switchMap(() => timer(0)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => this.calculate());
    }

    // ── 2. Sync result → URL ──────────────────────────────────────────────
    effect(() => {
      const hasDirect  = this.directResult();
      const hasInverse = this.inverseResult();
      const hasOde     = this.odeResult();

      if (hasDirect || hasInverse || hasOde) {
        this._urlPopulated = true;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { s: this.encodeState() },
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
  }

  showKeyboard = false;

  readonly mobileExtraGroup: KeyBtn[] = [
    { label: 'δ(□)', writeWithCursor: '\\operatorname{delta}\\left(\\right)' },
    { label: 'u(□)', writeWithCursor: '\\operatorname{u}\\left(\\right)' },
    { label: 'sgn(□)', writeWithCursor: '\\operatorname{sgn}\\left(\\right)' },
    { label: 'abs(□)', writeWithCursor: '\\operatorname{abs}\\left(\\right)' },
    { label: '|□|', writeWithCursor: '\\left|\\right|' },
    { label: 'i', typedText: 'i' },
    { label: '∞', write: '\\infty' },
    { label: '-∞', write: '-\\infty' },
  ];

  readonly keyGroups: KeyBtn[][] = [
    // Row 1: Funciones especiales de Laplace
    [
      { label: 'u(□)',    writeWithCursor: '\\operatorname{u}\\left(\\right)' },
      { label: 'δ(□)',    writeWithCursor: '\\operatorname{delta}\\left(\\right)' },
      { label: 'sgn(□)', writeWithCursor: '\\operatorname{sgn}\\left(\\right)' },
      { label: 'abs(□)', writeWithCursor: '\\operatorname{abs}\\left(\\right)' },
      { label: '|□|',    writeWithCursor: '\\left|\\right|' },
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
      { label: 'i', typedText: 'i' },
      { label: '∞', write: '\\infty' },
      { label: '-∞', write: '-\\infty' },
      { label: '−', write: '-' },
      { label: '⌫', keystroke: 'Backspace' },
    ],
  ];

  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  // ── Canvas overlay state ───────────────────────────────────────────────────

  private readonly isBrowser    = isPlatformBrowser(inject(PLATFORM_ID));
  readonly showCanvasSettings = signal(false);
  readonly urlCopied = signal(false);
  readonly showShareDialog = signal(false);
  readonly latestHistoryEntry = signal<HistoryEntry | null>(null);
  readonly favoriteLoading = signal(false);
  readonly showFavoriteDialog = signal(false);

  // ── Canvas line style ─────────────────────────────────────────────────────

  readonly xAxisFormat    = signal<'pi' | 'e' | 'integer' | 'custom'>('integer');
  readonly customConstName = signal<string | null>(null);

  readonly customConst = computed(() => {
    const params = this.activeParams();
    const pv = this.evaluationParams();
    const name = this.customConstName() ?? params[0];
    if (!name) return { symbol: 'T', value: 1 };
    return { symbol: name, value: pv[name] ?? 1 };
  });

  private readonly inputColorOverride  = signal<string | null>(null);
  private readonly resultColorOverride = signal<string | null>(null);
  readonly inputColor  = computed(() => this.inputColorOverride()  ?? this.colors.laplaceColors().input);
  readonly resultColor = computed(() => this.resultColorOverride() ?? this.colors.laplaceColors().result);
  readonly inputLineWidth  = signal(2);
  readonly inputDashed     = signal(false);
  readonly resultLineWidth = signal(2);
  readonly resultDashed    = signal(false);

  setInputColor(v: string):  void { this.inputColorOverride.set(v); }
  setResultColor(v: string): void { this.resultColorOverride.set(v); }

  resetLineStyles(): void {
    this.inputColorOverride.set(null);
    this.inputLineWidth.set(2);
    this.inputDashed.set(false);
    this.resultColorOverride.set(null);
    this.resultLineWidth.set(2);
    this.resultDashed.set(false);
  }

  // ── Variables ─────────────────────────────────────────────────────────────

  readonly varPairs = VAR_PAIRS;
  // ODE only needs the independent variable (t, x, τ); frequency is irrelevant
  readonly odeVarOptions = VAR_PAIRS.filter(p => p.freq === 's');

  // ── ODE examples ─────────────────────────────────────────────────────────

  readonly odeExamples: Array<{
    labelKey: string;
    eqTex: string;
    fn: string;
    varId: string;
    ics: Array<{ order: number; value: string; valueTex: string }>;
  }> = [
    {
      labelKey: 'laplace.odeEx1stOrderHom',
      eqTex: "y'+3y=0",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '1', valueTex: '1' }],
    },
    {
      labelKey: 'laplace.odeEx1stOrderNonHom',
      eqTex: "y'-2y=4",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '0', valueTex: '0' }],
    },
    {
      labelKey: 'laplace.odeEx2ndRealRoots',
      eqTex: "y''-5y'+6y=0",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '1', valueTex: '1' }],
    },
    {
      labelKey: 'laplace.odeEx2ndComplex',
      eqTex: "y''+2y'+5y=0",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '1', valueTex: '1' }, { order: 1, value: '0', valueTex: '0' }],
    },
    {
      labelKey: 'laplace.odeEx2ndRepeated',
      eqTex: "y''-2y'+y=0",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '1', valueTex: '1' }, { order: 1, value: '0', valueTex: '0' }],
    },
    {
      labelKey: 'laplace.odeEx2ndExpForcing',
      eqTex: "y''-3y'+2y=e^{t}",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
    },
    {
      labelKey: 'laplace.odeEx2ndSinForcing',
      eqTex: "y''+y=\\sin\\left(t\\right)",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
    },
    {
      labelKey: 'laplace.odeEx2ndPolyForcing',
      eqTex: "y''+4y=t^{2}",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
    },
    {
      labelKey: 'laplace.odeEx2ndCompoundForcing',
      eqTex: "y''+3y'+2y=te^{-t}",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
    },
    {
      labelKey: 'laplace.odeEx2ndDirac',
      eqTex: "y''+2y'+y=\\operatorname{delta}\\left(t\\right)",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }],
    },
    {
      labelKey: 'laplace.odeEx3rdOrder',
      eqTex: "y'''-6y''+11y'-6y=0",
      fn: 'y', varId: 't-s',
      ics: [{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '1', valueTex: '1' }, { order: 2, value: '0', valueTex: '0' }],
    },
  ];
  readonly varPairId = signal<string>('t-s');

  readonly activePair = computed<VarPair>(() =>
    VAR_PAIRS.find(p => p.id === this.varPairId()) ?? VAR_PAIRS[0],
  );

  readonly timeVar = computed(() => this.activePair().time);
  readonly freqVar = computed(() => this.activePair().freq);

  // ── Mode ──────────────────────────────────────────────────────────────────

  readonly mode = signal<LaplaceMode>('direct');

  readonly modes: { id: LaplaceMode; labelKey: string }[] = [
    { id: 'direct',  labelKey: 'laplace.modeDirecta' },
    { id: 'inverse', labelKey: 'laplace.modeInversa' },
  ];

  setMode(m: LaplaceMode): void {
    this.mode.set(m);
    this.clearResults();
    if (m === 'direct') {
      this.segments.set([defaultSegment()]);
    } else if (m === 'inverse') {
      this.inverseExpr.set('1/(s^2+1)');
      this.inverseExprTex.set('\\frac{1}{s^2+1}');
      this._mqInverseInited = false;
    } else if (m === 'ode') {
      this.odeEquation.set('');
      this.odeEquationTex.set("y'' + y = \\sin\\left(t\\right)");
      this.odeFnName.set('y');
      this.odeIcs.set([{ order: 0, value: '0', valueTex: '0' }, { order: 1, value: '0', valueTex: '0' }]);
      this._resetOdeMqFlags();
    }
  }

  // ── Shared state ─────────────────────────────────────────────────────────

  readonly loading   = signal(false);
  readonly errorMsg  = signal<string | null>(null);

  readonly hasComputedResult = computed(() =>
    this.directResult() !== null || this.inverseResult() !== null || this.odeResult() !== null,
  );

  readonly inputsLocked = computed(() => this.loading() || this.hasComputedResult());

  startNewCalculation(): void {
    this.directResult.set(null);
    this.inverseResult.set(null);
    this.odeResult.set(null);
    this.errorMsg.set(null);
    this.paramValues.set({});
    this.customConstName.set(null);
    this.showCanvasSettings.set(false);
    this.latestHistoryEntry.set(null);
    this.showShareDialog.set(false);
    this.showFavoriteDialog.set(false);
    this.urlCopied.set(false);
    this.resetLineStyles();
    this.showComplexPlane.set(false);
    this.pzResult.set(null);
    this.pzError.set(null);
    this.complexParamValues.set({});
    this.complexDetectedParams.set([]);
  }

  // ── Free parameters ───────────────────────────────────────────────────────

  readonly paramValues = signal<ParamValues>({});

  readonly activeParams = computed<string[]>(() =>
    this.directResult()?.params ?? this.inverseResult()?.params ?? this.odeResult()?.params ?? [],
  );

  readonly evaluationParams = computed<ParamValues>(() => {
    const names = this.activeParams();
    const pv = this.paramValues();
    const merged: ParamValues = { ...pv };
    for (const name of names) {
      if (!Number.isFinite(merged[name])) merged[name] = 1;
    }
    return merged;
  });

  onParamChange(pv: ParamValues): void {
    this.paramValues.set(pv);
  }

  // ── Direct mode ───────────────────────────────────────────────────────────

  readonly segments     = signal<TransformSegmentDraft[]>([defaultSegment()]);
  readonly directResult          = signal<LaplaceDirectResponse | null>(null);
  readonly altFormsDirect        = signal<AltForm[]>([]);
  readonly altFormsLoadingDirect = signal(false);
  readonly altFormsOpenDirect    = signal(false);

  addSegment(): void {
    this.segments.update(segs => [
      ...segs,
      { id: mkId(), expression: '', expressionTex: '', from: '', fromTex: '', to: '', toTex: '' },
    ]);
  }

  removeSegment(id: string): void {
    this.segments.update(segs => segs.filter(s => s.id !== id));
  }

  updateSegment(id: string, changes: Partial<TransformSegmentDraft>): void {
    this.segments.update(segs => segs.map(s => s.id === id ? { ...s, ...changes } : s));
  }

  // ── Inverse mode ─────────────────────────────────────────────────────────

  readonly altFormsInverse        = signal<AltForm[]>([]);
  readonly altFormsLoadingInverse = signal(false);
  readonly altFormsOpenInverse    = signal(false);

  readonly inverseExpr    = signal('1/(s^2+1)');
  readonly inverseExprTex = signal('\\frac{1}{s^2+1}');
  readonly inverseResult  = signal<LaplaceInverseResponse | null>(null);
  readonly inverseDefault = '\\frac{1}{s^2+1}';

  // ── ODE mode ─────────────────────────────────────────────────────────────

  // Maxima expressions sent to backend
  readonly odeEquation = signal('');
  readonly odeFnName   = signal('y');  // just the letter, e.g. "y", "g", "x"
  readonly odeUnknown  = computed(() => `${this.odeFnName()}(${this.timeVar()})`);
  readonly odeIcs      = signal<Array<{ order: number; value: string; valueTex?: string }>>([
    { order: 0, value: '0', valueTex: '0' },
    { order: 1, value: '0', valueTex: '0' },
  ]);
  readonly odeResult          = signal<LaplaceOdeResponse | null>(null);
  readonly altFormsOde        = signal<AltForm[]>([]);
  readonly altFormsLoadingOde = signal(false);
  readonly altFormsOpenOde    = signal(false);

  // LaTeX representation for the equation MathQuill field
  readonly odeEquationTex = signal("y'' + y = \\sin\\left(t\\right)");

  addIc(): void {
    const nextOrder = this.odeIcs().length;
    this.odeIcs.update(ics => [...ics, { order: nextOrder, value: '0', valueTex: '0' }]);
    this._mqOdeIcInited.push(false);
    this.odeIcFields.push(null);
  }

  removeIc(index: number): void {
    this.odeIcs.update(ics => ics.filter((_, i) => i !== index));
    this._mqOdeIcInited.splice(index, 1);
    this.odeIcFields.splice(index, 1);
  }

  updateIcValue(index: number, value: string, valueTex?: string): void {
    this.odeIcs.update(ics => ics.map((ic, i) =>
      i === index ? { ...ic, value, valueTex: valueTex ?? value } : ic
    ));
  }

  // ── Canvas layers ─────────────────────────────────────────────────────────

  readonly layers = computed<PlotLayer[]>(() => {
    const m        = this.mode();
    const direct   = this.directResult();
    const inverse  = this.inverseResult();
    const ode      = this.odeResult();
    const segs     = this.segments();
    const tVar     = this.timeVar();
    const fVar     = this.freqVar();
    const pv       = this.evaluationParams();
    const plotter  = this.plotter;
    const math     = this.mathUtils;
    const invExpr  = this.inverseExpr();

    const inColor  = this.inputColor();
    const inLW     = this.inputLineWidth();
    const inDashed = this.inputDashed();
    const resColor = this.resultColor();
    const resLW    = this.resultLineWidth();
    const resDashed = this.resultDashed();

    const layer: PlotLayer = {
      curves: [],
      onDraw: (ctx, vp) => {
        // ── Direct: plot f(t) input segments ───────────────────────────────
        if (m === 'direct') {
          const compiled = segs
            .map(seg => ({
              fn: math.compile(seg.expression, tVar, pv),
              from: this.parseLimit(seg.from, pv),
              to:   this.parseLimit(seg.to, pv),
            }))
            .filter(s => !!s.fn);

          const finitePieces   = compiled.filter(s => isFinite(s.from) && isFinite(s.to));
          const infinitePieces = compiled.filter(s => !isFinite(s.from) || !isFinite(s.to));

          if (finitePieces.length > 0) {
            plotter.plotPiecewise(
              ctx,
              finitePieces.map(s => ({ fn: s.fn!, from: s.from, to: s.to })),
              vp,
              { color: inColor, lineWidth: inLW, dashed: inDashed },
            );
          }
          for (const s of infinitePieces) {
            const gated = (x: number) => (x >= s.from && x <= s.to ? s.fn!(x) : NaN);
            plotter.plotFn(ctx, gated, vp, { color: inColor, lineWidth: inLW, dashed: inDashed });
          }

          // F(s) result — plot vs real axis of s
          if (direct?.exists && direct.F?.maxima) {
            const fn = math.compile(direct.F.maxima, fVar, pv);
            if (fn) plotter.plotFn(ctx, fn, vp, { color: resColor, lineWidth: resLW, dashed: resDashed });
          }
        }

        // ── Inverse: plot F(s) input + f(t) result ─────────────────────────
        if (m === 'inverse') {
          // Input F(s) in red — plot over the frequency axis
          if (invExpr) {
            const fn = math.compile(invExpr, fVar, pv);
            if (fn) plotter.plotFn(ctx, fn, vp, { color: inColor, lineWidth: inLW, dashed: inDashed });
          }
          // Result f(t) in blue
          if (inverse?.exists && inverse.f?.maxima) {
            const fn = math.compile(inverse.f.maxima, tVar, pv);
            if (fn) plotter.plotFn(ctx, fn, vp, { color: resColor, lineWidth: resLW, dashed: resDashed });
          }
        }

        // ── ODE: plot y(t) solution ─────────────────────────────────────────
        if (m === 'ode' && ode?.exists && ode.solution?.maxima) {
          const fn = math.compile(ode.solution.maxima, tVar, pv);
          if (fn) plotter.plotFn(ctx, fn, vp, { color: resColor, lineWidth: resLW, dashed: resDashed });
        }
      },
    };

    return [layer];
  });

  private parseLimit(s: string, params?: ParamValues): number {
    if (!s?.trim()) return NaN;
    if (s === 'inf' || s === '+inf') return Infinity;
    if (s === 'minf' || s === '-inf') return -Infinity;
    if (params && Object.keys(params).length > 0) {
      const fn = this.mathUtils.compile(s, '_', params);
      const v = fn?.(0);
      if (v !== undefined && isFinite(v)) return v;
    }
    const result = this.mathUtils.evaluate(s, 0, '_');
    return isFinite(result) ? result : NaN;
  }

  // ── URL state ─────────────────────────────────────────────────────────────

  private encodeState(): string {
    try {
      const m = this.mode();
      const state: Record<string, unknown> = {
        m,
        vp: this.varPairId(),
      };
      if (m === 'direct') {
        state['seg'] = this.segments().map(s => ({
          e: s.expression, et: s.expressionTex,
          f: s.from, ft: s.fromTex,
          t: s.to, tt: s.toTex,
        }));
      } else if (m === 'inverse') {
        state['expr'] = this.inverseExpr();
        state['exprTex'] = this.inverseExprTex();
      } else if (m === 'ode') {
        state['eq']    = this.odeEquation();
        state['eqTex'] = this.odeEquationTex();
        state['fnName'] = this.odeFnName();
        state['ics']   = this.odeIcs();
      }
      return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    } catch {
      return '';
    }
  }

  private restoreState(encoded: string): void {
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const s = JSON.parse(json) as Record<string, unknown>;

      if (s['vp'] && typeof s['vp'] === 'string') this.varPairId.set(s['vp']);

      const m = s['m'];
      if (m === 'direct' || m === 'inverse' || m === 'ode') this.mode.set(m);

      if (m === 'direct' && Array.isArray(s['seg'])) {
        const segs = (s['seg'] as Array<Record<string, string>>).map(seg => ({
          id: mkId(),
          expression: seg['e'] ?? '',
          expressionTex: seg['et'] ?? '',
          from: seg['f'] ?? '',
          fromTex: seg['ft'] ?? '',
          to: seg['t'] ?? '',
          toTex: seg['tt'] ?? '',
        }));
        if (segs.length) this.segments.set(segs);
      } else if (m === 'inverse' && typeof s['expr'] === 'string') {
        this.inverseExpr.set(s['expr']);
        if (typeof s['exprTex'] === 'string' && s['exprTex']) {
          this.inverseExprTex.set(s['exprTex']);
        }
      } else if (m === 'ode') {
        if (typeof s['eq'] === 'string')     this.odeEquation.set(s['eq']);
        if (typeof s['eqTex'] === 'string')  this.odeEquationTex.set(s['eqTex']);
        if (typeof s['fnName'] === 'string') this.odeFnName.set(s['fnName']);
        if (Array.isArray(s['ics']))
          this.odeIcs.set(s['ics'] as Array<{ order: number; value: string; valueTex?: string }>);
        // Normalize to an ODE-valid var pair (frequency is irrelevant in ODE)
        if (!this.odeVarOptions.find(p => p.id === this.varPairId())) {
          const fallback = this.odeVarOptions.find(p => p.time === this.activePair().time);
          if (fallback) this.varPairId.set(fallback.id);
        }
        this._resetOdeMqFlags();
      }
    } catch {
      // ignore malformed state
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private readonly submit$ = new Subject<void>();

  ngOnInit(): void {
    this.seo.setPage(
      'seo.laplace.title',
      'seo.laplace.description',
      'Laplace transform calculator, transformada de Laplace, inverse Laplace transform, transformada inversa de Laplace, ODE solver, resolución de EDOs, differential equations, ecuaciones diferenciales ordinarias, Laplace method, método de Laplace, partial fractions, fracciones parciales, piecewise functions, funciones a trozos, initial conditions, condiciones iniciales, step function, Heaviside, Dirac delta, impulse response, graph Laplace transform, graficar transformada de Laplace, symbolic math, cálculo simbólico',
    );

    this.submit$.pipe(
      debounceTime(50),
      switchMap(() => {
        this.loading.set(true);
        this.errorMsg.set(null);
        this.paramValues.set({});
        this.customConstName.set(null);

        const m = this.mode();
        if (m === 'direct') {
          const validSegs = this.segments().filter(s => s.expression.trim());
          if (!validSegs.length) {
            this.loading.set(false);
            this.errorMsg.set(this.transloco.translate('laplace.errorNoSegments'));
            return of(null);
          }
          return this.api.calculateLaplaceDirect({
            segments: validSegs.map(s => ({
              expression: s.expression, expressionTex: s.expressionTex,
              from: s.from, fromTex: s.fromTex,
              to: s.to,   toTex: s.toTex,
            })),
            timeVar: this.timeVar(),
            freqVar: this.freqVar(),
          }).pipe(catchError(err => {
            this.errorMsg.set(formatApiError(err, 'Error al calcular'));
            return of(null);
          }));
        }

        if (m === 'inverse') {
          const expr = this.inverseExpr().trim();
          if (!expr) {
            this.loading.set(false);
            this.errorMsg.set(this.transloco.translate('laplace.errorNoExpr'));
            return of(null);
          }
          return this.api.calculateLaplaceInverse({
            expression: expr,
            expressionTex: this.inverseExprTex(),
            freqVar: this.freqVar(),
            timeVar: this.timeVar(),
          }).pipe(
            catchError(err => { this.errorMsg.set(formatApiError(err, 'Error al calcular')); return of(null); }),
          );
        }

        const eq  = this.odeEquation().trim();
        const unk = this.odeUnknown().trim();
        if (!eq || !unk) {
          this.loading.set(false);
          this.errorMsg.set(this.transloco.translate('laplace.errorNoEq'));
          return of(null);
        }
        const ics: LaplaceIcCondition[] = this.odeIcs().map(ic => ({
          order: ic.order,
          value: ic.value || '0',
          valueTex: ic.valueTex,
        }));
        return this.api.calculateLaplaceOde({
          equation: eq,
          equationTex: this.odeEquationTex(),
          unknown: unk,
          timeVar: this.timeVar(),
          initialConditions: ics,
        }).pipe(
          catchError(err => { this.errorMsg.set(formatApiError(err, 'Error al calcular')); return of(null); }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      this.loading.set(false);
      if (result === null) return;
      const m = this.mode();
      // Reset complex plane on every new result
      this.pzResult.set(null);
      this.pzError.set(null);

      if (m === 'direct') {
        const r = result as LaplaceDirectResponse;
        this.directResult.set(r);
        this.altFormsDirect.set([]); this.altFormsOpenDirect.set(false);
        if (r.exists && r.F) this._runAltForms(r.F, this.altFormsDirect, this.altFormsLoadingDirect);
        this.plotComponent()?.resetView();
        this.showCanvasSettings.set(typeof window !== 'undefined' && window.innerWidth >= 1024);
        if (r.exists && !this.showComplexPlane()) this._pulseBtnOnce();
      }
      if (m === 'inverse') {
        const r = result as LaplaceInverseResponse;
        this.inverseResult.set(r);
        this.altFormsInverse.set([]); this.altFormsOpenInverse.set(false);
        if (r.exists && r.f) this._runAltForms(r.f, this.altFormsInverse, this.altFormsLoadingInverse);
        this.plotComponent()?.resetView();
        this.showCanvasSettings.set(typeof window !== 'undefined' && window.innerWidth >= 1024);
        if (r.exists && !this.showComplexPlane()) this._pulseBtnOnce();
      }
      if (m === 'ode') {
        const r = result as LaplaceOdeResponse;
        this.odeResult.set(r);
        this.altFormsOde.set([]); this.altFormsOpenOde.set(false);
        if (r.exists && r.solution) this._runAltForms(r.solution, this.altFormsOde, this.altFormsLoadingOde);
        this.plotComponent()?.resetView();
        this.showCanvasSettings.set(typeof window !== 'undefined' && window.innerWidth >= 1024);
      }
      if (this.userStore.isAuthenticated()) this.fetchLatestEntry();
    });
  }

  ngAfterViewChecked(): void {
    if (!this.isBrowser) return;
    if (!this._mqInverseInited && this.mqInverseRef?.nativeElement) {
      this._mqInverseInited = true;
      void this.initInverseField();
    }
    if (!this._mqOdeEqInited && this.mqOdeEqRef?.nativeElement) {
      this._mqOdeEqInited = true;
      void this.initOdeEqField();
    }
    // IC fields — one per condition
    for (let i = 0; i < this.odeIcs().length; i++) {
      if (!this._mqOdeIcInited[i]) {
        const el = document.querySelector(`[data-mq-ic="${i}"]`) as HTMLElement | null;
        if (el) {
          this._mqOdeIcInited[i] = true;
          void this.initOdeIcField(el, i);
        }
      }
    }
  }

  private async initInverseField(): Promise<void> {
    const el = this.mqInverseRef.nativeElement;
    const field = await this.mqs.createField(el, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf) => {
          const latex = mf.latex();
          if (!latex.trim()) { this.inverseExpr.set(''); this.inverseExprTex.set(''); return; }
          this.inverseExprTex.set(latex);
          this.tex2max.convertClientSide(latex).subscribe(r => {
            if (r.ok) this.inverseExpr.set(r.maxima);
          });
        },
        enter: () => this.calculate(),
      },
    });
    this.inverseField = field;
    if (field) field.latex(this.inverseExprTex());
    el.addEventListener('focusin',  () => { if (this.inverseField) this.mqs.setActiveField(this.inverseField, 'F(s)'); });
    el.addEventListener('focusout', () => this.mqs.clearActiveField());
  }

  private async initOdeEqField(): Promise<void> {
    const el = this.mqOdeEqRef.nativeElement;
    const field = await this.mqs.createField(el, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf) => {
          const latex = mf.latex();
          this.odeEquationTex.set(latex);
          if (!latex.trim()) { this.odeEquation.set(''); return; }
          // Read signals at event time so fn/tvar changes are always reflected
          const r = this.tex2max.convertOde(latex, this.odeFnName(), this.timeVar());
          this.odeEquation.set(r.ok ? r.maxima : '');
        },
        enter: () => this.calculate(),
      },
    });
    this.odeEqField = field;
    if (field) field.latex(this.odeEquationTex());
    el.addEventListener('focusin',  () => {
      if (this.odeEqField) this.mqs.setActiveField(this.odeEqField, `${this.odeFnName()}'' + ${this.odeFnName()} = f(${this.timeVar()})`);
    });
    el.addEventListener('focusout', () => this.mqs.clearActiveField());
  }

  private async initOdeIcField(el: HTMLElement, index: number): Promise<void> {
    const ic = this.odeIcs()[index];
    const field = await this.mqs.createField(el, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf) => {
          const latex = mf.latex();
          // Use ODE context so i→%i, e→%e are handled correctly
          const r = this.tex2max.convertOde(latex, this.odeFnName(), this.timeVar());
          this.updateIcValue(index, r.ok ? r.maxima : latex, latex);
        },
        enter: () => this.calculate(),
      },
    });
    this.odeIcFields[index] = field;
    if (field) field.latex(ic.valueTex ?? ic.value);
    el.addEventListener('focusin',  () => { if (this.odeIcFields[index]) this.mqs.setActiveField(this.odeIcFields[index]!, 'valor'); });
    el.addEventListener('focusout', () => this.mqs.clearActiveField());
  }

  // Label for IC row: y(0)=, y'(0)=, y''(0)=, ...
  odeIcLabel(order: number): string {
    const fn = this.odeFnName();
    if (order === 0) return `${fn}(0)`;
    return `${fn}${"'".repeat(order)}(0)`;
  }

  onOdeFnNameChange(value: string): void {
    const clean = value.replace(/[^a-zA-Z]/g, '').slice(0, 2) || 'y';
    this.odeFnName.set(clean);
    // Re-parse the current equation with the new function name
    const latex = this.odeEquationTex();
    if (latex.trim()) {
      const r = this.tex2max.convertOde(latex, clean, this.timeVar());
      this.odeEquation.set(r.ok ? r.maxima : '');
    }
  }

  loadOdeExample(labelKey: string): void {
    const ex = this.odeExamples.find(e => e.labelKey === labelKey);
    if (!ex) return;
    this.varPairId.set(ex.varId);
    this.odeFnName.set(ex.fn);
    this.odeEquationTex.set(ex.eqTex);
    const r = this.tex2max.convertOde(ex.eqTex, ex.fn, this.timeVar());
    this.odeEquation.set(r.ok ? r.maxima : '');
    this.odeIcs.set(ex.ics);
    this._resetOdeMqFlags();
  }

  // Called when mode switches back to ODE — reset MathQuill init flags
  private _resetOdeMqFlags(): void {
    this._mqOdeEqInited = false;
    this._mqOdeIcInited = this.odeIcs().map(() => false);
    this.odeEqField  = null;
    this.odeIcFields = this.odeIcs().map(() => null);
  }

  ngOnDestroy(): void {
    if (this.mqInverseRef?.nativeElement) this.mqInverseRef.nativeElement.innerHTML = '';
    if (this.mqOdeEqRef?.nativeElement)   this.mqOdeEqRef.nativeElement.innerHTML = '';
  }

  calculate(): void {
    this.submit$.next();
  }

  private clearResults(): void {
    this.directResult.set(null);
    this.inverseResult.set(null);
    this.odeResult.set(null);
    this.errorMsg.set(null);
    this.paramValues.set({});
    this.customConstName.set(null);
    this.pzResult.set(null);
    this.pzError.set(null);
    this.showComplexPlane.set(false);
    this.complexParamValues.set({});
    this.complexDetectedParams.set([]);
  }

  // ── Alt forms ─────────────────────────────────────────────────────────────

  private _runAltForms(
    main: { maxima: string; tex: string },
    formsSig: ReturnType<typeof signal<AltForm[]>>,
    loadingSig: ReturnType<typeof signal<boolean>>,
  ): void {
    formsSig.set([]);
    loadingSig.set(true);
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
        results.forEach((r: SimplifyResponse | null, i) => {
          if (!r) return;
          const { tex, maxima } = r.simplified;
          if (!tex || !maxima) return;
          const key = normalize(tex);
          if (seenTex.has(key)) return;
          seenTex.add(key);
          forms.push({ labelKey: profiles[i].labelKey, tex, maxima });
        });
        formsSig.set(forms);
        loadingSig.set(false);
      });
  }

  // ── Computed helpers ──────────────────────────────────────────────────────

  readonly hasDirectResult  = computed(() => this.directResult() !== null);
  readonly hasInverseResult = computed(() => this.inverseResult() !== null);
  readonly hasOdeResult     = computed(() => this.odeResult() !== null);
  readonly hasResult        = computed(() =>
    this.hasDirectResult() || this.hasInverseResult() || this.hasOdeResult()
  );

  // ── Complex plane panel ───────────────────────────────────────────────────

  readonly showComplexPlane       = signal(false);
  readonly complexPlaneBtnPulse   = signal(false);
  readonly complexPlaneMode    = signal<'2d' | '3d'>('2d');
  readonly complexColorScheme  = signal<'classic' | 'phase' | 'magnitude'>('classic');
  readonly complexWireframe    = signal(false);
  readonly complexShowGrid3d   = signal(true);
  readonly complexResolution   = signal(80);
  readonly complexRange3d      = signal(4);
  readonly complexHeightScale  = signal(1.0);
  readonly complexZClip        = signal(5.0);
  readonly complexParamValues  = signal<ParamValues>({});
  readonly complexDetectedParams = signal<string[]>([]);
  readonly pzLoading         = signal(false);
  readonly pzResult          = signal<LaplacePoleZeroResponse | null>(null);
  readonly pzError           = signal<string | null>(null);

  /** F(s) expression currently shown in the complex plane (Maxima syntax). */
  readonly complexPlaneExpr = computed<string>(() => {
    const r = this.directResult();
    if (r?.F?.maxima) return r.F.maxima;
    const ri = this.inverseResult();
    if (ri) return this.inverseExpr();  // F(s) is the input for inverse mode
    return '';
  });

  private _pulseBtnOnce(): void {
    this.complexPlaneBtnPulse.set(true);
    setTimeout(() => this.complexPlaneBtnPulse.set(false), 1800);
  }

  toggleComplexPlane(): void {
    const next = !this.showComplexPlane();
    this.showComplexPlane.set(next);
    if (next && !this.pzLoading() && this.pzResult() === null) this.loadPoleZero();
  }

  toggleComplexPlaneAndOpenSettings(): void {
    this.toggleComplexPlane();
    if (this.showComplexPlane()) this.showCanvasSettings.set(true);
  }

  loadPoleZero(): void {
    const expr = this.complexPlaneExpr();
    if (!expr) return;
    this.pzLoading.set(true);
    this.pzError.set(null);
    this.api.calculateLaplacePoleZero({ expression: expr, freqVar: this.freqVar() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => { this.pzResult.set(r); this.pzLoading.set(false); },
        error: (e) => { this.pzError.set(formatApiError(e, 'Error al calcular polos/ceros')); this.pzLoading.set(false); },
      });
  }

  // ── Share ─────────────────────────────────────────────────────────────────

  get shareHref(): string {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }

  openShareDialog(): void {
    this.showShareDialog.set(true);
  }

  async copyShareUrl(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.urlCopied.set(true);
      setTimeout(() => this.urlCopied.set(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  // ── Favorites ─────────────────────────────────────────────────────────────

  openFavoriteDialog(): void {
    const entry = this.latestHistoryEntry();
    if (entry) {
      this.doToggle(entry);
    } else {
      this.favoriteLoading.set(true);
      this.fetchLatestEntry(() => {
        this.favoriteLoading.set(false);
        const loaded = this.latestHistoryEntry();
        if (loaded) this.doToggle(loaded);
      });
    }
  }

  onFavoriteConfirmed(name: string): void {
    const entry = this.latestHistoryEntry();
    if (!entry) return;
    this.favoriteLoading.set(true);
    this.showFavoriteDialog.set(false);
    this.api
      .toggleFavorite(entry.id, name.trim() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.latestHistoryEntry.set(updated);
          this.favoriteLoading.set(false);
        },
        error: () => this.favoriteLoading.set(false),
      });
  }

  cancelFavoriteDialog(): void {
    this.showFavoriteDialog.set(false);
  }

  private fetchLatestEntry(callback?: () => void): void {
    this.api
      .getHistory({ limit: 1 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((res) => {
          const latest = res.entries[0] ?? null;
          if (!latest || latest.isFavorite) return of(latest);
          return this.api.getHistory({ favorites: true, limit: 1 }).pipe(
            map((favRes) => {
              const fav = favRes.entries[0];
              return fav && JSON.stringify(fav.input) === JSON.stringify(latest.input)
                ? fav
                : latest;
            }),
            catchError(() => of(latest)),
          );
        }),
      )
      .subscribe({
        next: (entry) => {
          this.latestHistoryEntry.set(entry);
          callback?.();
        },
        error: () => callback?.(),
      });
  }

  private doToggle(entry: HistoryEntry): void {
    if (entry.isFavorite) {
      this.favoriteLoading.set(true);
      this.api
        .toggleFavorite(entry.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            this.latestHistoryEntry.set(updated);
            this.favoriteLoading.set(false);
          },
          error: () => this.favoriteLoading.set(false),
        });
    } else {
      this.showFavoriteDialog.set(true);
    }
  }
}
