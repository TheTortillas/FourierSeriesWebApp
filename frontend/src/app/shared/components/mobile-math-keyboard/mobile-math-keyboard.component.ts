import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MathKeyboardService } from '../../../core/services/mathquill/math-keyboard.service';
import { MathquillService } from '../../../core/services/mathquill/mathquill.service';

@Component({
  selector: 'app-mobile-math-keyboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mobile-math-keyboard.component.html',
  styleUrl: './mobile-math-keyboard.component.scss',
})
export class MobileMathKeyboardComponent implements OnInit {
  @Input() isVisible: boolean = false;
  @Input() isMobile: boolean = false;

  @Output() onInsertMath = new EventEmitter<string>();
  @Output() onDeleteMath = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>();

  activeTab: string = 'numbers';

  keyboardTabs = [
    { id: 'numbers', name: 'Números' },
    { id: 'basics', name: 'Variables' },
    { id: 'advanced', name: 'Avanzados' },
    { id: 'trigonometric', name: 'Trigonometría' },
    { id: 'functions', name: 'Funciones' },
  ];

  constructor(
    private mathKeyboardService: MathKeyboardService,
    private mathquillService: MathquillService
  ) {}

  ngOnInit(): void {}

  // Obtener botones del teclado del servicio
  get mathButtonsBasic() {
    return this.mathKeyboardService.mathButtonsBasic;
  }

  get mathButtonsTrig() {
    return this.mathKeyboardService.mathButtonsTrig;
  }

  setActiveTab(tabId: string): void {
    this.activeTab = tabId;
    // Renderizar MathJax para la nueva pestaña visible
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 10);
  }

  insertMath(latex: string): void {
    this.onInsertMath.emit(latex);
  }

  deleteMath(): void {
    this.onDeleteMath.emit();
  }

  hideMobileKeyboard(): void {
    this.onClose.emit();
  }
}
