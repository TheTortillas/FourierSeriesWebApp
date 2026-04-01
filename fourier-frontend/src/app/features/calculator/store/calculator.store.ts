import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../../core/services/api/api.service';
import { formatApiError } from '../../../shared/utils/api-error.utils';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import { UserStore } from '../../../core/services/auth/user.store';
import {
  TrigonometricResponse,
  TrigonometricTermsResponse,
  ComplexResponse,
  ComplexTermsResponse,
  HalfRangeResponse,
} from '../../../domain';

// ─── Draft types (UI-level) ───────────────────────────────────────────────────

export interface SegmentDraft {
  /** Stable id for Angular track-by */
  id: string;
  /** Expression in Maxima syntax (e.g. "x^2", "sin(x)", "%pi") */
  expression: string;
  /** Expression as LaTeX from MathQuill (for preview rendering) */
  expressionTex: string;
  /** Lower bound in Maxima syntax (e.g. "-%pi", "0") */
  from: string;
  /** Lower bound as LaTeX */
  fromTex: string;
  /** Upper bound in Maxima syntax (e.g. "%pi") */
  to: string;
  /** Upper bound as LaTeX */
  toTex: string;
}

export type SeriesType = 'trigonometric' | 'complex' | 'halfRange';

export type CalculatorResult =
  | { type: 'trigonometric'; data: TrigonometricResponse; terms: TrigonometricTermsResponse }
  | { type: 'complex'; data: ComplexResponse; terms: ComplexTermsResponse }
  | { type: 'halfRange'; data: HalfRangeResponse; terms: TrigonometricTermsResponse };

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _nextId = 0;
function nextId(): string {
  return `seg-${++_nextId}`;
}

function defaultSegment(): SegmentDraft {
  return {
    id: nextId(),
    expression: 'x',
    expressionTex: 'x',
    from: '-%pi',
    fromTex: '-\\pi',
    to: '%pi',
    toTex: '\\pi',
  };
}

