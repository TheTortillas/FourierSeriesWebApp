/**
 * Minimal client-side LaTeX → Maxima translator for the grapher.
 *
 * The backend (tex2max) handles standard math well, but doesn't know special
 * functions like Si, Ci, erf, etc. This module post-processes the raw LaTeX
 * string before MathQuill sends it to the backend:
 *
 *   1. Detect any special function names in the LaTeX.
 *   2. If found, do a full client-side translation (no backend needed).
 *   3. If not found, delegate to the backend as usual.
 *
 * The client-side translator handles: arithmetic, standard trig, exp/log,
 * sqrt, abs, fractions, powers, and all supported special functions.
 */

import { Observable, of } from 'rxjs';
import { LatexToMaximaService, ConversionResult } from '../../core/services/math/latex-to-maxima.service';

// ── Special function name → Maxima identifier ──────────────────────────────

const SPECIAL_FN: Record<string, string> = {
  Si:  'expintegral_si',
  Ci:  'expintegral_ci',
  Shi: 'expintegral_shi',
  Chi: 'expintegral_chi',
  Ei:  'expintegral_ei',
  E1:  'expintegral_e1',
  li:  'expintegral_li',
  erf: 'erf',
  erfc: 'erfc',
};

const SPECIAL_FN_RE = new RegExp(`\\b(${Object.keys(SPECIAL_FN).join('|')})\\b`);

// ── Trig / standard function remap to Maxima names ─────────────────────────

const STD_FN: Record<string, string> = {
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot',
  sec: 'sec', csc: 'csc',
  asin: 'asin', acos: 'acos', atan: 'atan',
  arcsin: 'asin', arccos: 'acos', arctan: 'atan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
  ln: 'log', log: 'log',
  sqrt: 'sqrt', abs: 'abs',
  exp: 'exp',
  gamma: 'gamma', factorial: 'factorial',
};

// ── Tokeniser ───────────────────────────────────────────────────────────────

type Token =
  | { t: 'num';   v: string }
  | { t: 'ident'; v: string }
  | { t: 'op';    v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'cmd';   v: string }   // \commandName
  | { t: 'lbrace' }
  | { t: 'rbrace' }
  | { t: 'end' };

function tokenise(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '\\') {
      i++;
      let name = '';
      while (i < src.length && /[a-zA-Z]/.test(src[i])) name += src[i++];
      if (name === '') {
        // \( \) \[ \] etc — skip structural LaTeX
        i++;
      } else {
        tokens.push({ t: 'cmd', v: name });
      }
      continue;
    }
    if (ch === '{') { tokens.push({ t: 'lbrace' }); i++; continue; }
    if (ch === '}') { tokens.push({ t: 'rbrace' }); i++; continue; }
    if (ch === '(') { tokens.push({ t: 'lp' }); i++; continue; }
    if (ch === ')') { tokens.push({ t: 'rp' }); i++; continue; }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let n = '';
      while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++];
      tokens.push({ t: 'num', v: n });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let name = '';
      while (i < src.length && /[a-zA-Z0-9]/.test(src[i])) name += src[i++];
      tokens.push({ t: 'ident', v: name });
      continue;
    }
    if (/[+\-*/^_,|]/.test(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
    // skip unknown chars (structural LaTeX noise)
    i++;
  }
  tokens.push({ t: 'end' });
  return tokens;
}

