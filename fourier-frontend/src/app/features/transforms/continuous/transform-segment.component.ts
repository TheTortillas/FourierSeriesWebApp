import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
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

interface KeyBtn {
  label: string;
  typedText?: string;
  cmd?: string;
  write?: string;
  keystroke?: string;
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

  get activeFieldName(): string {
    if (this.focusedFieldIdx === 0) return `f(${this.intVar()})`;
    if (this.focusedFieldIdx === 1) return this.transloco.translate('calculator.segment.from');
    return this.transloco.translate('calculator.segment.to');
  }

  readonly segment = input.required<TransformSegmentDraft>();
  readonly index = input.required<number>();
  readonly isOnly = input<boolean>(false);
  readonly intVar = input<string>('t');
  readonly error = input<string | null>(null);

  readonly updated = output<{ id: string; changes: Partial<TransformSegmentDraft> }>();
  readonly removed = output<string>();

  showKeyboard = false;
  focusedFieldIdx: 0 | 1 | 2 = 0;
  conversionErrors: [string | null, string | null, string | null] = [null, null, null];
  fields: [MathField | null, MathField | null, MathField | null] = [null, null, null];
  private _syncing = false;

  private readonly fieldSubjects: [Subject<string>, Subject<string>, Subject<string>] = [
    new Subject<string>(),
    new Subject<string>(),
    new Subject<string>(),
  ];
  private readonly _subs = new Subscription();

  readonly keyGroups: KeyBtn[][] = [
    // Special functions for transforms
    [
      { label: 'δ(·)', typedText: 'delta(' },
      { label: 'u(·)', typedText: 'u(' },
      { label: 'sgn', typedText: 'sgn(' },
      { label: 'i', write: '\\mathrm{i}' },
      { label: '∞', write: '\\infty' },
      { label: '-∞', write: '-\\infty' },
    ],
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
    effect(() => {
      const seg = this.segment();
      const pairs: [number, string][] = [
        [0, seg.expressionTex || ''],
        [1, seg.fromTex || ''],
        [2, seg.toTex || ''],
      ];
      this._syncing = true;
      for (const [i, tex] of pairs) {
        const f = this.fields[i];
        if (f && f.latex() !== tex) f.latex(tex);
      }
      this._syncing = false;
    });
  }

  async ngAfterViewInit(): Promise<void> {
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
            // Update LaTeX immediately so the MathJax preview refreshes without delay
            this.updated.emit({ id: this.segment().id, changes: { [texKey]: latexRaw } });
            // Debounced: send to backend for Maxima conversion
            this.fieldSubjects[i].next(latexRaw);
          },
        },
      });
      this.fields[i] = field;

      // Set initial LaTeX without triggering the edit handler
      if (initialLatex && field) {
        this._syncing = true;
        field.latex(initialLatex);
        this._syncing = false;
      }

      // Subscribe: debounce → parse API → emit Maxima update
      this._subs.add(
        this.fieldSubjects[i].pipe(
          debounceTime(350),
          switchMap((latexRaw) => this.tex2max.convertForTransforms(latexRaw)),
        ).subscribe((result) => {
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
    this._subs.unsubscribe();
    for (const s of this.fieldSubjects) s.complete();
    for (const ref of [this.mqExprRef, this.mqFromRef, this.mqToRef]) {
      if (ref?.nativeElement) ref.nativeElement.innerHTML = '';
    }
  }

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
    if (btn.label === 'δ(·)') {
      field.write('\\delta\\left(\\right)');
      field.keystroke('Left');
      return;
    }
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

  wrapClass(hasError: boolean): string {
    const base =
      'w-full px-2 py-1 min-h-[2rem] text-sm rounded border cursor-text ' +
      'bg-paper2 dark:bg-dark-surface2 focus-within:ring-1 transition-colors';
    return hasError
      ? `${base} border-red-400 focus-within:ring-red-400`
      : `${base} border-border dark:border-dark-border focus-within:border-accent focus-within:ring-accent`;
  }
}
