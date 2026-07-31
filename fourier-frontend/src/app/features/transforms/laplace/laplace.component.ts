import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  DestroyRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, filter, of, Subject, switchMap, take, timer } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

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
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import type {
  LaplaceDirectResponse,
  LaplaceInverseResponse,
  LaplaceOdeResponse,
  LaplaceIcCondition,
} from '../../../domain/types/transform.types';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { ExportButtonComponent } from '../../../shared/components/export-button/export-button.component';

export type LaplaceMode = 'direct' | 'inverse' | 'ode';

let _nextId = 0;
const mkId = () => `lp-${++_nextId}`;

function defaultSegment(): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: 'sin(t)',
    expressionTex: '\\sin(t)',
    from: '0',
    fromTex: '0',
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
  { id: 't-s', time: 't', freq: 's', timeDisplay: 't', freqDisplay: 's' },
  { id: 't-p', time: 't', freq: 'p', timeDisplay: 't', freqDisplay: 'p' },
  { id: 'x-s', time: 'x', freq: 's', timeDisplay: 'x', freqDisplay: 's' },
  { id: 'tau-s', time: 'tau', freq: 's', timeDisplay: 'τ', freqDisplay: 's' },
];

@Component({
  selector: 'app-laplace',
  templateUrl: './laplace.component.html',
  imports: [
    NavComponent,
    NgTemplateOutlet,
    MathjaxDirective,
    TransformSegmentComponent,
    FormsModule,
    TranslocoPipe,
    MobileMathKeyboardComponent,
    FunctionPlotComponent,
    ParamSlidersComponent,
    FooterComponent,
    ExportButtonComponent,
  ],
})
export class LaplaceComponent implements OnInit, AfterViewChecked, OnDestroy {
  readonly api        = inject(ApiService);
  readonly userStore  = inject(UserStore);
  private readonly transloco  = inject(TranslocoService);
  private readonly seo        = inject(SeoService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  readonly destroyRef = inject(DestroyRef);
  readonly mqs                = inject(MathquillService);
  private readonly tex2max    = inject(LatexToMaximaService);
  private readonly plotter    = inject(PlottingService);
  private readonly mathUtils  = inject(MathUtilsService);

  @ViewChild('mqInverseExpr') private mqInverseRef!: ElementRef<HTMLElement>;
  @ViewChild('canvasWrapperRef') private canvasWrapperRef!: ElementRef<HTMLElement>;
  readonly plotComponent = viewChild(FunctionPlotComponent);

  inverseField: MathField | null = null;
  private _mqInverseInited = false;
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
    { label: 'δ(□)', typedText: 'delta(' },
    { label: 'u(□)', typedText: 'heaviside(' },
    { label: '∞', write: '\\infty' },
  ];

  readonly keyGroups: KeyBtn[][] = [
    // Row 1: Funciones especiales de Laplace
    [
      { label: 'u(□)',    writeWithCursor: '\\operatorname{u}\\left(\\right)' },
      { label: 'δ(□)',    writeWithCursor: '\\operatorname{delta}\\left(\\right)' },
      { label: 'sgn(□)', writeWithCursor: '\\operatorname{sgn}\\left(\\right)' },
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
      { label: '∞', write: '\\infty' },
      { label: '−', write: '-' },
      { label: '⌫', keystroke: 'Backspace' },
    ],
  ];

  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  // ── Canvas overlay state ───────────────────────────────────────────────────

  readonly showCanvasSettings = signal(false);
  readonly isMobile = signal(typeof window !== 'undefined' && window.innerWidth < 1024);
  readonly isFullscreen = signal(false);

  // ── Canvas line style ─────────────────────────────────────────────────────

  readonly inputColor     = signal('#dc2626');
  readonly inputLineWidth = signal(2);
  readonly inputDashed    = signal(false);
  readonly resultColor    = signal('#2563eb');
  readonly resultLineWidth = signal(2);
  readonly resultDashed   = signal(false);

  resetLineStyles(): void {
    this.inputColor.set('#dc2626');
    this.inputLineWidth.set(2);
    this.inputDashed.set(false);
    this.resultColor.set('#2563eb');
    this.resultLineWidth.set(2);
    this.resultDashed.set(false);
  }

  // ── Variables ─────────────────────────────────────────────────────────────

