import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MathquillService, MathField } from '../../../core/services/math/mathquill.service';
import { LatexToMaximaService } from '../../../core/services/math/latex-to-maxima.service';

export interface TransformSegmentDraft {
  id: string;
  expression: string;
  expressionTex: string;
  from: string;
  fromTex: string;
  to: string;
  toTex: string;
}

@Component({
  selector: 'app-transform-segment',
  templateUrl: './transform-segment.component.html',
  imports: [TranslocoPipe],
})
export class TransformSegmentComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mqExpr') mqExprRef!: ElementRef<HTMLElement>;
  @ViewChild('mqFrom') mqFromRef!: ElementRef<HTMLElement>;
  @ViewChild('mqTo') mqToRef!: ElementRef<HTMLElement>;

  readonly mqs = inject(MathquillService);
  readonly tex2max = inject(LatexToMaximaService);
  private readonly transloco = inject(TranslocoService);
  private readonly elRef = inject(ElementRef<HTMLElement>);

  readonly segment = input.required<TransformSegmentDraft>();
  readonly index = input.required<number>();
  readonly isOnly = input<boolean>(false);
  readonly intVar = input<string>('t');
  readonly error = input<string | null>(null);
  readonly continuityError = input<string | null>(null);
  readonly prevContinuityError = input<string | null>(null);
  readonly orderError = input<boolean>(false);

  readonly updated = output<{ id: string; changes: Partial<TransformSegmentDraft> }>();
  readonly removed = output<string>();

  focusedFieldIdx: 0 | 1 | 2 = 0;
  conversionErrors: [string | null, string | null, string | null] = [null, null, null];
  fields: [MathField | null, MathField | null, MathField | null] = [null, null, null];

  private _syncing = false;
  private readonly _specialCapture = this.mqs.createSpecialKeyCapture(
    () => this.fields[this.focusedFieldIdx],
  );

  // Only TeX signals — prevents backend Maxima updates from ejecting the cursor
  private readonly exprTex = computed(() => this.segment().expressionTex);
  private readonly fromTex_ = computed(() => this.segment().fromTex);
  private readonly toTex_ = computed(() => this.segment().toTex);

  private readonly fieldSubjects: [Subject<string>, Subject<string>, Subject<string>] = [
    new Subject<string>(),
    new Subject<string>(),
    new Subject<string>(),
  ];
  private readonly _subs = new Subscription();

  constructor() {
    effect(() => {
      const pairs: [number, string][] = [
        [0, this.exprTex() || ''],
        [1, this.fromTex_() || ''],
        [2, this.toTex_() || ''],
      ];
      this._syncing = true;
      try {
        for (const [i, tex] of pairs) {
          const f = this.fields[i];
          if (f && f.latex() !== tex) f.latex(tex);
        }
      } finally {
        this._syncing = false;
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    this.elRef.nativeElement.addEventListener('keydown', this._specialCapture, true);
    this.elRef.nativeElement.addEventListener(
      'beforeinput',
      this._specialCapture as EventListener,
      true,
    );
    type Key = [
      0 | 1 | 2,
      keyof Pick<TransformSegmentDraft, 'expression' | 'from' | 'to'>,
      keyof Pick<TransformSegmentDraft, 'expressionTex' | 'fromTex' | 'toTex'>,
      string,
    ];
    const keys: Key[] = [
      [0, 'expression', 'expressionTex', this.segment().expressionTex],
      [1, 'from', 'fromTex', this.segment().fromTex],
      [2, 'to', 'toTex', this.segment().toTex],
    ];
    const refs = [this.mqExprRef, this.mqFromRef, this.mqToRef];

    for (const [i, maximaKey, texKey, initialLatex] of keys) {
      const field = await this.mqs.createField(refs[i].nativeElement, {
        ...this.mqs.defaultConfig(),
        handlers: {
          edit: (mf: MathField) => {
            if (this._syncing) return;
            const latexRaw = mf.latex();
            if (!latexRaw.trim()) {
              this.conversionErrors[i] = null;
              this.updated.emit({
                id: this.segment().id,
                changes: { [maximaKey]: '', [texKey]: '' },
              });
              return;
            }
            this.updated.emit({ id: this.segment().id, changes: { [texKey]: latexRaw } });
            this.fieldSubjects[i].next(latexRaw);
          },
        },
      });
      this.fields[i] = field;

      if (initialLatex && field) {
        this._syncing = true;
        field.latex(initialLatex);
        this._syncing = false;
      }

      this._subs.add(
        this.fieldSubjects[i]
          .pipe(
            debounceTime(350),
            switchMap((latexRaw) => this.tex2max.convertForTransforms(latexRaw)),
          )
          .subscribe((result) => {
            if (result.ok) {
              this.conversionErrors[i] = null;
              this.updated.emit({ id: this.segment().id, changes: { [maximaKey]: result.maxima } });
            } else {
              this.conversionErrors[i] = result.error ?? null;
              this.updated.emit({ id: this.segment().id, changes: { [maximaKey]: '' } });
            }
          }),
      );
    }
  }

  ngOnDestroy(): void {
    this.elRef.nativeElement.removeEventListener('keydown', this._specialCapture, true);
    this.elRef.nativeElement.removeEventListener(
      'beforeinput',
      this._specialCapture as EventListener,
      true,
    );
    this._subs.unsubscribe();
    for (const s of this.fieldSubjects) s.complete();
    for (const ref of [this.mqExprRef, this.mqFromRef, this.mqToRef]) {
      if (ref?.nativeElement) ref.nativeElement.innerHTML = '';
    }
  }

  onKeyDown(e: KeyboardEvent): void {
    const field = this.fields[this.focusedFieldIdx];
    if (!field) return;
    if (e.key === '\\') {
      e.preventDefault();
      field.typedText('\\');
    }
  }

  /** Called from (focusin) on each field wrapper and from (click) → focusField. */
  onFocusIn(idx: 0 | 1 | 2): void {
    this.focusedFieldIdx = idx;
    const names: [string, string, string] = [
      `f(${this.intVar()})`,
      this.transloco.translate('calculator.segment.from'),
      this.transloco.translate('calculator.segment.to'),
    ];
    this.mqs.setActiveField(this.fields[idx], names[idx]);
  }

  focusField(idx: 0 | 1 | 2): void {
    this.onFocusIn(idx);
    this.fields[idx]?.focus();
  }

  readonly hasExpressionError = () => !!this.error() && !this.segment().expression.trim();

  wrapClass(hasError: boolean, hasWarning = false): string {
    const base =
      'w-full h-full px-3 py-2 min-h-[2.5rem] text-sm rounded border cursor-text ' +
      'bg-paper2 dark:bg-dark-surface2 focus-within:ring-1 transition-colors flex items-center';
    if (hasError) return `${base} border-red-400 focus-within:ring-red-400`;
    if (hasWarning) return `${base} border-amber-400 focus-within:ring-amber-400`;
    return `${base} border-border dark:border-dark-border focus-within:border-accent focus-within:ring-accent`;
  }
}
