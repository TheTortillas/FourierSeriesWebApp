import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NavComponent } from '../../../shared/components/nav/nav.component';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../shared/components/function-plot/function-plot.component';
import { ApiService } from '../../../core/services/api/api.service';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { TransformSegmentComponent, TransformSegmentDraft } from './transform-segment.component';
import {
  FourierTransformResponse,
  InverseFourierTransformResponse,
} from '../../../domain/types/transform.types';

let _nextId = 0;
const mkId = () => `ts-${++_nextId}`;

function emptySegment(): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: '',
    expressionTex: '',
    from: '',
    fromTex: '',
    to: '',
    toTex: '',
  };
}

interface VarPair {
  id: string;
  time: string;
  freq: string;
  timeDisplay: string;
  freqDisplay: string;
}

const VAR_PAIRS: VarPair[] = [
  { id: 't-w', time: 't', freq: 'w', timeDisplay: 't', freqDisplay: 'ω' },
  { id: 't-f', time: 't', freq: 'f', timeDisplay: 't', freqDisplay: 'f' },
  { id: 't-nu', time: 't', freq: 'nu', timeDisplay: 't', freqDisplay: 'ν' },
  { id: 'x-xi', time: 'x', freq: 'xi', timeDisplay: 'x', freqDisplay: 'ξ' },
  { id: 'x-k', time: 'x', freq: 'k', timeDisplay: 'x', freqDisplay: 'k' },
  { id: 'custom', time: '', freq: '', timeDisplay: '', freqDisplay: '' },
];

@Component({
  selector: 'app-continuous-transform',
  templateUrl: './continuous-transform.component.html',
  imports: [
    NavComponent,
    MathjaxDirective,
    FunctionPlotComponent,
    TransformSegmentComponent,
    FormsModule,
  ],
})
export class ContinuousTransformComponent {
  readonly api = inject(ApiService);
  readonly plotter = inject(PlottingService);
  readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<'ft' | 'ift'>('ft');
  readonly varPairId = signal<string>('t-w');
  readonly customTime = signal('t');
  readonly customFreq = signal('w');
  readonly segments = signal<TransformSegmentDraft[]>([emptySegment()]);
  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly ftResult = signal<FourierTransformResponse | null>(null);
  readonly iftResult = signal<InverseFourierTransformResponse | null>(null);

  // ── Canvas layer toggles ─────────────────────────────────────────────────
  readonly showOriginal = signal(true);
  readonly showReal = signal(true);
  readonly showImag = signal(true);
  readonly showMag = signal(false);

  readonly varPairs = VAR_PAIRS;

  readonly activePair = computed<VarPair>(() => {
    const id = this.varPairId();
    if (id === 'custom') {
      const t = this.customTime() || 't';
      const f = this.customFreq() || 'w';
      return { id: 'custom', time: t, freq: f, timeDisplay: t, freqDisplay: f };
    }
    return VAR_PAIRS.find((p) => p.id === id) ?? VAR_PAIRS[0];
  });

  readonly intVar = computed(() => {
    const p = this.activePair();
    return this.mode() === 'ft' ? p.time : p.freq;
  });

  readonly transVar = computed(() => {
    const p = this.activePair();
    return this.mode() === 'ft' ? p.freq : p.time;
  });

  readonly inputFnLabel = computed(() => {
    const p = this.activePair();
    const v = this.mode() === 'ft' ? p.timeDisplay : p.freqDisplay;
    return this.mode() === 'ft' ? `f(${v})` : `F(${v})`;
  });

  readonly resultVarDisplay = computed(() => {
    const p = this.activePair();
    return this.mode() === 'ft' ? p.freqDisplay : p.timeDisplay;
  });

  readonly canCalculate = computed(() =>
    this.segments().every((s) => s.expression.trim() && s.from.trim() && s.to.trim()),
  );

  // ── Canvas layers ────────────────────────────────────────────────────────

