import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
  Inject,
  NgZone,
  OnDestroy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MathquillService } from '../../core/services/mathquill/mathquill.service';
import { MathquillHandlerService } from '../../core/services/mathquill/mathquill-handler.service';
import { FourierValidatorService } from '../../core/services/validation/fourier-validator.service';
import { MathKeyboardService } from '../../core/services/mathquill/math-keyboard.service';
import { Piece } from '../../interfaces/piece.interface';
import { ApiService } from '../../core/services/api/api.service';
import { FourierRequest } from '../../interfaces/fourier-request.interface';
import { TrigonometricResponse } from '../../interfaces/trigonometric-response.interface';
import { ComplexResponse } from '../../interfaces/complex-response.interface';
import { LatexToMaximaService } from '../../core/services/conversion/latex-to-maxima.service';
import Swal from 'sweetalert2';
import { debounceTime, Subject } from 'rxjs';
import { Router } from '@angular/router';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { MobileMathKeyboardComponent } from '../../shared/components/mobile-math-keyboard/mobile-math-keyboard.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-fourier-calculator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MobileMathKeyboardComponent,
    FooterComponent,
  ],
  templateUrl: './fourier-calculator.component.html',
  styleUrl: './fourier-calculator.component.scss',
})
export class FourierCalculatorComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('pieceContainer') pieceContainer: ElementRef | undefined;
  @ViewChild('menuDropdown') menuDropdown: ElementRef | undefined;

  pieces: Piece[] = [];
  seriesType: string = 'trigonometric';
  selectedVariable: string = 'x';
  keyboardVisible: boolean = true;

  private updateSubject = new Subject<void>();
  private isBrowser: boolean;

  calculationType: 'series' | 'dft' = 'series';
  dftParams = {
    numSamples: 128,
    sampleRate: 3,
  };

  // Add this new property for numSamples options
  powersOfTwo = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

  // Add a property to track global click listener
  private documentClickListener: any;

  // Propiedad para el tour
  private tourDriver: any;

  // Propiedad para controlar si se ha completado el tour
  tourCompleted: boolean = false;

  // Obtener botones del teclado del servicio
  get mathButtonsBasic() {
    return this.mathKeyboardService.mathButtonsBasic;
  }
  get mathButtonsTrig() {
    return this.mathKeyboardService.mathButtonsTrig;
  }
  get mathButtons() {
    return this.mathKeyboardService.mathButtons;
  }

  // Mobile keyboard properties
  isMobile: boolean = false;
  mobileKeyboardVisible: boolean = false;

  // Menu dropdown state
  menuOpen: boolean = false;

  constructor(
    private apiService: ApiService,
    private mathquillService: MathquillService,
    private mathquillHandler: MathquillHandlerService,
    private validator: FourierValidatorService,
    private mathKeyboardService: MathKeyboardService,
    private latexToMaximaService: LatexToMaximaService,
    private ngZone: NgZone,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Debounce function updates
    this.updateSubject.pipe(debounceTime(100)).subscribe(() => {
      this.ngZone.run(() => this.updateDisplayDebounced());
    });
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      window.scrollTo(0, 0);

      this.addPiece();
      // Check if device is mobile
      this.isMobile = this.mathquillService.isMobileDevice();

      // Add event listener for clicks outside MathQuill fields
      if (this.isMobile) {
        this.setupDocumentClickListener();
      }

      // Verificar si el tour ya se completó
      this.tourCompleted =
        localStorage.getItem('fourierTourCompleted') === 'true';
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      setTimeout(() => {
        this.mathquillService.renderMathJax(); // Add touch events for the drag handle
        if (this.isMobile) {
          this.setupDragToHide();
        }

        // Setup menu click listener to close dropdown when clicking outside
        this.setupMenuClickListener();

        // Inicializar y mostrar el tour después de renderizar la interfaz
        this.initTour();
        this.checkAndStartTour();
      }, 300); // Incrementé el tiempo para asegurar que todos los elementos estén renderizados
    }
  }

  // Add OnDestroy implementation to clean up the event listener
  ngOnDestroy(): void {
    if (this.isBrowser) {
      // Remove document click listener
      if (this.documentClickListener) {
        document.removeEventListener('click', this.documentClickListener);
      }

      // Detener el tour si está activo
      if (this.tourDriver) {
        try {
          // Destruir la instancia del tour para evitar que permanezca en otras páginas
          this.tourDriver.destroy();
          this.tourDriver = null;
        } catch (error) {
          console.error('Error al destruir el tour:', error);
        }
      }
    }
  }

  // Create a method to handle the document click listener
  private setupDocumentClickListener(): void {
    this.documentClickListener = (event: MouseEvent) => {
      // Don't hide keyboard if clicking on the keyboard itself
      if (this.isClickInsideKeyboard(event)) {
        return;
      }

      // Don't hide keyboard if clicking on a MathQuill field
      if (this.isClickOnMathField(event)) {
        // Show keyboard if clicking on math field
        this.showMobileKeyboard();
        return;
      }

      // Hide keyboard if clicking elsewhere
      this.hideMobileKeyboard();
    };

    document.addEventListener('click', this.documentClickListener);
  }

  // Helper method to check if click is inside the keyboard
  private isClickInsideKeyboard(event: MouseEvent): boolean {
    const keyboardElement = document.querySelector('.mobile-math-keyboard');
    const toggleButton = document.querySelector('.mobile-keyboard-toggle');

    return !!(
      (keyboardElement && keyboardElement.contains(event.target as Node)) ||
      (toggleButton && toggleButton.contains(event.target as Node))
    );
  }

  // Helper method to check if click is on a math field
  private isClickOnMathField(event: MouseEvent): boolean {
    const mathFields = document.querySelectorAll('.math-field');

    for (let i = 0; i < mathFields.length; i++) {
      if (mathFields[i].contains(event.target as Node)) {
        return true;
      }
    }

    return false;
  }

  // Setup drag to hide functionality
  private setupDragToHide(): void {
    const dragHandle = document.querySelector('.keyboard-drag-handle');
    const keyboard = document.querySelector('.mobile-math-keyboard');

    if (!dragHandle || !keyboard) return;

    let startY = 0;
    let currentY = 0;

    const touchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      currentY = startY;

      document.addEventListener('touchmove', touchMove, { passive: false });
      document.addEventListener('touchend', touchEnd);
    };

    const touchMove = (e: TouchEvent) => {
      // Prevent scrolling while dragging
      e.preventDefault();

      currentY = e.touches[0].clientY;

      // Calculate the drag distance
      const deltaY = currentY - startY;

      // Only allow dragging down (positive deltaY)
      if (deltaY > 0) {
        // Apply transform to keyboard directly for smooth animation
        (keyboard as HTMLElement).style.transform = `translateY(${deltaY}px)`;
      }
    };

    const touchEnd = () => {
      // Remove event listeners
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('touchend', touchEnd);

      // Calculate if we should hide the keyboard
      const deltaY = currentY - startY;

      // Reset the inline style
      (keyboard as HTMLElement).style.transform = '';

      // If dragged down more than 80px, hide the keyboard
      if (deltaY > 80) {
        this.hideMobileKeyboard();
      }
    };

    // Add touch start event
    //dragHandle.addEventListener('touchstart', touchStart);
  }

  toggleKeyboard(): void {
    this.keyboardVisible = !this.keyboardVisible;

    if (this.keyboardVisible) {
      setTimeout(() => {
        this.mathquillService.renderMathJax();
      }, 100);
    }
  }

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

              // Determinar el índice del siguiente campo
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
                    case 0:
                      field = this.pieces[pieceIndex].funcField;
                      break;
                    case 1:
                      field = this.pieces[pieceIndex].startField;
                      break;
                    case 2:
                      field = this.pieces[pieceIndex].endField;
                      break;
                  }

                  if (field) {
                    this.mathquillHandler.setActiveMathField(field);
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

    setTimeout(() => {
      this.pieces.push({
        funcField: null,
        startField: null,
        endField: null,
      });

      setTimeout(() => {
        this.initializeMathFields();
        this.validator.validateIntervals(this.pieces);
      }, 0);
    });
  }

  removePiece(index: number): void {
    if (!this.isBrowser) return;

    this.pieces.splice(index, 1);
    this.updateFunctionDisplay();
    setTimeout(() => {
      this.validator.validateIntervals(this.pieces);
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

    const field = this.mathquillHandler.createMathField(element, {
      edit: () => {
        // Trigger debounced update
        this.updateSubject.next();

        // Validar intervalos si es necesario
        if (
          element.classList.contains('pieceStart') ||
          element.classList.contains('pieceEnd')
        ) {
          setTimeout(() => this.validator.validateIntervals(this.pieces), 100);
        }
      },
    });

    // Add click event to show keyboard on mobile
    if (this.isMobile) {
      element.addEventListener('click', () => {
        this.showMobileKeyboard();
      });
    }

    return field;
  }

  private updateDisplayDebounced(): void {
    if (!this.isBrowser) return;
    this.updateFunctionDisplay(false);
    this.validator.validateIntervals(this.pieces);
  }

  insertMath(latex: string): void {
    if (!this.isBrowser) return;

    this.mathquillHandler.insertMath(latex);

    // Permitir un breve tiempo para que MathQuill procese la entrada
    setTimeout(() => {
      // Activar la actualización de visualización dentro de Angular
      this.ngZone.run(() => {
        this.updateSubject.next();
      });
    }, 10);

    // Renderizar MathJax para el teclado móvil si es necesario
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 50);
  }

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

  submitData(): void {
    if (!this.isBrowser) return;

    // Validación del formulario (mantener la validación existente)
    const validation = this.validator.validateForm(
      this.seriesType,
      this.pieces
    );
    if (!validation.isValid) {
      Swal.fire({
        title: validation.error.title,
        text: validation.error.text,
        html: validation.error.html,
        icon: validation.error.icon,
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const italicValidation = this.validator.validateItalicText(
      this.pieces,
      this.selectedVariable
    );
    if (!italicValidation.isValid) {
      Swal.fire({
        title: italicValidation.error.title,
        html: italicValidation.error.html,
        icon: italicValidation.error.icon,
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Crear la matriz de función en el formato requerido y convertir a Maxima
    const funcionMatrix = this.pieces.map((piece) => [
      this.latexToMaximaService.convertToMaxima(piece.funcField.latex()),
      this.latexToMaximaService.convertToMaxima(piece.startField.latex()),
      this.latexToMaximaService.convertToMaxima(piece.endField.latex()),
    ]);

    // Guardar también las expresiones LaTeX originales para visualización
    const latexMatrix = this.pieces.map((piece) => [
      piece.funcField.latex(),
      piece.startField.latex(),
      piece.endField.latex(),
    ]);

    // Guardar las expresiones originales en formato MAXIMA para la visualización
    const maximaMatrix = this.pieces.map((piece) => [
      this.latexToMaximaService.convertToMaxima(piece.funcField.latex()),
      this.latexToMaximaService.convertToMaxima(piece.startField.latex()),
      this.latexToMaximaService.convertToMaxima(piece.endField.latex()),
    ]);

    // Crear objeto JSON para enviar
    const data: FourierRequest = {
      funcionMatrix,
      intVar: this.selectedVariable,
    };

    // Mostrar log de lo que se está enviando al backend
    // console.log('🚀 Enviando al backend (Series de Fourier):', {
    //   tipo: this.seriesType,
    //   datos: data,
    //   latex: latexMatrix,
    //   maxima: maximaMatrix,
    // });

    // Mostrar indicador de carga
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
    // Determinar la ruta de navegación según el tipo de serie
    let targetRoute: string;

    switch (this.seriesType) {
      case 'trigonometric':
        apiCall = this.apiService.calculateTrigonometricSeriesPiecewise(data);
        targetRoute = '/fourier-series-plot/trig';
        break;
      case 'complex':
        apiCall = this.apiService.calculateComplexSeriesPiecewise(data);
        targetRoute = '/fourier-series-plot/complex';
        break;
      case 'halfrange':
        apiCall = this.apiService.calculateHalfRangeSeries(data);
        targetRoute = '/fourier-series-plot/half-range';
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
      next: (response: TrigonometricResponse | ComplexResponse) => {
        Swal.close();
        if (response.success) {
          this.router.navigate([targetRoute], {
            state: {
              response,
              seriesType: this.seriesType,
              intVar: this.selectedVariable,
              originalLatex: latexMatrix,
              maximaMatrix: maximaMatrix,
              originalFunction: this.getFunctionLatex(),
            },
          });
        } else {
          this.showValidationErrorMessage(response);
        }
      },
      error: (error) => {
        if (error.status === 422 && error.error?.validationDetails) {
          Swal.close();
          this.showValidationErrorMessage(error.error);
        } else {
          Swal.fire({
            title: 'Error',
            text:
              error.error?.message ||
              'Ocurrió un error al calcular la serie de Fourier',
            icon: 'error',
            confirmButtonText: 'Entendido',
          });
        }
      },
    });
  }

  /**
   * Muestra un mensaje detallado de error de validación
   * @param response Respuesta con detalles de validación
   */
  showValidationErrorMessage(
    response: TrigonometricResponse | ComplexResponse
  ): void {
    let errorHtml = '<div>';

    errorHtml +=
      '<p class="mb-3">La función no puede ser calculada debido a los siguientes problemas:</p>';
    errorHtml += '<ul style="list-style-type: disc; padding-left: 20px;">';

    // Si hay detalles de validación para piezas específicas (función por trozos)
    if (response.validationDetails?.pieces) {
      response.validationDetails.pieces.forEach((piece, index: number) => {
        if (!piece.validation.isValid) {
          errorHtml += `<li style="margin-bottom: 8px;"><strong>Problema en tramo ${
            index + 1
          }:</strong> `;

          // Determinar qué coeficientes tienen problemas
          const problemCoeffs = [];

          if (this.seriesType === 'complex') {
            // Serie compleja
            const complexPiece = piece as unknown as {
              validation: {
                c0?: {
                  isIntegrable: boolean;
                  hasSpecialFunctions: boolean;
                  result: string;
                };
                cn?: {
                  isIntegrable: boolean;
                  hasSpecialFunctions: boolean;
                  result: string;
                };
              };
            };

            if (
              complexPiece.validation.c0 &&
              (!complexPiece.validation.c0.isIntegrable ||
                complexPiece.validation.c0.hasSpecialFunctions)
            ) {
              problemCoeffs.push('c₀');
            }
            if (
              complexPiece.validation.cn &&
              (!complexPiece.validation.cn.isIntegrable ||
                complexPiece.validation.cn.hasSpecialFunctions)
            ) {
              problemCoeffs.push('cₙ');
            }
          } else {
            // Series trigonométricas
            const trigPiece = piece as unknown as {
              validation: {
                a0?: {
                  isIntegrable: boolean;
                  hasSpecialFunctions: boolean;
                  result: string;
                };
                an?: {
                  isIntegrable: boolean;
                  hasSpecialFunctions: boolean;
                  result: string;
                };
                bn?: {
                  isIntegrable: boolean;
                  hasSpecialFunctions: boolean;
                  result: string;
                };
              };
            };

            if (
              trigPiece.validation.a0 &&
              (!trigPiece.validation.a0.isIntegrable ||
                trigPiece.validation.a0.hasSpecialFunctions)
            ) {
              problemCoeffs.push('a₀');
            }
            if (
              trigPiece.validation.an &&
              (!trigPiece.validation.an.isIntegrable ||
                trigPiece.validation.an.hasSpecialFunctions)
            ) {
              problemCoeffs.push('aₙ');
            }
            if (
              trigPiece.validation.bn &&
              (!trigPiece.validation.bn.isIntegrable ||
                trigPiece.validation.bn.hasSpecialFunctions)
            ) {
              problemCoeffs.push('bₙ');
            }
          }

          // Agregar detalles del problema
          errorHtml += `No se pueden calcular los coeficientes: ${problemCoeffs.join(
            ', '
          )}</li>`;
        }
      });
    } else {
      // Si son problemas generales de la función completa
      const problemCoeffs = [];

      if (this.seriesType === 'complex') {
        // Tratamos response como ComplexResponse
        const complexResponse = response as ComplexResponse;

        if (
          complexResponse.validationDetails?.c0 &&
          (!complexResponse.validationDetails.c0.isIntegrable ||
            complexResponse.validationDetails.c0.hasSpecialFunctions)
        ) {
          problemCoeffs.push('c₀');
        }
        if (
          complexResponse.validationDetails?.cn &&
          (!complexResponse.validationDetails.cn.isIntegrable ||
            complexResponse.validationDetails.cn.hasSpecialFunctions)
        ) {
          problemCoeffs.push('cₙ');
        }
      } else {
        // Tratamos response como TrigonometricResponse
        const trigResponse = response as TrigonometricResponse;

        if (
          trigResponse.validationDetails?.a0 &&
          (!trigResponse.validationDetails.a0.isIntegrable ||
            trigResponse.validationDetails.a0.hasSpecialFunctions)
        ) {
          problemCoeffs.push('a₀');
        }
        if (
          trigResponse.validationDetails?.an &&
          (!trigResponse.validationDetails.an.isIntegrable ||
            trigResponse.validationDetails.an.hasSpecialFunctions)
        ) {
          problemCoeffs.push('aₙ');
        }
        if (
          trigResponse.validationDetails?.bn &&
          (!trigResponse.validationDetails.bn.isIntegrable ||
            trigResponse.validationDetails.bn.hasSpecialFunctions)
        ) {
          problemCoeffs.push('bₙ');
        }
      }

      if (problemCoeffs.length > 0) {
        errorHtml += `<li style="margin-bottom: 8px;">No se pueden calcular los coeficientes: ${problemCoeffs.join(
          ', '
        )}</li>`;
      }
    }

    errorHtml += '</ul>';

    // Consejos para el usuario
    errorHtml += '<p style="margin-top: 12px;">La función puede contener:</p>';
    errorHtml += '<ul style="list-style-type: disc; padding-left: 20px;">';
    errorHtml += '<li>Integrales que no tienen solución analítica</li>';
    errorHtml += '<li>Funciones especiales (erf, gamma, Bessel, etc.)</li>';
    errorHtml += '<li>Expresiones demasiado complejas para resolver</li>';
    errorHtml += '</ul>';

    // Sugerencias
    errorHtml +=
      '<p style="margin-top: 12px;">Intenta simplificar la función o usar otra aproximación.</p>';

    // Nueva sugerencia para usar DFT sin colores
    errorHtml +=
      '<div style="margin-top: 16px; padding: 12px; border: 1px solid #ccc; border-radius: 4px;">' +
      '<p><strong>💡 Sugerencia:</strong></p>' +
      '<p>Para funciones no integrables analíticamente, puedes usar la <strong>Transformada Discreta de Fourier</strong>.' +
      ' Esta opción utiliza métodos numéricos para aproximar los coeficientes.</p>' +
      '<button id="switchToDft" style="margin-top: 8px; padding: 8px 16px; background-color: #3b82f6; color: white; border-radius: 4px; border: none; cursor: pointer;">' +
      'Cambiar a Transformada Discreta</button>' +
      '</div>';

    errorHtml += '</div>';

    Swal.fire({
      title: 'No se puede calcular la serie',
      html: errorHtml,
      icon: 'warning',
      confirmButtonText: 'Entendido',
      width: '36em',
      didOpen: () => {
        // Agregar evento al botón para cambiar a DFT
        document
          .getElementById('switchToDft')
          ?.addEventListener('click', () => {
            Swal.close();
            // Cambiar a DFT
            this.setCalculationType('dft');
          });
      },
    });
  }

  // Método auxiliar para obtener la representación LaTeX completa de la función
  getFunctionLatex(): string {
    let latex = '';

    if (this.pieces.length === 1) {
      // Función de una sola pieza
      const funcLatex = this.pieces[0].funcField?.latex() || '\\square';
      const startLatex = this.pieces[0].startField?.latex() || '\\square';
      const endLatex = this.pieces[0].endField?.latex() || '\\square';

      latex =
        funcLatex +
        ', \\quad ' +
        startLatex +
        ' < ' +
        this.selectedVariable +
        ' < ' +
        endLatex;
    } else if (this.pieces.length > 1) {
      // Función a trozos
      latex = '\\begin{cases}';
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
          latex += ' \\\\ '; // Nueva línea en LaTeX
        }
      }
      latex += '\\end{cases}';
    }

    return latex;
  }

  setCalculationType(type: 'series' | 'dft'): void {
    this.calculationType = type;
    // Si cambiamos a DFT, resetear el tipo de serie seleccionado
    if (type === 'dft') {
      this.seriesType = '';
    }
  }

  // Nuevo método para enviar cálculos DFT
  submitDftCalculation(): void {
    // Validación básica
    if (
      !this.pieces.length ||
      this.pieces.some(
        (p) =>
          !p.funcField?.latex() ||
          !p.startField?.latex() ||
          !p.endField?.latex()
      )
    ) {
      Swal.fire({
        title: 'Datos incompletos',
        text: 'Por favor define la función completamente',
        icon: 'warning',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const italicValidation = this.validator.validateItalicText(
      this.pieces,
      this.selectedVariable
    );
    if (!italicValidation.isValid) {
      Swal.fire({
        title: italicValidation.error.title,
        html: italicValidation.error.html,
        icon: italicValidation.error.icon,
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Verificar que sampleRate sea un entero positivo o cero
    if (
      this.dftParams.sampleRate < 0 ||
      !Number.isInteger(this.dftParams.sampleRate) ||
      this.dftParams.sampleRate > 100
    ) {
      Swal.fire({
        title: 'Valor inválido',
        text: 'La frecuencia de muestreo debe ser un entero positivo o cero',
        icon: 'warning',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Crear la matriz de función en el formato requerido y convertir a Maxima
    const funcionMatrix = this.pieces.map((piece) => [
      this.latexToMaximaService.convertToMaxima(piece.funcField.latex()),
      this.latexToMaximaService.convertToMaxima(piece.startField.latex()),
      this.latexToMaximaService.convertToMaxima(piece.endField.latex()),
    ]);

    // Guardar también las expresiones LaTeX originales para visualización
    const latexMatrix = this.pieces.map((piece) => [
      piece.funcField.latex(),
      piece.startField.latex(),
      piece.endField.latex(),
    ]);

    // Crear objeto JSON para enviar
    const data = {
      funcionMatrix,
      N: this.dftParams.numSamples,
      M: this.dftParams.sampleRate,
      intVar: this.selectedVariable,
    };

    // Mostrar log de lo que se está enviando al backend
    // console.log('🚀 Enviando al backend (DFT):', {
    //   datos: data,
    //   latex: latexMatrix,
    //   parametros: this.dftParams,
    // });

    // Mostrar indicador de carga
    Swal.fire({
      title: 'Calculando...',
      html: 'Espera mientras se calcula la Transformada Discreta de Fourier',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Llamar al servicio API para DFT
    this.apiService.calculateDFT(data).subscribe({
      next: (response) => {
        Swal.close();
        if (response.success) {
          this.router.navigate(['/fourier-transform-plot/dft'], {
            state: {
              response,
              calculationType: 'dft',
              intVar: this.selectedVariable,
              originalLatex: latexMatrix,
              dftParams: this.dftParams,
              originalFunction: this.getFunctionLatex(),
            },
          });
        } else {
          // Manejar error específico de DFT si es necesario
          Swal.fire({
            title: 'Error en cálculo de DFT',
            text: response.message || 'No se pudo calcular la transformada',
            icon: 'error',
            confirmButtonText: 'Entendido',
          });
        }
      },
      error: (error) => {
        Swal.fire({
          title: 'Error',
          text: error.error?.message || 'Ocurrió un error al calcular la DFT',
          icon: 'error',
          confirmButtonText: 'Entendido',
        });
      },
    });
  }

  // Mobile keyboard methods
  showMobileKeyboard(): void {
    this.mobileKeyboardVisible = true;
    // Render MathJax for the keyboard buttons after the keyboard becomes visible
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 100);
  }

  hideMobileKeyboard(): void {
    this.mobileKeyboardVisible = false;
  }

  // Method to delete the last character or selection in the active math field
  deleteMath(): void {
    if (!this.isBrowser) return;

    const activeField = this.mathquillHandler.getActiveMathField();
    if (activeField) {
      // Check if there's a selection first
      const hasSelection =
        activeField.selection !== undefined &&
        activeField.selection() !== undefined &&
        activeField.selection() !== '';

      if (hasSelection) {
        // If there's a selection, replace it with empty string
        activeField.write('');
      } else {
        // Otherwise, delete the character to the left of the cursor
        activeField.keystroke('Backspace');
      }

      // Update function display after deletion
      this.updateSubject.next();
    }
  }

  navigateToMenu(): void {
    this.router.navigate(['/']);
  }

  // Método para inicializar el tour
  private initTour(): void {
    if (!this.isBrowser) return;

    this.tourDriver = driver({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],
      steps: this.getTourSteps(),
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      // Remove the invalid property 'overlayClickNext'
      onDestroyed: () => {
        // Guardar en localStorage que el usuario ha visto el tour
        localStorage.setItem('fourierTourCompleted', 'true');
      },
    });
  }

  // Método para verificar si debe mostrarse el tour y ejecutarlo
  private checkAndStartTour(): void {
    if (!this.isBrowser) return;

    // Verificar si el usuario ya ha visto el tour
    this.tourCompleted =
      localStorage.getItem('fourierTourCompleted') === 'true';

    if (!this.tourCompleted && this.tourDriver) {
      setTimeout(() => {
        this.startTour();
      }, 500); // Dar tiempo adicional para asegurar que todo esté listo
    }
  }

  // Método para iniciar el tour manualmente
  startTour(): void {
    if (this.isBrowser && this.tourDriver) {
      this.tourDriver.drive();
    }
  }

  // Método para reiniciar el tour (puede ser llamado desde un botón en la interfaz)
  restartTour(): void {
    if (this.isBrowser) {
      // Reiniciar la configuración del tour y comenzar de nuevo
      this.initTour();
      this.startTour();
    }
  }

  // Configuración de los pasos del tour
  private getTourSteps(): any[] {
    // Adaptar los pasos según sea móvil o desktop
    const isMobile = this.mathquillService.isMobileDevice();

    const steps = [
      {
        element: '.card',
        popover: {
          title: 'Bienvenido a la Calculadora Fourier',
          description:
            'Esta herramienta te permite calcular Series de Fourier y Transformadas Discretas de funciones matemáticas.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#variable',
        popover: {
          title: 'Variable de integración',
          description:
            'Selecciona la variable con la que trabajarás, ya sea espacial (x) o temporal (t).',
          side: 'bottom',
        },
      },
      {
        element: '#functionDisplay',
        popover: {
          title: 'Visualización de la función',
          description:
            'Aquí podrás ver cómo se representa matemáticamente la función que estás definiendo.',
          side: 'top',
        },
      },
      {
        element: '#pieceContainer',
        popover: {
          title: 'Definición de función',
          description:
            'Define tu función matemática y los intervalos donde se aplica. Puedes añadir múltiples tramos para funciones por partes.',
          side: 'top',
        },
      },
    ];

    // Añadir paso específico para teclado matemático en escritorio
    if (!isMobile) {
      steps.push({
        element: '.keyboard-toggle-btn',
        popover: {
          title: 'Teclado matemático',
          description:
            'Haz clic aquí para mostrar u ocultar el teclado matemático, que te ayudará a introducir símbolos y funciones.',
          side: 'bottom',
        },
      });
    }

    // Continuar con pasos comunes
    steps.push(
      {
        element: '.mb-8.section-container',
        popover: {
          title: 'Tipo de cálculo',
          description:
            'Selecciona entre Series de Fourier (para funciones analíticamente integrables) o Transformada Discreta (para aproximaciones numéricas).',
          side: 'top',
        },
      },
      {
        element: '#submitButton',
        popover: {
          title: 'Calcular',
          description:
            'Una vez que hayas configurado tu función, haz clic aquí para calcular la serie o transformada.',
          side: 'top',
        },
      }
    );

    return steps;
  }

  // Puedes añadir un método público para ser llamado desde el HTML
  showHelp(): void {
    this.restartTour();
  }

  // Toggle menu dropdown
  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  // Setup document click listener to close menu when clicking outside
  private setupMenuClickListener(): void {
    if (!this.isBrowser) return;

    document.addEventListener('click', (event: MouseEvent) => {
      if (
        this.menuDropdown &&
        !this.menuDropdown.nativeElement.contains(event.target as Node)
      ) {
        this.menuOpen = false;
      }
    });
  }
}
