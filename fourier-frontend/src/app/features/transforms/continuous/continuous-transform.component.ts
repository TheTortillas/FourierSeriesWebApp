import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NavComponent } from '../../../shared/components/nav/nav.component';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';
import { ApiService } from '../../../core/services/api/api.service';
import {
  TransformSegmentComponent,
  TransformSegmentDraft,
} from './transform-segment.component';
import {
  FourierTransformResponse,
  InverseFourierTransformResponse,
} from '../../../domain/types/transform.types';

let _nextId = 0;
const mkId = () => `ts-${++_nextId}`;

function emptySegment(): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: '', expressionTex: '',
    from: '',       fromTex: '',
    to: '',         toTex: '',
  };
}

interface VarPair {
  id: string;
  /** Maxima-safe name for time/space domain variable */
  time: string;
  /** Maxima-safe name for frequency domain variable */
  freq: string;
  /** Display character (Unicode) for time var */
  timeDisplay: string;
  /** Display character (Unicode) for freq var */
  freqDisplay: string;
}

const VAR_PAIRS: VarPair[] = [
  { id: 't-w',    time: 't', freq: 'w',  timeDisplay: 't', freqDisplay: 'ω' },
  { id: 't-f',    time: 't', freq: 'f',  timeDisplay: 't', freqDisplay: 'f' },
  { id: 't-nu',   time: 't', freq: 'nu', timeDisplay: 't', freqDisplay: 'ν' },
  { id: 'x-xi',   time: 'x', freq: 'xi', timeDisplay: 'x', freqDisplay: 'ξ' },
  { id: 'x-k',    time: 'x', freq: 'k',  timeDisplay: 'x', freqDisplay: 'k' },
  { id: 'custom', time: '',  freq: '',   timeDisplay: '',  freqDisplay: ''  },
];

@Component({
  selector: 'app-continuous-transform',
  templateUrl: './continuous-transform.component.html',
  imports: [NavComponent, MathjaxDirective, TransformSegmentComponent, FormsModule],
})
export class ContinuousTransformComponent {
  readonly api        = inject(ApiService);
  readonly destroyRef = inject(DestroyRef);

  readonly mode      = signal<'ft' | 'ift'>('ft');
  readonly varPairId = signal<string>('t-w');
  readonly customTime = signal('t');
  readonly customFreq = signal('w');
  readonly segments  = signal<TransformSegmentDraft[]>([emptySegment()]);
  readonly loading   = signal(false);
  readonly errorMsg  = signal<string | null>(null);
  readonly ftResult  = signal<FourierTransformResponse | null>(null);
  readonly iftResult = signal<InverseFourierTransformResponse | null>(null);

  readonly varPairs = VAR_PAIRS;

  readonly activePair = computed<VarPair>(() => {
    const id = this.varPairId();
    if (id === 'custom') {
      const t = this.customTime() || 't';
      const f = this.customFreq() || 'w';
      return { id: 'custom', time: t, freq: f, timeDisplay: t, freqDisplay: f };
    }
    return VAR_PAIRS.find(p => p.id === id) ?? VAR_PAIRS[0];
  });

  /** The variable being integrated over in the current mode */
  readonly intVar = computed(() => {
    const p = this.activePair();
    return this.mode() === 'ft' ? p.time : p.freq;
  });

  /** The variable that appears in the result */
  readonly transVar = computed(() => {
    const p = this.activePair();
    return this.mode() === 'ft' ? p.freq : p.time;
  });

  /** Display label for the input function */
  readonly inputFnLabel = computed(() => {
    const p = this.activePair();
    const v = this.mode() === 'ft' ? p.timeDisplay : p.freqDisplay;
    return this.mode() === 'ft' ? `f(${v})` : `F(${v})`;
  });

  /** Display variable for the result */
  readonly resultVarDisplay = computed(() => {
    const p = this.activePair();
    return this.mode() === 'ft' ? p.freqDisplay : p.timeDisplay;
  });

  readonly canCalculate = computed(() => {
    return this.segments().every(
      s => s.expression.trim() && s.from.trim() && s.to.trim()
    );
  });

  // ── Mode / var actions ────────────────────────────────────────────────────

  setMode(m: 'ft' | 'ift'): void {
    this.mode.set(m);
    this.ftResult.set(null);
    this.iftResult.set(null);
    this.errorMsg.set(null);
  }

  // ── Segment actions ───────────────────────────────────────────────────────

  addSegment(): void {
    this.segments.update(s => [...s, emptySegment()]);
  }

  removeSegment(id: string): void {
    this.segments.update(s => s.filter(seg => seg.id !== id));
  }

  updateSegment(id: string, changes: Partial<TransformSegmentDraft>): void {
    this.segments.update(list =>
      list.map(s => s.id === id ? { ...s, ...changes } : s)
    );
  }

  // ── Calculate ─────────────────────────────────────────────────────────────

  calculate(): void {
    if (!this.canCalculate()) return;

    const segs = this.segments().map(s => ({
      expression: s.expression,
      from: s.from,
      to: s.to,
    }));
    const intVar   = this.intVar();
    const transVar = this.transVar();

    this.loading.set(true);
    this.errorMsg.set(null);
    this.ftResult.set(null);
    this.iftResult.set(null);

    if (this.mode() === 'ft') {
      this.api
        .calculateFourierTransform({ segments: segs, intVar, transVar })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next:  (res) => { this.ftResult.set(res);  this.loading.set(false); },
          error: (e)   => {
            this.errorMsg.set(e?.error?.error ?? 'Error al calcular la transformada');
            this.loading.set(false);
          },
        });
    } else {
      this.api
        .calculateInverseFourierTransform({ segments: segs, intVar, transVar })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next:  (res) => { this.iftResult.set(res); this.loading.set(false); },
          error: (e)   => {
            this.errorMsg.set(e?.error?.error ?? 'Error al calcular la transformada inversa');
            this.loading.set(false);
          },
        });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Wraps a LaTeX expression in display-math delimiters for MathjaxDirective */
  display(tex: string): string {
    return `\\[${tex}\\]`;
  }

  /** Builds "F(ω) =" label for FT result */
  ftLabel(varDisplay: string): string {
    return `F(${varDisplay}) =`;
  }
}
