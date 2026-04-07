import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { CalculatorStore } from '../../store/calculator.store';
import { SegmentInputComponent } from '../segment-input/segment-input.component';
import { SeriesTypeSelectorComponent } from '../series-type-selector/series-type-selector.component';
import { MathjaxDirective } from '../../../../shared/directives/mathjax.directive';
import { TranslocoPipe } from '@jsverse/transloco';
import { LatexToMaximaService } from '../../../../core/services/math/latex-to-maxima.service';

@Component({
  selector: 'app-calculator-form',
  imports: [SegmentInputComponent, SeriesTypeSelectorComponent, MathjaxDirective, TranslocoPipe],
  templateUrl: './calculator-form.component.html',
})
export class CalculatorFormComponent {
  readonly store = inject(CalculatorStore);
  private readonly intervalValidator = inject(LatexToMaximaService);
  private readonly destroyRef = inject(DestroyRef);

  /** Per-segment continuity error key (drives amber border, no inline text). */
  readonly continuityErrors = signal<(string | null)[]>([null]);
  /** True while the debounce or HTTP comparison is in flight. */
  readonly continuityValidating = signal(false);

  readonly hasContinuityError = computed(() => this.continuityErrors().some((e) => e !== null));

  constructor() {
    toObservable(this.store.segments).pipe(
      tap((segs) => { if (segs.length > 1) this.continuityValidating.set(true); }),
      debounceTime(600),
      switchMap((segs) => {
        if (segs.length <= 1) return of(segs.map(() => null as string | null));

        const pairIndices: number[] = [];
        const pairs: Array<{ a: string; b: string }> = [];

        for (let i = 0; i < segs.length - 1; i++) {
          const toVal = segs[i].to;
          const fromVal = segs[i + 1].from;
          if (toVal && fromVal) {
            pairIndices.push(i);
            pairs.push({ a: toVal, b: fromVal });
          }
        }

        if (pairs.length === 0) return of(segs.map(() => null as string | null));

        return this.intervalValidator.compareIntervals(pairs).pipe(
          map((results) => {
            const errors: (string | null)[] = segs.map(() => null);
            results.forEach((result, ri) => {
              if (result === 'different') {
                errors[pairIndices[ri]] = 'calculator.segment.continuityGap';
              }
            });
            return errors;
          }),
          catchError(() => of(segs.map(() => null as string | null))),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((errors) => {
      this.continuityErrors.set(errors);
      this.continuityValidating.set(false);
    });
  }
}
