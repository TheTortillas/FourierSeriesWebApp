import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
  Inject,
  NgZone,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MathquillService } from '../../../core/services/mathquill.service';
import { Piece } from '../../../interfaces/piece.interface';
import Swal from 'sweetalert2';
import { debounceTime, Subject } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { FourierRequest } from '../../../interfaces/fourier-request.interface';
import { FourierResponse } from '../../../interfaces/fourier-response.interface';

@Component({
  selector: 'app-mathquill',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mathquill.component.html',
  styleUrls: ['./mathquill.component.scss'],
})
export class MathquillComponent implements OnInit, AfterViewInit {
  @ViewChild('pieceContainer') pieceContainer: ElementRef | undefined;

  pieces: Piece[] = [];
  activeMathField: any = null;
  seriesType: string = '';
  isHalfRange: boolean = false;
  halfRangeType: string = '';

  private updateSubject = new Subject<void>();
  keyboardVisible: boolean = true;

  // Variable selection (new)
  selectedVariable: string = 'x';

  // Check if we're running in the browser
  private isBrowser: boolean;

  // MathQuill keyboard buttons configuration
  // Operadores y funciones básicas
  mathButtonsBasic = [
    { latex: '\\pi', display: '\\pi', tooltip: 'Constante Pi (π)' },
    { latex: 'e', display: 'e', tooltip: 'Constante de Euler (e)' },
    {
      latex: '\\left (  \\right )',
      display: '\\left ( \\square \\right )',
      tooltip: 'Paréntesis',
    },
    { latex: '{}^2', display: '\\square^2', tooltip: 'Cuadrado' },
    { latex: '{}^{}', display: '{\\square}^{\\square}', tooltip: 'Potencia' },
    { latex: '\\cdot', display: '*', tooltip: 'Multiplicación' },
    { latex: '+', display: '+', tooltip: 'Suma' },
    { latex: '-', display: '-', tooltip: 'Resta' },
    {
      latex: '\\frac{ }{ }',
      display: '\\frac{\\square}{\\square}',
      tooltip: 'Fracción',
    },
    {
      latex: '\\sqrt{ }',
      display: '\\sqrt{\\square}',
      tooltip: 'Raíz Cuadrada',
    },
    {
      latex: '\\ln{ }',
      display: '\\ln{\\square}',
      tooltip: 'Logaritmo Natural',
    },
    {
      latex: '\\log_{ }{ }',
      display: '\\log_{\\square}{\\square}',
      tooltip: 'Logaritmo en Base',
    },
  ];

  // Funciones trigonométricas soportadas por Maxima
  mathButtonsTrig = [
    {
      latex: '\\sin\\left( \\right )',
      display: '\\sin\\left(\\square\\right)',
      tooltip: 'Seno',
    },
    {
      latex: '\\cos\\left( \\right )',
      display: '\\cos\\left(\\square\\right)',
      tooltip: 'Coseno',
    },
    {
      latex: '\\tan\\left( \\right )',
      display: '\\tan\\left(\\square\\right)',
      tooltip: 'Tangente',
    },
    {
      latex: '\\cot\\left( \\right )',
      display: '\\cot\\left(\\square\\right)',
      tooltip: 'Cotangente',
    },
    {
      latex: '\\sec\\left( \\right )',
      display: '\\sec\\left(\\square\\right)',
      tooltip: 'Secante',
    },
    {
      latex: '\\csc\\left( \\right )',
      display: '\\csc\\left(\\square\\right)',
      tooltip: 'Cosecante',
    },
    {
      latex: '\\arcsin\\left( \\right )',
      display: '\\arcsin\\left(\\square\\right)',
      tooltip: 'Arcoseno (inversa del seno)',
    },
    {
      latex: '\\arccos\\left( \\right )',
      display: '\\arccos\\left(\\square\\right)',
      tooltip: 'Arcocoseno (inversa del coseno)',
    },
    {
      latex: '\\arctan\\left( \\right )',
      display: '\\arctan\\left(\\square\\right)',
      tooltip: 'Arcotangente (inversa de la tangente)',
    },
    {
      latex: '\\sinh\\left( \\right )',
      display: '\\sinh\\left(\\square\\right)',
      tooltip: 'Seno hiperbólico',
    },
    {
      latex: '\\cosh\\left( \\right )',
      display: '\\cosh\\left(\\square\\right)',
      tooltip: 'Coseno hiperbólico',
    },
    {
      latex: '\\tanh\\left( \\right )',
      display: '\\tanh\\left(\\square\\right)',
      tooltip: 'Tangente hiperbólica',
    },
  ];

