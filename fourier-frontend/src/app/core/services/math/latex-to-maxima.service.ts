import { Injectable, inject } from '@angular/core';
import { Observable, of, catchError, map } from 'rxjs';
import { ApiService } from '../api/api.service';

export interface ConversionResult {
  maxima: string;
  ok: boolean;
  error?: string;
}

/**
 * Converts LaTeX math expressions to Maxima CAS syntax via the backend API.
 * tex2max (GPL v2) runs server-side only — this service is a thin HTTP client.
 */
@Injectable({ providedIn: 'root' })
export class LatexToMaximaService {
  private readonly api = inject(ApiService);

  convert(latex: string): Observable<ConversionResult> {
    if (!latex.trim()) {
      return of({ maxima: '', ok: false, error: 'Expresión vacía' });
    }
    return this.api.parseLaTeX(latex, 'series').pipe(
      catchError((err) => {
        const error = err?.error?.error ?? 'Error de conexión al parsear la expresión';
        return of({ maxima: '', ok: false, error } as ConversionResult);
      }),
    );
  }

  convertForTransforms(latex: string): Observable<ConversionResult> {
    if (!latex.trim()) {
      return of({ maxima: '', ok: false, error: 'Expresión vacía' });
    }
    return this.api.parseLaTeX(latex, 'transform').pipe(
      catchError((err) => {
        const error = err?.error?.error ?? 'Error de conexión al parsear la expresión';
        return of({ maxima: '', ok: false, error } as ConversionResult);
      }),
    );
  }

  /** Validates segment boundaries via a single backend call.
   *  - `pairs`      → continuity: ratsimp(a-b)=0 between adjacent segments
   *  - `orderPairs` → order: is(from < to) per segment (unknown = symbolic, ignored)
   *  All expressions must be in Maxima syntax. */
  validateBoundaries(body: {
    pairs?: Array<{ a: string; b: string }>;
    orderPairs?: Array<{ a: string; b: string }>;
  }): Observable<{
    results: Array<'equal' | 'different' | 'unknown'>;
    orderResults: Array<'valid' | 'invalid' | 'unknown'>;
  }> {
    const hasPairs = (body.pairs?.length ?? 0) > 0;
    const hasOrder = (body.orderPairs?.length ?? 0) > 0;
    if (!hasPairs && !hasOrder) {
      return of({ results: [], orderResults: [] });
    }
    return this.api.compareIntervals(body).pipe(
      map((r) => ({
        results: r.results ?? [],
        orderResults: r.orderResults ?? [],
      })),
      catchError(() => of({
        results: (body.pairs ?? []).map(() => 'unknown' as const),
        orderResults: (body.orderPairs ?? []).map(() => 'unknown' as const),
      })),
    );
  }
}
