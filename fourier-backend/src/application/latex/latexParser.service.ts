// eslint-disable-next-line @typescript-eslint/no-require-imports
const Tex2Max = require("tex2max");

export interface ParseResult {
  maxima: string;
  ok: boolean;
  error?: string;
}

/**
 * Converts LaTeX math expressions to Maxima CAS syntax.
 * tex2max is GPL v2 — keeping it server-side avoids bundling it in the browser.
 */
export class LatexParserService {
  private readonly converter = new Tex2Max({
    onlySingleVariables: false,
    addTimesSign: true,
    onlyGreekSymbol: false,
  });

  parse(latex: string): ParseResult {
    if (!latex.trim()) {
      return { maxima: "", ok: false, error: "Expresión vacía" };
    }
    try {
      const preprocessed = this.preProcess(latex.trim());
      const raw: string = this.converter.toMaxima(preprocessed);
      const maxima = this.postProcess(raw);
      return { maxima, ok: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { maxima: "", ok: false, error };
    }
  }

  parseForTransforms(latex: string): ParseResult {
    const base = this.parse(latex);
    if (!base.ok) return base;

    let maxima = base.maxima;

    maxima = maxima.replace(
      /\b(u|sgn|delta|imagunit|rect|tri|sinc|gamma|factorial)\s*\*\s*\(/g,
      "$1(",
    );

    // Imaginary unit resolution
    maxima = maxima.replace(/\bimagunit([a-zA-Z])(?![a-zA-Z0-9_%])/g, "%i*$1");
    maxima = maxima.replace(/\bimagunit\b/g, "%i");
    maxima = maxima.replace(/\bi([a-zA-Z])(?![a-zA-Z0-9_%])/g, "%i*$1");
    maxima = maxima.replace(
      /(?<![a-zA-Z0-9_%])([a-zA-Z])i(?![a-zA-Z0-9_%])/g,
      "$1*%i",
    );
    maxima = maxima.replace(/(?<![a-zA-Z0-9_%])i(?![a-zA-Z0-9_%])/g, "%i");

    return { ...base, maxima };
  }

  private preProcess(latex: string): string {
    let s = latex
      .replace(/\\cdot\s*/g, " ")
      .replace(/\\operatorname\{sen\}/g, "\\sin")
      .replace(/\\operatorname\{tg\}/g, "\\tan")
      .replace(/\\operatorname\{senh\}/g, "\\sinh")
      .replace(/\\operatorname\{ctg\}/g, "\\cot")
      .replace(/\\arcsin/g, "\\operatorname{asin}")
      .replace(/\\arccos/g, "\\operatorname{acos}")
      .replace(/\\arctan/g, "\\operatorname{atan}")
      .replace(/\\operatorname\{arcsin\}/g, "\\operatorname{asin}")
      .replace(/\\operatorname\{arccos\}/g, "\\operatorname{acos}")
      .replace(/\\operatorname\{arctan\}/g, "\\operatorname{atan}")
      .replace(/\\operatorname\{ln\}/g, "\\log")
      .replace(/\\ln\b/g, "\\log")
      .replace(/\\exp\b/g, "\\operatorname{exp}")
      .replace(/\\operatorname\{exp\}\s*\\left\s*\(/g, "\\operatorname{exp}(")
      .replace(/\\operatorname\{exp\}\s*\(/g, "\\operatorname{exp}(")
      .replace(/\\operatorname\{sech\}/g, "\\sech")
      .replace(/\\operatorname\{csch\}/g, "\\csch")
      .replace(/\\operatorname\{coth\}/g, "\\coth")
      .replace(/\\operatorname\{sgn\}/g, "sgn")
      .replace(/\\operatorname\{rect\}/g, "rect")
      .replace(/\\operatorname\{tri\}/g, "tri")
      .replace(/\\operatorname\{sinc\}/g, "sinc")
      .replace(/\\operatorname\{delta\}/g, " TMDELTA")
      .replace(/\\delta\b/g, " TMDELTA")
      .replace(/\\operatorname\{gamma\}/g, "TMGAMMA")
      .replace(/\\operatorname\{factorial\}/g, "TMFACTORIAL")
      .replace(/\\Gamma\b/g, "TMGAMMA")
      .replace(/\\mathrm\{i\}/g, "\\operatorname{imagunit}")
      .replace(/-\s*\\infty/g, "TMMINF")
      .replace(/\\infty/g, "TMINF");

    s = this.normalizePipes(s);
    s = this.substituteExp(s);
    s = this.splitBareIdentifiers(s);
    return s;
  }

  /**
   * Splits multi-letter bare identifiers (outside LaTeX commands) into
   * individual letters separated by spaces, so that tex2max's addTimesSign
   * inserts explicit * between them.
   *
   * Examples:
   *   Lt        → L t         → tex2max → L*t
   *   ab        → a b         → tex2max → a*b
   *   2Lt       → 2L t        → tex2max → 2*L*t
   *   \sin(Lt)  → \sin(L t)   → tex2max → sin(L*t)
   *
   * Protected (never split):
   *   - LaTeX commands: \sin, \frac, \operatorname{...}, etc.  (already parsed by tex2max)
   *   - Our internal markers: TMDELTA, TMINF, TMMINF, TMGAMMA, TMFACTORIAL
   *   - Single-letter identifiers (trivially already fine)
   */
  private splitBareIdentifiers(s: string): string {
    // Names that tex2max already knows as single tokens — splitting them would break parsing.
    // Includes all functions tex2max handles natively plus our injected markers.
    const KNOWN: ReadonlySet<string> = new Set([
      // tex2max built-ins
      "lg", "log", "ln", "sqrt", "max", "min", "sum", "lim", "int", "binom", "abs",
      "arccos", "arccosh", "arccot", "arccoth", "arccsc", "arccsch",
      "arcsec", "arcsech", "arcsin", "arcsinh", "arctan", "arctanh",
      "cos", "cosh", "cot", "coth", "csc", "csch",
      "sec", "sech", "sin", "sinh", "tan", "tanh",
      // Our domain functions (passed through as bare words after \operatorname substitution)
      "sgn", "rect", "tri", "sinc", "imagunit",
      // Internal markers injected before this step
      "TMDELTA", "TMINF", "TMMINF", "TMGAMMA", "TMFACTORIAL",
    ]);

    let result = "";
    let i = 0;

    while (i < s.length) {
      const ch = s[i];

      // LaTeX command: \word — copy verbatim, including any following braces
      if (ch === "\\") {
        result += ch;
        i++;
        // Copy the command name
        while (i < s.length && /[a-zA-Z]/.test(s[i])) {
          result += s[i++];
        }
        continue;
      }

      // Bare alphabetic run — the only thing tex2max tokenizes as STRING_LITERAL
      if (/[a-zA-Z]/.test(ch)) {
        // Collect the full run
        let run = "";
        const start = i;
        while (i < s.length && /[a-zA-Z]/.test(s[i])) run += s[i++];

        if (run.length === 1 || KNOWN.has(run)) {
          // Single letter or known function — keep as-is
          result += run;
        } else {
          // Unknown multi-letter bare identifier: is it one of our markers?
          // Markers are already uppercase-only strings; check again just in case.
          // Separate each letter with a space so tex2max sees distinct tokens.
          result += run.split("").join(" ");
        }
        void start; // suppress unused-var lint
        continue;
      }

      result += ch;
      i++;
    }

    return result;
  }

  /**
   * Convert bare pipe pairs |...| to \left|...\right| so tex2max can parse them.
   */
  private normalizePipes(s: string): string {
    let result = "";
    let i = 0;
    while (i < s.length) {
      if (s[i] === "|") {
        const before = result.slice(-5);
        if (before.endsWith("\\left") || before.endsWith("right")) {
          result += s[i++];
          continue;
        }
        let j = i + 1;
        let depth = 0;
        while (j < s.length) {
          if (s[j] === "{") depth++;
          else if (s[j] === "}") depth--;
          else if (s[j] === "|" && depth === 0) break;
          j++;
        }
        if (j < s.length) {
          result += "\\left|" + s.slice(i + 1, j) + "\\right|";
          i = j + 1;
        } else {
          result += s[i++];
        }
      } else {
        result += s[i++];
      }
    }
    return result;
  }

  private substituteExp(latex: string): string {
    const marker = "\\operatorname{exp}(";
    let result = "";
    let i = 0;
    while (i < latex.length) {
      const idx = latex.indexOf(marker, i);
      if (idx === -1) {
        result += latex.slice(i);
        break;
      }
      result += latex.slice(i, idx) + " e^{(";
      i = idx + marker.length;
      let depth = 1;
      while (i < latex.length && depth > 0) {
        const c = latex[i];
        if (c === "(") depth++;
        else if (c === ")") {
          depth--;
          if (depth === 0) {
            const inner = result.replace(/\\right$/, "");
            result = inner + ")}";
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

  private postProcess(raw: string): string {
    const normalized = raw
      .replace(/\bpi\b/g, "%pi")
      .replace(/(?<![a-zA-Z0-9_%])e(?![a-zA-Z0-9_%])/g, "%e")
      .replace(/\bexp\b/g, "exp")
      .replace(/\barcsin\b/g, "asin")
      .replace(/\barccos\b/g, "acos")
      .replace(/\barctan\b/g, "atan")
      .replace(/\barccot\b/g, "acot")
      .replace(/\barcsec\b/g, "asec")
      .replace(/\barccsc\b/g, "acsc")
      .replace(/\bln\b/g, "log")
      .replace(/\bsen\b/g, "sin")
      .replace(/\btg\b/g, "tan")
      .replace(/\bsenh\b/g, "sinh")
      .replace(/\bctg\b/g, "cot")
      .replace(/\bTMMINF\b/g, "minf")
      .replace(/\bTMINF\b/g, "inf")
      .replace(/\bTMDELTA\b/g, "delta")
      .replace(/\bTMGAMMA\b/g, "gamma")
      .replace(/\bTMFACTORIAL\b/g, "factorial")
      .replace(/\b(u|sgn|delta|rect|tri|sinc|gamma|factorial|exp|sech|csch|coth)\s*\*\s*\(/g, "$1(");

    return this.normalizePostfixFactorial(normalized);
  }

  private normalizePostfixFactorial(expr: string): string {
    let prev = "";
    let cur = expr;
    while (cur !== prev) {
      prev = cur;
      cur = cur.replace(/(\([^()]+\)|[a-zA-Z0-9_%]+)\s*!/g, (_m, token: string) => {
        const inner =
          token.startsWith("(") && token.endsWith(")") ? token.slice(1, -1) : token;
        return `factorial(${inner})`;
      });
    }
    return cur;
  }
}
