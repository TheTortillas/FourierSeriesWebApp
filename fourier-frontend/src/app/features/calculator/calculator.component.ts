import { Component, inject } from '@angular/core';
import { CalculatorFormComponent } from './components/calculator-form/calculator-form.component';
import { ResultsSummaryComponent } from './components/results-summary/results-summary.component';
import { ThemeService } from '../../core/services/theme/theme.service';

@Component({
  selector: 'app-calculator',
  imports: [CalculatorFormComponent, ResultsSummaryComponent],
  templateUrl: './calculator.component.html',
})
export class CalculatorComponent {
  readonly theme = inject(ThemeService);
}
