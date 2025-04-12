import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MathUtilsService {
  /**
   * Converts a Maxima expression to JavaScript math format
   * @param expr The Maxima expression as string
   * @returns Converted JavaScript expression
   */
  maximaToJS(expr: string): string {
    if (!expr) return '';

    // Limpieza de artefactos de salto de línea de Maxima
    expr = expr.replace(/\\\n/g, '');
    expr = expr.replace(/\\\s*\n/g, '');

    const replacements = [
      // Constants
      { pattern: /%pi/g, replacement: 'Math.PI' },
      { pattern: /%e/g, replacement: 'Math.E' },

      // Trigonometric functions
      { pattern: /\bsin\(/g, replacement: 'Math.sin(' },
      { pattern: /\bcos\(/g, replacement: 'Math.cos(' },
      { pattern: /\btan\(/g, replacement: 'Math.tan(' },
      { pattern: /\bsec\(/g, replacement: '1 / Math.cos(' },
      { pattern: /\bcsc\(/g, replacement: '1 / Math.sin(' },
      { pattern: /\bcot\(/g, replacement: '1 / Math.tan(' },

      // Inverse trigonometric functions
      { pattern: /\basin\(/g, replacement: 'Math.asin(' },
      { pattern: /\bacos\(/g, replacement: 'Math.acos(' },
      { pattern: /\batan\(/g, replacement: 'Math.atan(' },
      { pattern: /\basec\(/g, replacement: 'Math.acos(1/' },
      { pattern: /\bacsc\(/g, replacement: 'Math.asin(1/' },
      { pattern: /\bacot\(/g, replacement: 'Math.atan(1/' },

      // Hyperbolic functions
      { pattern: /\bsinh\(/g, replacement: 'Math.sinh(' },
      { pattern: /\bcosh\(/g, replacement: 'Math.cosh(' },
      { pattern: /\btanh\(/g, replacement: 'Math.tanh(' },
      { pattern: /\bsech\(/g, replacement: '1 / Math.cosh(' },
      { pattern: /\bcsch\(/g, replacement: '1 / Math.sinh(' },
      { pattern: /\bcoth\(/g, replacement: '1 / Math.tanh(' },

      // Inverse hyperbolic functions (not natively in Math but can be defined)
      {
        pattern: /\basinh\(/g,
        replacement: 'Math.log($1 + Math.sqrt($1 * $1 + 1))',
      },
      {
        pattern: /\bacosh\(/g,
        replacement: 'Math.log($1 + Math.sqrt($1 * $1 - 1))',
      },
      {
        pattern: /\batanh\(/g,
        replacement: '0.5 * Math.log((1 + $1) / (1 - $1))',
      },

      // Other functions
      { pattern: /\bsqrt\(/g, replacement: 'Math.sqrt(' },
      { pattern: /\babs\(/g, replacement: 'Math.abs(' },
      { pattern: /\blog\(/g, replacement: 'Math.log(' },
      { pattern: /\bln\(/g, replacement: 'Math.log(' },
      { pattern: /\bexp\(/g, replacement: 'Math.exp(' },
      { pattern: /\bfloor\(/g, replacement: 'Math.floor(' },
      { pattern: /\bceil\(/g, replacement: 'Math.ceil(' },
      { pattern: /\bround\(/g, replacement: 'Math.round(' },
      { pattern: /\bmax\(/g, replacement: 'Math.max(' },
      { pattern: /\bmin\(/g, replacement: 'Math.min(' },
      { pattern: /\bpow\(/g, replacement: 'Math.pow(' },
      { pattern: /\brandom\(/g, replacement: 'Math.random(' },

      // Powers
      { pattern: /\*\*/g, replacement: '**' },
      { pattern: /\^/g, replacement: '**' },

      // Logical equality
      { pattern: /([^=!<>])=([^=])/g, replacement: '$1==$2' },
    ];

    let jsExpr = expr;
    replacements.forEach(({ pattern, replacement }) => {
      jsExpr = jsExpr.replace(pattern, replacement);
    });

    // Additional cleanup for special cases
    jsExpr = jsExpr.replace(/\)\(/g, ')*('); // Handle implicit multiplication like f(x)(y)
    jsExpr = jsExpr.replace(/(\d)([a-zA-Z])/g, '$1*$2'); // Handle implicit multiplication like 2x

    // For trig inverse functions that need parenthesis closing
    jsExpr = jsExpr.replace(/\basec\(([^)]+)\)/g, 'Math.acos(1/$1)');
    jsExpr = jsExpr.replace(/\bacsc\(([^)]+)\)/g, 'Math.asin(1/$1)');
    jsExpr = jsExpr.replace(/\bacot\(([^)]+)\)/g, 'Math.atan(1/$1)');

    // For hyperbolic inverse functions that need proper substitution
    jsExpr = jsExpr.replace(
      /Math\.log\(\$1 \+ Math\.sqrt\(\$1 \* \$1 \+ 1\)\)/g,
      function (match, expr) {
        return `Math.log(${expr} + Math.sqrt(${expr} * ${expr} + 1))`;
      }
    );
    jsExpr = jsExpr.replace(
      /Math\.log\(\$1 \+ Math\.sqrt\(\$1 \* \$1 - 1\)\)/g,
      function (match, expr) {
        return `Math.log(${expr} + Math.sqrt(${expr} * ${expr} - 1))`;
      }
    );
    jsExpr = jsExpr.replace(
      /0\.5 \* Math\.log\(\(1 \+ \$1\) \/ \(1 - \$1\)\)/g,
      function (match, expr) {
        return `0.5 * Math.log((1 + ${expr}) / (1 - ${expr}))`;
      }
    );

    return jsExpr;
  }

  /**
   * Evaluates a Maxima expression with given variable values
   * @param expr The Maxima expression
   * @param variables Object with variable names as keys and their values
   * @returns Computed result
   */
  evaluateMaximaExpr(expr: string, variables: Record<string, number>): number {
    const jsExpr = this.maximaToJS(expr);

    // Create function with the variables as parameters
    const varNames = Object.keys(variables);
    const varValues = Object.values(variables);

    try {
      // eslint-disable-next-line no-new-func
      const evalFn = new Function(...varNames, `return ${jsExpr};`);
      return evalFn(...varValues);
    } catch (error) {
      console.error('Error evaluating expression:', error);
      return NaN;
    }
  }

  /**
   * Helper function to create custom math functions not available in Math
   * These can be added to your evaluation context if needed
   */
  getExtendedMathFunctions() {
    return {
      // Inverse hyperbolic functions
      asinh: (x: number) => Math.log(x + Math.sqrt(x * x + 1)),
      acosh: (x: number) => Math.log(x + Math.sqrt(x * x - 1)),
      atanh: (x: number) => 0.5 * Math.log((1 + x) / (1 - x)),

      // Sec, csc, cot and their inverses
      sec: (x: number) => 1 / Math.cos(x),
      csc: (x: number) => 1 / Math.sin(x),
      cot: (x: number) => 1 / Math.tan(x),
      asec: (x: number) => Math.acos(1 / x),
      acsc: (x: number) => Math.asin(1 / x),
      acot: (x: number) => Math.atan(1 / x),

      // Hyperbolic sec, csc, cot
      sech: (x: number) => 1 / Math.cosh(x),
      csch: (x: number) => 1 / Math.sinh(x),
      coth: (x: number) => 1 / Math.tanh(x),
    };
  }
}
