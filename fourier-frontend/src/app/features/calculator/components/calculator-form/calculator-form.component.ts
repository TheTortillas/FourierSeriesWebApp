import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, of, switchMap, tap } from 'rxjs';
import { CalculatorStore, SegmentDraft, SeriesType } from '../../store/calculator.store';
import { SegmentInputComponent } from '../segment-input/segment-input.component';
import { SeriesTypeSelectorComponent } from '../series-type-selector/series-type-selector.component';
import { MathjaxDirective } from '../../../../shared/directives/mathjax.directive';
import { TranslocoPipe } from '@jsverse/transloco';
import { LatexToMaximaService } from '../../../../core/services/math/latex-to-maxima.service';
import { MathquillService, KeyBtn } from '../../../../core/services/math/mathquill.service';
import { MobileMathKeyboardComponent } from '../../../../shared/components/math-keyboard/mobile-math-keyboard.component';
import { ExportButtonComponent } from '../../../../shared/components/export-button/export-button.component';
import {
  ExampleSelectorComponent,
  type ExampleOption,
} from '../../../../shared/components/example-selector/example-selector.component';

type SegmentSeed = Omit<SegmentDraft, 'id'>;

interface FourierExample {
  labelKey: string;
  seriesType: SeriesType;
  intVar: string;
  segments: SegmentSeed[];
}

function seg(
  expression: string,
  expressionTex: string,
  from: string,
  fromTex: string,
  to: string,
  toTex: string,
): SegmentSeed {
  return { expression, expressionTex, from, fromTex, to, toTex };
}

const CALCULATOR_EXAMPLES: FourierExample[] = [
  // ── Trigonométrica — numéricos ──
  {
    labelKey: 'calculator.exSquareWave',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [
      seg('-1', '-1', '-%pi', '-\\pi', '0', '0'),
      seg('1', '1', '0', '0', '%pi', '\\pi'),
    ],
  },
  {
    labelKey: 'calculator.exSawtooth',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [seg('x', 'x', '-%pi', '-\\pi', '%pi', '\\pi')],
  },
  {
    labelKey: 'calculator.exTriangle',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [seg('abs(x)', '\\left|x\\right|', '-%pi', '-\\pi', '%pi', '\\pi')],
  },
  {
    labelKey: 'calculator.exPulseTrain',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [
      seg('0', '0', '-%pi', '-\\pi', '-%pi/2', '-\\frac{\\pi}{2}'),
      seg('1', '1', '-%pi/2', '-\\frac{\\pi}{2}', '%pi/2', '\\frac{\\pi}{2}'),
      seg('0', '0', '%pi/2', '\\frac{\\pi}{2}', '%pi', '\\pi'),
    ],
  },
  {
    labelKey: 'calculator.exHalfWaveRect',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [
      seg('sin(x)', '\\sin\\left(x\\right)', '0', '0', '%pi', '\\pi'),
      seg('0', '0', '%pi', '\\pi', '2*%pi', '2\\pi'),
    ],
  },
  {
    labelKey: 'calculator.exFullWaveRect',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [seg('abs(sin(x))', '\\left|\\sin\\left(x\\right)\\right|', '-%pi', '-\\pi', '%pi', '\\pi')],
  },
  {
    labelKey: 'calculator.exParabola',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [seg('x^2', 'x^{2}', '-%pi', '-\\pi', '%pi', '\\pi')],
  },
  {
    labelKey: 'calculator.exAbs',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [seg('abs(x)', '\\left|x\\right|', '-%pi', '-\\pi', '%pi', '\\pi')],
  },
  {
    labelKey: 'calculator.exSinh',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [seg('sinh(x)', '\\sinh\\left(x\\right)', '-%pi', '-\\pi', '%pi', '\\pi')],
  },
  // ── Trigonométrica — parámetros simbólicos ──
  {
    labelKey: 'calculator.exSquareWaveSym',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [
      seg('-1', '-1', '-T/2', '-\\frac{T}{2}', '0', '0'),
      seg('1', '1', '0', '0', 'T/2', '\\frac{T}{2}'),
    ],
  },
  {
    labelKey: 'calculator.exSawtoothSym',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [seg('x', 'x', '-L', '-L', 'L', 'L')],
  },
  {
    labelKey: 'calculator.exPulseTrainSym',
    seriesType: 'trigonometric',
    intVar: 'x',
    segments: [
      seg('0', '0', '-T/2', '-\\frac{T}{2}', '-a', '-a'),
      seg('1', '1', '-a', '-a', 'a', 'a'),
      seg('0', '0', 'a', 'a', 'T/2', '\\frac{T}{2}'),
    ],
  },
  // ── Compleja ──
  {
    labelKey: 'calculator.exComplexSquareWave',
    seriesType: 'complex',
    intVar: 'x',
    segments: [
      seg('-1', '-1', '-%pi', '-\\pi', '0', '0'),
      seg('1', '1', '0', '0', '%pi', '\\pi'),
    ],
  },
  {
    labelKey: 'calculator.exComplexExp',
    seriesType: 'complex',
    intVar: 'x',
    segments: [seg('exp(x)', 'e^{x}', '-%pi', '-\\pi', '%pi', '\\pi')],
  },
  {
    labelKey: 'calculator.exComplexSawtoothSym',
    seriesType: 'complex',
    intVar: 'x',
    segments: [seg('x', 'x', '-L', '-L', 'L', 'L')],
  },
  {
    labelKey: 'calculator.exComplexPulseSym',
    seriesType: 'complex',
    intVar: 'x',
    segments: [
      seg('0', '0', '-T/2', '-\\frac{T}{2}', '-a', '-a'),
      seg('1', '1', '-a', '-a', 'a', 'a'),
      seg('0', '0', 'a', 'a', 'T/2', '\\frac{T}{2}'),
    ],
  },
  // ── Medio rango ──
  {
    labelKey: 'calculator.exHalfRangeRamp',
    seriesType: 'halfRange',
    intVar: 'x',
    segments: [seg('x', 'x', '0', '0', 'L', 'L')],
  },
  {
    labelKey: 'calculator.exHalfRangeParabola',
    seriesType: 'halfRange',
    intVar: 'x',
    segments: [seg('x*(L-x)', 'x\\left(L-x\\right)', '0', '0', 'L', 'L')],
  },
  {
    labelKey: 'calculator.exHalfRangeConstant',
    seriesType: 'halfRange',
    intVar: 'x',
    segments: [seg('1', '1', '0', '0', 'L', 'L')],
  },
  {
    labelKey: 'calculator.exHalfRangeSine',
    seriesType: 'halfRange',
    intVar: 'x',
    segments: [
      seg(
        'sin(%pi*x/L)',
        '\\sin\\left(\\frac{\\pi x}{L}\\right)',
        '0',
        '0',
        'L',
        'L',
      ),
    ],
  },
];

