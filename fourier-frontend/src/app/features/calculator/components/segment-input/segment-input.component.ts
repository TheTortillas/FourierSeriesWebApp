import {
  AfterViewInit, Component, ElementRef, OnDestroy,
  ViewChild, effect, inject, input,
} from '@angular/core';
import { SegmentDraft, CalculatorStore } from '../../store/calculator.store';
import { MathquillService, MathField } from '../../../../core/services/math/mathquill.service';
import { LatexToMaximaService } from '../../../../core/services/math/latex-to-maxima.service';

/**
 * One row of the piecewise function input.
 * All three fields use MathQuill: LaTeX → tex2max → Maxima stored in draft.
 * LaTeX is also stored (as *Tex) for the live f(x) preview.
 *
 * Layout: styled outer wrapper div + inner div that MathQuill transforms.
 * This keeps our bg/border styling intact even after MathQuill's CSS loads.
 */
@Component({
  selector: 'app-segment-input',
  template: `
    <div class="flex items-start gap-2 group">

      <!-- Index badge -->
      <div class="shrink-0 w-5 flex items-center justify-center
                  text-xs text-muted font-mono mt-8">
        {{ index() + 1 }}
      </div>

      <!-- Expression (f(x)) -->
      <div class="flex-1 min-w-0">
        <label class="block text-[10px] text-muted font-mono mb-0.5">f(x)</label>
        <div [class]="wrapClass(hasExpressionError())" (click)="fields[0]?.focus()">
          <div #mqExpr></div>
        </div>
        @if (hasExpressionError()) {
          <p class="text-[10px] text-red-400 mt-0.5">{{ error() }}</p>
        }
        @if (conversionErrors[0]) {
          <p class="text-[10px] text-amber-500 mt-0.5">{{ conversionErrors[0] }}</p>
        }
      </div>

      <!-- From -->
      <div class="w-24 shrink-0">
        <label class="block text-[10px] text-muted font-mono mb-0.5">desde</label>
        <div [class]="wrapClass(false)" (click)="fields[1]?.focus()">
          <div #mqFrom></div>
        </div>
      </div>

      <!-- To -->
      <div class="w-24 shrink-0">
        <label class="block text-[10px] text-muted font-mono mb-0.5">hasta</label>
        <div [class]="wrapClass(false)" (click)="fields[2]?.focus()">
          <div #mqTo></div>
        </div>
      </div>

      <!-- Remove -->
      <button
        (click)="store.removeSegment(segment().id)"
        [disabled]="isOnly()"
        title="Eliminar tramo"
        class="shrink-0 mt-6 w-7 h-7 flex items-center justify-center rounded
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
  fields: [MathField | null, MathField | null, MathField | null] = [null, null, null];

  constructor() {
    // When the store resets a segment, clear the MathQuill fields
    effect(() => {
      const seg = this.segment();
      if (!seg.expression   && this.fields[0]) this.fields[0].latex('');
      if (!seg.from         && this.fields[1]) this.fields[1].latex('');
      if (!seg.to           && this.fields[2]) this.fields[2].latex('');
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const keys: Array<[0 | 1 | 2, keyof Omit<SegmentDraft, 'id'>, keyof Omit<SegmentDraft, 'id'>, string]> = [
      [0, 'expression', 'expressionTex', this.segment().expressionTex],
      [1, 'from',       'fromTex',       this.segment().fromTex],
      [2, 'to',         'toTex',         this.segment().toTex],
    ];
    const refs = [this.mqExprRef, this.mqFromRef, this.mqToRef];

    for (const [i, maximaKey, texKey, initialLatex] of keys) {
      const el = refs[i].nativeElement;
      const field = await this.mqs.createField(el, {
        ...this.mqs.defaultConfig(),
        handlers: {
          edit: (mf: MathField) => {
            const latex = mf.latex().trim();
            if (!latex) {
              this.conversionErrors[i] = null;
              this.store.updateSegment(this.segment().id, { [maximaKey]: '', [texKey]: '' });
              return;
            }
            const result = this.tex2max.convert(latex);
            if (result.ok) {
              this.conversionErrors[i] = null;
              this.store.updateSegment(this.segment().id, { [maximaKey]: result.maxima, [texKey]: latex });
            } else {
              // Still update the LaTeX for preview even if Maxima conversion fails
              this.conversionErrors[i] = result.error ?? null;
              this.store.updateSegment(this.segment().id, { [texKey]: latex });
            }
          },
        },
      });
      this.fields[i] = field;
      // Restore initial LaTeX (e.g. default segment has x, -π, π)
      if (initialLatex && field) field.latex(initialLatex);
    }
  }

  ngOnDestroy(): void {
    for (const ref of [this.mqExprRef, this.mqFromRef, this.mqToRef]) {
      if (ref?.nativeElement) ref.nativeElement.innerHTML = '';
    }
  }

  readonly hasExpressionError = () =>
    !!this.error() && !this.segment().expression.trim();

  /** Outer wrapper: our bg + border. MathQuill only touches the inner div. */
  wrapClass(hasError: boolean): string {
    const base =
      'w-full px-2 py-1 min-h-[2rem] text-sm rounded border cursor-text ' +
      'bg-paper2 dark:bg-dark-surface2 ' +
      'focus-within:ring-1 transition-colors';
    return hasError
      ? `${base} border-red-400 focus-within:ring-red-400`
      : `${base} border-border dark:border-dark-border focus-within:border-accent focus-within:ring-accent`;
  }
}
