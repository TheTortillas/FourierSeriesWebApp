import { Component, input, output, signal, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ParamValues {
  [name: string]: number;
}

interface ParamRange { min: number; max: number; }

/**
 * Reusable slider panel for free symbolic parameters detected in a Maxima result.
 *
 * Usage:
 *   <app-param-sliders [params]="result.params" (valuesChange)="onParamChange($event)" />
 *
 * Each parameter gets its own card with:
 *   - Name + editable current-value input
 *   - Editable min ── slider ── editable max
 */
@Component({
  selector: 'app-param-sliders',
  imports: [FormsModule],
  template: `
    @if (params().length > 0) {
      <div class="mt-3 space-y-2">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide px-0.5">
          Parámetros libres
        </p>

        @for (name of params(); track name) {
          <div class="rounded-lg border border-gray-200 dark:border-gray-600
                      bg-white dark:bg-gray-800 px-3 py-2 space-y-1.5">

            <!-- Row 1: param name + current value -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-mono font-semibold text-gray-700 dark:text-gray-200 shrink-0">
                {{ name }} =
              </span>
              <input
                type="number"
                class="w-24 px-2 py-0.5 text-sm text-right font-mono rounded border
                       border-blue-300 dark:border-blue-700
                       bg-blue-50 dark:bg-blue-900/30
                       text-gray-800 dark:text-gray-100
                       focus:outline-none focus:ring-1 focus:ring-blue-500"
                [step]="step()"
                [ngModel]="getValue(name)"
                (ngModelChange)="setValue(name, +$event)"
              />
            </div>

            <!-- Row 2: min ── slider ── max -->
            <div class="flex items-center gap-2">
              <input
                type="number"
                title="Mínimo"
                class="w-14 px-1.5 py-0.5 text-xs text-center font-mono rounded border
                       border-gray-300 dark:border-gray-600
                       bg-gray-50 dark:bg-gray-700
                       text-gray-500 dark:text-gray-400
                       focus:outline-none focus:ring-1 focus:ring-gray-400"
                [ngModel]="getMin(name)"
                (ngModelChange)="setMin(name, +$event)"
              />
              <input
                type="range"
                class="flex-1 accent-blue-600 cursor-pointer"
                [min]="getMin(name)"
                [max]="getMax(name)"
                [step]="step()"
                [ngModel]="getValue(name)"
                (ngModelChange)="setValue(name, $event)"
              />
              <input
                type="number"
                title="Máximo"
                class="w-14 px-1.5 py-0.5 text-xs text-center font-mono rounded border
                       border-gray-300 dark:border-gray-600
                       bg-gray-50 dark:bg-gray-700
                       text-gray-500 dark:text-gray-400
                       focus:outline-none focus:ring-1 focus:ring-gray-400"
                [ngModel]="getMax(name)"
                (ngModelChange)="setMax(name, +$event)"
              />
            </div>

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

  /** Current numeric value for each detected param. */
  readonly values = signal<ParamValues>({});
  /** Per-param slider range (editable min/max). */
  readonly ranges = signal<Record<string, ParamRange>>({});

  constructor() {
    // When the param list changes, initialise any new entries.
    effect(() => {
      const names     = this.params();
      const def       = this.defaultValue();
      const defMin    = this.min();
      const defMax    = this.max();
      const current   = untracked(() => this.values());
      const curRanges = untracked(() => this.ranges());

      const next: ParamValues = {};
      const nextRanges: Record<string, ParamRange> = {};
      for (const name of names) {
        next[name]       = current[name]    ?? def;
        nextRanges[name] = curRanges[name]  ?? { min: defMin, max: defMax };
      }
      this.values.set(next);
      this.ranges.set(nextRanges);
      this.valuesChange.emit(next);
    });
  }

  getValue(name: string): number {
    return (this.values() as Record<string, number | undefined>)[name] ?? this.defaultValue();
  }

  setValue(name: string, raw: number | string): void {
    const value = Number(raw);
    if (!isFinite(value)) return;
    const next = { ...this.values(), [name]: value };
    this.values.set(next);
    this.valuesChange.emit(next);
  }

  getMin(name: string): number {
    return (this.ranges() as Record<string, ParamRange | undefined>)[name]?.min ?? this.min();
  }

  getMax(name: string): number {
    return (this.ranges() as Record<string, ParamRange | undefined>)[name]?.max ?? this.max();
  }

  setMin(name: string, val: number): void {
    if (!isFinite(val)) return;
    this.ranges.update(r => {
      const cur = r[name] ?? { min: this.min(), max: this.max() };
      return { ...r, [name]: { ...cur, min: val } };
    });
  }

  setMax(name: string, val: number): void {
    if (!isFinite(val)) return;
    this.ranges.update(r => {
      const cur = r[name] ?? { min: this.min(), max: this.max() };
      return { ...r, [name]: { ...cur, max: val } };
    });
  }
}
