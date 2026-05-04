import { Injectable } from '@angular/core';

export type JsFunction = (x: number) => number;

/**
 * Translates a Maxima expression string into an evaluable JS function.
 *
 * Supports the subset of Maxima syntax used by the Fourier backend:
 *   - Arithmetic: +, -, *, /, ^
 *   - Maxima constants: %pi, %e
 *   - Trig: sin, cos, tan, asin, acos, atan
 *   - Hyperbolic: sinh, cosh, tanh
 *   - Other: sqrt, exp, log, abs, floor, ceiling
 *
 * SSR-safe: no DOM dependencies.
 */
@Injectable({ providedIn: 'root' })
export class MathUtilsService {
  /**
   * Compiles a Maxima expression string to a JS function of `variable` (default `'x'`).
   * If `params` is provided, those symbol→value substitutions are applied to the
   * Maxima string BEFORE the conversion pipeline, allowing parametric expressions
   * (e.g. `exp(-a*t)` with `{a: 2}`) to be evaluated numerically.
   * Returns null if the expression cannot be compiled.
   */
  compile(maxima: string, variable = 'x', params?: Record<string, number>): JsFunction | null {
    if (!maxima.trim()) return null;

    try {
      let expr = maxima;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          // Word-boundary replacement: won't touch 'a' inside 'abs', 'atan', etc.
          // Always wrap in parens so negative values don't create `--` decrement ops.
          expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${String(value)})`);
        }
      }
      const js = this.maximaToJs(expr);
      // eslint-disable-next-line no-new-func
      const fn = new Function(variable, `"use strict"; ${this._helpers} return (${js});`) as JsFunction;
      // Smoke-test: try several points to handle singularities at 0 (e.g. sin(x)/x = NaN at 0 but valid elsewhere)
      const testPoints = [0, 1, -1, 0.5, Math.PI];
      for (const pt of testPoints) {
        try {
          const test = fn(pt);
          if (typeof test === 'number') return fn;
        } catch {
          // continue to next test point
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Evaluates a Maxima expression at a given value.
   * Returns NaN if compilation fails or the result is non-finite.
   */
  evaluate(maxima: string, x: number, variable = 'x'): number {
    const fn = this.compile(maxima, variable);
    if (!fn) return NaN;
    try {
      const result = fn(x);
      return isFinite(result) ? result : NaN;
    } catch {
      return NaN;
    }
  }

  /**
   * Samples a Maxima expression over [from, to] with `n` points.
   * Returns an array of { x, y } pairs, skipping NaN results.
   */
  sample(
    maxima: string,
    from: number,
    to: number,
    n = 500,
    variable = 'x',
  ): { x: number; y: number }[] {
    const fn = this.compile(maxima, variable);
    if (!fn) return [];

    const points: { x: number; y: number }[] = [];
    const step = (to - from) / (n - 1);

    for (let i = 0; i < n; i++) {
      const x = from + i * step;
      try {
        const y = fn(x);
        if (isFinite(y)) points.push({ x, y });
      } catch {
        // skip discontinuities
      }
    }
    return points;
  }

  // ── Translation ────────────────────────────────────────────────────────────

  private maximaToJs(expr: string): string {
    let s = expr
      // Constants — order matters: %pi before %i so %pi isn't consumed by %i
      .replace(/%pi\b/g, 'Math.PI')
      .replace(/%e\b/g, 'Math.E')
      // Imaginary unit: treat as 0 for real-valued plotting (Re/Im already separated by backend)
      .replace(/%i\b/g, '0')
      .replace(/\binf\b/g, 'Infinity')
      // Power operator: ^ → **
      .replace(/\^/g, '**');

    // JS forbids a unary '-' as the direct left operand of '**' (SyntaxError).
    // Fix both -IDENTIFIER** and -(expr)** before any further substitutions touch them.
    s = this._fixUnaryMinusPow(s);

    s = s
      // Functions — order matters (longer names first to avoid partial matches)
      .replace(/\basinh\b/g, 'Math.asinh')
      .replace(/\bacosh\b/g, 'Math.acosh')
      .replace(/\batanh\b/g, 'Math.atanh')
      .replace(/\basin\b/g, 'Math.asin')
      .replace(/\bacos\b/g, 'Math.acos')
      .replace(/\batan2\b/g, 'Math.atan2')
      .replace(/\batan\b/g, 'Math.atan')
      // Reciprocal inverses (no JS native — express via Math.asin/acos/atan)
      .replace(/\bacot\b/g, '_acot')
      .replace(/\basec\b/g, '_asec')
      .replace(/\bacsc\b/g, '_acsc')
      .replace(/\bsinh\b/g, 'Math.sinh')
      .replace(/\bcosh\b/g, 'Math.cosh')
      .replace(/\btanh\b/g, 'Math.tanh')
      .replace(/\bsin\b/g, 'Math.sin')
      .replace(/\bcos\b/g, 'Math.cos')
      .replace(/\btan\b/g, 'Math.tan')
      // Reciprocals (no JS native — express via sin/cos/tan)
      .replace(/\bcot\b/g, '_cot')
      .replace(/\bsec\b/g, '_sec')
      .replace(/\bcsc\b/g, '_csc')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\bexp\b/g, 'Math.exp')
      .replace(/\blog2\b/g, 'Math.log2')
      .replace(/\blog10\b/g, 'Math.log10')
      .replace(/\blog\b/g, 'Math.log')   // Maxima log = natural log
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\bfloor\b/g, 'Math.floor')
      .replace(/\bceiling\b/g, 'Math.ceil')
      .replace(/\bround\b/g, 'Math.round')
      .replace(/\btruncate\b/g, 'Math.trunc')
      .replace(/\bmax\b/g, 'Math.max')
      .replace(/\bmin\b/g, 'Math.min')
      .replace(/\bsign\b/g, 'Math.sign')
      .replace(/\bsgn\b\s*\(/g, 'Math.sign(')             // signum
      // Combinatorial / special functions
      .replace(/\bgamma\b/g, '_gamma')
      .replace(/\bfactorial\b/g, '_factorial')
      // Error functions — approximate via Horner series
      .replace(/\berfc\b/g, '_erfc')
      .replace(/\berf\b/g, '_erf');

    // Maxima if(cond, then, else) → JS ternary.  Must run before nested-fn replacements.
    s = this._replaceMathIf(s);

    // Special functions that may contain nested parentheses in their arguments
    // (e.g. u(w+(2.4)) after param substitution).  A simple [^)]* regex would
    // stop at the first ')' inside the argument, producing broken JS.
    // _replaceNestedFn walks the string counting balanced parens instead.
    s = this._replaceNestedFn(s, 'delta', (_arg) => '0');
    s = this._replaceNestedFn(s, 'u', (arg) => `(${arg} >= 0 ? 1 : 0)`);

    // Unrecognised Maxima names (e.g. besselj, polygamma) would produce
    // ReferenceErrors at eval time.  Replace any remaining bare identifiers
    // that look like function calls with NaN so the curve silently disappears
    // instead of crashing compile().
    s = this._stubUnknownFunctions(s);

    // Math.E**(expr) is a JS SyntaxError when expr starts with a unary minus
    // (e.g. Math.E**(-t**2+2*t-1)).  Convert all Math.E**(...) to Math.exp(...).
    s = this._replaceMathEPow(s);

    return s;
  }

  /**
   * Translates Maxima's `if(cond, then, else)` to a JS ternary `(cond ? then : else)`.
   * Handles nested parens in all three arguments.
   * Maxima also uses `=` for equality in conditions — rewritten to `===`.
   */
  private _replaceMathIf(expr: string): string {
    const occs = this._findFunctionCalls(expr, 'if');
    if (occs.length === 0) return expr;

    // Process in reverse so character positions stay valid
    let result = expr;
    for (let i = occs.length - 1; i >= 0; i--) {
      const { start, end, arg } = occs[i];
      // Split arg on commas at depth 0 to get (cond, thenExpr, elseExpr)
      const parts = this._splitAtDepth0(arg);
      if (parts.length < 2) continue;
      const [cond, thenExpr, elseExpr = 'NaN'] = parts;
      // Maxima uses = for equality; rewrite to ===, but not >= <= !=
      const jsCond = cond
        .replace(/([^><!])=([^=])/g, '$1===$2')
        .replace(/\bnot\b/g, '!')
        .replace(/\band\b/g, '&&')
        .replace(/\bor\b/g, '||');
      const replacement = `((${jsCond}) ? (${thenExpr}) : (${elseExpr}))`;
      result = result.slice(0, start) + replacement + result.slice(end);
    }
    return result;
  }

  /** Splits a string on commas that are at parenthesis depth 0. */
  private _splitAtDepth0(s: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') depth--;
      else if (s[i] === ',' && depth === 0) {
        parts.push(s.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(s.slice(start).trim());
    return parts;
  }

  /**
   * Replaces any remaining `name(arg)` calls where `name` is a bare identifier
   * not already translated to a known JS/helper function, with `NaN`.
   * This prevents ReferenceErrors from unknown Maxima specials (besselj, polygamma…).
   */
  private _stubUnknownFunctions(expr: string): string {
    const known = new Set([
      'Math', 'function', 'return', 'NaN', 'Infinity',
      '_cot', '_sec', '_csc', '_acot', '_asec', '_acsc',
      '_gamma', '_factorial', '_erf', '_erfc',
    ]);
    // Collect unknown function calls using nested-paren-aware finder
    const re = /(?<!\.)(\b[a-zA-Z_][a-zA-Z0-9_]*\b)\s*\(/g;
    const stubs: string[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(expr)) !== null) {
      const name = m[1];
      if (!known.has(name)) stubs.push(name);
    }
    // Replace each unknown function's full call (with balanced parens) with NaN
    for (const name of [...new Set(stubs)]) {
      expr = this._replaceNestedFn(expr, name, () => 'NaN');
    }
    return expr;
  }

  // ── Nested-parenthesis helpers ─────────────────────────────────────────────

  /**
   * Locates every `funcName(…)` call in `expr`, correctly tracking nested
   * parentheses so that arguments like `w+(2.4)` are captured in full.
   *
   * Returns one entry per call: the character span [start, end) of the entire
   * `funcName(arg)` token, and the `arg` string without the outer parens.
   */
  private _findFunctionCalls(
    expr: string,
    funcName: string,
  ): { start: number; end: number; arg: string }[] {
    const re = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
    const results: { start: number; end: number; arg: string }[] = [];
    let m: RegExpExecArray | null;

    re.lastIndex = 0;
    while ((m = re.exec(expr)) !== null) {
      const argStart = m.index + m[0].length;
      let depth = 1;
      let j = argStart;
      while (j < expr.length && depth > 0) {
        if (expr[j] === '(') depth++;
        else if (expr[j] === ')') depth--;
        if (depth > 0) j++;
      }
      results.push({ start: m.index, end: j + 1, arg: expr.slice(argStart, j) });
    }
    return results;
  }

  /**
   * Replaces every call `funcName(arg)` in `expr` with `make(arg)`, correctly
   * handling nested parentheses inside `arg`.  A plain regex like `[^)]*` would
   * stop at the first `)` inside `arg`, which breaks expressions like
   * `u(w+(2.4))` produced when slider parameters are substituted.
   */
  private _replaceNestedFn(
    expr: string,
    funcName: string,
    make: (arg: string) => string,
  ): string {
    const occurrences = this._findFunctionCalls(expr, funcName);
    if (occurrences.length === 0) return expr;
    let result = '';
    let cursor = 0;
    for (const { start, end, arg } of occurrences) {
      result += expr.slice(cursor, start);
      result += make(arg);
      cursor = end;
    }
    return result + expr.slice(cursor);
  }

  /**
   * Parses a Maxima expression and returns the position and weight of every
   * Dirac delta term it contains.
   *
   * Algorithm per delta occurrence:
   *   1. **Position** — solve `arg(variable) = 0` via `pos = −arg(0)`.
   *      Works for the linear arguments produced by the backend: `w−a`, `w+a`, `w`.
   *   2. **Weight**  — replace *this* delta with `1`, all others with `0`,
   *      compile the resulting expression, and evaluate it.
   *      For typical Fourier outputs (e.g. `%pi*(delta(w−a)+delta(w+a))`),
   *      the modified expression is constant so the evaluation point is arbitrary;
   *      `0` is used first and `pos` is tried as a fallback.
   *
   * @param maxima    Maxima expression string (may contain `%pi`, `%e`, `^`, …).
   * @param variable  Integration / transform variable (default `'x'`).
   * @param params    Optional parameter values substituted before parsing
   *                  (same substitution as `compile`).
   */
  parseDeltaTerms(
    maxima: string,
    variable = 'x',
    params?: Record<string, number>,
  ): { pos: number; weight: number }[] {
    // Apply the same param substitution as compile()
    let expr = maxima;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${String(value)})`);
      }
    }

    const occs = this._findFunctionCalls(expr, 'delta');
    if (occs.length === 0) return [];

    const results: { pos: number; weight: number }[] = [];

    for (let i = 0; i < occs.length; i++) {
      // ── 1. Position ───────────────────────────────────────────────────────
      const argFn = this.compile(occs[i].arg, variable);
      const argAt0 = argFn?.(0);
      if (argAt0 === undefined || !isFinite(argAt0)) continue;
      const pos = -argAt0;

      // ── 2. Weight ─────────────────────────────────────────────────────────
      // Build modified expression: this delta → 1, all others → 0
      let modified = '';
      let cursor = 0;
      for (let j = 0; j < occs.length; j++) {
        modified += expr.slice(cursor, occs[j].start);
        modified += j === i ? '1' : '0';
        cursor = occs[j].end;
      }
      modified += expr.slice(cursor);

      const weightFn = this.compile(modified, variable);
      if (!weightFn) continue;

      // Evaluate at 0 (constant for typical FT outputs); fallback to pos
      let weight = weightFn(0);
      if (!isFinite(weight)) weight = weightFn(pos);
      if (!isFinite(weight)) continue;

      results.push({ pos, weight });
    }

    return results;
  }

  /**
   * Converts every `Math.E**(expr)` occurrence to `Math.exp(expr)`, correctly
   * tracking nested parentheses.  Loops until stable to handle nested exponents.
   *
   * Also avoids the JS SyntaxError that occurs when `expr` starts with a unary
   * minus directly before `**` (e.g. `-t**2+2*t-1`): in that case the argument
   * is prefixed with `0` so `-t**2` becomes the binary-subtraction `0-t**2`.
   */
  private _replaceMathEPow(expr: string): string {
    const token = 'Math.E**(';
    while (expr.includes(token)) {
      const idx = expr.indexOf(token);
      const argStart = idx + token.length;
      let depth = 1, j = argStart;
      while (j < expr.length && depth > 0) {
        if (expr[j] === '(') depth++;
        else if (expr[j] === ')') depth--;
        if (depth > 0) j++;
      }
      const arg = expr.slice(argStart, j);
      expr = expr.slice(0, idx) + `Math.exp(${arg})` + expr.slice(j + 1);
    }
    return expr;
  }

  /**
   * Fixes the JS SyntaxError: unary '-' cannot be the direct left operand of '**'.
   * Mathematically -x**n = -(x**n), so we wrap the whole power:
   *   -WORD**EXP    →  -(WORD**EXP)
   *   -(EXPR)**EXP  →  -((EXPR)**EXP)
   * Only fires when '-' is in a unary position (start, or after an operator / '(' / ',').
   * Runs in a loop until no more substitutions are needed (handles nested cases).
   */
  private _fixUnaryMinusPow(s: string): string {
    const isUnaryBefore = (str: string, pos: number): boolean => {
      if (pos === 0) return true;
      return /[(,=+\-*\/!&|~?:%\s]/.test(str[pos - 1]);
    };

    /** Collect a balanced-paren group starting at an open '(' at position `start`. */
    const collectGroup = (str: string, start: number): number => {
      let depth = 0, j = start;
      while (j < str.length) {
        if (str[j] === '(') depth++;
        else if (str[j] === ')') { depth--; if (depth === 0) return j; }
        j++;
      }
      return j - 1;
    };

    /** Collect a bare token (\w+ or \w+.\w+ for Math.X) starting at `start`. */
    const collectToken = (str: string, start: number): number => {
      let j = start;
      while (j < str.length && /[\w.]/.test(str[j])) j++;
      return j - 1;
    };

    for (let pass = 0; pass < 10; pass++) {
      let i = 0, out = '', changed = false;
      while (i < s.length) {
        if (s[i] === '-' && isUnaryBefore(s, i)) {
          const next = i + 1;
          let baseStart: number, baseEnd: number;

          if (s[next] === '(') {
            // Grouped base: -(...)
            baseStart = next;
            baseEnd = collectGroup(s, next);
          } else if (/[\w]/.test(s[next])) {
            // Bare token base: -word or -number
            baseStart = next;
            baseEnd = collectToken(s, next);
          } else {
            out += s[i++]; continue;
          }

          const afterBase = baseEnd + 1;
          if (s.slice(afterBase, afterBase + 2) === '**') {
            // Collect the exponent (grouped or bare token)
            const expStart = afterBase + 2;
            let expEnd: number;
            if (s[expStart] === '(') expEnd = collectGroup(s, expStart);
            else expEnd = collectToken(s, expStart);

            // Wrap: -(BASE**EXP)
            out += '-(' + s.slice(baseStart, expEnd + 1) + ')';
            i = expEnd + 1;
            changed = true;
            continue;
          }
        }
        out += s[i++];
      }
      s = out;
      if (!changed) break;
    }
    return s;
  }

  // ── Reciprocal / inverse-reciprocal helpers (inlined at eval time) ──────────

  private readonly _helpers = `
    function _cot(x)  { return 1 / Math.tan(x); }
    function _sec(x)  { return 1 / Math.cos(x); }
    function _csc(x)  { return 1 / Math.sin(x); }
    function _acot(x) { return Math.PI / 2 - Math.atan(x); }
    function _asec(x) { return Math.acos(1 / x); }
    function _acsc(x) { return Math.asin(1 / x); }
    function _gamma(x) {
      if (x <= 0 && x === Math.floor(x)) return Infinity;
      if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * _gamma(1 - x));
      x -= 1;
      const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,
        771.32342877765313,-176.61502916214059,12.507343278686905,
        -0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
      let a = c[0];
      const t = x + 7.5;
      for (let i = 1; i < 9; i++) a += c[i] / (x + i);
      return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
    }
    function _factorial(n) { return _gamma(n + 1); }
    function _erf(x) {
      const t = 1 / (1 + 0.3275911 * Math.abs(x));
      const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
      return x >= 0 ? y : -y;
    }
    function _erfc(x) { return 1 - _erf(x); }
  `;
}
