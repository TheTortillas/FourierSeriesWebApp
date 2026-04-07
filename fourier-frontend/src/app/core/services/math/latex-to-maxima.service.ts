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

  /** Symbolically compare multiple boundary pairs via the backend.
   *  Pairs must be in Maxima syntax (the stored `.from`/`.to` values). */
  compareIntervals(
    pairs: Array<{ a: string; b: string }>,
  ): Observable<Array<'equal' | 'different' | 'unknown'>> {
    if (pairs.length === 0) return of([]);
    return this.api.compareIntervals(pairs).pipe(
      map((r) => r.results),
      catchError(() => of(pairs.map(() => 'unknown' as const))),
    );
  }
}
