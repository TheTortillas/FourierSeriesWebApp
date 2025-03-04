import {
  Component,
  AfterViewInit,
  ElementRef,
  QueryList,
  ViewChildren,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MathService } from '../../../core/services/math.service';
import { Piece } from '../../../interfaces/piece.interface';


@Component({
  selector: 'app-mathquill',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mathquill.component.html',
  styleUrls: ['./mathquill.component.scss'], 
})
export class MathquillComponent implements AfterViewInit {
  // Referencias a los elementos HTML de cada campo en cada "pieza"
  @ViewChildren('funcFieldElem') funcFieldElems!: QueryList<ElementRef>;
  @ViewChildren('startFieldElem') startFieldElems!: QueryList<ElementRef>;
  @ViewChildren('endFieldElem') endFieldElems!: QueryList<ElementRef>;

  // Array de "piezas"
  pieces: Piece[] = [
    {
      funcField: null,
      startField: null,
      endField: null,
    },
  ];

  // Para manejar el campo de MathField activo
  activePieceIndex: number | null = null;
  activePieceField: 'funcField' | 'startField' | 'endField' | null = null;

  // Botones del teclado
  mathButtons = [
    { latex: '\\pi', display: '$$\\pi$$' },
    { latex: 'e', display: '$$e$$' },
    { latex: '\\left(', display: '$$\\left( \\square \\right)$$' },
    { latex: 'e^{ }', display: '$$e^{\\square}$$' },
    { latex: '\\frac{ }{ }', display: '$$\\frac{\\square}{\\square}$$' },
    { latex: '\\cdot', display: '$$\\times$$' },
    { latex: '\\sin\\left(\\right)', display: '$$\\sin(\\square)$$' },
    { latex: '\\cos\\left(\\right)', display: '$$\\cos(\\square)$$' },
    { latex: '\\sinh\\left(\\right)', display: '$$\\sinh(\\square)$$' },
    { latex: '\\cosh\\left(\\right)', display: '$$\\cosh(\\square)$$' },
    { latex: '{}^2', display: '$$\\square^2$$' },
    { latex: '{}^{}', display: '$${\\square}^{\\square}$$' },
  ];

  // Para la selección de tipo de serie
  selectedSeriesType: string | null = null;
  showHalfRangeToggle = false;   // Se muestra si selectedSeriesType = "Trigonometric"
  useHalfRange = false;          // valor del checkbox
  showHalfRangeExtension = false; // Se muestra si useHalfRange = true
  selectedHalfRange: string | null = null;

  constructor(private mathService: MathService) {}

  ngAfterViewInit() {
    this.createAllMathFields();
  }

  // Cada vez que cambie el número de piezas, o se renderice de nuevo
  // podemos volver a crear los MathFields
  ngAfterViewChecked() {
    // Opcionalmente, puedes asegurarte de que si se agregan nuevas piezas,
    // se inicialicen sus MathFields:
    this.createAllMathFields();
  }

  // Crea/inicializa todos los MathFields en cada "trozo"
  private createAllMathFields() {
    // Por cada pieza, si no tiene ya un MathField creado, se lo asignamos
    this.pieces.forEach((piece, index) => {
      // Asignar el campo "funcField"
      if (!piece.funcField && this.funcFieldElems?.toArray()[index]) {
        piece.funcField = this.mathService.createMathField(
          this.funcFieldElems.toArray()[index].nativeElement
        );
      }

      // Asignar el campo "startField"
      if (!piece.startField && this.startFieldElems?.toArray()[index]) {
        piece.startField = this.mathService.createMathField(
          this.startFieldElems.toArray()[index].nativeElement
        );
      }

      // Asignar el campo "endField"
      if (!piece.endField && this.endFieldElems?.toArray()[index]) {
        piece.endField = this.mathService.createMathField(
          this.endFieldElems.toArray()[index].nativeElement
        );
      }
    });

    // Finalmente, renderizamos MathJax para que se vean los botones
    this.mathService.renderMathJax();
  }

  // Manejo del campo activo: guardamos en qué pieza y qué campo se hace click
  setActiveField(pieceIndex: number, field: 'funcField' | 'startField' | 'endField') {
    this.activePieceIndex = pieceIndex;
    this.activePieceField = field;
  }

  // Insertar LaTeX en el campo activo
  insertLatex(latex: string) {
    if (
      this.activePieceIndex !== null &&
      this.activePieceField !== null &&
      this.pieces[this.activePieceIndex]
    ) {
      const field = this.pieces[this.activePieceIndex][this.activePieceField];
      if (field) {
        field.write(latex);
        field.focus();
      }
    }
  }
  
  // Agregar un nuevo tramo (piece) al final del array
  addPiece() {
    this.pieces.push({
      funcField: null,
      startField: null,
      endField: null,
    });
    
    // Esto asegura que después de agregar un trozo, el siguiente ciclo de detección de cambios
    // inicializará los campos matemáticos del nuevo elemento
    setTimeout(() => {
      const newIndex = this.pieces.length - 1;
      const newFuncField = this.funcFieldElems?.toArray()[newIndex];
      const newStartField = this.startFieldElems?.toArray()[newIndex];
      const newEndField = this.endFieldElems?.toArray()[newIndex];
      
      if (newFuncField && newStartField && newEndField) {
        this.pieces[newIndex].funcField = this.mathService.createMathField(
          newFuncField.nativeElement
        );
        this.pieces[newIndex].startField = this.mathService.createMathField(
          newStartField.nativeElement
        );
        this.pieces[newIndex].endField = this.mathService.createMathField(
          newEndField.nativeElement
        );
      }
    });
  }
  // Eliminar un tramo
  removePiece(index: number) {
    this.pieces.splice(index, 1);
    // Resetear los campos activos si borramos el que estaba activo
    if (this.activePieceIndex === index) {
      this.activePieceIndex = null;
      this.activePieceField = null;
    }
  }

  // trackBy para optimizar el *ngFor
  trackByIndex(index: number, item: any) {
    return index;
  }

  // Manejo del cambio de tipo de serie
  onTypeChange() {
    this.showHalfRangeToggle = this.selectedSeriesType === 'Trigonometric';

    // Si cambiamos a uno que no es "Trigonométrica", reiniciamos
    if (!this.showHalfRangeToggle) {
      this.useHalfRange = false;
      this.showHalfRangeExtension = false;
      this.selectedHalfRange = null;
    }
  }

  // Si se activa/desactiva la extensión de medio rango
  onToggleChange() {
    this.showHalfRangeExtension = this.useHalfRange;
    if (!this.useHalfRange) {
      this.selectedHalfRange = null;
    }
  }
}
