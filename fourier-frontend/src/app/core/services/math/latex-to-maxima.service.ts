import { Injectable, inject } from '@angular/core';
import { Observable, of, catchError, map } from 'rxjs';
import { ApiService } from '../api/api.service';
import { FUNCTION_REGISTRY, LATEX_TO_MAXIMA, CLIENT_SIDE_LATEX_NAMES } from './function-registry';

export interface ConversionResult {
  maxima: string;
  ok: boolean;
  error?: string;
}

// ── Derived maps from registry ────────────────────────────────────────────────
//
// These replace the former hand-written STD_FN / SPECIAL_FN / SPECIAL_FN_RE
// literals. Adding a new function to FUNCTION_REGISTRY automatically updates
// all three without any change here.

// Regex that matches any latexName marked clientSideOnly in the registry.
// Longer names are listed first so alternation matches 'Shi' before 'Si', etc.
const CLIENT_SIDE_RE = new RegExp(
  `\\b(${[...CLIENT_SIDE_LATEX_NAMES]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .join('|')})\\b`,
);

// ── Tokeniser ─────────────────────────────────────────────────────────────────

type Token =
  | { t: 'num';    v: string }
  | { t: 'ident';  v: string }
  | { t: 'op';     v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'cmd';    v: string }
  | { t: 'lbrace' }
  | { t: 'rbrace' }
  | { t: 'prime' }
  | { t: 'end' };

function tokenise(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '\\') {
      i++;
      let name = '';
      while (i < src.length && /[a-zA-Z]/.test(src[i])) name += src[i++];
      if (name) out.push({ t: 'cmd', v: name }); else i++;
      continue;
    }
    if (ch === '{') { out.push({ t: 'lbrace' }); i++; continue; }
    if (ch === '}') { out.push({ t: 'rbrace' }); i++; continue; }
    if (ch === '(') { out.push({ t: 'lp'     }); i++; continue; }
    if (ch === ')') { out.push({ t: 'rp'     }); i++; continue; }
    if (ch === "'") { out.push({ t: 'prime'  }); i++; continue; }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let n = '';
      while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++];
      out.push({ t: 'num', v: n });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let name = '';
      while (i < src.length && /[a-zA-Z0-9]/.test(src[i])) name += src[i++];
      out.push({ t: 'ident', v: name });
      continue;
    }
    if (/[+\-*/^_|=]/.test(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
    if (ch === ',') { out.push({ t: 'op', v: ',' }); i++; continue; }
    i++;
  }
  out.push({ t: 'end' });
  return out;
}

// ── Parser ────────────────────────────────────────────────────────────────────

interface OdeContext { fn: string; tvar: string; bareVar?: boolean; }

class Parser {
  private pos = 0;
  constructor(
    private readonly toks: Token[],
    private readonly ode?: OdeContext,
  ) {}

  private peek(): Token { return this.toks[this.pos]; }
  private eat(): Token  { return this.toks[this.pos++]; }

  private is(t: Token['t'], v?: string): boolean {
    const tok = this.peek();
    return tok.t === t && (v === undefined || ('v' in tok && (tok as { v: string }).v === v));
  }

  parse(): string { return this.equation(); }

  // Top-level: handle optional = for ODE equations like y'' + y = sin(t)
  private equation(): string {
    const lhs = this.addSub();
    if (this.is('op', '=')) {
      this.eat();
      return `${lhs}=${this.addSub()}`;
    }
    return lhs;
  }

  private addSub(): string {
    let s = this.mulDiv();
    while (this.is('op', '+') || this.is('op', '-')) {
      const op = (this.eat() as { t: 'op'; v: string }).v;
      s = `${s}${op}${this.mulDiv()}`;
    }
    return s;
  }

  private mulDiv(): string {
    let s = this.power();
    for (;;) {
      if (this.is('op', '*') || this.is('op', '/')) {
        const op = (this.eat() as { t: 'op'; v: string }).v;
        s = `(${s}${op}${this.power()})`;
      } else if (this.is('cmd', 'cdot') || this.is('cmd', 'times')) {
        this.eat(); // consume \cdot or \times, treat as explicit *
        s = `(${s}*${this.power()})`;
      } else if (
        this.is('num') ||
        this.is('ident') ||
        this.is('lp') ||
        (this.is('cmd') && !this.is('cmd', 'right'))
      ) {
        s = `(${s}*${this.power()})`;
      } else {
        break;
      }
    }
    return s;
  }

  private power(): string {
    const base = this.unary();
    if (this.is('op', '^')) {
      this.eat();
      return `(${base})^(${this.braceOrAtom()})`;
    }
    return base;
  }

  private unary(): string {
    if (this.is('op', '-')) { this.eat(); return `-(${this.atom()})`; }
    if (this.is('op', '+')) { this.eat(); }
    return this.atom();
  }

