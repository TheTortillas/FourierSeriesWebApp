import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SegmentDraft, CalculatorStore } from '../../store/calculator.store';
import { MathquillService, MathField } from '../../../../core/services/math/mathquill.service';
import { LatexToMaximaService } from '../../../../core/services/math/latex-to-maxima.service';

export interface KeyBtn {
  label: string;
  typedText?: string;
  cmd?: string;
  write?: string;
  keystroke?: string;
}

@Component({
  selector: 'app-segment-input',
  templateUrl: './segment-input.component.html',
  imports: [TranslocoPipe],
})
export class SegmentInputComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mqExpr') mqExprRef!: ElementRef<HTMLElement>;
  @ViewChild('mqFrom') mqFromRef!: ElementRef<HTMLElement>;
  @ViewChild('mqTo') mqToRef!: ElementRef<HTMLElement>;

  readonly store = inject(CalculatorStore);
  readonly mqs = inject(MathquillService);
  readonly tex2max = inject(LatexToMaximaService);
  private readonly transloco = inject(TranslocoService);

  get activeFieldName(): string {
    if (this.focusedFieldIdx === 0) return `f(${this.store.intVar()})`;
    if (this.focusedFieldIdx === 1) return this.transloco.translate('calculator.segment.from');
    return this.transloco.translate('calculator.segment.to');
  }

  readonly segment = input.required<SegmentDraft>();
  readonly index = input.required<number>();
  readonly isOnly = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly continuityError = input<string | null>(null);
  /** Truthy when the previous segment has a gap with this one — highlights the `from` field. */
  readonly prevContinuityError = input<string | null>(null);
  /** Truthy when from >= to (definitively invalid, symbolic intervals are 'unknown' and ignored). */
  readonly orderError = input<boolean>(false);

  showKeyboard = false;
  focusedFieldIdx: 0 | 1 | 2 = 0;
  conversionErrors: [string | null, string | null, string | null] = [null, null, null];
  fields: [MathField | null, MathField | null, MathField | null] = [null, null, null];

  // Guard against latex() setter triggering the edit handler
  private _syncingFromStore = false;

  // One Subject per field — each emits the raw LaTeX string when the user types.
  // debounceTime + switchMap in ngAfterViewInit convert it to a Maxima string via API.
  private readonly fieldSubjects: [Subject<string>, Subject<string>, Subject<string>] = [
    new Subject<string>(),
    new Subject<string>(),
    new Subject<string>(),
  ];
  private readonly _subs = new Subscription();

  // ── Math keyboard button groups ────────────────────────────────────────────

  readonly keyGroups: KeyBtn[][] = [
    // Basic trig
    [
      { label: 'sin', typedText: 'sin(' },
      { label: 'cos', typedText: 'cos(' },
      { label: 'tan', typedText: 'tan(' },
      { label: 'cot', typedText: 'cot(' },
      { label: 'sec', typedText: 'sec(' },
      { label: 'csc', typedText: 'csc(' },
    ],
    // Inverse trig
    [
      { label: 'asin', typedText: 'asin(' },
      { label: 'acos', typedText: 'acos(' },
      { label: 'atan', typedText: 'atan(' },
      { label: 'acot', typedText: 'acot(' },
      { label: 'asec', typedText: 'asec(' },
      { label: 'acsc', typedText: 'acsc(' },
    ],
    // Hyperbolic + inverse hyperbolic
    [
      { label: 'sinh', typedText: 'sinh(' },
      { label: 'cosh', typedText: 'cosh(' },
      { label: 'tanh', typedText: 'tanh(' },
      { label: 'asinh', typedText: 'asinh(' },
      { label: 'acosh', typedText: 'acosh(' },
      { label: 'atanh', typedText: 'atanh(' },
    ],
    // Misc
    [
      { label: 'log', typedText: 'log(' },
      { label: 'ln', typedText: 'ln(' },
      { label: 'exp', typedText: 'exp(' },
      { label: '\\', typedText: '\\' },
      { label: 'Γ(·)', write: '\\Gamma(' },
      { label: 'n!', typedText: 'factorial(' },
      { label: 'x!', typedText: '!' },
      { label: '√·', cmd: '\\sqrt' },
      { label: '|·|', typedText: 'abs(' },
      { label: 'π', typedText: 'pi' },
      { label: 'eˣ', typedText: 'e^' },
      { label: 'xⁿ', typedText: '^' },
      { label: '(', typedText: '(' },
      { label: ')', typedText: ')' },
      { label: '−', write: '-' },
      { label: '/', typedText: '/' },
      { label: '⌫', keystroke: 'Backspace' },
    ],
  ];

  constructor() {
    // Sync MathQuill display whenever the store segment or intVar changes
    effect(() => {
      this.store.intVar(); // subscribe so rename triggers sync
      const seg = this.segment();
      const pairs: [number, string][] = [
        [0, seg.expressionTex || ''],
        [1, seg.fromTex || ''],
        [2, seg.toTex || ''],
      ];
      this._syncingFromStore = true;
      for (const [i, tex] of pairs) {
        const f = this.fields[i];
        if (f && f.latex() !== tex) f.latex(tex);
      }
      this._syncingFromStore = false;
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const keys: Array<
      [0 | 1 | 2, keyof Omit<SegmentDraft, 'id'>, keyof Omit<SegmentDraft, 'id'>, string]
    > = [
      [0, 'expression', 'expressionTex', this.segment().expressionTex],
      [1, 'from', 'fromTex', this.segment().fromTex],
      [2, 'to', 'toTex', this.segment().toTex],
    ];
    const refs = [this.mqExprRef, this.mqFromRef, this.mqToRef];

    for (const [i, maximaKey, texKey, initialLatex] of keys) {
      const el = refs[i].nativeElement;
      const field = await this.mqs.createField(el, {
        ...this.mqs.defaultConfig(),
        handlers: {
          edit: (mf: MathField) => {
            if (this._syncingFromStore) return;
            const latexRaw = mf.latex();
            if (!latexRaw.trim()) {
              this.conversionErrors[i] = null;
              this.store.updateSegment(this.segment().id, { [maximaKey]: '', [texKey]: '' });
              return;
            }
            // Update LaTeX immediately so the MathJax preview refreshes without delay
            this.store.updateSegment(this.segment().id, { [texKey]: latexRaw });
            // Debounced: send to backend for Maxima conversion
            this.fieldSubjects[i].next(latexRaw);
          },
        },
      });
      this.fields[i] = field;

      // Set initial LaTeX without triggering the edit handler
      if (initialLatex && field) {
        this._syncingFromStore = true;
        field.latex(initialLatex);
        this._syncingFromStore = false;
      }

      // Subscribe: debounce → parse API → update Maxima in store
      this._subs.add(
        this.fieldSubjects[i].pipe(
          debounceTime(350),
          switchMap((latexRaw) => this.tex2max.convert(latexRaw)),
        ).subscribe((result) => {
          if (result.ok) {
            this.conversionErrors[i] = null;
            this.store.updateSegment(this.segment().id, { [maximaKey]: result.maxima });
          } else {
            this.conversionErrors[i] = result.error ?? null;
            this.store.updateSegment(this.segment().id, { [maximaKey]: '' });
          }
        }),
      );
    }
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
    for (const s of this.fieldSubjects) s.complete();
    for (const ref of [this.mqExprRef, this.mqFromRef, this.mqToRef]) {
      if (ref?.nativeElement) ref.nativeElement.innerHTML = '';
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === '^') {
      const field = this.fields[this.focusedFieldIdx];
      if (field) {
        e.preventDefault();
        field.typedText('^');
      }
    } else if (e.key === '\\' || e.code === 'Backslash' || e.code === 'IntlBackslash') {
      const field = this.fields[this.focusedFieldIdx];
      if (field) {
        e.preventDefault();
        field.typedText('\\');
      }
    }
  }

  focusField(idx: 0 | 1 | 2): void {
    this.focusedFieldIdx = idx;
    this.fields[idx]?.focus();
  }

  insertKey(btn: KeyBtn): void {
    const field = this.fields[this.focusedFieldIdx];
    if (!field) return;
    field.focus();
    if (btn.label === 'Γ(·)') {
      field.write('\\Gamma\\left(\\right)');
      field.keystroke('Left');
      return;
    }
    if (btn.label === 'exp') {
      field.write('\\operatorname{exp}\\left(\\right)');
      field.keystroke('Left');
      return;
    }
    if (btn.typedText !== undefined) field.typedText(btn.typedText);
    else if (btn.cmd !== undefined) field.cmd(btn.cmd);
    else if (btn.write !== undefined) field.write(btn.write);
    else if (btn.keystroke !== undefined) field.keystroke(btn.keystroke);
  }

  readonly hasExpressionError = () => !!this.error() && !this.segment().expression.trim();

  wrapClass(hasError: boolean, hasWarning = false): string {
    const base =
      'w-full px-2 py-1.5 min-h-[2.25rem] text-sm rounded border cursor-text ' +
      'bg-paper2 dark:bg-dark-surface2 ' +
      'focus-within:ring-1 transition-colors';
    if (hasError) return `${base} border-red-400 focus-within:ring-red-400`;
    if (hasWarning) return `${base} border-amber-400 focus-within:ring-amber-400`;
    return `${base} border-border dark:border-dark-border focus-within:border-accent focus-within:ring-accent`;
  }
}
