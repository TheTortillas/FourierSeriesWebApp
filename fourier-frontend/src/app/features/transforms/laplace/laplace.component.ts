import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';
import { RouterLink } from '@angular/router';

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
import type {
  LaplaceDirectResponse,
  LaplaceInverseResponse,
  LaplaceOdeResponse,
  LaplaceIcCondition,
} from '../../../domain/types/transform.types';
import { FooterComponent } from '../../../shared/components/footer/footer.component';

export type LaplaceMode = 'direct' | 'inverse' | 'ode';

let _nextId = 0;
const mkId = () => `lp-${++_nextId}`;

function defaultSegment(): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: '1',
    expressionTex: '1',
    from: '0',
    fromTex: '0',
    to: '1',
    toTex: '1',
  };
}

@Component({
  selector: 'app-laplace',
  templateUrl: './laplace.component.html',
  imports: [
    NavComponent,
    MathjaxDirective,
    TransformSegmentComponent,
    FormsModule,
    TranslocoPipe,
    MobileMathKeyboardComponent,
    RouterLink,
    FooterComponent,
  ],
})
export class LaplaceComponent implements OnInit, AfterViewChecked, OnDestroy {
  readonly api        = inject(ApiService);
  readonly userStore  = inject(UserStore);
  private readonly transloco = inject(TranslocoService);
  private readonly seo       = inject(SeoService);
  readonly destroyRef = inject(DestroyRef);
  private readonly mqs       = inject(MathquillService);
  private readonly tex2max   = inject(LatexToMaximaService);

  @ViewChild('mqInverseExpr') private mqInverseRef!: ElementRef<HTMLElement>;

  inverseField: MathField | null = null;
  private _mqInverseInited = false;

  showKeyboard = false;

  readonly mobileExtraGroup: KeyBtn[] = [
    { label: 'δ(□)', typedText: 'delta(' },
    { label: 'u(□)', typedText: 'heaviside(' },
    { label: '∞', write: '\\infty' },
  ];

  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

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
  }

  // ── Shared state ─────────────────────────────────────────────────────────

  readonly loading   = signal(false);
  readonly errorMsg  = signal<string | null>(null);

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

  readonly inverseExpr    = signal('4/(s-2) - 3/(s+5)');
  readonly inverseResult  = signal<LaplaceInverseResponse | null>(null);
  readonly inverseDefault = '\\frac{4}{s-2}-\\frac{3}{s+5}';

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

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private readonly submit$ = new Subject<void>();

  ngOnInit(): void {
    this.seo.setPage(
      'seo.laplace.title',
      'seo.laplace.description',
      'Laplace transform calculator, transformada de Laplace, inverse Laplace, ODE solver, partial fractions, differential equations, Laplace method, transformada inversa de Laplace',
    );

    this.submit$.pipe(
      debounceTime(50),
      switchMap(() => {
        this.loading.set(true);
        this.errorMsg.set(null);

        const m = this.mode();
        if (m === 'direct') {
          const validSegs = this.segments().filter(s => s.expression.trim());
          if (!validSegs.length) {
            this.loading.set(false);
            this.errorMsg.set(this.transloco.translate('laplace.errorNoSegments'));
            return of(null);
          }
          return this.api.calculateLaplaceDirect({
            segments: validSegs.map(s => ({ expression: s.expression, from: s.from, to: s.to })),
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
          return this.api.calculateLaplaceInverse({ expression: expr }).pipe(
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
        return this.api.calculateLaplaceOde({ equation: eq, unknown: unk, initialConditions: ics }).pipe(
          catchError(err => { this.errorMsg.set(formatApiError(err, 'Error al calcular')); return of(null); }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      this.loading.set(false);
      if (result === null) return;
      const m = this.mode();
      if (m === 'direct')  this.directResult.set(result as LaplaceDirectResponse);
      if (m === 'inverse') this.inverseResult.set(result as LaplaceInverseResponse);
      if (m === 'ode')     this.odeResult.set(result as LaplaceOdeResponse);
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
          if (!latex.trim()) { this.inverseExpr.set(''); return; }
          this.tex2max.convertWithSpecialFns(latex).subscribe(r => {
            if (r.ok) this.inverseExpr.set(r.maxima);
          });
        },
        enter: () => this.calculate(),
      },
    });
    this.inverseField = field;
    if (field) field.latex(this.inverseDefault);
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
  }

  // ── Computed helpers ──────────────────────────────────────────────────────

  readonly hasDirectResult  = computed(() => this.directResult() !== null);
  readonly hasInverseResult = computed(() => this.inverseResult() !== null);
  readonly hasOdeResult     = computed(() => this.odeResult() !== null);
  readonly hasResult        = computed(() =>
    this.hasDirectResult() || this.hasInverseResult() || this.hasOdeResult()
  );
}
