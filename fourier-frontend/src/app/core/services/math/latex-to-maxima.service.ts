import { Injectable, inject } from '@angular/core';
import { Observable, of, catchError, map } from 'rxjs';
import { ApiService } from '../api/api.service';

export interface ConversionResult {
  maxima: string;
  ok: boolean;
  error?: string;
}

// ── Special-function client-side translator ───────────────────────────────────
//
// tex2max (GPL v2, server-side) doesn't know Si, Ci, Shi, Chi, Ei, E1, li,
// erf, erfc. When the raw LaTeX contains any of these names we translate the
// entire expression client-side and skip the backend call entirely.
// All other expressions are handled by the backend as usual.

const SPECIAL_FN: Record<string, string> = {
  Shi:  'expintegral_shi',
  Chi:  'expintegral_chi',
  Si:   'expintegral_si',
  Ci:   'expintegral_ci',
  Ei:   'expintegral_ei',
  E1:   'expintegral_e1',
  li:   'expintegral_li',
  erfc: 'erfc',
  erf:  'erf',
};

// Longer names listed first so the alternation matches Shi before Si, etc.
const SPECIAL_FN_RE = new RegExp(`\\b(${Object.keys(SPECIAL_FN).join('|')})\\b`);

const STD_FN: Record<string, string> = {
  // Trig
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
  // Inverse trig
  asin: 'asin', acos: 'acos', atan: 'atan', acot: 'acot', asec: 'asec', acsc: 'acsc',
  arcsin: 'asin', arccos: 'acos', arctan: 'atan', arccot: 'acot', arcsec: 'asec', arccsc: 'acsc',
  // Hyperbolic
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', coth: 'coth', sech: 'sech', csch: 'csch',
  // Inverse hyperbolic
  asinh: 'asinh', acosh: 'acosh', atanh: 'atanh', acoth: 'acoth', asech: 'asech', acsch: 'acsch',
  // Exp / log
  ln: 'log', log: 'log', exp: 'exp',
  // Misc
  sqrt: 'sqrt', abs: 'abs',
  floor: 'floor', ceiling: 'ceiling', round: 'round',
  gamma: 'gamma', factorial: 'factorial',
  // Spanish aliases
  sen: 'sin', tg: 'tan', senh: 'sinh',
};

type Token =
  | { t: 'num';    v: string }
  | { t: 'ident';  v: string }
  | { t: 'op';     v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'cmd';    v: string }
  | { t: 'lbrace' }
  | { t: 'rbrace' }
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
    if (/[+\-*/^_,|]/.test(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
    i++;
  }
  out.push({ t: 'end' });
  return out;
}

class Parser {
  private pos = 0;
  constructor(private readonly toks: Token[]) {}

  private peek(): Token { return this.toks[this.pos]; }
  private eat(): Token  { return this.toks[this.pos++]; }

  private is(t: Token['t'], v?: string): boolean {
    const tok = this.peek();
    return tok.t === t && (v === undefined || ('v' in tok && (tok as { v: string }).v === v));
  }

  parse(): string { return this.addSub(); }

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
    while (this.is('op', '*') || this.is('op', '/')) {
      const op = (this.eat() as { t: 'op'; v: string }).v;
      s = `(${s}${op}${this.power()})`;
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
      const mx = SPECIAL_FN[name] ?? STD_FN[name];
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
      if (cmd === 'left' || cmd === 'right') { this.eat(); return this.addSub(); }
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
        return `${SPECIAL_FN[name] ?? name}(${this.funcArg()})`;
      }
      const mx = SPECIAL_FN[cmd] ?? STD_FN[cmd];
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
    if (this.is('lp'))     { this.eat(); const a = this.addSub(); if (this.is('rp')) this.eat(); return a; }
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

function clientTranslate(latex: string): string | null {
  try {
    const result = new Parser(tokenise(latex)).parse();
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
 * Expressions containing special functions (Si, Ci, erf…) are translated
 * client-side via `convertWithSpecialFns` so every MathQuill field supports them.
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
   * Intercepts special functions (Si, Ci, Shi, Chi, Ei, E1, li, erf, erfc)
   * and translates them client-side; everything else goes to the backend.
   *
   * @param mode  'series' for the calculator, 'transform' for everything else.
   */
  convertWithSpecialFns(latex: string, mode: 'series' | 'transform' = 'transform'): Observable<ConversionResult> {
    if (!latex.trim()) return of({ maxima: '', ok: false, error: 'Expresión vacía' });
    if (SPECIAL_FN_RE.test(latex)) {
      const maxima = clientTranslate(latex);
      if (maxima) return of({ ok: true, maxima });
    }
    return this._backend(latex, mode);
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