function segmentError(s: SegmentDraft): string | null {
  if (!s.expression.trim()) return 'Expresión requerida';
  if (!s.from.trim()) return 'Límite inferior requerido';
  if (!s.to.trim()) return 'Límite superior requerido';
  return null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CalculatorStore {
  private readonly api       = inject(ApiService);
  private readonly math      = inject(MathUtilsService);
  private readonly userStore = inject(UserStore);
  private readonly transloco = inject(TranslocoService);
  private readonly allowedNTerms = [25, 50, 75, 100] as const;

  // ── Form state ─────────────────────────────────────────────────────────────
  readonly segments = signal<SegmentDraft[]>([defaultSegment()]);
  readonly seriesType = signal<SeriesType>('trigonometric');
  readonly nTerms = signal<number>(25);
  readonly intVar = signal<string>('x');

  // ── Result state ───────────────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<CalculatorResult | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  readonly segmentErrors = computed(() => this.segments().map(segmentError));

  readonly isValid = computed(() => this.segmentErrors().every((e) => e === null));

  readonly hasResult = computed(() => this.result() !== null);
  readonly inputsLocked = computed(() => this.loading() || this.hasResult());

  /** LaTeX string for the live f(x) = … preview above the inputs */
  readonly previewLatex = computed(() => {
    const segs = this.segments();
    const v = this.intVar();
    if (segs.length === 0) return null;
    if (segs.length === 1) {
      const s = segs[0];
      if (!s.expressionTex && !s.fromTex && !s.toTex) return null;
      return `f(${v}) = ${s.expressionTex || '\\square'}, \\quad ${s.fromTex || '\\square'} < ${v} < ${s.toTex || '\\square'}`;
    }
    const rows = segs
      .map(
        (s) =>
          `${s.expressionTex || '\\square'}, & ${s.fromTex || '\\square'} < ${v} < ${s.toTex || '\\square'}`,
      )
      .join(' \\\\ ');
    return `f(${v}) = \\begin{cases} ${rows} \\end{cases}`;
  });

  /** Compiled JS functions for live canvas preview (one per segment) */
  readonly previewFunctions = computed(() => {
    const v = this.intVar();
    return this.segments().map((s) => ({
      fn: this.math.compile(s.expression, v),
      from: this.parseFloat(s.from),
      to: this.parseFloat(s.to),
    }));
  });

  // ── Segment mutations ──────────────────────────────────────────────────────

  addSegment(): void {
    if (this.inputsLocked()) return;
    this.segments.update((segs) => [
      ...segs,
      {
        id: nextId(),
        expression: '',
        expressionTex: '',
        from: segs.at(-1)?.to ?? '0',
        fromTex: segs.at(-1)?.toTex ?? '0',
        to: '',
        toTex: '',
      },
    ]);
  }

  removeSegment(id: string): void {
    if (this.inputsLocked()) return;
    this.segments.update((segs) => (segs.length > 1 ? segs.filter((s) => s.id !== id) : segs));
  }

  updateSegment(id: string, patch: Partial<Omit<SegmentDraft, 'id'>>): void {
    if (this.inputsLocked()) return;
    this.segments.update((segs) => segs.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  setSeriesType(type: SeriesType): void {
    if (this.inputsLocked()) return;
    this.seriesType.set(type);
  }

  setNTerms(n: number): void {
    if (this.inputsLocked()) return;
    const parsed = Number(n);
    const next = this.allowedNTerms.includes(parsed as (typeof this.allowedNTerms)[number])
      ? parsed
      : 25;
    this.nTerms.set(next);
  }

  setIntVar(v: string): void {
    if (this.inputsLocked()) return;
    const next = v || 'x';
    const prev = this.intVar();
    if (prev === next) return;
    this.intVar.set(next);
    // Rename the old variable in all segment expressions (word-boundary safe)
    const re = new RegExp(`\\b${prev}\\b`, 'g');
    this.segments.update((segs) =>
      segs.map((s) => ({
        ...s,
        expression: s.expression.replace(re, next),
        expressionTex: s.expressionTex.replace(re, next),
      })),
    );
  }

  resetForm(): void {
    this.segments.set([defaultSegment()]);
    this.seriesType.set('trigonometric');
    this.nTerms.set(25);
    this.intVar.set('x');
    this.result.set(null);
    this.error.set(null);
  }

  /** Clears computed Fourier outputs but keeps the current piecewise function inputs. */
  clearComputedResult(): void {
    this.loading.set(false);
    this.result.set(null);
    this.error.set(null);
  }

  // ── API calls ──────────────────────────────────────────────────────────────

  calculate(): void {
    if (!this.isValid()) return;

    const type = this.seriesType();
    const req = {
      segments: this.segments().map((s) => ({
        expression: s.expression,
        expressionTex: s.expressionTex,
        from: s.from,
        fromTex: s.fromTex,
        to: s.to,
        toTex: s.toTex,
      })),
      seriesType: type,
      intVar: this.intVar(),
    };

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    const terms$ = { input: req, nTerms: this.nTerms() };

    if (type === 'trigonometric') {
      this.api.calculateTrigonometric(req).subscribe({
        next: (data) => {
          if (data.validation?.decision === 'reject') {
            this.result.set({
              type: 'trigonometric',
              data,
              terms: { terms: [], executionTimeMs: 0 },
            });
            this.loading.set(false);
            this.userStore.refreshQuota();
            return;
          }

          this.api.calculateTrigonometricTerms(terms$).subscribe({
            next: (terms) => {
              this.result.set({ type: 'trigonometric', data, terms });
              this.loading.set(false);
              this.userStore.refreshQuota();
            },
            error: (e) => this.handleError(e),
          });
        },
        error: (e) => this.handleError(e),
      });
    } else if (type === 'complex') {
      this.api.calculateComplex(req).subscribe({
        next: (data) => {
          if (data.validation?.decision === 'reject') {
            this.result.set({
              type: 'complex',
              data,
              terms: { terms: [], executionTimeMs: 0 },
            });
            this.loading.set(false);
            this.userStore.refreshQuota();
            return;
          }

          this.api.calculateComplexTerms(terms$).subscribe({
            next: (terms) => {
              this.result.set({ type: 'complex', data, terms });
              this.loading.set(false);
              this.userStore.refreshQuota();
            },
            error: (e) => this.handleError(e),
          });
        },
        error: (e) => this.handleError(e),
      });
    } else {
      this.api.calculateHalfRange(req).subscribe({
        next: (data) => {
          if (data.validation?.decision === 'reject') {
            this.result.set({
              type: 'halfRange',
              data,
              terms: { terms: [], executionTimeMs: 0 },
            });
            this.loading.set(false);
            this.userStore.refreshQuota();
            return;
          }

          this.api.calculateHalfRangeTerms(terms$).subscribe({
            next: (terms) => {
              this.result.set({ type: 'halfRange', data, terms });
              this.loading.set(false);
              this.userStore.refreshQuota();
            },
            error: (e) => this.handleError(e),
          });
        },
        error: (e) => this.handleError(e),
      });
    }
  }

  // ── URL state persistence ──────────────────────────────────────────────────

  /**
   * Serializes the current form state (segments, seriesType, nTerms) to a
   * compact base64 string suitable for use as a URL query parameter.
   */
  encodeState(): string {
    const state = {
      seg: this.segments().map((s) => ({
        e: s.expression,
        et: s.expressionTex,
        f: s.from,
        ft: s.fromTex,
        t: s.to,
        tt: s.toTex,
      })),
      type: this.seriesType(),
      n: this.nTerms(),
      iv: this.intVar(),
    };
    try {
      // encodeURIComponent+unescape is the classic safe UTF-8→base64 path
      return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    } catch {
      return '';
    }
  }

  /**
   * Decodes a URL state string produced by encodeState() and applies it to the
   * store.  Returns true if the state was valid and successfully restored.
   */
  restoreState(encoded: string): boolean {
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const s = JSON.parse(json) as {
        seg: Array<{ e: string; et: string; f: string; ft: string; t: string; tt: string }>;
        type: SeriesType;
        n: number;
        iv?: string;
      };

      const validTypes: SeriesType[] = ['trigonometric', 'complex', 'halfRange'];
      if (!Array.isArray(s.seg) || !s.seg.length || !validTypes.includes(s.type)) return false;

      this.segments.set(
        s.seg.map((seg) => ({
          id: nextId(),
          expression: seg.e ?? '',
          expressionTex: seg.et ?? '',
          from: seg.f ?? '',
          fromTex: seg.ft ?? '',
          to: seg.t ?? '',
          toTex: seg.tt ?? '',
        })),
      );
      this.seriesType.set(s.type);
      if (typeof s.n === 'number') this.setNTerms(s.n);
      if (s.iv) this.intVar.set(s.iv);
      return true;
    } catch {
      return false;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Restores form from a raw history input record.
   * Uses Maxima expressions directly (no LaTeX available in history).
   */
  restoreFromInput(input: Record<string, unknown>): void {
    const segments = input['segments'] as
      | Array<{ expression: string; expressionTex?: string; from: string; fromTex?: string; to: string; toTex?: string }>
      | undefined;
    if (!segments?.length) return;

    const validTypes: SeriesType[] = ['trigonometric', 'complex', 'halfRange'];
    const type = input['seriesType'] as SeriesType | undefined;
    const harmonics = input['harmonics'] as number | undefined;
    const intVar = input['intVar'] as string | undefined;

    this.segments.set(
      segments.map((seg) => ({
        id: nextId(),
        expression: seg.expression ?? '',
        expressionTex: seg.expressionTex ?? seg.expression ?? '',
        from: seg.from ?? '',
        fromTex: seg.fromTex ?? seg.from ?? '',
        to: seg.to ?? '',
        toTex: seg.toTex ?? seg.to ?? '',
      })),
    );
    if (type && validTypes.includes(type)) this.seriesType.set(type);
    if (typeof harmonics === 'number') this.setNTerms(harmonics);
    if (intVar) this.intVar.set(intVar);
  }

  private handleError(e: unknown): void {
    this.loading.set(false);
    this.error.set(formatApiError(
      e,
      this.transloco.translate('errors.generic'),
      (key, params) => this.transloco.translate(key, params ?? {}),
      this.transloco.getActiveLang(),
    ));
  }

  /**
   * Parses a Maxima boundary string to a JS float for canvas preview.
   * Handles: %pi, -%pi, %pi/2, plain numbers.
   */
  parseFloat(maxima: string): number {
    if (!maxima.trim()) return NaN;
    const js = maxima
      .replace(/%pi/g, String(Math.PI))
      .replace(/%e/g, String(Math.E))
      .replace(/\^/g, '**');
    try {
      // eslint-disable-next-line no-new-func
      const v = new Function(`return (${js})`)() as number;
      return isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  }
}
