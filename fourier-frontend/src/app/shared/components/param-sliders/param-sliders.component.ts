import { Component, input, output, signal, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';

export interface ParamValues {
  [name: string]: number;
}

interface ParamRange {
  min: number;
  max: number;
}

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
  imports: [FormsModule, TranslocoPipe],
  template: `
    @if (params().length > 0) {
      <div class="flex flex-col gap-4">
      @for (name of params(); track name) {
        <div class="flex flex-col gap-2">
          <!-- Row 1: param name + editable value -->
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-mono font-bold text-accent shrink-0">{{ name }}</span>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-mono text-ink/50 dark:text-dark-ink/50">{{ 'settingsCanvas.paramCurrent' | transloco }}</span>
              <input
                type="number"
                class="w-20 px-2 py-0.5 rounded border border-border dark:border-dark-border bg-paper dark:bg-dark-bg text-ink dark:text-dark-ink text-center text-sm font-semibold font-mono focus:outline-none focus:border-accent tabular-nums"
                [step]="step()"
                [ngModel]="getValue(name)"
                (ngModelChange)="setValue(name, +$event)"
              />
            </div>
          </div>
          <!-- Row 2: full-width slider -->
          <input
            type="range"
            class="w-full accent-accent cursor-pointer h-1.5"
            [min]="getMin(name)"
            [max]="getMax(name)"
            [step]="step()"
            [ngModel]="getValue(name)"
            (ngModelChange)="setValue(name, $event)"
          />
          <!-- Row 3: editable min / max -->
          <div class="flex items-end gap-2">
            <div class="flex flex-col items-center gap-0.5 flex-1">
              <span class="text-[10px] font-mono text-ink/50 dark:text-dark-ink/50">{{ 'settingsCanvas.paramMin' | transloco }}</span>
              <input
                type="number"
                class="w-full px-2 py-1 rounded border border-border dark:border-dark-border bg-paper dark:bg-dark-bg text-ink dark:text-dark-ink text-center text-xs font-mono focus:outline-none focus:border-accent"
                [ngModel]="getMin(name)"
                (ngModelChange)="setMin(name, +$event)"
              />
            </div>
            <span class="text-ink/30 dark:text-dark-ink/30 font-mono shrink-0 pb-1">—</span>
            <div class="flex flex-col items-center gap-0.5 flex-1">
              <span class="text-[10px] font-mono text-ink/50 dark:text-dark-ink/50">{{ 'settingsCanvas.paramMax' | transloco }}</span>
              <input
                type="number"
                class="w-full px-2 py-1 rounded border border-border dark:border-dark-border bg-paper dark:bg-dark-bg text-ink dark:text-dark-ink text-center text-xs font-mono focus:outline-none focus:border-accent"
                [ngModel]="getMax(name)"
                (ngModelChange)="setMax(name, +$event)"
              />
            </div>
          </div>
        </div>
      }
      </div>
    }
  `,
})
export class ParamSlidersComponent {
  readonly params = input<string[]>([]);
  readonly defaultValue = input<number>(1);
  readonly min = input<number>(-5);
  readonly max = input<number>(5);
  readonly step = input<number>(0.1);

  readonly valuesChange = output<ParamValues>();

  /** Current numeric value for each detected param. */
  readonly values = signal<ParamValues>({});
  /** Per-param slider range (editable min/max). */
  readonly ranges = signal<Record<string, ParamRange>>({});

  constructor() {
    // When the param list changes, initialise any new entries.
    effect(() => {
      const names = this.params();
      const def = this.defaultValue();
      const defMin = this.min();
      const defMax = this.max();
      const current = untracked(() => this.values());
      const curRanges = untracked(() => this.ranges());

      const next: ParamValues = {};
      const nextRanges: Record<string, ParamRange> = {};
      for (const name of names) {
        next[name] = current[name] ?? def;
        nextRanges[name] = curRanges[name] ?? { min: defMin, max: defMax };
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
    this.ranges.update((r) => {
      const cur = r[name] ?? { min: this.min(), max: this.max() };
      return { ...r, [name]: { ...cur, min: val } };
    });
  }

  setMax(name: string, val: number): void {
    if (!isFinite(val)) return;
    this.ranges.update((r) => {
      const cur = r[name] ?? { min: this.min(), max: this.max() };
      return { ...r, [name]: { ...cur, max: val } };
    });
  }

  /** Clears all slider values and ranges back to defaults. Call on "nuevo cálculo". */
  reset(): void {
    this.values.set({});
    this.ranges.set({});
  }
}
