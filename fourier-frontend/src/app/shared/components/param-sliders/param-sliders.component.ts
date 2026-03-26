import { Component, input, output, computed, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ParamValues {
  [name: string]: number;
}

/**
 * Reusable slider panel for free symbolic parameters detected in a Maxima result.
 *
 * Usage:
 *   <app-param-sliders [params]="result.params" (valuesChange)="onParamChange($event)" />
 *
 * When the user moves a slider the component emits the full updated map so the
 * parent can pass it straight to MathUtilsService.compile(expr, variable, values).
 */
@Component({
  selector: 'app-param-sliders',
  imports: [FormsModule],
  template: `
    @if (params().length > 0) {
      <div class="mt-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700
                  bg-gray-50 dark:bg-gray-800/50 space-y-2">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Parámetros libres
        </p>

        @for (name of params(); track name) {
          <div class="flex items-center gap-3">
            <!-- Symbol label -->
            <span class="w-5 text-sm font-mono text-gray-700 dark:text-gray-300 text-right shrink-0">
              {{ name }}
            </span>

            <!-- Slider -->
            <input
              type="range"
              class="flex-1 accent-blue-600 cursor-pointer"
              [min]="min()"
              [max]="max()"
              [step]="step()"
              [ngModel]="values()[name] ?? defaultValue()"
              (ngModelChange)="setValue(name, $event)"
            />

            <!-- Numeric input -->
            <input
              type="number"
              class="w-16 px-1.5 py-0.5 text-sm text-right font-mono rounded border
                     border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-700
                     text-gray-800 dark:text-gray-200
                     focus:outline-none focus:ring-1 focus:ring-blue-500"
              [min]="min()"
              [max]="max()"
              [step]="step()"
              [ngModel]="values()[name] ?? defaultValue()"
              (ngModelChange)="setValue(name, +$event)"
            />
          </div>
        }
      </div>
    }
  `,
})
export class ParamSlidersComponent {
  readonly params       = input<string[]>([]);
  readonly defaultValue = input<number>(1);
  readonly min          = input<number>(0.1);
  readonly max          = input<number>(5);
  readonly step         = input<number>(0.1);

  readonly valuesChange = output<ParamValues>();

  /** Internal state: one entry per detected param. */
  readonly values = signal<ParamValues>({});

  constructor() {
    // When the param list changes, initialise any new entries with defaultValue.
    effect(() => {
      const names  = this.params();
      const def    = this.defaultValue();
      const current = this.values();
      const next: ParamValues = {};
      for (const name of names) {
        next[name] = current[name] ?? def;
      }
      this.values.set(next);
      this.valuesChange.emit(next);
    });
  }

  setValue(name: string, raw: number | string): void {
    const value = Number(raw);
    if (!isFinite(value)) return;
    const next = { ...this.values(), [name]: value };
    this.values.set(next);
    this.valuesChange.emit(next);
  }
}