  readonly varPairs = VAR_PAIRS;
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
    { id: 'ode',     labelKey: 'laplace.modeOde' },
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
      this.odeIcs.set([{ order: 0, value: '0' }, { order: 1, value: '0' }]);
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
    this.showCanvasSettings.set(false);
    this.resetLineStyles();
  }

  // ── Free parameters ───────────────────────────────────────────────────────

  readonly paramValues = signal<ParamValues>({});

  readonly activeParams = computed<string[]>(() =>
    this.directResult()?.params ?? this.inverseResult()?.params ?? [],
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
  readonly directResult = signal<LaplaceDirectResponse | null>(null);

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

  readonly inverseExpr    = signal('1/(s^2+1)');
  readonly inverseExprTex = signal('\\frac{1}{s^2+1}');
  readonly inverseResult  = signal<LaplaceInverseResponse | null>(null);
  readonly inverseDefault = '\\frac{1}{s^2+1}';

  // ── ODE mode ─────────────────────────────────────────────────────────────

  readonly odeEquation = signal('');
  readonly odeUnknown  = signal('y(t)');
  readonly odeIcs      = signal<Array<{ order: number; value: string }>>([
    { order: 0, value: '0' },
    { order: 1, value: '0' },
  ]);
  readonly odeResult   = signal<LaplaceOdeResponse | null>(null);

  addIc(): void {
    const nextOrder = this.odeIcs().length;
    this.odeIcs.update(ics => [...ics, { order: nextOrder, value: '0' }]);
  }

  removeIc(index: number): void {
    this.odeIcs.update(ics => ics.filter((_, i) => i !== index));
  }

  updateIcValue(index: number, value: string): void {
    this.odeIcs.update(ics => ics.map((ic, i) => i === index ? { ...ic, value } : ic));
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

  // ── Canvas overlay actions ─────────────────────────────────────────────────

  toggleFullscreen(): void {
    const el = this.canvasWrapperRef?.nativeElement;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }

  downloadCanvas(): void {
    const canvas = this.canvasWrapperRef?.nativeElement?.querySelector('canvas');
    if (!canvas) return;
    const url = (canvas as HTMLCanvasElement).toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'laplace-transform.png';
    a.click();
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
        state['eq'] = this.odeEquation();
        state['unk'] = this.odeUnknown();
        state['ics'] = this.odeIcs();
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
        if (typeof s['eq'] === 'string') this.odeEquation.set(s['eq']);
        if (typeof s['unk'] === 'string') this.odeUnknown.set(s['unk']);
        if (Array.isArray(s['ics'])) this.odeIcs.set(s['ics'] as Array<{ order: number; value: string }>);
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
      'Laplace transform calculator, transformada de Laplace, inverse Laplace, ODE solver, partial fractions, differential equations, Laplace method, transformada inversa de Laplace',
    );

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.isMobile.set(window.innerWidth < 1024));
      document.addEventListener('fullscreenchange', () => {
        this.isFullscreen.set(!!document.fullscreenElement);
      });
    }

    this.submit$.pipe(
      debounceTime(50),
      switchMap(() => {
        this.loading.set(true);
        this.errorMsg.set(null);
        this.paramValues.set({});

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
        }));
        return this.api.calculateLaplaceOde({
          equation: eq,
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
      if (m === 'direct')  { this.directResult.set(result as LaplaceDirectResponse); this.plotComponent()?.resetView(); }
      if (m === 'inverse') { this.inverseResult.set(result as LaplaceInverseResponse); this.plotComponent()?.resetView(); }
      if (m === 'ode')     { this.odeResult.set(result as LaplaceOdeResponse); this.plotComponent()?.resetView(); }
    });
  }

  ngAfterViewChecked(): void {
    if (this._mqInverseInited || !this.mqInverseRef?.nativeElement) return;
    this._mqInverseInited = true;
    void this.initInverseField();
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

  ngOnDestroy(): void {
    if (this.mqInverseRef?.nativeElement) this.mqInverseRef.nativeElement.innerHTML = '';
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
  }

  // ── Computed helpers ──────────────────────────────────────────────────────

  readonly hasDirectResult  = computed(() => this.directResult() !== null);
  readonly hasInverseResult = computed(() => this.inverseResult() !== null);
  readonly hasOdeResult     = computed(() => this.odeResult() !== null);
  readonly hasResult        = computed(() =>
    this.hasDirectResult() || this.hasInverseResult() || this.hasOdeResult()
  );
}
