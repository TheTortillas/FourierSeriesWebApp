import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, finalize } from 'rxjs';
import { CalculatorStore } from '../../store/calculator.store';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../../shared/components/function-plot/function-plot.component';
import {
  FourierReconstructionService,
  TrigNumericTerm,
  ComplexNumericTerm,
} from '../../../../core/services/canvas/fourier-reconstruction.service';
import { PlottingService } from '../../../../core/services/canvas/plotting.service';
import { MathjaxDirective } from '../../../../shared/directives/mathjax.directive';
import { ApiService } from '../../../../core/services/api/api.service';
import { SimplifyProfile } from '../../../../domain';

@Component({
  selector: 'app-results-summary',
  imports: [FunctionPlotComponent, MathjaxDirective],
  templateUrl: './results-summary.component.html',
})
export class ResultsSummaryComponent {
  readonly store = inject(CalculatorStore);
  readonly reconstruction = inject(FourierReconstructionService);
  readonly plotter = inject(PlottingService);
  readonly api = inject(ApiService);
  readonly destroyRef = inject(DestroyRef);

  // ── Simplify state ──────────────────────────────────────────────────────────
  readonly simplifyProfile = signal<SimplifyProfile>('raw');
  readonly simplifying = signal(false);
  readonly simplifiedCoeffs = signal<Record<string, string> | null>(null);

  // exponential sub-flags (only relevant when profile === 'exponential')
  readonly expFlag = signal<'exponentialize' | 'demoivre'>('exponentialize');

  // half-range series mode (only relevant when result.type === 'halfRange')
  readonly halfRangeMode = signal<'cosine' | 'sine'>('cosine');

  // ── Helper: parse a Maxima string to number ─────────────────────────────────
  private parseMaxima(s: string): number {
    try {
      // eslint-disable-next-line no-new-func
      return new Function(
        `return (${s.replace(/%pi/g, String(Math.PI)).replace(/%e/g, String(Math.E)).replace(/\^/g, '**')})`,
      )() as number;
    } catch {
      return 0;
    }
  }

  /** Canvas layers: original function + Fourier approximation */
  readonly layers = computed<PlotLayer[]>(() => {
    const result = this.store.result();
    const previews = this.store.previewFunctions();
    const nTerms = this.store.nTerms();
    const hrMode = this.halfRangeMode();
    const plotter = this.plotter;
    const rec = this.reconstruction;

    if (!result) {
      // No result yet: only show the original function preview
      return [
        {
          curves: [],
          onDraw(ctx, vp) {
            for (const { fn, from, to } of previews) {
              if (fn && isFinite(from) && isFinite(to)) {
                plotter.plotFnRange(ctx, fn, from, to, 400, vp, {
                  color: '#8b2500',
                  lineWidth: 2.5,
                });
              }
            }
          },
        },
      ];
    }

    // Build approximation function from result
    const w0 = rec.parseW0(result.data.w0.maxima);

    let approxFn: ((x: number) => number) | null = null;

    if (result.type === 'trigonometric') {
      const terms = result.terms.terms as TrigNumericTerm[];
      const a0 = result.data.coefficients.a0Float ?? 0;
      approxFn = rec.buildTrigonometric(a0, terms, w0, nTerms);
    } else if (result.type === 'halfRange') {
      const terms = result.terms.terms as TrigNumericTerm[];
      if (hrMode === 'cosine') {
        const a0 = result.data.coefficients.a0Float ?? 0;
        approxFn = rec.buildCosineOnly(a0, terms, w0, nTerms);
      } else {
        approxFn = rec.buildSineOnly(terms, w0, nTerms);
      }
    } else if (result.type === 'complex') {
      const terms = result.terms.terms as ComplexNumericTerm[];
      const c0 =
        result.data.coefficients.c0Float ?? this.parseMaxima(result.data.coefficients.c0.maxima);
      approxFn = rec.buildComplex(c0, terms, w0, nTerms);
    }

    const localApprox = approxFn;

    return [
      {
        curves: [],
        onDraw(ctx, vp) {
          // Original function (bounded to piece intervals)
          for (const { fn, from, to } of previews) {
            if (fn && isFinite(from) && isFinite(to)) {
              plotter.plotFnRange(ctx, fn, from, to, 400, vp, { color: '#8b2500', lineWidth: 2.5 });
            }
          }
          // Fourier approximation (fills visible range)
          if (localApprox) {
            plotter.plotFn(ctx, localApprox, vp, { color: '#1a4a6b', lineWidth: 1.75 });
          }
        },
      },
    ];
  });

