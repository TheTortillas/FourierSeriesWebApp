import { Injectable } from '@angular/core';
import { Piece } from '../../../interfaces/piece.interface';
import Swal from 'sweetalert2';
import { LatexToMaximaService } from '../conversion/latex-to-maxima.service';
import { MathUtilsService } from '../maximaToJS/math-utils.service';

@Injectable({
  providedIn: 'root',
})
export class FourierValidatorService {
  constructor(
    private latexToMaximaService: LatexToMaximaService,
    private mathUtilsService: MathUtilsService
  ) {}

  validateIntervals(pieces: Piece[]): boolean {
    if (pieces.length <= 0) return false;

    // Clase para marcar campos inválidos
    const invalidClass = 'border-red-500';

    // Eliminar las marcas de error anteriores
    document.querySelectorAll('.pieceStart, .pieceEnd').forEach((element) => {
      element.classList.remove(invalidClass);
    });

    let hasError = false;

    // 1. Verificar que el límite inferior sea menor que el límite superior en cada trozo
    for (let i = 0; i < pieces.length; i++) {
      const startField = document.querySelectorAll('.pieceStart')[
        i
      ] as HTMLElement;
      const endField = document.querySelectorAll('.pieceEnd')[i] as HTMLElement;

      if (!startField || !endField) continue;

      const startLatex = pieces[i].startField?.latex() || '';
      const endLatex = pieces[i].endField?.latex() || '';

      // Si ambos campos tienen contenido, verificamos que start < end
      if (
        startLatex &&
        endLatex &&
        startLatex !== '\\square' &&
        endLatex !== '\\square'
      ) {
        try {
          // Convertir expresiones LaTeX a Maxima
          const startMaxima =
            this.latexToMaximaService.convertToMaxima(startLatex);
          const endMaxima = this.latexToMaximaService.convertToMaxima(endLatex);

          // Intentar evaluar las expresiones como números (si son constantes)
          // Este enfoque funcionará para valores constantes. Para expresiones más complejas
          // se podría necesitar un enfoque más sofisticado.
          try {
            const startValue = this.mathUtilsService.evaluateMaximaExpr(
              startMaxima,
              {}
            );
            const endValue = this.mathUtilsService.evaluateMaximaExpr(
              endMaxima,
              {}
            );

            if (
              !isNaN(startValue) &&
              !isNaN(endValue) &&
              startValue >= endValue
            ) {
              startField.classList.add(invalidClass);
              endField.classList.add(invalidClass);
              hasError = true;
            }
          } catch (evalError) {
            // En caso de no poder evaluar numéricamente, ignoramos esta validación
            console.warn('No se pudo evaluar numéricamente:', evalError);
          }
        } catch (convError) {
          console.warn('Error al convertir expresiones:', convError);
        }
      }
    }

    // 2. Verificar que los intervalos sean contiguos (código existente)
    if (pieces.length > 1) {
      for (let i = 1; i < pieces.length; i++) {
        const previousEndField = document.querySelectorAll('.pieceEnd')[
          i - 1
        ] as HTMLElement;
        const currentStartField = document.querySelectorAll('.pieceStart')[
          i
        ] as HTMLElement;

        if (!previousEndField || !currentStartField) continue;

        const previousEndLatex = pieces[i - 1].endField?.latex() || '';
        const currentStartLatex = pieces[i].startField?.latex() || '';

        // Si ambos campos tienen contenido, comparamos
        if (
          previousEndLatex &&
          currentStartLatex &&
          previousEndLatex !== '\\square' &&
          currentStartLatex !== '\\square'
        ) {
          // Verificar si son exactamente iguales
          if (previousEndLatex !== currentStartLatex) {
            // Marcar ambos campos como inválidos
            previousEndField.classList.add(invalidClass);
            currentStartField.classList.add(invalidClass);
            hasError = true;
          }
        }
      }
    }

    return hasError;
  }

