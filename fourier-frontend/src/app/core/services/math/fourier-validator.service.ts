import { Injectable } from '@angular/core';
import { Segment } from '../../../domain';

export interface SegmentError {
  index: number;
  field: 'expression' | 'from' | 'to';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: SegmentError[];
}

/**
 * Client-side validation for piecewise function segments.
 *
 * Validates:
 * - Each segment has a non-empty expression, from, and to.
 * - `from` < `to` for each segment (numeric check for simple cases).
 * - Segments are contiguous: segment[i].to === segment[i+1].from
 *   (checked as strings, since they may be symbolic like `-%pi`).
 * - No overlapping ranges.
 *
 * SSR-safe: no DOM dependencies.
 */
@Injectable({ providedIn: 'root' })
export class FourierValidatorService {
  validate(segments: Segment[]): ValidationResult {
    const errors: SegmentError[] = [];

    if (segments.length === 0) {
      return {
        valid: false,
        errors: [{ index: 0, field: 'expression', message: 'Se requiere al menos un tramo.' }],
      };
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      if (!seg.expression.trim()) {
        errors.push({ index: i, field: 'expression', message: 'La expresión no puede estar vacía.' });
      }
      if (!seg.from.trim()) {
        errors.push({ index: i, field: 'from', message: 'El límite inferior no puede estar vacío.' });
      }
      if (!seg.to.trim()) {
        errors.push({ index: i, field: 'to', message: 'El límite superior no puede estar vacío.' });
      }

      // Numeric range check (only for purely numeric bounds)
      const fromNum = this.tryParseNumber(seg.from);
      const toNum   = this.tryParseNumber(seg.to);
      if (fromNum !== null && toNum !== null && fromNum >= toNum) {
        errors.push({
          index: i,
          field: 'to',
          message: `El límite superior (${seg.to}) debe ser mayor que el inferior (${seg.from}).`,
        });
      }
    }

    // Contiguity check: seg[i].to must equal seg[i+1].from (string comparison)
    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i].to.trim();
      const next    = segments[i + 1].from.trim();
      if (current !== next) {
        errors.push({
          index: i + 1,
          field: 'from',
          message: `El inicio del tramo ${i + 2} (${next}) debe coincidir con el fin del tramo ${i + 1} (${current}).`,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Returns the first error message for a specific segment field,
   * or null if that field is valid.
   */
  getError(result: ValidationResult, index: number, field: SegmentError['field']): string | null {
    const err = result.errors.find((e) => e.index === index && e.field === field);
    return err?.message ?? null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private tryParseNumber(s: string): number | null {
    const n = Number(s.trim());
    return isNaN(n) ? null : n;
  }
}
