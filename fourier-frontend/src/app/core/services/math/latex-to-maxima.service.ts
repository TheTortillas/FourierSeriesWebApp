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
   * - \\operatorname{exp}(…) → e^{(…)}  tex2max can't handle \operatorname{exp}
   *   but handles e^{x} perfectly, and %e^(x) is valid Maxima for exp(x).
   */
  private preProcess(latex: string): string {
    let s = latex
      // Normalize scalable delimiters that are not needed by tex2max.
      .replace(/\\left/g, '')
      .replace(/\\right/g, '')
      .replace(/\\operatorname\{sen\}/g, '\\sin')
      .replace(/\\operatorname\{tg\}/g, '\\tan')
      .replace(/\\operatorname\{senh\}/g, '\\sinh')
      .replace(/\\operatorname\{ctg\}/g, '\\cot')
      .replace(/\\arcsin/g, '\\operatorname{asin}')
      .replace(/\\arccos/g, '\\operatorname{acos}')
      .replace(/\\arctan/g, '\\operatorname{atan}')
      .replace(/\\operatorname\{arcsin\}/g, '\\operatorname{asin}')
      .replace(/\\operatorname\{arccos\}/g, '\\operatorname{acos}')
      .replace(/\\operatorname\{arctan\}/g, '\\operatorname{atan}')
      .replace(/\\operatorname\{ln\}/g, '\\log')
      .replace(/\\ln\b/g, '\\log')
      // Normalize any exp(...) variant so substituteExp can process it reliably.
      .replace(/\\exp\(/g, '\\operatorname{exp}(')
      .replace(/\\operatorname\{exp\}\(/g, '\\operatorname{exp}(')
      // Special functions used in Fourier transforms
      // delta: tex2max cannot handle \delta or \operatorname{delta} — it either
      // interprets the Greek letter command or splits the operatorname content
      // into individual letters.  Replace with a token BEFORE tex2max (same
      // strategy as \infty → TMINF) and restore in postProcess.
      // Handle \operatorname{delta} first (produced by MathQuill autoOperatorNames),
      // then bare \delta (produced by direct LaTeX or history restore).
      .replace(/\\operatorname\{delta\}/g, ' TMDELTA')
      .replace(/\\delta\b/g, ' TMDELTA')
      // Gamma and factorial: tex2max doesn't know these as function names.
      // Replace with tokens before tex2max, restore in postProcess.
      // Also handle \Gamma (LaTeX symbol) as an alias for gamma.
      .replace(/\\operatorname\{gamma\}/g, 'TMGAMMA')
      .replace(/\\operatorname\{factorial\}/g, 'TMFACTORIAL')
      .replace(/\\Gamma\b/g, 'TMGAMMA')
      // Heaviside u(...) and sgn(...) pass through tex2max as raw letter sequences
      // (identifiers); the spurious * they may get is removed in convertForTransforms.
      // Imaginary unit: the keyboard button inserts \mathrm{i}.
      // Replace with \operatorname{imagunit} so tex2max emits `imagunit` as a
      // standalone named token; addTimesSign:true then inserts * between it and
      // adjacent single-letter variables (e.g. imagunit*w).
      // convertForTransforms maps imagunit → %i.
      .replace(/\\mathrm\{i\}/g, '\\operatorname{imagunit}')
      // Infinity: tex2max cannot handle \infty (\operatorname{inf} would be
      // treated as a function call without args and throw). Replace with unique
      // tokens BEFORE tex2max so they pass as plain variable identifiers.
      // Handle -\infty before +\infty to avoid double-replacement.
      .replace(/-\s*\\infty/g, 'TMMINF')
      .replace(/\\infty/g, 'TMINF');

    // tex2max crashes on \operatorname{exp} (not in its whitelist).
    // Convert \operatorname{exp}(arg) → e^{(arg)} with balanced-paren extraction
    // so tex2max sees plain e^{…} and produces e^(…) → postProcess gives %e^(…).
    s = this.substituteExp(s);
    return s;
  }

  /**
   * Replaces every \operatorname{exp}(…) with e^{(…)} using balanced-paren
   * extraction so nested expressions like exp((x+1)^2) are handled correctly.
   */
  private substituteExp(latex: string): string {
    const marker = '\\operatorname{exp}(';
    let result = '';
    let i = 0;
    while (i < latex.length) {
      const idx = latex.indexOf(marker, i);
      if (idx === -1) {
        result += latex.slice(i);
        break;
      }
      result += latex.slice(i, idx) + 'e^{(';
      i = idx + marker.length;
      let depth = 1;
      while (i < latex.length && depth > 0) {
        const c = latex[i];
        if (c === '(') depth++;
        else if (c === ')') {
          depth--;
          if (depth === 0) {
            result += ')}';
            i++;
            break;
          }
        }
        result += c;
        i++;
      }
    }
    return result;
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
   * Same as convert() but also maps the imaginary unit to `%i` (Maxima).
   * Use this for Fourier transform inputs where `i` means the imaginary unit,
   * not a variable. Do NOT use for series calculations where `i` is an index.
   */
  convertForTransforms(latex: string): ConversionResult {
    const base = this.convert(latex);
    if (!base.ok) return base;

    let maxima = base.maxima;

    // tex2max doesn't know u, sgn, delta, rect, sinc as function names, so it
    // may emit e.g. `u*(t)` instead of `u(t)`.  Remove the spurious multiplication.
    maxima = maxima.replace(/\b(u|sgn|delta|imagunit|rect|sinc|gamma|factorial)\s*\*\s*\(/g, '$1(');

    // ── Imaginary unit resolution ────────────────────────────────────────────
    // Priority order matters here.

    // 1. Button-inserted i (\mathrm{i} → \operatorname{imagunit} in preProcess).
    //    tex2max may merge it with an adjacent single-letter variable (e.g.
    //    `imagunitw` instead of `imagunit*w`).  Handle both merged and separated.
    maxima = maxima.replace(/\bimagunit([a-zA-Z])(?![a-zA-Z0-9_%])/g, '%i*$1');
    maxima = maxima.replace(/\bimagunit\b/g, '%i');

    // 2a. `i` fused BEFORE a single-letter variable (e.g. `iw` → `%i*w`).
    //     \bi ensures `i` is at a word start; lookahead prevents matching
    //     multi-letter identifiers like `imagunit`, `sinh`, etc.
    maxima = maxima.replace(/\bi([a-zA-Z])(?![a-zA-Z0-9_%])/g, '%i*$1');

    // 2b. `i` fused AFTER a single-letter variable (e.g. `wi` → `w*%i`).
    //     Lookbehind `(?<![a-zA-Z0-9_%])` prevents matching inside longer words
    //     like `sin`, `%pi`, etc. — those have a letter/% before the preceding char.
    maxima = maxima.replace(/(?<![a-zA-Z0-9_%])([a-zA-Z])i(?![a-zA-Z0-9_%])/g, '$1*%i');

    // 3. Any remaining isolated bare `i` → `%i`.
    maxima = maxima.replace(/(?<![a-zA-Z0-9_%])i(?![a-zA-Z0-9_%])/g, '%i');

    return { ...base, maxima };
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
    const normalized = raw
      .replace(/\bpi\b/g, '%pi')
      .replace(/(?<![a-zA-Z0-9_%])e(?![a-zA-Z0-9_%])/g, '%e')
      // Maxima function name normalization
      .replace(/\bexp\b/g, 'exp')
      .replace(/\barcsin\b/g, 'asin')
      .replace(/\barccos\b/g, 'acos')
      .replace(/\barctan\b/g, 'atan')
      .replace(/\barccot\b/g, 'acot')
      .replace(/\barcsec\b/g, 'asec')
      .replace(/\barccsc\b/g, 'acsc')
      .replace(/\bln\b/g, 'log')
      .replace(/\bsen\b/g, 'sin')
      .replace(/\btg\b/g, 'tan')
      .replace(/\bsenh\b/g, 'sinh')
      .replace(/\bctg\b/g, 'cot')
      // Restore tokens inserted by preProcess to bypass tex2max
      .replace(/\bTMMINF\b/g, 'minf')
      .replace(/\bTMINF\b/g, 'inf')
      .replace(/\bTMDELTA\b/g, 'delta')
      .replace(/\bTMGAMMA\b/g, 'gamma')
      .replace(/\bTMFACTORIAL\b/g, 'factorial')
      // tex2max adds a spurious * between a named token and the following (
      // (e.g. gamma*(x) instead of gamma(x)). Clean up universally here.
      .replace(/\b(gamma|factorial|exp)\s*\*\s*\(/g, '$1(');

    return this.normalizePostfixFactorial(normalized);
  }

  /**
   * Converts postfix factorial forms like x! or (x+1)! to Maxima function
   * form factorial(x) that the backend understands consistently.
   */
  private normalizePostfixFactorial(expr: string): string {
    let prev = '';
    let cur = expr;

    // Apply repeatedly so nested cases like ((x+1)!)! are fully normalized.
    while (cur !== prev) {
      prev = cur;
      cur = cur.replace(/(\([^()]+\)|[a-zA-Z0-9_%]+)\s*!/g, (_m, token: string) => {
        const inner = token.startsWith('(') && token.endsWith(')') ? token.slice(1, -1) : token;
        return `factorial(${inner})`;
      });
    }

    return cur;
  }
}