// ── Recursive-descent parser → Maxima string ───────────────────────────────

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos]; }
  private eat(): Token  { return this.tokens[this.pos++]; }

  private match(t: Token['t'], v?: string): boolean {
    const tok = this.peek();
    return tok.t === t && (v === undefined || ('v' in tok && tok.v === v));
  }

  /** Parse the full expression (addition/subtraction level). */
  parse(): string {
    const s = this.addSub();
    return s;
  }

  private addSub(): string {
    let left = this.mulDiv();
    while (this.match('op', '+') || this.match('op', '-')) {
      const op = (this.eat() as { t: 'op'; v: string }).v;
      left = `${left}${op}${this.mulDiv()}`;
    }
    return left;
  }

  private mulDiv(): string {
    let left = this.power();
    while (this.match('op', '*') || this.match('op', '/')) {
      const op = (this.eat() as { t: 'op'; v: string }).v;
      left = `(${left}${op}${this.power()})`;
    }
    return left;
  }

  private power(): string {
    const base = this.unary();
    if (this.match('op', '^')) {
      this.eat();
      const exp = this.braceOrAtom();
      return `(${base})^(${exp})`;
    }
    return base;
  }

  private unary(): string {
    if (this.match('op', '-')) { this.eat(); return `-(${this.atom()})`; }
    if (this.match('op', '+')) { this.eat(); }
    return this.atom();
  }

  private atom(): string {
    const tok = this.peek();

    // Number literal
    if (tok.t === 'num') { this.eat(); return tok.v; }

    // Identifier — could be a function name or variable
    if (tok.t === 'ident') {
      this.eat();
      const name = tok.v;
      // Special function?
      if (SPECIAL_FN[name]) {
        const arg = this.funcArg();
        return `${SPECIAL_FN[name]}(${arg})`;
      }
      // Standard function?
      if (STD_FN[name]) {
        const arg = this.funcArg();
        return `${STD_FN[name]}(${arg})`;
      }
      // Followed by implicit multiplication or parentheses → function call
      if (this.match('lp')) {
        const arg = this.funcArg();
        return `${name}(${arg})`;
      }
      // Subscript (ignore, just return name)
      if (this.match('op', '_')) { this.eat(); this.braceOrAtom(); }
      return name;
    }

    // LaTeX command
    if (tok.t === 'cmd') {
      this.eat();
      const cmd = tok.v;
      // \frac{a}{b}
      if (cmd === 'frac') {
        const num = this.braceGroup();
        const den = this.braceGroup();
        return `(${num})/(${den})`;
      }
      // \sqrt{x} or \sqrt[n]{x}
      if (cmd === 'sqrt') {
        const arg = this.braceGroup();
        return `sqrt(${arg})`;
      }
      // \left / \right — just consume and parse inner
      if (cmd === 'left' || cmd === 'right') {
        // next token is a delimiter char — skip it (it became an op token)
        this.eat();
        return this.addSub();
      }
      // \cdot \times → *
      if (cmd === 'cdot' || cmd === 'times') { return '*'; }
      // \pi \theta etc
      if (cmd === 'pi')    return '%pi';
      if (cmd === 'theta') return 'theta';
      if (cmd === 'infty') return 'inf';
      // Known function via command
      if (STD_FN[cmd]) {
        const arg = this.funcArg();
        return `${STD_FN[cmd]}(${arg})`;
      }
      if (SPECIAL_FN[cmd]) {
        const arg = this.funcArg();
        return `${SPECIAL_FN[cmd]}(${arg})`;
      }
      // \operatorname{name}
      if (cmd === 'operatorname') {
        this.eat(); // {
        let name = '';
        while (!this.match('rbrace') && this.peek().t !== 'end') {
          const t = this.eat();
          name += 't' in t && 'v' in t ? (t as { v: string }).v : '';
        }
        this.eat(); // }
        const mx = SPECIAL_FN[name] ?? name;
        const arg = this.funcArg();
        return `${mx}(${arg})`;
      }
      // fallback: treat command as identifier
      return cmd;
    }

    // Parenthesised expression
    if (tok.t === 'lp') {
      this.eat();
      const inner = this.addSub();
      if (this.match('rp')) this.eat();
      return `(${inner})`;
    }

    // Brace group
    if (tok.t === 'lbrace') {
      this.eat();
      const inner = this.addSub();
      if (this.match('rbrace')) this.eat();
      return inner;
    }

    // Absolute value via |
    if (tok.t === 'op' && (tok as { t: 'op'; v: string }).v === '|') {
      this.eat();
      const inner = this.addSub();
      if (this.match('op', '|')) this.eat();
      return `abs(${inner})`;
    }

    return '';
  }

  /** Parse a function argument: either (expr) or {expr}. */
  private funcArg(): string {
    if (this.match('lp')) {
      this.eat();
      const arg = this.addSub();
      if (this.match('rp')) this.eat();
      return arg;
    }
    if (this.match('lbrace')) {
      return this.braceGroup();
    }
    return this.atom();
  }

  /** Parse a {group}. */
  private braceGroup(): string {
    if (this.match('lbrace')) this.eat();
    const inner = this.addSub();
    if (this.match('rbrace')) this.eat();
    return inner;
  }

  /** Parse a {group} or a single atom (for ^ exponents etc). */
  private braceOrAtom(): string {
    if (this.match('lbrace')) return this.braceGroup();
    return this.atom();
  }
}

function clientTranslate(latex: string): string | null {
  try {
    const tokens = tokenise(latex);
    const parser = new Parser(tokens);
    const result = parser.parse();
    return result || null;
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a grapher LaTeX expression to Maxima.
 * - If the expression contains special functions: translate client-side.
 * - Otherwise: delegate to the backend (tex2max) as usual.
 */
export function convertForGrapher(
  latex: string,
  tex2max: LatexToMaximaService,
): Observable<ConversionResult> {
  if (SPECIAL_FN_RE.test(latex)) {
    const maxima = clientTranslate(latex);
    if (maxima) {
      return of({ ok: true, maxima });
    }
    // client translation failed → fall through to backend (will likely fail too,
    // but the error message is more informative than a silent NaN)
  }
  return tex2max.convertForTransforms(latex);
}