  private atom(): string {
    const tok = this.peek();

    if (tok.t === 'num') { this.eat(); return tok.v; }

    if (tok.t === 'ident') {
      this.eat();
      const name = tok.v;

      // ODE prime notation: if this ident is the unknown function, count trailing primes
      if (this.ode && name === this.ode.fn) {
        let order = 0;
        while (this.is('prime')) { this.eat(); order++; }
        const { fn, tvar } = this.ode;
        if (order > 0) return this.ode!.bareVar
          ? `diff(${fn},${tvar},${order})`
          : `diff(${fn}(${tvar}),${tvar},${order})`;
        // bare fn name → fn(tvar) unless immediately followed by ( (already a call)
        if (!this.is('lp')) return this.ode!.bareVar ? fn : `${fn}(${tvar})`;
      }

      // In ODE context, bare 'e' → %e (Euler), bare 'i' → %i (imaginary unit)
      if (this.ode && name !== this.ode.fn) {
        if (name === 'e') return '%e';
        if (name === 'i') return '%i';
      }

      // Look up in registry (covers both clientSideOnly and standard functions)
      const mx = LATEX_TO_MAXIMA.get(name);
      if (mx) return `${mx}(${this.funcArg()})`;
      if (this.is('lp')) return `${name}(${this.funcArg()})`;
      if (this.is('op', '_')) { this.eat(); this.braceOrAtom(); }
      return name;
    }

    if (tok.t === 'cmd') {
      this.eat();
      const cmd = tok.v;
      if (cmd === 'frac')  return `(${this.braceGroup()})/(${this.braceGroup()})`;
      if (cmd === 'sqrt')  return `sqrt(${this.braceGroup()})`;
      if (cmd === 'left') {
        const delim = this.peek();
        this.eat(); // consume the opening delimiter token
        if (delim.t === 'op' && (delim as { t: 'op'; v: string }).v === '|') {
          // \left|...\right| → abs(...)
          const inner = this.addSub();
          if (this.is('cmd', 'right')) { this.eat(); if (this.is('op', '|')) this.eat(); }
          return `abs(${inner})`;
        }
        // \left(...\right) — parse content and consume closing \right)
        const inner = this.addSub();
        if (this.is('cmd', 'right')) { this.eat(); if (this.is('rp')) this.eat(); }
        return `(${inner})`;
      }
      if (cmd === 'right') {
        // Stray \right — consume its delimiter and return empty
        this.eat();
        return '';
      }
      if (cmd === 'cdot' || cmd === 'times') return '*';
      if (cmd === 'pi')    return '%pi';
      if (cmd === 'theta') return 'theta';
      if (cmd === 'infty') return 'inf';
      if (cmd === 'operatorname') {
        if (this.is('lbrace')) this.eat();
        let name = '';
        while (!this.is('rbrace') && this.peek().t !== 'end') {
          const t = this.eat();
          name += 'v' in t ? (t as { v: string }).v : '';
        }
        if (this.is('rbrace')) this.eat();
        const mx = LATEX_TO_MAXIMA.get(name);
        return `${mx ?? name}(${this.funcArg()})`;
      }
      const mx = LATEX_TO_MAXIMA.get(cmd);
      if (mx) return `${mx}(${this.funcArg()})`;
      return cmd;
    }

    if (tok.t === 'lp') {
      this.eat();
      const inner = this.addSub();
      if (this.is('rp')) this.eat();
      return `(${inner})`;
    }

    if (tok.t === 'lbrace') {
      this.eat();
      const inner = this.addSub();
      if (this.is('rbrace')) this.eat();
      return inner;
    }

    if (tok.t === 'op' && (tok as { t: 'op'; v: string }).v === '|') {
      this.eat();
      const inner = this.addSub();
      if (this.is('op', '|')) this.eat();
      return `abs(${inner})`;
    }

    return '';
  }

  private funcArg(): string {
    // \left( ... \right) — MathQuill wraps multi-arg calls in \left(\right)
    if (this.is('cmd', 'left')) {
      this.eat();           // consume 'left'
      if (this.is('lp')) this.eat(); // consume '('
      const args: string[] = [this.addSub()];
      while (this.is('op', ',')) { this.eat(); args.push(this.addSub()); }
      // consume \right)
      if (this.is('cmd', 'right')) { this.eat(); if (this.is('rp')) this.eat(); }
      return args.join(',');
    }
    if (this.is('lp')) {
      this.eat();
      const args: string[] = [this.addSub()];
      while (this.is('op', ',')) { this.eat(); args.push(this.addSub()); }
      if (this.is('rp')) this.eat();
      return args.join(',');
    }
    if (this.is('lbrace')) return this.braceGroup();
    return this.atom();
  }

  private braceGroup(): string {
    if (this.is('lbrace')) this.eat();
    const inner = this.addSub();
    if (this.is('rbrace')) this.eat();
    return inner;
  }

  private braceOrAtom(): string {
    return this.is('lbrace') ? this.braceGroup() : this.atom();
  }
}