@Component({
  selector: 'app-calculator-form',
  imports: [
    SegmentInputComponent,
    SeriesTypeSelectorComponent,
    MathjaxDirective,
    TranslocoPipe,
    MobileMathKeyboardComponent,
    ExportButtonComponent,
    ExampleSelectorComponent,
  ],
  templateUrl: './calculator-form.component.html',
})
export class CalculatorFormComponent {
  readonly store = inject(CalculatorStore);
  readonly mqs = inject(MathquillService);
  private readonly intervalValidator = inject(LatexToMaximaService);
  private readonly destroyRef = inject(DestroyRef);

  showKeyboard = false;

  readonly exampleOptions: ExampleOption[] = CALCULATOR_EXAMPLES.map((ex) => ({
    id: ex.labelKey,
    labelKey: ex.labelKey,
  }));

  private _exampleSegId = 0;

  loadExample(labelKey: string): void {
    const ex = CALCULATOR_EXAMPLES.find((e) => e.labelKey === labelKey);
    if (!ex) return;

    this.store.clearComputedResult();
    // Set intVar directly (not via setIntVar) — that method rewrites existing
    // segment expressions to the new variable, which would corrupt the
    // example's expressions since they're already written in terms of ex.intVar.
    this.store.intVar.set(ex.intVar);
    this.store.segments.set(
      ex.segments.map((s) => ({ ...s, id: `seg-ex-${++this._exampleSegId}` })),
    );
    this.store.setSeriesType(ex.seriesType);
  }

  readonly mobileExtraGroup: KeyBtn[] = [
    { label: '|□|', writeWithCursor: '\\left|\\right|' },
    { label: 'Γ(□)', writeWithCursor: '\\Gamma\\left(\\right)' },
    { label: 'n!', writeWithCursor: '\\operatorname{factorial}\\left(\\right)' },
    { label: 'π', typedText: 'pi' },
  ];

  readonly keyGroups: KeyBtn[][] = [
    // Row 1: Trig básica + inversa
    [
      { label: 'sin(□)', writeWithCursor: '\\sin\\left(\\right)' },
      { label: 'cos(□)', writeWithCursor: '\\cos\\left(\\right)' },
      { label: 'tan(□)', writeWithCursor: '\\tan\\left(\\right)' },
      { label: 'cot(□)', writeWithCursor: '\\cot\\left(\\right)' },
      { label: 'sec(□)', writeWithCursor: '\\sec\\left(\\right)' },
      { label: 'csc(□)', writeWithCursor: '\\csc\\left(\\right)' },
      { label: 'asin(□)', writeWithCursor: '\\operatorname{asin}\\left(\\right)' },
      { label: 'acos(□)', writeWithCursor: '\\operatorname{acos}\\left(\\right)' },
      { label: 'atan(□)', writeWithCursor: '\\operatorname{atan}\\left(\\right)' },
    ],
    // Row 2: Hiperbólicas + logaritmos + misc
    [
      { label: 'sinh(□)', writeWithCursor: '\\sinh\\left(\\right)' },
      { label: 'cosh(□)', writeWithCursor: '\\cosh\\left(\\right)' },
      { label: 'tanh(□)', writeWithCursor: '\\tanh\\left(\\right)' },
      { label: 'log(□)', writeWithCursor: '\\log\\left(\\right)' },
      { label: 'ln(□)', writeWithCursor: '\\ln\\left(\\right)' },
      { label: 'exp(□)', writeWithCursor: '\\operatorname{exp}\\left(\\right)' },
      { label: '|□|', writeWithCursor: '\\left|\\right|' },
      { label: 'Γ(□)', writeWithCursor: '\\Gamma\\left(\\right)' },
      { label: 'n!', writeWithCursor: '\\operatorname{factorial}\\left(\\right)' },
    ],
    // Row 3: Operadores y constantes
    [
      { label: 'e^□' },
      { label: '□²' },
      { label: '□^□' },
      { label: '□/□' },
      { label: '√□', cmd: '\\sqrt' },
      { label: '(□)', writeWithCursor: '\\left(\\right)' },
      { label: 'π', typedText: 'pi' },
      { label: '−', write: '-' },
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
