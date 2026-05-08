import { Component, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs';
import { CalculatorStore } from './store/calculator.store';
import { CalculatorFormComponent } from './components/calculator-form/calculator-form.component';
import { ResultsSummaryComponent } from './components/results-summary/results-summary.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { NavComponent } from '../../shared/components/nav/nav.component';
import { UserStore } from '../../core/services/auth/user.store';
import { SeoService } from '../../core/services/seo/seo.service';
import { FeedbackService } from '../../core/services/feedback/feedback.service';

@Component({
  selector: 'app-calculator',
  imports: [NavComponent, CalculatorFormComponent, ResultsSummaryComponent, TranslocoPipe],
  templateUrl: './calculator.component.html',
})
export class CalculatorComponent implements OnInit {
  private readonly store      = inject(CalculatorStore);
  private readonly router     = inject(Router);
  private readonly route      = inject(ActivatedRoute);
  private readonly userStore  = inject(UserStore);
  private readonly seo        = inject(SeoService);
  private readonly feedbackSvc = inject(FeedbackService);

  ngOnInit(): void {
    this.seo.setPage('seo.calculator.title', 'seo.calculator.description');
  }

  /** Set to true when URL state was restored and needs a first calculation */
  private needsCalculate = false;

  /** Tracks whether we have ever written a result to the URL */
  private urlPopulated = false;

  constructor() {
    // ── 1. Restore state from URL BEFORE children mount ───────────────────
    // afterNextRender would be too late for MathQuill initialization, which
    // reads the store in ngAfterViewInit of each SegmentInputComponent.
    const navState = this.router.getCurrentNavigation()?.extras.state as
      | { restoreInput?: Record<string, unknown> }
      | undefined;

    const encoded = this.route.snapshot.queryParamMap.get('s');

    if (navState?.restoreInput) {
      this.store.restoreFromInput(navState.restoreInput);
      this.needsCalculate = true;
    } else if (encoded) {
      this.needsCalculate = this.store.restoreState(encoded);
    } else {
      this.store.resetForm();
    }

    // ── 2. Auto-calculate once auth is initialized ────────────────────────
    // Wait for initFromStorage() to complete so the Bearer token is in memory
    // before the API call goes out. Using afterNextRender here caused a race
    // condition: the calculate request was sent before the refresh token
    // exchange completed, making it look like an anonymous (quota-exhausted) request.
    if (this.needsCalculate) {
      toObservable(this.userStore.initialized)
        .pipe(filter(Boolean), take(1))
        .subscribe(() => {
          this.needsCalculate = false;
          this.store.calculate();
        });
    }

    // ── 3. Sync result → URL + feedback modal trigger ─────────────────────
    effect(() => {
      const result = this.store.result();
      if (result) {
        this.urlPopulated = true;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { s: this.store.encodeState() },
          replaceUrl: true,
        });
        setTimeout(() => this.feedbackSvc.tryOpenModal(), 4000);
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