function clientTranslate(latex: string, ode?: OdeContext): string | null {
  try {
    const result = new Parser(tokenise(latex), ode).parse();
    return result || null;
  } catch {
    return null;
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Converts LaTeX math expressions to Maxima CAS syntax.
 *
 * Standard expressions are sent to the backend (tex2max, GPL v2, server-side).
 * Expressions containing client-side-only functions (erf, erfc, Si, Ci, …)
 * are translated locally via the client parser so every MathQuill field
 * supports them without a backend round-trip.
 *
 * The set of client-side-only functions is derived from FUNCTION_REGISTRY
 * (entries with clientSideOnly: true) — no hardcoded list here.
 */
@Injectable({ providedIn: 'root' })
export class LatexToMaximaService {
  private readonly api = inject(ApiService);

  /** Series mode — used by the Fourier series calculator. */
  convert(latex: string): Observable<ConversionResult> {
    return this._backend(latex, 'series');
  }

  /** Transform mode — used by the continuous-transform inputs. */
  convertForTransforms(latex: string): Observable<ConversionResult> {
    return this._backend(latex, 'transform');
  }

  /**
   * Preferred method for MathQuill fields.
   * Intercepts client-side-only functions and translates them locally;
   * everything else goes to the backend.
   *
   * @param mode  'series' for the calculator, 'transform' for everything else.
   */
  convertWithSpecialFns(latex: string, mode: 'series' | 'transform' = 'transform'): Observable<ConversionResult> {
    if (!latex.trim()) return of({ maxima: '', ok: false, error: 'Expresión vacía' });
    if (CLIENT_SIDE_RE.test(latex)) {
      const maxima = clientTranslate(latex);
      if (maxima) return of({ ok: true, maxima });
    }
    return this._backend(latex, mode);
  }

  /**
   * Converts LaTeX entirely client-side using the local parser.
   * Use for fields where the backend tex2max parser produces wrong output
   * (e.g. Laplace inverse expressions like \frac{1}{s^2+1}).
   */
  convertClientSide(latex: string): Observable<ConversionResult> {
    if (!latex.trim()) return of({ maxima: '', ok: false, error: 'Expresión vacía' });
    const maxima = clientTranslate(latex);
    if (maxima) return of({ ok: true, maxima });
    return this._backend(latex, 'transform');
  }

  /**
   * Converts an ODE equation written with prime notation (y', y'', y''') to Maxima.
   * Prime derivatives and bare function references are expanded to diff(...) form.
   * Everything else (e^{4t}, \sin, \frac, implicit multiplication, …) is handled
   * by the same client-side parser used for all other expressions.
   *
   * @param latex   Raw MathQuill LaTeX string, e.g. "y''+2y'+y=25e^{4t}"
   * @param odeFn   Unknown function letter, e.g. "y"
   * @param odeTvar Independent variable, e.g. "t"
   */
  convertOde(latex: string, odeFn: string, odeTvar: string): ConversionResult {
    if (!latex.trim()) return { maxima: '', ok: false, error: 'Expresión vacía' };
    const maxima = clientTranslate(latex, { fn: odeFn, tvar: odeTvar });
    if (maxima) return { ok: true, maxima };
    return { maxima: '', ok: false, error: 'No se pudo parsear la ecuación' };
  }

  /** Like convertOde but produces diff(y,x,2) bare-variable form for ode2/ic1/ic2/bc2. */
  convertOdeForOde2(latex: string, odeFn: string, odeTvar: string): ConversionResult {
    if (!latex.trim()) return { maxima: '', ok: false, error: 'Expresión vacía' };
    const maxima = clientTranslate(latex, { fn: odeFn, tvar: odeTvar, bareVar: true });
    if (maxima) return { ok: true, maxima };
    return { maxima: '', ok: false, error: 'No se pudo parsear la ecuación' };
  }

  /** Validates segment boundaries via a single backend call. */
  validateBoundaries(body: {
    pairs?: Array<{ a: string; b: string }>;
    orderPairs?: Array<{ a: string; b: string }>;
  }): Observable<{
    results: Array<'equal' | 'different' | 'unknown'>;
    orderResults: Array<'valid' | 'invalid' | 'unknown'>;
  }> {
    const hasPairs = (body.pairs?.length ?? 0) > 0;
    const hasOrder = (body.orderPairs?.length ?? 0) > 0;
    if (!hasPairs && !hasOrder) return of({ results: [], orderResults: [] });
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

  private _backend(latex: string, mode: 'series' | 'transform'): Observable<ConversionResult> {
    if (!latex.trim()) return of({ maxima: '', ok: false, error: 'Expresión vacía' });
    return this.api.parseLaTeX(latex, mode).pipe(
      catchError((err) => {
        const error = err?.error?.error ?? 'Error de conexión al parsear la expresión';
        return of({ maxima: '', ok: false, error } as ConversionResult);
      }),
    );
  }
}

// Re-export registry for consumers that need it (e.g. keyboard components)
export { FUNCTION_REGISTRY } from './function-registry';
export type { FunctionDef, FunctionCategory } from './function-registry';