  validateForm(
    seriesType: string,
    pieces: Piece[]
  ): { isValid: boolean; error?: any } {
    // Validación de tipo de serie
    if (!seriesType) {
      return {
        isValid: false,
        error: {
          title: 'Error',
          text: 'Por favor, selecciona un tipo de serie de Fourier',
          icon: 'error',
        },
      };
    }

    // Verificar si hay piezas definidas
    if (pieces.length === 0) {
      return {
        isValid: false,
        error: {
          title: 'Error',
          text: 'Debes definir al menos una parte de la función',
          icon: 'error',
        },
      };
    }

    // Validar que en cada intervalo, el límite inferior sea menor que el superior
    const hasIntervalOrderErrors = this.validateIntervalOrder(pieces);
    if (hasIntervalOrderErrors) {
      return {
        isValid: false,
        error: {
          title: 'Error en los intervalos',
          html: 'En cada intervalo, el límite inferior debe ser menor que el límite superior.',
          icon: 'error',
        },
      };
    }

    // Validar los intervalos contiguos
    const hasIntervalErrors = this.validateIntervals(pieces);
    if (hasIntervalErrors) {
      return {
        isValid: false,
        error: {
          title: 'Error en los intervalos',
          html: 'Los intervalos deben ser contiguos. Cada trozo debe empezar donde termina el anterior.',
          icon: 'error',
        },
      };
    }

    // Validación de cada pieza de la función (campos no vacíos)
    let hasEmptyFields = false;
    let emptyFieldsMessage = '';

    // Validar cada pieza
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];

      // Revisar si algún campo está vacío
      const funcLatex = piece.funcField?.latex() || '';
      const startLatex = piece.startField?.latex() || '';
      const endLatex = piece.endField?.latex() || '';

      if (!funcLatex.trim() || funcLatex === '\\square') {
        hasEmptyFields = true;
        emptyFieldsMessage += `• Función en la pieza ${i + 1}\n`;
      }

      if (!startLatex.trim() || startLatex === '\\square') {
        hasEmptyFields = true;
        emptyFieldsMessage += `• Límite inferior en la pieza ${i + 1}\n`;
      }

