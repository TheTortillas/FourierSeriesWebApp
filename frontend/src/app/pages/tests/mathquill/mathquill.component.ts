import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MathquillService } from '../../../core/services/mathquill.service';
import { Piece } from '../../../interfaces/piece.interface';
import Swal from 'sweetalert2';

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

  // Variable selection (new)
  selectedVariable: string = 'x';

  // Check if we're running in the browser
  private isBrowser: boolean;

  // MathQuill keyboard buttons configuration
  mathButtons = [
    { latex: '\\pi', display: '\\pi' },
    { latex: 'e', display: 'e' },
    { latex: '\\left (  \\right )', display: '\\left ( \\square \\right )' },
    { latex: 'e^{ }', display: 'e^{\\square}' },
    { latex: '\\frac{ }{ }', display: '\\frac{\\square}{\\square}' },
    { latex: '\\cdot', display: '*' },
    {
      latex: '\\sin\\left( \\right )',
      display: '\\sin\\left(\\square\\right)',
    },
    {
      latex: '\\cos\\left( \\right )',
      display: '\\cos\\left(\\square\\right)',
    },
    {
      latex: '\\sinh\\left( \\right )',
      display: '\\sinh\\left(\\square\\right)',
    },
    {
      latex: '\\cosh\\left( \\right )',
      display: '\\cosh\\left(\\square\\right)',
    },
    { latex: '{}^2', display: '\\square^2' },
    { latex: '{}^{}', display: '{\\square}^{\\square}' },
  ];

  constructor(
    private mathquillService: MathquillService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
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
      setTimeout(() => this.initializeMathFields(), 0);
    });
  }

  removePiece(index: number): void {
    if (!this.isBrowser) return;

    this.pieces.splice(index, 1);
    this.updateFunctionDisplay();
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
  }

  createMathField(element: HTMLElement): any {
    if (!this.isBrowser) return null;

    const mathField = this.mathquillService.createMathField(element, {
      edit: () => this.updateFunctionDisplay(),
    });

    // Add focus handling
    element.addEventListener('focus', () => {
      this.activeMathField = mathField;
    });

    element.addEventListener('mousedown', () => {
      this.activeMathField = mathField;
    });

    return mathField;
  }

  insertMath(latex: string): void {
    if (!this.isBrowser) return;

    if (this.activeMathField) {
      this.activeMathField.focus();
      this.activeMathField.write(latex);
    } else {
      alert(
        'Por favor, selecciona un campo antes de usar el teclado matemático.'
      );
    }
  }

  updateFunctionDisplay(): void {
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

    // Force MathJax update for variable spans
    this.updateVariableInMathJax();
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
  
    // Validación de extensión de medio rango cuando es requerida
    if (
      this.seriesType === 'Trigonometric' &&
      this.isHalfRange &&
      !this.halfRangeType
    ) {
      Swal.fire({
        title: 'Error',
        text: 'Por favor, selecciona un tipo de extensión de medio rango',
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
  
    // NUEVAS VALIDACIONES PARA INTERVALOS
    
    // Para series sin extensión de medio rango (trigonométrica regular o compleja)
    if (!this.isHalfRange) {
      // Para funciones de un solo trozo
      if (this.pieces.length === 1) {
        const startLatex = this.pieces[0].startField.latex();
        const endLatex = this.pieces[0].endField.latex();
        
        // Intenta determinar si son simétricos
        // Nota: Esta es una comprobación básica, idealmente necesitaríamos un parser matemático
        // más sofisticado para evaluar expresiones complejas
        const isSymmetric = this.checkSymmetry(startLatex, endLatex);
        
        if (!isSymmetric) {
          Swal.fire({
            title: 'Error en los intervalos',
            html: `Para series sin extensión de medio rango con un solo trozo, los límites deben ser simétricos (como -3 y 3, o -π y π).<br><br>Actualmente tienes: ${startLatex} y ${endLatex}`,
            icon: 'error',
            confirmButtonText: 'Entendido',
          });
          return;
        }
      }
      // Para funciones de múltiples trozos
      else if (this.pieces.length > 1) {
        const firstStartLatex = this.pieces[0].startField.latex();
        const lastEndLatex = this.pieces[this.pieces.length - 1].endField.latex();
        
        // Verifica simetría entre el primer límite inferior y el último límite superior
        const isSymmetric = this.checkSymmetry(firstStartLatex, lastEndLatex);
        
        if (!isSymmetric) {
          Swal.fire({
            title: 'Error en los intervalos',
            html: `Para series sin extensión de medio rango con múltiples trozos, el primer límite inferior debe ser simétrico al último límite superior.<br><br>Actualmente tienes: ${firstStartLatex} y ${lastEndLatex}`,
            icon: 'error',
            confirmButtonText: 'Entendido',
          });
          return;
        }
      }
    }
    // Para series con extensión de medio rango (solo trigonométrica con half range)
    else {
      // El primer límite inferior debe ser 0
      const firstStartLatex = this.pieces[0].startField.latex();
      
      if (firstStartLatex !== '0') {
        Swal.fire({
          title: 'Error en los intervalos',
          html: `Para series con extensión de medio rango, el primer límite inferior debe ser 0.<br><br>Actualmente tienes: ${firstStartLatex}`,
          icon: 'error',
          confirmButtonText: 'Entendido',
        });
        return;
      }
      
      // El límite superior final debe ser mayor que 0
      const lastEndLatex = this.pieces[this.pieces.length - 1].endField.latex();
      // Aquí hacemos una comprobación simple, asumiendo que un valor mayor que 0 será 
      // una expresión explícitamente positiva (no negamos el 0)
      if (lastEndLatex === '0') {
        Swal.fire({
          title: 'Error en los intervalos',
          html: `Para series con extensión de medio rango, el límite superior debe ser mayor que 0.<br><br>Actualmente tienes: ${lastEndLatex}`,
          icon: 'error',
          confirmButtonText: 'Entendido',
        });
        return;
      }
    }
  
    // Si todas las validaciones pasan, recopilar los datos
    const piecesData = this.pieces.map((piece) => {
      return {
        func: piece.funcField.latex(),
        start: piece.startField.latex(),
        end: piece.endField.latex(),
      };
    });
  
    // Crear objeto JSON para enviar
    const data = {
      variable: this.selectedVariable,
      type: this.seriesType,
      isHalfRange: this.isHalfRange,
      halfRange: this.isHalfRange ? this.halfRangeType : null,
      pieces: piecesData,
    };
  
    console.log('Submission data:', JSON.stringify(data, null, 2));
  
    // Mostrar mensaje de éxito
    Swal.fire({
      title: 'Datos enviados',
      text: 'La información ha sido enviada correctamente',
      icon: 'success',
      confirmButtonText: 'Continuar',
    });
  }
  
  // Método auxiliar para verificar la simetría de dos expresiones LaTeX
  // Esta es una implementación básica, para expresiones más complejas se necesitaría un parser más sofisticado
  checkSymmetry(expr1: string, expr2: string): boolean {
    // Caso simple: números opuestos como -3 y 3
    if (expr1.startsWith('-') && !expr2.startsWith('-')) {
      const expr1WithoutMinus = expr1.substring(1);
      return expr1WithoutMinus === expr2;
    }
    
    // Caso inverso: 3 y -3
    if (!expr1.startsWith('-') && expr2.startsWith('-')) {
      const expr2WithoutMinus = expr2.substring(1);
      return expr1 === expr2WithoutMinus;
    }
    
    // Caso pi: -\pi y \pi
    if (expr1 === '-\\pi' && expr2 === '\\pi') {
      return true;
    }
    
    if (expr1 === '\\pi' && expr2 === '-\\pi') {
      return true;
    }
    
    // Caso fracciones de pi: -\frac{\pi}{2} y \frac{\pi}{2}
    if (expr1.includes('\\frac{-\\pi}') && expr2.includes('\\frac{\\pi}')) {
      // Simplificación: verificamos si son iguales tras eliminar el signo negativo
      const expr1Normalized = expr1.replace('-\\pi', '\\pi');
      return expr1Normalized === expr2;
    }
    
    if (expr1.includes('\\frac{\\pi}') && expr2.includes('\\frac{-\\pi}')) {
      const expr2Normalized = expr2.replace('-\\pi', '\\pi');
      return expr1 === expr2Normalized;
    }
    
    // Si las expresiones son más complejas, esta verificación básica no es suficiente
    // Aquí podrías agregar más casos específicos o implementar un parser matemático
    
    return false;
  }
}