  /** LaTeX coefficient strings for display */
  readonly coeffTex = computed(() => {
    const result = this.store.result();
    const hrMode = this.halfRangeMode();
    if (!result) return null;

    if (result.type === 'trigonometric') {
      const c = result.data.coefficients;
      return {
        a0: c.a0?.tex ?? null,
        an: c.an?.tex ?? null,
        bn: c.bn?.tex ?? null,
        w0: result.data.w0.tex,
      };
    }
    if (result.type === 'halfRange') {
      const c = result.data.coefficients;
      return hrMode === 'cosine'
        ? { a0: c.a0?.tex ?? null, an: c.an?.tex ?? null, w0: result.data.w0.tex }
        : { bn: c.bn?.tex ?? null, w0: result.data.w0.tex };
    }
    if (result.type === 'complex') {
      const c = result.data.coefficients;
      return { c0: c.c0.tex, cn: c.cn.tex, w0: result.data.w0.tex };
    }
    return null;
  });

  /** Active coefficient LaTeX: uses simplified values when available, else falls back to coeffTex */
  readonly activeCoeffTex = computed(() => {
    const simplified = this.simplifiedCoeffs();
    const base = this.coeffTex();
    if (!base) return null;
    if (!simplified) return base;

    return {
      ...base,
      ...(simplified['a0'] !== undefined ? { a0: simplified['a0'] } : {}),
      ...(simplified['an'] !== undefined ? { an: simplified['an'] } : {}),
      ...(simplified['bn'] !== undefined ? { bn: simplified['bn'] } : {}),
      ...(simplified['c0'] !== undefined ? { c0: simplified['c0'] } : {}),
      ...(simplified['cn'] !== undefined ? { cn: simplified['cn'] } : {}),
      ...(simplified['w0'] !== undefined ? { w0: simplified['w0'] } : {}),
    };
  });

  readonly execTime = computed(() => {
    const r = this.store.result();
    return r ? r.data.executionTimeMs : null;
  });

  readonly termTableHeader = computed<[string, string]>(() => {
    const r = this.store.result();
    if (r?.type === 'complex') return ['|cₙ|', '∠cₙ (rad)'];
    if (r?.type === 'halfRange') {
      return this.halfRangeMode() === 'cosine' ? ['aₙ', '—'] : ['bₙ', '—'];
    }
    return ['aₙ', 'bₙ'];
  });

  /** Numeric terms rows for the table (all terms, including n=0) */
  readonly termRows = computed<
    { n: number; col1: string; col2: string; lim1: boolean; lim2: boolean }[]
  >(() => {
    const r = this.store.result();
    if (!r) return [];

    if (r.type === 'trigonometric') {
      const a0Float = r.data.coefficients.a0Float;
      // a0Float is Coeff_A0_Raw; a0Float/2 = Coeff_A0 is the actual a₀ in the series
      const row0 =
        a0Float !== undefined
          ? [{ n: 0, col1: (a0Float / 2).toFixed(6), col2: '—', lim1: false, lim2: false }]
          : [];
      const rows = r.terms.terms.map((t) => {
        const term = t as TrigNumericTerm;
        return {
          n: term.n,
          col1: term.anFloat.toFixed(6),
          col2: term.bnFloat.toFixed(6),
          lim1: !!term.anUsedLimit,
          lim2: !!term.bnUsedLimit,
        };
      });
      return [...row0, ...rows];
    }

    if (r.type === 'halfRange') {
      const isSine = this.halfRangeMode() === 'sine';
      const a0Float = r.data.coefficients.a0Float;
      // Cosine expansion: n=0 shows a₀ = a0Float/2 (the actual constant term)
      // Sine expansion: no constant term, so no n=0 row
      const row0 =
        !isSine && a0Float !== undefined
          ? [{ n: 0, col1: (a0Float / 2).toFixed(6), col2: '—', lim1: false, lim2: false }]
          : [];
      const rows = r.terms.terms.map((t) => {
        const term = t as TrigNumericTerm;
        return isSine
          ? {
              n: term.n,
              col1: term.bnFloat.toFixed(6),
              col2: '—',
              lim1: !!term.bnUsedLimit,
              lim2: false,
            }
          : {
              n: term.n,
              col1: term.anFloat.toFixed(6),
              col2: '—',
              lim1: !!term.anUsedLimit,
              lim2: false,
            };
      });
      return [...row0, ...rows];
    }

    if (r.type === 'complex') {
      const c0Float = r.data.coefficients.c0Float;
      const row0 =
        c0Float !== undefined
          ? [
              {
                n: 0,
                col1: Math.abs(c0Float).toFixed(6),
                col2: '0.000000',
                lim1: false,
                lim2: false,
              },
            ]
          : [];
      const rows = r.terms.terms.map((t) => {
        const term = t as ComplexNumericTerm;
        return {
          n: term.n,
          col1: term.amplitude.toFixed(6),
          col2: term.phase.toFixed(6),
          lim1: !!term.cnUsedLimit,
          lim2: !!term.cnNegUsedLimit,
        };
      });
      return [...row0, ...rows];
    }

    return [];
  });

