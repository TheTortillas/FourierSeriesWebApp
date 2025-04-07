import { Injectable } from '@angular/core';
import { Piece } from '../../../interfaces/piece.interface';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class FourierValidatorService {
  constructor() {}

  validateIntervals(pieces: Piece[]): boolean {
    if (pieces.length <= 1) return false;

    // Clase para marcar campos inválidos
    const invalidClass = 'border-red-500';

    // Eliminar las marcas de error anteriores
    document.querySelectorAll('.pieceStart, .pieceEnd').forEach((element) => {
      element.classList.remove(invalidClass);
    });

    let hasError = false;

    // Verificar cada par de intervalos adyacentes
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
      if (previousEndLatex && currentStartLatex) {
        // Verificar si son exactamente iguales
        if (previousEndLatex !== currentStartLatex) {
          // Marcar ambos campos como inválidos
          previousEndField.classList.add(invalidClass);
          currentStartField.classList.add(invalidClass);
          hasError = true;
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
}
