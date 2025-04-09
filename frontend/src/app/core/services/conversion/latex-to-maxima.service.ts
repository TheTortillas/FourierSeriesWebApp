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

      const maximaExpression = this.converter.toMaxima(latexExpression);

      // Algunos post-procesamiento que pueda ser necesario para compatibilidad con Maxima
      return this.postProcessMaximaExpression(maximaExpression);
    } catch (error) {
      console.error('Error al convertir LaTeX a Maxima:', error);
      console.error('Expresión LaTeX problemática:', latexExpression);
      // En caso de error, devolver la expresión original para no bloquear toda la operación
      return latexExpression;
    }
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
      ln: 'log', // En Maxima, log es el logaritmo natural
      log: 'log10', // En Maxima, log10 es el logaritmo base 10
    };

    // Aplicar todas las conversiones de funciones
    for (const [latexFunc, maximaFunc] of Object.entries(funcMap)) {
      // Buscar patrón como \func(...) o func(...)
      const pattern1 = new RegExp(`\\\\${latexFunc}\\s*\\(`, 'g');
      const pattern2 = new RegExp(`\\b${latexFunc}\\s*\\(`, 'g');

      result = result.replace(pattern1, `${maximaFunc}(`);
      result = result.replace(pattern2, `${maximaFunc}(`);
    }

    // Asegurar que las multiplicaciones implícitas tengan el operador *
    // Por ejemplo: 2x -> 2*x
    result = result.replace(/(\d)([a-zA-Z])/g, '$1*$2');

    return result;
  }
}
