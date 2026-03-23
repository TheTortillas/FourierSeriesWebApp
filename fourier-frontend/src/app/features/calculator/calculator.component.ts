import { afterNextRender, Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CalculatorStore } from './store/calculator.store';
import { CalculatorFormComponent } from './components/calculator-form/calculator-form.component';
import { ResultsSummaryComponent } from './components/results-summary/results-summary.component';
import { NavComponent } from '../../shared/components/nav/nav.component';

@Component({
  selector: 'app-calculator',
  imports: [NavComponent, CalculatorFormComponent, ResultsSummaryComponent],
  templateUrl: './calculator.component.html',
})
export class CalculatorComponent {
  private readonly store  = inject(CalculatorStore);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  /** Set to true when URL state was restored and needs a first calculation */
  private needsCalculate = false;

  /** Tracks whether we have ever written a result to the URL */
  private urlPopulated = false;

  constructor() {
    // ── 1. Restore state from URL BEFORE children mount ───────────────────
    // afterNextRender would be too late for MathQuill initialization, which
    // reads the store in ngAfterViewInit of each SegmentInputComponent.
    const encoded = this.route.snapshot.queryParamMap.get('s');
    if (encoded) {
      this.needsCalculate = this.store.restoreState(encoded);
    }

    // ── 2. Auto-calculate once the browser has fully rendered ─────────────
    afterNextRender(() => {
      if (this.needsCalculate) {
        this.needsCalculate = false;
        this.store.calculate();
      }
    });

    // ── 3. Sync result → URL ──────────────────────────────────────────────
    effect(() => {
      const result = this.store.result();
      if (result) {
        this.urlPopulated = true;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { s: this.store.encodeState() },
          replaceUrl: true,
        });
      } else if (this.urlPopulated) {
        // Form was reset — clear the URL param
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      }
    });
  }
}
