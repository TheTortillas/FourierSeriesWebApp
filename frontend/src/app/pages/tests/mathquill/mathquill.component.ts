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
import { MathquillService } from '../../../core/services/mathquill/mathquill.service';
import { MathquillHandlerService } from '../../../core/services/mathquill/mathquill-handler.service';
import { FourierValidatorService } from '../../../core/services/validation/fourier-validator.service';
import { MathKeyboardService } from '../../../core/services/mathquill/math-keyboard.service';
import { Piece } from '../../../interfaces/piece.interface';
import { ApiService } from '../../../core/services/api/api.service';
import { FourierRequest } from '../../../interfaces/fourier-request.interface';
import { TrigonometricResponse } from '../../../interfaces/trigonometric-response.interface';
import { ComplexResponse } from '../../../interfaces/complex-response.interface';
import { LatexToMaximaService } from '../../../core/services/conversion/latex-to-maxima.service';
import Swal from 'sweetalert2';
import { debounceTime, Subject } from 'rxjs';

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
  seriesType: string = '';
  selectedVariable: string = 'x';
  keyboardVisible: boolean = true;

  private updateSubject = new Subject<void>();
  private isBrowser: boolean;

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

  constructor(
    private apiService: ApiService,
    private mathquillService: MathquillService,
    private mathquillHandler: MathquillHandlerService,
    private validator: FourierValidatorService,
    private mathKeyboardService: MathKeyboardService,
    private latexToMaximaService: LatexToMaximaService,
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
    if (this.isBrowser) {
      this.addPiece();
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      setTimeout(() => {
        this.mathquillService.renderMathJax();
      }, 100);
    }
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

    return this.mathquillHandler.createMathField(element, {
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

    // Validación del formulario
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

    // Crear la matriz de función en el formato requerido y CONVERTIR A MAXIMA
    const funcionMatrix = this.pieces.map((piece) => [
      this.latexToMaximaService.convertToMaxima(piece.funcField.latex()),
      this.latexToMaximaService.convertToMaxima(piece.startField.latex()),
      this.latexToMaximaService.convertToMaxima(piece.endField.latex()),
    ]);

    // Crear objeto JSON para enviar
    const data: FourierRequest = {
      funcionMatrix,
      intVar: this.selectedVariable,
    };

    // Imprimir datos convertidos para depuración
    // console.log(
    //   '%c Datos enviados (convertidos a Maxima):',
    //   'background: #002b36; color: #2aa198; font-size: 12px; padding: 4px 8px; border-radius: 4px;'
    // );
    // console.log(data);

    // Mostrar también las expresiones originales LaTeX para comparación
    // console.log(
    //   '%c Expresiones LaTeX originales:',
    //   'background: #073642; color: #cb4b16; font-size: 12px; padding: 4px 8px; border-radius: 4px;'
    // );
    // console.log(
    //   this.pieces.map((piece) => [
    //     piece.funcField.latex(),
    //     piece.startField.latex(),
    //     piece.endField.latex(),
    //   ])
    // );

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
      next: (response: TrigonometricResponse | ComplexResponse) => {
        Swal.fire({
          title: 'Cálculo completado',
          text: 'La serie ha sido calculada exitosamente. Consulta la consola para ver los resultados.',
          icon: 'success',
          confirmButtonText: 'Aceptar',
          timerProgressBar: true,
        });
      },
      error: (error) => {
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
