import { Component } from '@angular/core';
import { CalculatorFormComponent } from './components/calculator-form/calculator-form.component';
import { ResultsSummaryComponent } from './components/results-summary/results-summary.component';

/**
 * /calculator — página principal.
 *
 * Layout:
 *   Desktop: panel izquierdo (form) + panel derecho (canvas + resultados)
 *   Mobile:  columna única, canvas encima del form
 */
@Component({
  selector: 'app-calculator',
  imports: [CalculatorFormComponent, ResultsSummaryComponent],
  templateUrl: './calculator.component.html',
})
export class CalculatorComponent {}
