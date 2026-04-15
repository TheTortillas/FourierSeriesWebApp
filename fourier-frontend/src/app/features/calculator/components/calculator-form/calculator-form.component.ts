import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, of, switchMap, tap } from 'rxjs';
import { CalculatorStore } from '../../store/calculator.store';
import { SegmentInputComponent } from '../segment-input/segment-input.component';
import { SeriesTypeSelectorComponent } from '../series-type-selector/series-type-selector.component';
import { MathjaxDirective } from '../../../../shared/directives/mathjax.directive';
import { TranslocoPipe } from '@jsverse/transloco';
import { LatexToMaximaService } from '../../../../core/services/math/latex-to-maxima.service';
import { MathquillService, KeyBtn } from '../../../../core/services/math/mathquill.service';
import { MobileMathKeyboardComponent } from '../../../../shared/components/math-keyboard/mobile-math-keyboard.component';
import { ExportButtonComponent } from '../../../../shared/components/export-button/export-button.component';

@Component({
  selector: 'app-calculator-form',
  imports: [SegmentInputComponent, SeriesTypeSelectorComponent, MathjaxDirective, TranslocoPipe, MobileMathKeyboardComponent, ExportButtonComponent],
  templateUrl: './calculator-form.component.html',
})
export class CalculatorFormComponent {
  readonly store = inject(CalculatorStore);
  readonly mqs = inject(MathquillService);
  private readonly intervalValidator = inject(LatexToMaximaService);
  private readonly destroyRef = inject(DestroyRef);

  showKeyboard = false;

  readonly keyGroups: KeyBtn[][] = [
    [
      { label: 'sin', typedText: 'sin(' },
      { label: 'cos', typedText: 'cos(' },
      { label: 'tan', typedText: 'tan(' },
      { label: 'cot', typedText: 'cot(' },
      { label: 'sec', typedText: 'sec(' },
      { label: 'csc', typedText: 'csc(' },
    ],
    [
      { label: 'asin', typedText: 'asin(' },
      { label: 'acos', typedText: 'acos(' },
      { label: 'atan', typedText: 'atan(' },
      { label: 'acot', typedText: 'acot(' },
      { label: 'asec', typedText: 'asec(' },
      { label: 'acsc', typedText: 'acsc(' },
    ],
    [
      { label: 'sinh', typedText: 'sinh(' },
      { label: 'cosh', typedText: 'cosh(' },
      { label: 'tanh', typedText: 'tanh(' },
      { label: 'asinh', typedText: 'asinh(' },
      { label: 'acosh', typedText: 'acosh(' },
      { label: 'atanh', typedText: 'atanh(' },
    ],
    [
      { label: 'log', typedText: 'log(' },
      { label: 'ln', typedText: 'ln(' },
      { label: 'exp', typedText: 'exp(' },
      { label: '\\', typedText: '\\' },
      { label: 'Γ(·)', write: '\\Gamma(' },
      { label: 'n!', typedText: 'factorial(' },
      { label: 'x!', typedText: '!' },
      { label: '√·', cmd: '\\sqrt' },
      { label: '|·|' },
      { label: 'π', typedText: 'pi' },
      { label: 'eˣ' },
      { label: 'xⁿ', cmd: '^' },
      { label: '(', typedText: '(' },
      { label: ')', typedText: ')' },
      { label: '−', write: '-' },
      { label: '/', typedText: '/' },
      { label: '⌫', keystroke: 'Backspace' },
    ],
  ];

  /** Per-segment continuity error key (amber border). null = ok. */
  readonly continuityErrors = signal<(string | null)[]>([null]);
  /** Per-segment order flag (red border when from >= to, definitively). */
  readonly orderErrors = signal<boolean[]>([false]);
  /** True while the debounce or HTTP check is in flight. */
  readonly continuityValidating = signal(false);

  readonly hasContinuityError = computed(() => this.continuityErrors().some((e) => e !== null));
  readonly hasOrderError = computed(() => this.orderErrors().some(Boolean));

  constructor() {
    toObservable(this.store.segments).pipe(
      tap((segs) => {
        const needsCheck = segs.some((s) => s.from && s.to) || segs.length > 1;
        if (needsCheck) this.continuityValidating.set(true);
      }),
      debounceTime(600),
      switchMap((segs) => {
        // Continuity pairs: to[i] vs from[i+1]
        const pairIndices: number[] = [];
        const pairs: Array<{ a: string; b: string }> = [];
        for (let i = 0; i < segs.length - 1; i++) {
          if (segs[i].to && segs[i + 1].from) {
            pairIndices.push(i);
            pairs.push({ a: segs[i].to, b: segs[i + 1].from });
          }
        }

        // Order pairs: from[i] vs to[i] for each segment
        const orderIndices: number[] = [];
        const orderPairs: Array<{ a: string; b: string }> = [];
        for (let i = 0; i < segs.length; i++) {
          if (segs[i].from && segs[i].to) {
            orderIndices.push(i);
            orderPairs.push({ a: segs[i].from, b: segs[i].to });
          }
        }

        if (pairs.length === 0 && orderPairs.length === 0) {
          return of({ continuity: segs.map(() => null as string | null), order: segs.map(() => false) });
        }

        return this.intervalValidator.validateBoundaries({ pairs, orderPairs }).pipe(
          switchMap((res) => {
            const continuity: (string | null)[] = segs.map(() => null);
            res.results.forEach((r, ri) => {
              if (r === 'different') continuity[pairIndices[ri]] = 'calculator.segment.continuityGap';
            });

            const order: boolean[] = segs.map(() => false);
            res.orderResults.forEach((r, ri) => {
              if (r === 'invalid') order[orderIndices[ri]] = true;
            });

            return of({ continuity, order });
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ continuity, order }) => {
      this.continuityErrors.set(continuity);
      this.orderErrors.set(order);
      this.continuityValidating.set(false);
    });
  }
}
