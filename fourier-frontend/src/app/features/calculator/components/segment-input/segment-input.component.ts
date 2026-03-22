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
 * - Expression: MathQuill field → LaTeX → tex2max → Maxima stored in the draft
 * - From / To:  plain text inputs in Maxima syntax (-%pi, %pi/2, 0, …)
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
        <!-- Container that MathQuill mounts onto -->
        <div
          #mqContainer
          [class]="mqClass(hasExpressionError())"
          style="min-height:2rem; cursor:text;">
        </div>
        @if (hasExpressionError()) {
          <p class="text-[10px] text-red-400 mt-0.5">{{ error() }}</p>
        }
        @if (conversionError()) {
          <p class="text-[10px] text-red-400 mt-0.5">{{ conversionError() }}</p>
        }
      </div>

      <!-- From field -->
      <div class="w-24 shrink-0">
        <label class="block text-[10px] text-muted font-mono mb-0.5">desde</label>
        <input
          type="text"
          [ngModel]="segment().from"
          (ngModelChange)="store.updateSegment(segment().id, { from: $event })"
          placeholder="-%pi"
          [class]="inputClass(false)"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <!-- To field -->
      <div class="w-24 shrink-0">
        <label class="block text-[10px] text-muted font-mono mb-0.5">hasta</label>
        <input
          type="text"
          [ngModel]="segment().to"
          (ngModelChange)="store.updateSegment(segment().id, { to: $event })"
          placeholder="%pi"
          [class]="inputClass(false)"
          autocomplete="off"
          spellcheck="false"
        />
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
  @ViewChild('mqContainer') mqContainer!: ElementRef<HTMLElement>;

  readonly store   = inject(CalculatorStore);
  readonly mqs     = inject(MathquillService);
  readonly tex2max = inject(LatexToMaximaService);

  readonly segment = input.required<SegmentDraft>();
  readonly index   = input.required<number>();
  readonly isOnly  = input<boolean>(false);
  readonly error   = input<string | null>(null);

  conversionError: () => string | null = () => null;
  private _conversionError: string | null = null;
  private field: MathField | null = null;

  constructor() {
    // Keep conversionError as a plain getter so template sees it
    this.conversionError = () => this._conversionError;

    // When segment expression changes externally (e.g. store reset),
    // keep MathQuill in sync. Use effect to react to signal.
    effect(() => {
      const expr = this.segment().expression;
      if (this.field && !expr) {
        this.field.latex('');
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const el = this.mqContainer.nativeElement;
    this.field = await this.mqs.createField(el, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf) => this.onMathFieldEdit(mf),
      },
    });
    // Set initial value from store if segment already has an expression
    // (e.g. navigating back). The store holds Maxima — we can't restore
    // LaTeX from Maxima, so we leave it blank if empty.
  }

  ngOnDestroy(): void {
    // MathQuill doesn't have an official destroy API; just clear the container
    if (this.mqContainer?.nativeElement) {
      this.mqContainer.nativeElement.innerHTML = '';
    }
  }

  private onMathFieldEdit(mf: MathField): void {
    const latex = mf.latex().trim();
    if (!latex) {
      this._conversionError = null;
      this.store.updateSegment(this.segment().id, { expression: '' });
      return;
    }
    const result = this.tex2max.convert(latex);
    if (result.ok) {
      this._conversionError = null;
      this.store.updateSegment(this.segment().id, { expression: result.maxima });
    } else {
      this._conversionError = `No se pudo convertir: ${result.error}`;
      // Keep last good value in store — don't overwrite with empty
    }
  }

  readonly hasExpressionError = () =>
    !!this.error() && !this.segment().expression.trim();

  mqClass(hasError: boolean): string {
    const base =
      'w-full px-2 py-1 text-sm rounded border bg-paper dark:bg-dark-surface ' +
      'focus-within:outline-none focus-within:ring-1 transition-colors';
    return hasError
      ? `${base} border-red-400 focus-within:ring-red-400`
      : `${base} border-border dark:border-dark-border focus-within:border-accent focus-within:ring-accent`;
  }

  inputClass(hasError: boolean): string {
    const base =
      'w-full px-2 py-1.5 text-sm font-mono rounded border bg-paper dark:bg-dark-surface ' +
      'text-ink dark:text-dark-ink focus:outline-none focus:ring-1 transition-colors';
    return hasError
      ? `${base} border-red-400 focus:ring-red-400`
      : `${base} border-border dark:border-dark-border focus:border-accent focus:ring-accent`;
  }
}
