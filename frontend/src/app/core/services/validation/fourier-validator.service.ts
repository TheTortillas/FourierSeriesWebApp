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
}
