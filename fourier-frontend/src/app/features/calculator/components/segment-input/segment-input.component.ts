import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SegmentDraft, CalculatorStore } from '../../store/calculator.store';

/**
 * One row of the piecewise function input.
 * Accepts Maxima syntax directly:
 *   expression: x^2, sin(x), %pi, 1
 *   from/to:   -%pi, 0, %pi/2
 *
 * Uses plain text inputs (MathQuill optional enhancement, Phase 5+).
 */
@Component({
  selector: 'app-segment-input',
  imports: [FormsModule],
  template: `
    <div class="flex items-start gap-2 group">

      <!-- Segment index badge -->
      <div class="shrink-0 w-5 h-8 flex items-center justify-center
                  text-xs text-muted font-mono mt-0.5">
        {{ index() + 1 }}
      </div>

      <!-- Expression field -->
      <div class="flex-1 min-w-0">
        <label class="block text-[10px] text-muted mb-0.5 font-mono">f(x)</label>
        <input
          type="text"
          [ngModel]="segment().expression"
          (ngModelChange)="store.updateSegment(segment().id, { expression: $event })"
          placeholder="ej. sin(x), x^2, %pi/2"
          [class]="inputClass(hasExpressionError())"
          autocomplete="off"
          spellcheck="false"
        />
        @if (hasExpressionError()) {
          <p class="text-[10px] text-red-400 mt-0.5">{{ error() }}</p>
        }
      </div>

      <!-- From field -->
      <div class="w-24 shrink-0">
        <label class="block text-[10px] text-muted mb-0.5 font-mono">desde</label>
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
        <label class="block text-[10px] text-muted mb-0.5 font-mono">hasta</label>
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
export class SegmentInputComponent {
  readonly store   = inject(CalculatorStore);
  readonly segment = input.required<SegmentDraft>();
  readonly index   = input.required<number>();
  readonly isOnly  = input<boolean>(false);
  readonly error   = input<string | null>(null);

  readonly hasExpressionError = () =>
    !!this.error() && !this.segment().expression.trim();

  inputClass(hasError: boolean): string {
    const base =
      'w-full px-2 py-1.5 text-sm font-mono rounded border bg-paper dark:bg-dark-surface ' +
      'focus:outline-none focus:ring-1 transition-colors';
    return hasError
      ? `${base} border-red-400 focus:ring-red-400`
      : `${base} border-border dark:border-dark-border focus:border-accent focus:ring-accent`;
  }
}