  readonly layers = computed<PlotLayer[]>(() => {
    const ft = this.ftResult();
    const ift = this.iftResult();
    const segs = this.segments();
    const intVariable = this.intVar();
    const transVariable = this.transVar();

    const showOrig = this.showOriginal();
    const showRe = this.showReal();
    const showIm = this.showImag();
    const showM = this.showMag();

    const plotter = this.plotter;

    const ORIGINAL_COLOR = 'hsla(10,  70%, 45%, 0.75)';
    const REAL_COLOR = 'hsla(217, 70%, 55%, 0.85)';
    const IMAG_COLOR = 'hsla(38,  80%, 50%, 0.85)';
    const MAG_COLOR = 'hsla(145, 60%, 45%, 0.85)';

    const layer: PlotLayer = {
      curves: [],
      onDraw: (ctx, vp) => {
        // ── Original input function (piecewise) ──────────────────────────
        if (showOrig) {
          for (const seg of segs) {
            const fn = this.buildMaximaFn(seg.expression, intVariable);
            const from = this.parseLimit(seg.from);
            const to = this.parseLimit(seg.to);
            if (fn && isFinite(from) && isFinite(to)) {
              plotter.plotFnRange(ctx, fn, from, to, 400, vp, {
                color: ORIGINAL_COLOR,
                lineWidth: 2,
              });
            }
          }
        }

        // ── FT result layers ─────────────────────────────────────────────
        if (ft?.exists) {
          const reFn =
            showRe && ft.realPart?.maxima
              ? this.buildMaximaFn(ft.realPart.maxima, transVariable)
              : null;
          const imFn =
            showIm && ft.imagPart?.maxima
              ? this.buildMaximaFn(ft.imagPart.maxima, transVariable)
              : null;
          const magFn =
            showM && ft.realPart?.maxima && ft.imagPart?.maxima
              ? this.buildMagFn(ft.realPart.maxima, ft.imagPart.maxima, transVariable)
              : null;

          if (reFn) plotter.plotFn(ctx, reFn, vp, { color: REAL_COLOR, lineWidth: 2 });
          if (imFn) plotter.plotFn(ctx, imFn, vp, { color: IMAG_COLOR, lineWidth: 2 });
          if (magFn) plotter.plotFn(ctx, magFn, vp, { color: MAG_COLOR, lineWidth: 2 });
        }

        // ── IFT result layers ────────────────────────────────────────────
        if (ift?.exists && showRe) {
          if (ift.fCombined?.maxima) {
            // Combined form: plot across full visible range
            const fn = this.buildMaximaFn(ift.fCombined.maxima, transVariable);
            if (fn) plotter.plotFn(ctx, fn, vp, { color: REAL_COLOR, lineWidth: 2 });
          } else {
            // Piecewise: positive half for t > 0, negative half for t < 0
            if (ift.fPositive?.maxima) {
              const fn = this.buildMaximaFn(ift.fPositive.maxima, transVariable);
              if (fn)
                plotter.plotFnRange(ctx, fn, 0, 1e4, 600, vp, { color: REAL_COLOR, lineWidth: 2 });
            }
            if (ift.fNegative?.maxima) {
              const fn = this.buildMaximaFn(ift.fNegative.maxima, transVariable);
              if (fn)
                plotter.plotFnRange(ctx, fn, -1e4, 0, 600, vp, { color: REAL_COLOR, lineWidth: 2 });
            }
          }
        }
      },
    };

    return [layer];
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
    this.segments.update((s) => [...s, emptySegment()]);
  }

  removeSegment(id: string): void {
    this.segments.update((s) => s.filter((seg) => seg.id !== id));
  }

  updateSegment(id: string, changes: Partial<TransformSegmentDraft>): void {
    this.segments.update((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }

  // ── Calculate ─────────────────────────────────────────────────────────────

  calculate(): void {
    if (!this.canCalculate()) return;

    const segs = this.segments().map((s) => ({ expression: s.expression, from: s.from, to: s.to }));
    const intVar = this.intVar();
    const transVar = this.transVar();

    this.loading.set(true);
    this.errorMsg.set(null);
    this.ftResult.set(null);
    this.iftResult.set(null);

    const payload = { segments: segs, intVar, transVar };
    console.log('[transforms] payload →', JSON.stringify(payload, null, 2));

    if (this.mode() === 'ft') {
      this.api
        .calculateFourierTransform(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            console.log('[transforms] FT response →', res);
            this.ftResult.set(res);
            this.loading.set(false);
          },
          error: (e) => {
            console.error('[transforms] FT error →', e);
            this.errorMsg.set(e?.error?.error ?? 'Error al calcular la transformada');
            this.loading.set(false);
          },
        });
    } else {
      this.api
        .calculateInverseFourierTransform(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            console.log('[transforms] IFT response →', res);
            this.iftResult.set(res);
            this.loading.set(false);
          },
          error: (e) => {
            console.error('[transforms] IFT error →', e);
            this.errorMsg.set(e?.error?.error ?? 'Error al calcular la transformada inversa');
            this.loading.set(false);
          },
        });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  display(tex: string): string {
    return `\\[${tex}\\]`;
  }

  /** Convert a Maxima expression string to a JS function of one variable.
   *  Returns null if the expression is empty or can't be parsed. */
  buildMaximaFn(maximaExpr: string, variable: string): ((x: number) => number) | null {
    if (!maximaExpr?.trim()) return null;
    try {
      const js = maximaExpr
        // Constants
        .replace(/%pi/g, String(Math.PI))
        .replace(/%e(?![a-zA-Z_0-9])/g, String(Math.E))
        // Power operator
        .replace(/\^/g, '**')
        // Math functions
        .replace(/\babs\b/g, 'Math.abs')
        .replace(/\bsqrt\b/g, 'Math.sqrt')
        .replace(/\bsin\b/g, 'Math.sin')
        .replace(/\bcos\b/g, 'Math.cos')
        .replace(/\btan\b/g, 'Math.tan')
        .replace(/\bsinh\b/g, 'Math.sinh')
        .replace(/\bcosh\b/g, 'Math.cosh')
        .replace(/\btanh\b/g, 'Math.tanh')
        .replace(/\bexp\b/g, 'Math.exp')
        .replace(/\blog\b/g, 'Math.log')
        // Special transform functions
        .replace(/\bdelta\b\s*\([^)]*\)/g, '0') // Dirac delta → 0 (non-plottable)
        .replace(/\bu\b\s*\(([^)]*)\)/g, '($1 >= 0 ? 1 : 0)') // Heaviside step
        .replace(/\bsgn\b\s*\(/g, 'Math.sign(') // Sign function
        // Remove trailing Maxima terminators
        .replace(/\$+\s*$/g, '');

      // eslint-disable-next-line no-new-func
      const fn = new Function(
        variable,
        `try { const _r = (${js}); return isFinite(_r) ? _r : NaN; } catch { return NaN; }`,
      );
      return fn as (x: number) => number;
    } catch {
      return null;
    }
  }

  /** Builds |F(ω)| = sqrt(Re² + Im²) from two Maxima expressions. */
  private buildMagFn(
    reExpr: string,
    imExpr: string,
    variable: string,
  ): ((x: number) => number) | null {
    const reFn = this.buildMaximaFn(reExpr, variable);
    const imFn = this.buildMaximaFn(imExpr, variable);
    if (!reFn || !imFn) return null;
    return (x: number) => {
      const re = reFn(x);
      const im = imFn(x);
      return isFinite(re) && isFinite(im) ? Math.sqrt(re * re + im * im) : NaN;
    };
  }

  /** Convert a Maxima limit string (inf, minf, %pi, numbers) to a JS number. */
  parseLimit(s: string): number {
    if (!s?.trim()) return NaN;
    if (s === 'inf' || s === '+inf') return Infinity;
    if (s === 'minf' || s === '-inf') return -Infinity;
    try {
      const js = s
        .replace(/%pi/g, String(Math.PI))
        .replace(/%e(?![a-zA-Z_0-9])/g, String(Math.E))
        .replace(/\^/g, '**');
      // eslint-disable-next-line no-new-func
      return new Function(`return (${js})`)() as number;
    } catch {
      return NaN;
    }
  }
}
