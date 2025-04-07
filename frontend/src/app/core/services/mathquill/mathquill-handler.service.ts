import { Injectable, NgZone } from '@angular/core';
import { MathquillService } from './mathquill.service';

@Injectable({
  providedIn: 'root',
})
export class MathquillHandlerService {
  private activeMathField: any = null;

  constructor(
    private mathquillService: MathquillService,
    private ngZone: NgZone
  ) {}

  setActiveMathField(field: any): void {
    this.activeMathField = field;
  }

  getActiveMathField(): any {
    return this.activeMathField;
  }

  createMathField(element: HTMLElement, options: any = {}): any {
    const mathField = this.mathquillService.createMathField(element, options);

    element.addEventListener('focus', () => {
      this.activeMathField = mathField;
    });

    element.addEventListener('mousedown', () => {
      this.activeMathField = mathField;
    });

    return mathField;
  }

  insertMath(latex: string): void {
    if (!this.activeMathField) return;

    // Ejecutar fuera de la detección de cambios para mejor rendimiento
    this.ngZone.runOutsideAngular(() => {
      this.activeMathField.focus();

      // Lista de todas las funciones trigonométricas
      const trigFunctions = [
        '\\sin',
        '\\cos',
        '\\tan',
        '\\cot',
        '\\sec',
        '\\csc',
        '\\arcsin',
        '\\arccos',
        '\\arctan',
        '\\arccot',
        '\\arcsec',
        '\\arccsc',
        '\\sinh',
        '\\cosh',
        '\\tanh',
        '\\coth',
        '\\sech',
        '\\csch',
        '\\arcsinh',
        '\\arccosh',
        '\\arctanh',
        '\\arccoth',
        '\\arcsech',
        '\\arccsch',
      ];

      // Comprobar si es una función trigonométrica
      const isTrigFunction = trigFunctions.some((func) => latex.includes(func));

      if (isTrigFunction) {
        // Extraer el nombre de la función
        const funcName = latex.match(/\\[a-z]+/)?.[0];
        if (funcName) {
          this.activeMathField.cmd(funcName);
          this.activeMathField.write('\\left( \\right)');
          this.activeMathField.keystroke('Left');
        }
      } else if (latex === '\\left (  \\right )') {
        // Paréntesis - posicionar cursor dentro
        this.activeMathField.write('\\left( \\right)');
        this.activeMathField.keystroke('Left');
      } else if (latex === '\\frac{ }{ }') {
        // Fracción - posicionar cursor en el numerador
        this.activeMathField.cmd('\\frac');
      } else if (latex === '\\sqrt{ }') {
        // Raíz cuadrada
        this.activeMathField.cmd('\\sqrt');
      } else if (latex === '\\ln{ }') {
        // Logaritmo natural
        this.activeMathField.cmd('\\ln');
        this.activeMathField.write('\\left( \\right)');
        this.activeMathField.keystroke('Left');
      } else if (latex === '\\log_{ }{ }') {
        // Logaritmo en base
        this.activeMathField.write('\\log_{}{}');
        this.activeMathField.keystroke('Left Left Left');
      } else if (latex === '{}^2') {
        // Cuadrado
        this.activeMathField.write('{}^2');
      } else if (latex === '{}^{}') {
        // Potencia general
        this.activeMathField.write('{}^{}');
        this.activeMathField.keystroke('Up');
      } else {
        // Otros símbolos o comandos simples
        this.activeMathField.write(latex);
      }
    });
  }
}
