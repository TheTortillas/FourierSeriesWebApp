import { Component, inject } from '@angular/core';
import { CalculatorStore, SeriesType } from '../../store/calculator.store';
import { TranslocoPipe } from '@jsverse/transloco';

interface TypeOption {
  value: SeriesType;
  label: string;
  description: string;
}

@Component({
  selector: 'app-series-type-selector',
  imports: [TranslocoPipe],
  template: `
    <div class="space-y-1.5">
      <p class="text-xs text-muted font-mono">{{ 'calculator.seriesType' | transloco }}</p>
      <div class="flex flex-col gap-1.5 sm:flex-row">
        @for (opt of options; track opt.value) {
          <button
            (click)="store.setSeriesType(opt.value)"
            [class]="btnClass(opt.value)"
            type="button"
          >
            <span class="font-semibold text-sm">
              {{ 'calculator.types.' + opt.value | transloco }}
            </span>
            <span class="text-[10px] opacity-70 mt-0.5 block leading-tight">
              {{ 'calculator.types.' + opt.value + 'Desc' | transloco }}
            </span>
          </button>
        }
      </div>
    </div>
  `,
})
export class SeriesTypeSelectorComponent {
  readonly store = inject(CalculatorStore);

  readonly options = [
    { value: 'trigonometric' },
    { value: 'complex' },
    { value: 'halfRange' },
  ] as const;

  btnClass(value: SeriesType): string {
    const active = this.store.seriesType() === value;
    const base =
      'flex-1 flex flex-col items-center px-3 py-2 rounded border cursor-pointer transition-all text-center';
    return active
      ? `${base} border-accent bg-accent/10 dark:bg-accent/20 text-ink dark:text-dark-ink`
      : `${base} border-border dark:border-dark-border text-muted hover:border-accent/50 hover:bg-paper2 dark:hover:bg-dark-surface2`;
  }
}
