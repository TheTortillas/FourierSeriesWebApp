// eslint-disable-next-line @typescript-eslint/no-require-imports
const Tex2Max = require("tex2max");

export interface ParseResult {
  maxima: string;
  ok: boolean;
  error?: string;
}

/**
 * Converts LaTeX math expressions to Maxima CAS syntax.
 * Mirrors the logic previously in the Angular LatexToMaximaService on the frontend.
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
      /\b(u|sgn|delta|imagunit|rect|sinc|gamma|factorial)\s*\*\s*\(/g,
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
      .replace(/\\left/g, "")
      .replace(/\\right/g, "")
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
      .replace(/\\exp\(/g, "\\operatorname{exp}(")
      .replace(/\\operatorname\{exp\}\(/g, "\\operatorname{exp}(")
      .replace(/\\operatorname\{delta\}/g, " TMDELTA")
      .replace(/\\delta\b/g, " TMDELTA")
      .replace(/\\operatorname\{gamma\}/g, "TMGAMMA")
      .replace(/\\operatorname\{factorial\}/g, "TMFACTORIAL")
      .replace(/\\Gamma\b/g, "TMGAMMA")
      .replace(/\\mathrm\{i\}/g, "\\operatorname{imagunit}")
      .replace(/-\s*\\infty/g, "TMMINF")
      .replace(/\\infty/g, "TMINF");

    s = this.substituteExp(s);
    return s;
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
      result += latex.slice(i, idx) + "e^{(";
      i = idx + marker.length;
      let depth = 1;
      while (i < latex.length && depth > 0) {
        const c = latex[i];
        if (c === "(") depth++;
        else if (c === ")") {
          depth--;
          if (depth === 0) {
            result += ")}";
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
      .replace(/\b(gamma|factorial|exp)\s*\*\s*\(/g, "$1(");

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