  // ── Profile selector options ────────────────────────────────────────────────
  readonly profileOptions: { value: SimplifyProfile; label: string }[] = [
    { value: 'raw', label: 'Sin simp.' },
    { value: 'integer', label: 'Entero' },
    { value: 'trigonometric', label: 'Trig.' },
    { value: 'exponential', label: 'Exp.' },
    { value: 'complete', label: 'Completo' },
  ];

  // ── Simplify actions ────────────────────────────────────────────────────────

  setHalfRangeMode(mode: 'cosine' | 'sine'): void {
    this.halfRangeMode.set(mode);
    this.simplifiedCoeffs.set(null);
    this.simplifyProfile.set('raw');
  }

  setProfile(profile: SimplifyProfile): void {
    this.simplifyProfile.set(profile);
    if (profile === 'raw') {
      this.simplifiedCoeffs.set(null);
    } else {
      this.simplifyAll(profile);
    }
  }

  setExpFlag(flag: 'exponentialize' | 'demoivre'): void {
    this.expFlag.set(flag);
    if (this.simplifyProfile() === 'exponential') {
      this.simplifyAll('exponential', flag);
    }
  }

  simplifyAll(
    profile: SimplifyProfile,
    flag: 'exponentialize' | 'demoivre' = this.expFlag(),
  ): void {
    const result = this.store.result();
    if (!result) return;

    this.simplifying.set(true);

    const displayFlags =
      profile === 'exponential'
        ? flag === 'exponentialize'
          ? { exponentialize: true }
          : { demoivre: true }
        : undefined;

    const calls: Record<string, ReturnType<typeof this.api.simplify>> = {};

    if (result.type === 'trigonometric') {
      const c = result.data.coefficients;
      if (c.a0?.maxima)
        calls['a0'] = this.api.simplify({ expression: c.a0.maxima, profile, displayFlags });
      if (c.an?.maxima)
        calls['an'] = this.api.simplify({ expression: c.an.maxima, profile, displayFlags });
      if (c.bn?.maxima)
        calls['bn'] = this.api.simplify({ expression: c.bn.maxima, profile, displayFlags });
    } else if (result.type === 'halfRange') {
      const c = result.data.coefficients;
      const hrMode = this.halfRangeMode();
      if (hrMode === 'cosine') {
        if (c.a0?.maxima)
          calls['a0'] = this.api.simplify({ expression: c.a0.maxima, profile, displayFlags });
        if (c.an?.maxima)
          calls['an'] = this.api.simplify({ expression: c.an.maxima, profile, displayFlags });
      } else {
        if (c.bn?.maxima)
          calls['bn'] = this.api.simplify({ expression: c.bn.maxima, profile, displayFlags });
      }
    } else if (result.type === 'complex') {
      const c = result.data.coefficients;
      if (c.c0?.maxima) {
        calls['c0'] = this.api.simplify({ expression: c.c0.maxima, profile, displayFlags });
      }
      if (c.cn?.maxima) {
        calls['cn'] = this.api.simplify({ expression: c.cn.maxima, profile, displayFlags });
      }
    }

    if (Object.keys(calls).length === 0) {
      this.simplifying.set(false);
      return;
    }

    forkJoin(calls)
      .pipe(
        finalize(() => this.simplifying.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((responses) => {
        const simplified: Record<string, string> = {};
        for (const [key, res] of Object.entries(responses)) {
          simplified[key] = res.simplified.tex;
        }
        this.simplifiedCoeffs.set(simplified);
      });
  }
}
