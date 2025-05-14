import { Component, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { SurveyButtonComponent } from '../../shared/components/survey-button/survey-button.component';
import { ThemeService } from '../../core/services/theming/theme.service';
import { MathquillService } from '../../core/services/mathquill/mathquill.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { FourierExamplesService } from '../../core/services/examples/fourier-examples.service';

interface Example {
  id: string;
  name: string;
  params?: Record<string, any>;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    ThemeToggleComponent,
    SurveyButtonComponent,
    FooterComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit {
  isDarkMode = false;
  activeDropdown: string | null = null;

  trigSeriesTeX: string =
    '$$f(x) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty} a_n \\cos(n\\omega_{0}x) + b_n \\sin(n\\omega_{0}x)$$';
  complexSeriesTeX: string =
    '$$ f(x) = \\sum_{n=-\\infty}^{\\infty} c_n e^{in\\omega _{0}x}$$';
  dftTeX: string = '$$X[k] = \\sum_{n=0}^{N-1} x_n e^{-i\\frac{2\\pi kn}{N}}$$';
  halfRangeTeX: string =
    '$$f(x) = \\frac{a_0}{2} + \\sum_{n=0}^{\\infty} a_n \\cos(n\\omega_{0}x) \\quad  f(x) = \\sum_{n=1}^{\\infty} b_n \\sin(n\\omega_{0}x)$$';

  // Ejemplos predefinidos para series trigonométricas
  trigExamples: Example[] = [
    { id: 'square', name: 'Onda Cuadrada' },
    { id: 'sawtooth', name: 'Diente de Sierra' },
    { id: 'triangle', name: 'Onda Triangular' },
  ];

  // Ejemplos predefinidos para series complejas
  complexExamples: Example[] = [
    { id: 'square_complex', name: 'Onda Cuadrada (Forma Compleja)' },
    { id: 'sawtooth_complex', name: 'Diente de Sierra (Forma Compleja)' },
    { id: 'triangle_complex', name: 'Onda Triangular (Forma Compleja)' },
  ];

  // Ejemplos predefinidos para DFT
  dftExamples: Example[] = [
    { id: 'sine_mix', name: 'Mezcla de Senoides' },
    { id: 'square_dft', name: 'Onda Cuadrada (DFT)' },
    { id: 'sawtooth_dft', name: 'Diente de Sierra (DFT)' },
    { id: 'impulse', name: 'Señal de Impulsos' },
    { id: 'noise', name: 'Señal con Ruido' },
  ];

  // Ejemplos predefinidos para series de medio rango
  halfRangeExamples: Example[] = [
    { id: 'linear', name: 'Función lineal' },
    { id: 'constant', name: 'Función constante' },
    { id: 'pulse_train', name: 'Tren de pulsos' },
  ];

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private mathquillService: MathquillService,
    private fourierExamplesService: FourierExamplesService
  ) {
    // Get initial theme state synchronously if possible
    this.isDarkMode = this.themeService.isDarkMode;
  }

  ngOnInit(): void {
    // Mover scroll a la parte superior
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }

    setTimeout(() => {
      this.themeService.darkMode$.subscribe((isDark) => {
        this.isDarkMode = isDark;
      });
    }, 0);
  }

  ngAfterViewInit(): void {
    // Render MathJax formulas after view is initialized
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 100);
  }

  navigateToCalculator(): void {
    this.router.navigate(['/fourier-calculator']);
  }

  navigateToDFT(): void {
    this.router.navigate(['/fourier-calculator'], {
      queryParams: { type: 'dft' },
    });
  }

  toggleDropdown(type: string): void {
    this.activeDropdown = this.activeDropdown === type ? null : type;
  }

  closeDropdownIfNot(type: string): void {
    if (this.activeDropdown && this.activeDropdown !== type) {
      this.activeDropdown = null;
    }
  }

  navigateToCalculatorWithExample(type: string, exampleId: string): void {
    if (type === 'trig') {
      const exampleData = this.fourierExamplesService.getTrigExample(exampleId);
      if (exampleData) {
        this.router.navigate(['/fourier-series-plot/trig'], {
          state: {
            response: exampleData,
            seriesType: 'trigonometric',
            intVar: exampleData.intVar || 'x',
            originalLatex: exampleData.originalLatex || [],
            maximaMatrix: exampleData.maximaMatrix || [],
            originalFunction: exampleData.originalFunction || '',
          },
        });
      } else {
        this.navigateToCalculator();
      }
    } else if (type === 'complex') {
      const exampleData = this.fourierExamplesService.getComplexExample(exampleId);
      if (exampleData) {
        this.router.navigate(['/fourier-series-plot/complex'], {
          state: {
            response: exampleData,           // ✓ Corrected
            seriesType: 'complex',           // ✓ Added missing
            intVar: exampleData.intVar || 'x', // ✓ Corrected
            originalLatex: exampleData.originalLatex || [],
            maximaMatrix: exampleData.maximaMatrix || [], // ✓ Added missing
            originalFunction: exampleData.originalFunction || '',
          },
        });
      } else {
        this.navigateToCalculator();
      }
    } else if (type === 'dft') {
      const exampleData = this.fourierExamplesService.getDftExample(exampleId);
      if (exampleData) {
        this.router.navigate(['/fourier-transform-plot/dft'], {
          state: {
            response: exampleData,                      
            intVar: exampleData.intVar || 'x',
            originalLatex: exampleData.originalLatex || [], 
            dftParams: exampleData.dftParams || { numSamples: 512, sampleRate: 10 }, 
            originalFunction: exampleData.originalFunction || '',
          },
        });
      } else {
        this.navigateToDFT();
      }
    } else if (type === 'halfRange') {
      const exampleData =
        this.fourierExamplesService.getHalfRangeExample(exampleId);
      if (exampleData) {
        this.router.navigate(['/fourier-series-plot/half-range'], {
          state: {
            response: exampleData,
            seriesType: 'halfRange',
            intVar: exampleData.intVar || 'x',
            originalLatex: exampleData.originalLatex || [],
            maximaMatrix: exampleData.maximaMatrix || [],
            originalFunction: exampleData.originalFunction || '',
          },
        });
      } else {
        this.navigateToCalculator();
      }
    } else {
      this.navigateToCalculator();
    }

    this.activeDropdown = null;
  }

  // Cerrar dropdown al hacer clic fuera de él
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const targetElement = event.target as HTMLElement;
    if (!targetElement.closest('.relative')) {
      this.activeDropdown = null;
    }
  }
}
