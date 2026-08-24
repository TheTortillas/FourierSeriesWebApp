import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export interface ExampleOption {
  id: string;
  labelKey: string;
}

/**
 * Presentational combobox for "load example" pickers. Each consumer owns its
 * own example data and the logic to populate its form — this component only
 * renders the `<select>` and emits the chosen id.
 */
@Component({
  selector: 'app-example-selector',
  templateUrl: './example-selector.component.html',
  imports: [TranslocoPipe],
})
export class ExampleSelectorComponent {
  /** Already-translated label shown above the select. */
  readonly label = input.required<string>();

  /** Already-translated placeholder shown as the disabled first option. */
  readonly placeholder = input.required<string>();

  readonly options = input.required<ExampleOption[]>();

  /** Emits the selected option's id; the select resets to the placeholder right after. */
  readonly select = output<string>();

  onChange(event: Event): void {
    const el = event.target as HTMLSelectElement;
    const id = el.value;
    el.value = '';
    if (id) this.select.emit(id);
  }
}
