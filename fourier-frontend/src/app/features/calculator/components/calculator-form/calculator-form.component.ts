import { Component, inject } from '@angular/core';
import { CalculatorStore } from '../../store/calculator.store';
import { SegmentInputComponent } from '../segment-input/segment-input.component';
import { SeriesTypeSelectorComponent } from '../series-type-selector/series-type-selector.component';
import { MathjaxDirective } from '../../../../shared/directives/mathjax.directive';

@Component({
  selector: 'app-calculator-form',
  imports: [SegmentInputComponent, SeriesTypeSelectorComponent, MathjaxDirective],
  templateUrl: './calculator-form.component.html',
})
export class CalculatorFormComponent {
  readonly store = inject(CalculatorStore);
}
