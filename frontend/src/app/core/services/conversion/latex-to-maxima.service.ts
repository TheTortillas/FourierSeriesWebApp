import { Injectable } from '@angular/core';
import TeX2Max from 'tex2max';

@Injectable({
  providedIn: 'root',
})
export class LatexToMaximaService {
  private converter: any;

  constructor() {
    this.converter = new TeX2Max({
      onlySingleVariables: false,
      handleEquation: true,
      addTimesSign: true,
      disallowDecimalPoints: false,
      disallowllowDecimalCommas: false,
      onlyGreekName: false,
      onlyGreekSymbol: false,
      debugging: false,
    });
  }

  /**
   * Convierte una expresión LaTeX a formato Maxima
   * @param latexExpression La expresión en formato LaTeX
   * @returns La expresión convertida a formato Maxima
   */
  convertToMaxima(latexExpression: string): string {
    try {
      // Si la expresión está vacía o es undefined, devolver string vacío
      if (!latexExpression || latexExpression.trim() === '') {
        return '';
      }

      // Si es el placeholder de MathQuill, devolver string vacío
      if (latexExpression === '\\square') {
        return '';
      }

      // Procesamiento previo para casos especiales
      let preprocessedLatex = this.preProcessLatexExpression(latexExpression);

      console.log('LaTeX pre-procesado:', preprocessedLatex);
      const maximaExpression = this.converter.toMaxima(preprocessedLatex);
      console.log('Maxima inicial:', maximaExpression);

      // Algunos post-procesamiento que pueda ser necesario para compatibilidad con Maxima
      const finalExpression =
        this.postProcessMaximaExpression(maximaExpression);
      console.log('Maxima final:', finalExpression);

      return finalExpression;
    } catch (error) {
      console.error('Error al convertir LaTeX a Maxima:', error);
      console.error('Expresión LaTeX problemática:', latexExpression);

      // Intento de recuperación para expresiones exponenciales
      if (latexExpression.includes('\\exp')) {
        return this.handleExponentialFallback(latexExpression);
      }

      // En caso de error, devolver la expresión original para no bloquear toda la operación
      return latexExpression;
    }
  }

  /**
   * Pre-procesa la expresión LaTeX para casos especiales antes de la conversión
   */
  private preProcessLatexExpression(expression: string): string {
    // Normalizar la función exponencial
    let result = expression;

    // Convertir \exp{...} y \exp \left( ... \right) a formatos que tex2max pueda manejar mejor
    result = result.replace(/\\exp\s*\{([^}]*)\}/g, '\\exp\\left($1\\right)');
    result = result.replace(/\\exp\s*(?!\\left)/g, '\\exp\\left(');

    // Asegurar que los espacios en blanco no afecten el parsing
    result = result.replace(/\\\s+/g, '\\');

    return result;
  }

  /**
   * Maneja la función exponencial cuando falla la conversión normal
   */
  private handleExponentialFallback(expression: string): string {
    // Extraer el contenido dentro de los paréntesis o llaves después de \exp
    const expMatch = expression.match(
      /\\exp(?:\\left)?\(\s*(.*?)\s*(?:\\right)?\)/
    );
    const expContent = expMatch ? expMatch[1] : '';

    if (expContent) {
      // Convertir manualmente el contenido si es posible
      const content = this.convertToMaxima(expContent);
      return `exp(${content})`;
    }

    // Si todo falla, transformar \exp directamente a exp()
    return expression.replace(
      /\\exp(?:\\left)?\(\s*(.*?)\s*(?:\\right)?\)/g,
      'exp($1)'
    );
  }

  /**
   * Realiza ajustes finales a la expresión Maxima para asegurar compatibilidad
   */
  private postProcessMaximaExpression(expression: string): string {
    // Reemplazar potencias con sintaxis de Maxima: a^b -> a**b
    let result = expression.replace(/\^/g, '**');

    // Reemplazar pi y e con sus equivalentes en Maxima
    result = result.replace(/\\pi|pi/g, '%pi');
    result = result.replace(/\\e|(?<![a-zA-Z])e(?![a-zA-Z])/g, '%e');

    // Reemplazar funciones trigonométricas y logarítmicas
    const funcMap: Record<string, string> = {
      sin: 'sin',
      cos: 'cos',
      tan: 'tan',
      cot: 'cot',
      sec: 'sec',
      csc: 'csc',
      asin: 'asin',
      acos: 'acos',
      atan: 'atan',
      sinh: 'sinh',
      cosh: 'cosh',
      tanh: 'tanh',
      ln: 'log',
      log: 'log',
      exp: 'exp',
    };

    // Aplicar todas las conversiones de funciones
    for (const [latexFunc, maximaFunc] of Object.entries(funcMap)) {
      // Buscar patrón como \func(...) o func(...)
      const pattern1 = new RegExp(`\\\\${latexFunc}\\s*\\(`, 'g');
      const pattern2 = new RegExp(`\\b${latexFunc}\\s*\\(`, 'g');

      result = result.replace(pattern1, `${maximaFunc}(`);
      result = result.replace(pattern2, `${maximaFunc}(`);
    }

    // Manejo especial para la función exponencial
    result = result.replace(/\\exp\{([^}]*)\}/g, 'exp($1)');
    result = result.replace(/\\exp\s*\\left\(\s*(.*?)\s*\\right\)/g, 'exp($1)');
    result = result.replace(/\\exp\s*\(\s*(.*?)\s*\)/g, 'exp($1)');

    // Manejo de notación exponencial
    result = result.replace(/\\text\{exp\}\s*\(\s*(.*?)\s*\)/g, 'exp($1)');
    result = result.replace(/\\mathrm\{exp\}\s*\(\s*(.*?)\s*\)/g, 'exp($1)');

    // Asegurar que las multiplicaciones implícitas tengan el operador *
    // Por ejemplo: 2x -> 2*x
    result = result.replace(/(\d)([a-zA-Z])/g, '$1*$2');

    return result;
  }
}
