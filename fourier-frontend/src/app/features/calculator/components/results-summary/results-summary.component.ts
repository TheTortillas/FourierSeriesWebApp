import { Component, computed, inject } from '@angular/core';
import { CalculatorStore } from '../../store/calculator.store';
import { FunctionPlotComponent, PlotLayer } from '../../../../shared/components/function-plot/function-plot.component';
import { FourierReconstructionService, TrigNumericTerm, ComplexNumericTerm } from '../../../../core/services/canvas/fourier-reconstruction.service';
import { PlottingService } from '../../../../core/services/canvas/plotting.service';

@Component({
  selector: 'app-results-summary',
  imports: [FunctionPlotComponent],
  templateUrl: './results-summary.component.html',
})
export class ResultsSummaryComponent {
  readonly store          = inject(CalculatorStore);
  readonly reconstruction = inject(FourierReconstructionService);
  readonly plotter        = inject(PlottingService);

  /** Canvas layers: original function + Fourier approximation */
  readonly layers = computed<PlotLayer[]>(() => {
    const result   = this.store.result();
    const previews = this.store.previewFunctions();
    const nTerms   = this.store.nTerms();
    const plotter  = this.plotter;
    const rec      = this.reconstruction;

    if (!result) {
      // No result yet: only show the original function preview
      return [{
        curves: [],
        onDraw(ctx, vp) {
          for (const { fn, from, to } of previews) {
            if (fn && isFinite(from) && isFinite(to)) {
              plotter.plotFnRange(ctx, fn, from, to, 400, vp,
                { color: '#8b2500', lineWidth: 2.5 });
            }
          }
        },
      }];
    }

    // Build approximation function from result
    const w0 = rec.parseW0(result.data.w0.maxima);

    let approxFn: ((x: number) => number) | null = null;

    if (result.type === 'trigonometric' || result.type === 'halfRange') {
      const terms  = result.terms.terms as TrigNumericTerm[];
      const a0Raw  = result.data.a0Raw?.maxima ?? '0';
      // eslint-disable-next-line no-new-func
      const a0 = (() => { try { return new Function(`return (${a0Raw.replace(/%pi/g, String(Math.PI)).replace(/%e/g, String(Math.E)).replace(/\^/g, '**')})`)() as number; } catch { return 0; } })();
      approxFn = rec.buildTrigonometric(a0, terms, w0, nTerms);
    } else if (result.type === 'complex') {
      const terms = result.terms.terms as ComplexNumericTerm[];
      const c0raw = result.data.coefficients.c0.maxima;
      // eslint-disable-next-line no-new-func
      const c0 = (() => { try { return new Function(`return (${c0raw.replace(/%pi/g, String(Math.PI)).replace(/%e/g, String(Math.E)).replace(/\^/g, '**')})`)() as number; } catch { return 0; } })();
      approxFn = rec.buildComplex(c0, terms, w0, nTerms);
    }

    const localApprox = approxFn;

    return [{
      curves: [],
      onDraw(ctx, vp) {
        // Original function (bounded to piece intervals)
        for (const { fn, from, to } of previews) {
          if (fn && isFinite(from) && isFinite(to)) {
            plotter.plotFnRange(ctx, fn, from, to, 400, vp,
              { color: '#8b2500', lineWidth: 2.5 });
          }
        }
        // Fourier approximation (fills visible range)
        if (localApprox) {
          plotter.plotFn(ctx, localApprox, vp,
            { color: '#1a4a6b', lineWidth: 1.75 });
        }
      },
    }];
  });

  /** LaTeX coefficient strings for display */
  readonly coeffTex = computed(() => {
    const result = this.store.result();
    if (!result) return null;

    if (result.type === 'trigonometric' || result.type === 'halfRange') {
      const c = result.data.coefficients;
      return {
        a0: c.a0?.tex ?? null,
        an: c.an?.tex ?? null,
        bn: c.bn?.tex ?? null,
        w0: result.data.w0.tex,
        series: 'series' in result.data ? result.data.series?.tex : null,
      };
    }
    if (result.type === 'complex') {
      const c = result.data.coefficients;
      return {
        c0: c.c0.tex,
        cn: c.cn.tex,
        w0: result.data.w0.tex,
        series: result.data.seriesComplex?.tex ?? null,
      };
    }
    return null;
  });

  readonly execTime = computed(() => {
    const r = this.store.result();
    return r ? r.data.executionTimeMs : null;
  });

  readonly termTableHeader = computed<[string, string]>(() => {
    const r = this.store.result();
    if (r?.type === 'complex') return ['|cₙ|', '∠cₙ'];
    return ['aₙ', 'bₙ'];
  });

  /** First 5 numeric terms as unified rows for the table */
  readonly termRows = computed<{ n: number; col1: string; col2: string }[]>(() => {
    const r = this.store.result();
    if (!r) return [];
    if (r.type === 'trigonometric' || r.type === 'halfRange') {
      return r.terms.terms.slice(0, 5).map((t) => ({
        n:    t.n,
        col1: (t as TrigNumericTerm).anFloat.toFixed(6),
        col2: (t as TrigNumericTerm).bnFloat.toFixed(6),
      }));
    }
    if (r.type === 'complex') {
      return r.terms.terms.slice(0, 5).map((t) => ({
        n:    t.n,
        col1: (t as ComplexNumericTerm).amplitude.toFixed(6),
        col2: (t as ComplexNumericTerm).phase.toFixed(6),
      }));
    }
    return [];
  });
}