      if (!endLatex.trim() || endLatex === '\\square') {
        hasEmptyFields = true;
        emptyFieldsMessage += `• Límite superior en la pieza ${i + 1}\n`;
      }
    }

    // Mostrar error si hay campos vacíos
    if (hasEmptyFields) {
      return {
        isValid: false,
        error: {
          title: 'Campos vacíos',
          html: `Por favor, completa los siguientes campos:<pre>${emptyFieldsMessage}</pre>`,
          icon: 'warning',
        },
      };
    }

    return { isValid: true };
  }

  /**
   * Valida que en cada intervalo, el límite inferior sea menor que el límite superior
   * @param pieces Las piezas de la función
   * @returns true si hay errores, false en caso contrario
   */
  private validateIntervalOrder(pieces: Piece[]): boolean {
    if (pieces.length <= 0) return false;

    const invalidClass = 'border-red-500';
    let hasError = false;

    // Eliminar marcas de error previas
    document.querySelectorAll('.pieceStart, .pieceEnd').forEach((element) => {
      element.classList.remove(invalidClass);
    });

    for (let i = 0; i < pieces.length; i++) {
      const startField = document.querySelectorAll('.pieceStart')[
        i
      ] as HTMLElement;
      const endField = document.querySelectorAll('.pieceEnd')[i] as HTMLElement;

      if (!startField || !endField) continue;

      const startLatex = pieces[i].startField?.latex() || '';
      const endLatex = pieces[i].endField?.latex() || '';

      if (
        startLatex &&
        endLatex &&
        startLatex !== '\\square' &&
        endLatex !== '\\square'
      ) {
        try {
          // Convertir expresiones LaTeX a Maxima
          const startMaxima =
            this.latexToMaximaService.convertToMaxima(startLatex);
          const endMaxima = this.latexToMaximaService.convertToMaxima(endLatex);

          try {
            const startValue = this.mathUtilsService.evaluateMaximaExpr(
              startMaxima,
              {}
            );
            const endValue = this.mathUtilsService.evaluateMaximaExpr(
              endMaxima,
              {}
            );

            if (
              !isNaN(startValue) &&
              !isNaN(endValue) &&
              startValue >= endValue
            ) {
              startField.classList.add(invalidClass);
              endField.classList.add(invalidClass);
              hasError = true;
            }
          } catch (evalError) {
            // En caso de no poder evaluar numéricamente, podríamos mostrar una advertencia
            console.warn('No se pudo evaluar numéricamente:', evalError);
          }
        } catch (convError) {
          console.warn('Error al convertir expresiones:', convError);
        }
      }
    }

    return hasError;
  }

  /**
   * Valida si hay texto en cursiva (funciones no reconocidas) en los campos
   * @param pieces Las piezas de la función a validar
   * @param intVar La variable de integración seleccionada
   * @returns Un objeto con el resultado de la validación y los detalles
   */
  validateItalicText(
    pieces: Piece[],
    intVar: string
  ): {
    isValid: boolean;
    error?: any;
  } {
    if (pieces.length <= 0) return { isValid: true };

    const invalidFields: {
      index: number;
      fieldType: string;
      content: string;
    }[] = [];

    // Permitir la variable de integración y las variables especiales L y T
    const allowedVars = [intVar, 'L', 'T'];

    // Lista de palabras clave a ignorar (constantes, etc.)
    const ignoreKeywords = ['pi', 'e'];

    // Variable para rastrear si se encontraron L o T
    let usesArbitraryVars = false;

    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];

      // Validar campo de función
      if (piece.funcField) {
        const funcLatex = piece.funcField.latex();
        const italicMatches = this.findItalicText(
          funcLatex,
          allowedVars,
          ignoreKeywords
        );

        if (italicMatches.length > 0) {
          invalidFields.push({
            index: i,
            fieldType: 'función',
            content: italicMatches.join(', '),
          });
        }

        // Verificar si se usan variables arbitrarias
        if (funcLatex.includes('L') || funcLatex.includes('T')) {
          usesArbitraryVars = true;
        }
      }

      // Validar límite inferior
      if (piece.startField) {
        const startLatex = piece.startField.latex();
        const italicMatches = this.findItalicText(
          startLatex,
          allowedVars,
          ignoreKeywords
        );

        if (italicMatches.length > 0) {
          invalidFields.push({
            index: i,
            fieldType: 'límite inferior',
            content: italicMatches.join(', '),
          });
        }

        // Verificar si se usan variables arbitrarias
        if (startLatex.includes('L') || startLatex.includes('T')) {
          usesArbitraryVars = true;
        }
      }

      // Validar límite superior
      if (piece.endField) {
        const endLatex = piece.endField.latex();
        const italicMatches = this.findItalicText(
          endLatex,
          allowedVars,
          ignoreKeywords
        );

        if (italicMatches.length > 0) {
          invalidFields.push({
            index: i,
            fieldType: 'límite superior',
            content: italicMatches.join(', '),
          });
        }

        // Verificar si se usan variables arbitrarias
        if (endLatex.includes('L') || endLatex.includes('T')) {
          usesArbitraryVars = true;
        }
      }
    }

    // Registrar en consola si se están usando variables arbitrarias
    if (usesArbitraryVars) {
      console.log(
        '⚠️ Se están usando variables arbitrarias (L, T) en la expresión.'
      );
    }

    if (invalidFields.length > 0) {
      let errorMessage = '';
      invalidFields.forEach((field) => {
        errorMessage += `\n• Pieza ${field.index + 1}, ${field.fieldType}: "${
          field.content
        }"`;
      });

      return {
        isValid: false,
        error: {
          title: 'Expresiones no reconocidas',
          html: `<div>
            <p>Se encontraron funciones o variables no reconocidas:</p>
            <pre style="text-align: left; margin-top: 10px; padding: 8px; background: #f4f4f4; border-radius: 4px; max-height: 150px; overflow-y: auto;">${errorMessage}</pre>
          </div>`,
          icon: 'warning',
        },
      };
    }

    return { isValid: true };
  }

  /**
   * Encuentra texto en cursiva (no reconocido) en una expresión LaTeX
   */
  private findItalicText(
    latex: string,
    allowedVars: string[],
    ignoreKeywords: string[]
  ): string[] {
    if (!latex || latex === '\\square') return [];

    const matches: string[] = [];
    const italicTextRegex = /(?<![\\a-zA-Z])([a-zA-Z]+)(?![a-zA-Z])/g;
    let match;

    // Buscar todas las coincidencias
    while ((match = italicTextRegex.exec(latex)) !== null) {
      const word = match[1];
      // Si no es una variable permitida ni una palabra clave ignorada
      if (!allowedVars.includes(word) && !ignoreKeywords.includes(word)) {
        // Ignorar funciones conocidas que no necesitan validación
        if (
          ![
            'sin',
            'cos',
            'tan',
            'sec',
            'csc',
            'cot',
            'sen',
            'exp',
            'log',
            'ln',
            'sinh',
            'cosh',
            'tanh',
          ].includes(word)
        ) {
          matches.push(word);
        }
      }
    }

    return matches;
  }
}
