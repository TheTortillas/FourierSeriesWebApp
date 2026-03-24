import { Injectable } from '@angular/core';
// tex2max is CommonJS — esbuild handles the CJS→ESM interop via allowedCommonJsDependencies.
// Static import (not require()) is required for browser bundles.
import Tex2Max from 'tex2max';

export interface ConversionResult {
  maxima: string;
  ok: boolean;
  error?: string;
}

/**
 * Converts LaTeX math expressions to Maxima CAS syntax.
 * Uses tex2max under the hood with Maxima-compatible post-processing.
 *
 * SSR-safe: tex2max is a pure JS library with no DOM dependencies.
 */
@Injectable({ providedIn: 'root' })
export class LatexToMaximaService {
  private readonly converter = new Tex2Max({
    onlySingleVariables: false,
    addTimesSign: true,
    onlyGreekSymbol: false,
  });

  /**
   * Converts a LaTeX string to a Maxima expression string.
   * Returns `{ ok: false, error }` if conversion fails.
   */
  convert(latex: string): ConversionResult {
    if (!latex.trim()) {
      return { maxima: '', ok: false, error: 'Expresión vacía' };
    }

    try {
      const preprocessed = this.preProcess(latex.trim());
      const raw: string = this.converter.toMaxima(preprocessed);
      const maxima = this.postProcess(raw);
      return { maxima, ok: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { maxima: '', ok: false, error };
    }
  }

  /**
   * Normalise LaTeX before tex2max sees it:
   * - Spanish operator names (sen, tg, senh, ctg) → standard LaTeX
   * - arcsin/arccos/arctan → asin/acos/atan operatorname (Maxima names)
   * - \\ln → \\log (Maxima's natural-log function is log)
   */
  private preProcess(latex: string): string {
    return latex
      .replace(/\\operatorname\{sen\}/g,  '\\sin')
      .replace(/\\operatorname\{tg\}/g,   '\\tan')
      .replace(/\\operatorname\{senh\}/g, '\\sinh')
      .replace(/\\operatorname\{ctg\}/g,  '\\cot')
      .replace(/\\arcsin/g, '\\operatorname{asin}')
      .replace(/\\arccos/g, '\\operatorname{acos}')
      .replace(/\\arctan/g, '\\operatorname{atan}')
      .replace(/\\operatorname\{arcsin\}/g, '\\operatorname{asin}')
      .replace(/\\operatorname\{arccos\}/g, '\\operatorname{acos}')
      .replace(/\\operatorname\{arctan\}/g, '\\operatorname{atan}')
      .replace(/\\operatorname\{ln\}/g, '\\log')
      .replace(/\\ln\b/g, '\\log');
  }

  /**
   * Convenience: returns the Maxima string or throws on failure.
   */
  toMaxima(latex: string): string {
    const result = this.convert(latex);
    if (!result.ok) throw new Error(result.error);
    return result.maxima;
  }

  /**
   * Post-processing to align tex2max output with Maxima conventions:
   * - `pi` → `%pi`
   * - standalone `e` (Euler's number) → `%e`
   * Note: tex2max already emits valid Maxima for most expressions.
   * `e^(x)` is valid Maxima (Maxima knows `e` as Euler's number),
   * but using `%e` is more explicit and canonical.
   */
  private postProcess(raw: string): string {
    return raw
      .replace(/\bpi\b/g, '%pi')
      .replace(/(?<![a-zA-Z0-9_%])e(?![a-zA-Z0-9_%])/g, '%e')
      // Maxima function name normalization
      .replace(/\barcsin\b/g,  'asin')
      .replace(/\barccos\b/g,  'acos')
      .replace(/\barctan\b/g,  'atan')
      .replace(/\barccot\b/g,  'acot')
      .replace(/\barcsec\b/g,  'asec')
      .replace(/\barccsc\b/g,  'acsc')
      .replace(/\bln\b/g,      'log')
      .replace(/\bsen\b/g,     'sin')
      .replace(/\btg\b/g,      'tan')
      .replace(/\bsenh\b/g,    'sinh')
      .replace(/\bctg\b/g,     'cot');
  }
}
