import { Component } from '@angular/core';
import { CalculatorFormComponent } from './components/calculator-form/calculator-form.component';
import { ResultsSummaryComponent } from './components/results-summary/results-summary.component';
import { NavComponent } from '../../shared/components/nav/nav.component';

@Component({
  selector: 'app-calculator',
  imports: [NavComponent, CalculatorFormComponent, ResultsSummaryComponent],
  templateUrl: './calculator.component.html',
})
export class CalculatorComponent {}
