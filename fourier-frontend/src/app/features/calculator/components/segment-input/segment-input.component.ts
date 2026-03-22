import {
  AfterViewInit, Component, ElementRef, OnDestroy,
  ViewChild, effect, inject, input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SegmentDraft, CalculatorStore } from '../../store/calculator.store';
import { MathquillService, MathField } from '../../../../core/services/math/mathquill.service';
import { LatexToMaximaService } from '../../../../core/services/math/latex-to-maxima.service';

/**
 * One row of the piecewise function input.
 * All three fields (expression, from, to) use MathQuill.
 * LaTeX → tex2max → Maxima is stored in the draft.
 */
@Component({
  selector: 'app-segment-input',
  imports: [FormsModule],
  template: `
    <div class="flex items-start gap-2 group">

      <!-- Segment index badge -->
      <div class="shrink-0 w-5 h-8 flex items-center justify-center
                  text-xs text-muted font-mono mt-5">
        {{ index() + 1 }}
      </div>

      <!-- Expression field (MathQuill) -->
      <div class="flex-1 min-w-0">
        <label class="block text-[10px] text-muted font-mono mb-0.5">f(x)</label>
        <div #mqExpr [class]="mqClass(hasExpressionError())"></div>
        @if (hasExpressionError()) {
          <p class="text-[10px] text-red-400 mt-0.5">{{ error() }}</p>
        }
        @if (conversionErrors[0]) {
          <p class="text-[10px] text-red-400 mt-0.5">{{ conversionErrors[0] }}</p>
        }
      </div>

      <!-- From field (MathQuill) -->
      <div class="w-24 shrink-0">
        <label class="block text-[10px] text-muted font-mono mb-0.5">desde</label>
        <div #mqFrom [class]="mqClass(false)"></div>
      </div>

      <!-- To field (MathQuill) -->
      <div class="w-24 shrink-0">
        <label class="block text-[10px] text-muted font-mono mb-0.5">hasta</label>
        <div #mqTo [class]="mqClass(false)"></div>
      </div>

      <!-- Remove button -->
      <button
        (click)="store.removeSegment(segment().id)"
        [disabled]="isOnly()"
        title="Eliminar tramo"
        class="shrink-0 mt-5 w-7 h-7 flex items-center justify-center rounded
               text-muted hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30
               disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer">
        ×
      </button>
    </div>
  `,
})
export class SegmentInputComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mqExpr') mqExprRef!: ElementRef<HTMLElement>;
  @ViewChild('mqFrom') mqFromRef!: ElementRef<HTMLElement>;
  @ViewChild('mqTo')   mqToRef!:   ElementRef<HTMLElement>;

  readonly store   = inject(CalculatorStore);
  readonly mqs     = inject(MathquillService);
  readonly tex2max = inject(LatexToMaximaService);

  readonly segment = input.required<SegmentDraft>();
  readonly index   = input.required<number>();
  readonly isOnly  = input<boolean>(false);
  readonly error   = input<string | null>(null);

  conversionErrors: [string | null, string | null, string | null] = [null, null, null];

  private fields: [MathField | null, MathField | null, MathField | null] = [null, null, null];

  constructor() {
    // Reset MathQuill fields when store resets (expression becomes '')
    effect(() => {
      const seg = this.segment();
      if (!seg.expression && this.fields[0]) this.fields[0].latex('');
      if (!seg.from       && this.fields[1]) this.fields[1].latex('');
      if (!seg.to         && this.fields[2]) this.fields[2].latex('');
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const makeConfig = (fieldIndex: 0 | 1 | 2, storeKey: keyof Omit<SegmentDraft, 'id'>) => ({
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf: MathField) => {
          const latex = mf.latex().trim();
          if (!latex) {
            this.conversionErrors[fieldIndex] = null;
            this.store.updateSegment(this.segment().id, { [storeKey]: '' });
            return;
          }
          const result = this.tex2max.convert(latex);
          if (result.ok) {
            this.conversionErrors[fieldIndex] = null;
            this.store.updateSegment(this.segment().id, { [storeKey]: result.maxima });
          } else {
            this.conversionErrors[fieldIndex] = result.error ?? null;
          }
        },
      },
    });

    this.fields[0] = await this.mqs.createField(this.mqExprRef.nativeElement, makeConfig(0, 'expression'));
    this.fields[1] = await this.mqs.createField(this.mqFromRef.nativeElement, makeConfig(1, 'from'));
    this.fields[2] = await this.mqs.createField(this.mqToRef.nativeElement,   makeConfig(2, 'to'));
  }

  ngOnDestroy(): void {
    for (const ref of [this.mqExprRef, this.mqFromRef, this.mqToRef]) {
      if (ref?.nativeElement) ref.nativeElement.innerHTML = '';
    }
  }

  readonly hasExpressionError = () =>
    !!this.error() && !this.segment().expression.trim();

  mqClass(hasError: boolean): string {
    const base =
      'w-full px-2 py-1 min-h-[2rem] text-sm rounded border ' +
      'bg-paper2 dark:bg-dark-surface2 ' +
      'focus-within:outline-none focus-within:ring-1 transition-colors cursor-text';
    return hasError
      ? `${base} border-red-400 focus-within:ring-red-400`
      : `${base} border-border dark:border-dark-border focus-within:border-accent focus-within:ring-accent`;
  }
}