  // Array completo para compatibilidad con código existente
  get mathButtons() {
    return [...this.mathButtonsBasic, ...this.mathButtonsTrig];
  }

  constructor(
    private apiService: ApiService,
    private mathquillService: MathquillService,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Debounce function updates
    this.updateSubject.pipe(debounceTime(100)).subscribe(() => {
      this.ngZone.run(() => this.updateDisplayDebounced());
    });
  }

  ngOnInit(): void {
    // Add the first piece when component initializes
    if (this.isBrowser) {
      this.addPiece();
    }
  }

  ngAfterViewInit(): void {
    // Render MathJax after view initialization
    if (this.isBrowser) {
      setTimeout(() => {
        this.mathquillService.renderMathJax();
      }, 100);
    }
  }

  toggleKeyboard(): void {
    this.keyboardVisible = !this.keyboardVisible;

    // Dar tiempo para que se complete la animación y luego renderizar MathJax
    if (this.keyboardVisible) {
      setTimeout(() => {
        this.mathquillService.renderMathJax();
      }, 100);
    }
  }

  // Agregar este método a la clase MathquillComponent
  setupTabNavigation(): void {
    if (!this.isBrowser) return;

    setTimeout(() => {
      // Seleccionar todos los campos math-field
      const mathFields = document.querySelectorAll('.math-field');

      mathFields.forEach((field, index) => {
        // Añadir manejo de la tecla Tab
        (field as HTMLElement).addEventListener(
          'keydown',
          (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
              e.preventDefault(); // Prevenir el comportamiento por defecto del Tab

              // Determinar el índice del siguiente campo basado en si Shift está presionado
              const nextIndex = e.shiftKey ? index - 1 : index + 1;

              // Asegurarse de que el índice está dentro de los límites
              if (nextIndex >= 0 && nextIndex < mathFields.length) {
                // Enfocar el siguiente campo
                (mathFields[nextIndex] as HTMLElement).focus();

                // Si el campo tiene un MathQuill asociado, activarlo
                const pieceIndex = Math.floor(nextIndex / 3);
                const fieldType = nextIndex % 3;

                if (this.pieces[pieceIndex]) {
                  let field = null;

                  switch (fieldType) {
                    case 0: // Campo de función
                      field = this.pieces[pieceIndex].funcField;
                      break;
                    case 1: // Campo de inicio
                      field = this.pieces[pieceIndex].startField;
                      break;
                    case 2: // Campo de fin
                      field = this.pieces[pieceIndex].endField;
                      break;
                  }

                  if (field) {
                    this.activeMathField = field;
                    field.focus();
                  }
                }
              }
            }
          }
        );
      });
    }, 500); // Dar tiempo para que se inicialicen los campos
  }

  addPiece(): void {
    if (!this.isBrowser) return;

    // Create empty fields for a new piece
    setTimeout(() => {
      this.pieces.push({
        funcField: null,
        startField: null,
        endField: null,
      });

      // Initialize MathQuill fields after DOM updates
      setTimeout(() => {
        this.initializeMathFields();
        this.validateIntervals();
      }, 0);
    });
  }

  removePiece(index: number): void {
    if (!this.isBrowser) return;

    this.pieces.splice(index, 1);
    this.updateFunctionDisplay();
    setTimeout(() => {
      this.validateIntervals();
      this.setupTabNavigation();
    }, 100);
  }

  initializeMathFields(): void {
    if (!this.isBrowser) return;

    const funcElements = document.querySelectorAll('.pieceFunc');
    const startElements = document.querySelectorAll('.pieceStart');
    const endElements = document.querySelectorAll('.pieceEnd');

    for (let i = 0; i < this.pieces.length; i++) {
      if (!this.pieces[i].funcField && funcElements[i]) {
        this.pieces[i].funcField = this.createMathField(
          funcElements[i] as HTMLElement
        );
      }

      if (!this.pieces[i].startField && startElements[i]) {
        this.pieces[i].startField = this.createMathField(
          startElements[i] as HTMLElement
        );
      }

      if (!this.pieces[i].endField && endElements[i]) {
        this.pieces[i].endField = this.createMathField(
          endElements[i] as HTMLElement
        );
      }
    }

    this.updateFunctionDisplay();
    this.setupTabNavigation();
  }

  createMathField(element: HTMLElement): any {
    if (!this.isBrowser) return null;

    const mathField = this.mathquillService.createMathField(element, {
      edit: () => {
        // Trigger debounced update instead of immediate update
        this.updateSubject.next();

        // Si el elemento es un campo de inicio o fin, validar los intervalos
        if (
          element.classList.contains('pieceStart') ||
          element.classList.contains('pieceEnd')
        ) {
          setTimeout(() => this.validateIntervals(), 100);
        }
      },
    });

    element.addEventListener('focus', () => {
      this.activeMathField = mathField;
    });

    element.addEventListener('mousedown', () => {
      this.activeMathField = mathField;
    });

    return mathField;
  }

  private updateDisplayDebounced(): void {
    if (!this.isBrowser) return;
    this.updateFunctionDisplay(false); // Pass false to avoid recursive updates
    this.validateIntervals();
  }

  insertMath(latex: string): void {
    if (!this.isBrowser || !this.activeMathField) return;

    // Ejecutar fuera de la detección de cambios de Angular para mejorar el rendimiento
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

      // Permitir un breve tiempo para que MathQuill procese la entrada
      setTimeout(() => {
        // Activar la actualización de visualización de forma segura dentro de Angular
        this.ngZone.run(() => {
          this.updateSubject.next();
        });
      }, 10);
    });
  }

  // Modified to accept a parameter to control rendering
  updateFunctionDisplay(shouldRenderVariableSpans = true): void {
    if (!this.isBrowser) return;

    const functionDisplay = document.getElementById('functionDisplay');
    if (!functionDisplay) return;

    // Use the selected variable
    let latex = 'f(' + this.selectedVariable + ') = ';

    if (this.pieces.length === 1) {
      // Single piece function
      const funcLatex = this.pieces[0].funcField?.latex() || '\\square';
      const startLatex = this.pieces[0].startField?.latex() || '\\square';
      const endLatex = this.pieces[0].endField?.latex() || '\\square';

      latex +=
        funcLatex +
        ', \\quad ' +
        startLatex +
        ' < ' +
        this.selectedVariable +
        ' < ' +
        endLatex;
    } else if (this.pieces.length > 1) {
      // Multiple pieces - use 'cases' environment
      latex += '\\begin{cases}';
      for (let i = 0; i < this.pieces.length; i++) {
        const funcLatex = this.pieces[i].funcField?.latex() || '\\square';
        const startLatex = this.pieces[i].startField?.latex() || '\\square';
        const endLatex = this.pieces[i].endField?.latex() || '\\square';

        latex +=
          funcLatex +
          ' & , \\quad ' +
          startLatex +
          ' < ' +
          this.selectedVariable +
          ' < ' +
          endLatex;
        if (i < this.pieces.length - 1) {
          latex += ' \\\\ '; // New line in LaTeX
        }
      }
      latex += '\\end{cases}';
    } else {
      // No pieces
      latex += '\\text{(No se ha definido la función)}';
    }

    functionDisplay.innerHTML = '$$' + latex + '$$';
    this.mathquillService.renderMathJax();

    // Only update variable spans when explicitly requested
    if (shouldRenderVariableSpans) {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => this.updateVariableInMathJax(), 0);
      });
    }
  }

  updateVariableInMathJax(): void {
    if (!this.isBrowser) return;

    // Update all variable spans with the current variable
    const variableSpans = document.querySelectorAll('.variable-span');
    variableSpans.forEach((span) => {
      span.innerHTML = `$$< ${this.selectedVariable} <$$`;
    });

    // Re-render MathJax for these spans
    this.mathquillService.renderMathJax();
  }

  handleTypeChange(): void {
    if (!this.isBrowser) return;

    const toggleContainer = document.getElementById('toggleContainer');
    const halfRangeExtension = document.getElementById('halfRangeExtension');

    this.isHalfRange = false;
    this.halfRangeType = '';

    if (halfRangeExtension) {
      halfRangeExtension.classList.add('hidden');
    }

    if (this.seriesType === 'Trigonometric' && toggleContainer) {
      toggleContainer.classList.remove('hidden');
    } else if (toggleContainer) {
      toggleContainer.classList.add('hidden');
    }
  }

  handleToggleChange(): void {
    if (!this.isBrowser) return;

    const halfRangeExtension = document.getElementById('halfRangeExtension');

    if (this.isHalfRange && halfRangeExtension) {
      halfRangeExtension.classList.remove('hidden');
    } else if (halfRangeExtension) {
      halfRangeExtension.classList.add('hidden');
    }
  }

  validateIntervals(): boolean {
    if (!this.isBrowser || this.pieces.length <= 1) return false;

    // Clase para marcar campos inválidos
    const invalidClass = 'border-red-500';

    // Eliminar las marcas de error anteriores
    document.querySelectorAll('.pieceStart, .pieceEnd').forEach((element) => {
      element.classList.remove(invalidClass);
    });

    let hasError = false;

    // Verificar cada par de intervalos adyacentes
    for (let i = 1; i < this.pieces.length; i++) {
      const previousEndField = document.querySelectorAll('.pieceEnd')[
        i - 1
      ] as HTMLElement;
      const currentStartField = document.querySelectorAll('.pieceStart')[
        i
      ] as HTMLElement;

      if (!previousEndField || !currentStartField) continue;

      const previousEndLatex = this.pieces[i - 1].endField?.latex() || '';
      const currentStartLatex = this.pieces[i].startField?.latex() || '';

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

  submitData(): void {
    if (!this.isBrowser) return;

    // Validación de tipo de serie
    if (!this.seriesType) {
      Swal.fire({
        title: 'Error',
        text: 'Por favor, selecciona un tipo de serie de Fourier',
        icon: 'error',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Verificar si hay piezas definidas
    if (this.pieces.length === 0) {
      Swal.fire({
        title: 'Error',
        text: 'Debes definir al menos una parte de la función',
        icon: 'error',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Validar los intervalos contiguos
    const hasIntervalErrors = this.validateIntervals();
    if (hasIntervalErrors) {
      Swal.fire({
        title: 'Error en los intervalos',
        html: 'Los intervalos deben ser contiguos. Cada trozo debe empezar donde termina el anterior.',
        icon: 'error',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Validación de cada pieza de la función (campos no vacíos)
    let hasEmptyFields = false;
    let emptyFieldsMessage = '';

    // Validar cada pieza
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i];

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
      Swal.fire({
        title: 'Campos vacíos',
        html: `Por favor, completa los siguientes campos:<pre>${emptyFieldsMessage}</pre>`,
        icon: 'warning',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Crear la matriz de función en el formato requerido
    const funcionMatrix = this.pieces.map((piece) => [
      piece.funcField.latex(),
      piece.startField.latex(),
      piece.endField.latex(),
    ]);

    // Crear objeto JSON para enviar usando la interfaz
    const data: FourierRequest = {
      funcionMatrix,
      intVar: this.selectedVariable,
    };

    console.log(
      '%c Datos enviados:',
      'background: #002b36; color: #2aa198; font-size: 12px; padding: 4px 8px; border-radius: 4px;'
    );
    console.log(data);

    // Mostrar indicador de carga (mantenemos esto para UX)
    Swal.fire({
      title: 'Calculando...',
      html: 'Espera mientras se calcula la serie de Fourier',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Llamar al servicio API correspondiente según el tipo de serie seleccionado
    let apiCall;
    switch (this.seriesType) {
      case 'trigonometric':
        apiCall = this.apiService.calculateTrigonometricSeriesPiecewise(data);
        break;
      case 'complex':
        apiCall = this.apiService.calculateComplexSeriesPiecewise(data);
        break;
      case 'halfrange':
        apiCall = this.apiService.calculateHalfRangeSeries(data);
        break;
      default:
        Swal.fire({
          title: 'Error',
          text: 'Tipo de serie no válido',
          icon: 'error',
          confirmButtonText: 'Entendido',
        });
        return;
    }

    // Suscribirse a la respuesta de la API
    apiCall.subscribe({
      next: (response: FourierResponse) => {
        console.log(response);
        Swal.fire({
          title: 'Cálculo completado',
          text: 'La serie ha sido calculada exitosamente. Consulta la consola para ver los resultados.',
          icon: 'success',
          confirmButtonText: 'Aceptar',
          timerProgressBar: true,
        });
      },
      error: (error) => {
        // Mostrar mensaje de error
        Swal.fire({
          title: 'Error',
          text:
            error.error?.message ||
            'Ocurrió un error al calcular la serie de Fourier',
          icon: 'error',
          confirmButtonText: 'Entendido',
        });
      },
    });
  }
}
