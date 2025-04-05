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

    const replacements = [
      { pattern: /%pi/g, replacement: 'Math.PI' },
      { pattern: /%e/g, replacement: 'Math.E' },
      { pattern: /%i/g, replacement: 'Complex.I' }, // Assuming you have a Complex class/library
      { pattern: /\bsin\(/g, replacement: 'Math.sin(' },
      { pattern: /\bcos\(/g, replacement: 'Math.cos(' },
      { pattern: /\btan\(/g, replacement: 'Math.tan(' },
      { pattern: /\bcot\(/g, replacement: '(1/Math.tan(' },
      { pattern: /\bcsc\(/g, replacement: '(1/Math.sin(' },
      { pattern: /\bsec\(/g, replacement: '(1/Math.cos(' },
      { pattern: /\basin\(/g, replacement: 'Math.asin(' },
      { pattern: /\bacos\(/g, replacement: 'Math.acos(' },
      { pattern: /\batan\(/g, replacement: 'Math.atan(' },
      { pattern: /\blog\(/g, replacement: 'Math.log(' },
      { pattern: /\bln\(/g, replacement: 'Math.log(' },
      { pattern: /\bexp\(/g, replacement: 'Math.exp(' },
      { pattern: /\bsqrt\(/g, replacement: 'Math.sqrt(' },
      { pattern: /\babs\(/g, replacement: 'Math.abs(' },
      { pattern: /\*\*/g, replacement: '**' },
      { pattern: /\^/g, replacement: '**' },
      { pattern: /([^=!<>])=([^=])/g, replacement: '$1==$2' },
    ];

    let jsExpr = expr;
    replacements.forEach(({ pattern, replacement }) => {
      jsExpr = jsExpr.replace(pattern, replacement);
    });

    // Additional cleanup for special cases (if needed)
    jsExpr = jsExpr.replace(/\)\(/g, ')*('); // Handle implicit multiplication like f(x)(y)
    jsExpr = jsExpr.replace(/(\d)([a-zA-Z])/g, '$1*$2'); // Handle implicit multiplication like 2x

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
}
