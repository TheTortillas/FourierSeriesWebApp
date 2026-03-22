import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../../core/services/api/api.service';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
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
  /** Lower bound in Maxima syntax (e.g. "-%pi", "0") */
  from: string;
  /** Upper bound in Maxima syntax (e.g. "%pi") */
  to: string;
}

export type SeriesType = 'trigonometric' | 'complex' | 'halfRange';

export type CalculatorResult =
  | { type: 'trigonometric'; data: TrigonometricResponse; terms: TrigonometricTermsResponse }
  | { type: 'complex';       data: ComplexResponse;       terms: ComplexTermsResponse       }
  | { type: 'halfRange';     data: HalfRangeResponse;     terms: TrigonometricTermsResponse };

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _nextId = 0;
function nextId(): string { return `seg-${++_nextId}`; }

function defaultSegment(): SegmentDraft {
  return { id: nextId(), expression: 'x', from: '-%pi', to: '%pi' };
}

function segmentError(s: SegmentDraft): string | null {
  if (!s.expression.trim()) return 'Expresión requerida';
  if (!s.from.trim())       return 'Límite inferior requerido';
  if (!s.to.trim())         return 'Límite superior requerido';
  return null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CalculatorStore {
  private readonly api   = inject(ApiService);
  private readonly math  = inject(MathUtilsService);

  // ── Form state ─────────────────────────────────────────────────────────────
  readonly segments   = signal<SegmentDraft[]>([defaultSegment()]);
  readonly seriesType = signal<SeriesType>('trigonometric');
  readonly nTerms     = signal<number>(10);

  // ── Result state ───────────────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);
  readonly result  = signal<CalculatorResult | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  readonly segmentErrors = computed(() =>
    this.segments().map(segmentError),
  );

  readonly isValid = computed(() =>
    this.segmentErrors().every((e) => e === null),
  );

  readonly hasResult = computed(() => this.result() !== null);

  /** Compiled JS functions for live canvas preview (one per segment) */
  readonly previewFunctions = computed(() =>
    this.segments().map((s) => ({
      fn:   this.math.compile(s.expression),
      from: this.parseFloat(s.from),
      to:   this.parseFloat(s.to),
    })),
  );

  // ── Segment mutations ──────────────────────────────────────────────────────

  addSegment(): void {
    this.segments.update((segs) => [
      ...segs,
      { id: nextId(), expression: '', from: segs.at(-1)?.to ?? '0', to: '' },
    ]);
  }

  removeSegment(id: string): void {
    this.segments.update((segs) =>
      segs.length > 1 ? segs.filter((s) => s.id !== id) : segs,
    );
  }

  updateSegment(id: string, patch: Partial<Omit<SegmentDraft, 'id'>>): void {
    this.segments.update((segs) =>
      segs.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }

  setSeriesType(type: SeriesType): void {
    this.seriesType.set(type);
  }

  setNTerms(n: number): void {
    this.nTerms.set(Math.max(1, Math.min(50, n)));
  }

  resetForm(): void {
    this.segments.set([defaultSegment()]);
    this.seriesType.set('trigonometric');
    this.nTerms.set(10);
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
        from:       s.from,
        to:         s.to,
      })),
      seriesType: type,
    };

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    const terms$ = { input: req, nTerms: this.nTerms() };

    if (type === 'trigonometric') {
      this.api.calculateTrigonometricTerms(terms$).subscribe({
        next: (terms) => {
          this.api.calculateTrigonometric(req).subscribe({
            next: (data) => {
              this.result.set({ type: 'trigonometric', data, terms });
              this.loading.set(false);
            },
            error: (e) => this.handleError(e),
          });
        },
        error: (e) => this.handleError(e),
      });
    } else if (type === 'complex') {
      this.api.calculateComplexTerms(terms$).subscribe({
        next: (terms) => {
          this.api.calculateComplex(req).subscribe({
            next: (data) => {
              this.result.set({ type: 'complex', data, terms });
              this.loading.set(false);
            },
            error: (e) => this.handleError(e),
          });
        },
        error: (e) => this.handleError(e),
      });
    } else {
      this.api.calculateHalfRangeTerms(terms$).subscribe({
        next: (terms) => {
          this.api.calculateHalfRange(req).subscribe({
            next: (data) => {
              this.result.set({ type: 'halfRange', data, terms });
              this.loading.set(false);
            },
            error: (e) => this.handleError(e),
          });
        },
        error: (e) => this.handleError(e),
      });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private handleError(e: unknown): void {
    this.loading.set(false);
    if (e instanceof HttpErrorResponse) {
      this.error.set(e.error?.error ?? e.message);
    } else {
      this.error.set('Error desconocido');
    }
  }

  /**
   * Parses a Maxima boundary string to a JS float for canvas preview.
   * Handles: %pi, -%pi, %pi/2, plain numbers.
   */
  parseFloat(maxima: string): number {
    if (!maxima.trim()) return NaN;
    const js = maxima
      .replace(/%pi/g, String(Math.PI))
      .replace(/%e/g,  String(Math.E))
      .replace(/\^/g,  '**');
    try {
      // eslint-disable-next-line no-new-func
      const v = new Function(`return (${js})`)() as number;
      return isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  }
}
