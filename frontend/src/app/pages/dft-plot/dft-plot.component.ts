import {
  Component,
  ViewChild,
  OnInit,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CartesianCanvasComponent } from '../../shared/components/cartesian-canvas/cartesian-canvas.component';
import { MathquillService } from '../../core/services/mathquill/mathquill.service';
import { MathUtilsService } from '../../core/services/maximaToJS/math-utils.service';
import { ApiService } from '../../core/services/api/api.service';
import { ThemeService } from '../../core/services/theming/theme.service';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { SurveyButtonComponent } from '../../shared/components/survey-button/survey-button.component';
import { LatexToMaximaService } from '../../core/services/conversion/latex-to-maxima.service'; 

import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dft-plot',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CartesianCanvasComponent,
    ThemeToggleComponent,
    SurveyButtonComponent
  ],
  templateUrl: './dft-plot.component.html',
  styleUrl: './dft-plot.component.scss',
})
export class DFTPlotComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cartesianCanvas') cartesianCanvas!: CartesianCanvasComponent;

  public sidenavOpen = true;
  public isDarkMode = true;
  private themeSubscription: Subscription | null = null;

  // Canvas colors based on theme
  public bgColor: string = '#222'; // Dark theme default
  public axisColor: string = '#90DCB5'; // Dark theme default
  public gridColor: string = '#6BBCAC'; // Dark theme default
  public fontColor: string = '#EBEBEB'; // Dark theme default

  public xAxisScale: 'integer' | 'pi' | 'e' = 'integer';
  public xAxisFactor: number = 1;

  // Datos de la función
  public intVar: string = 'x';
  public originalLatex: string[][] = [];
  public originalFunction: string = '';
  public dftParams = { numSamples: 512, sampleRate: 10 };

  // Variables para la visualización
  public showOriginalFunction: boolean = true;

  public functionColor: string = '#ddb3ff'; // Violeta
  public functionLineWidth: number = 2; // Grosor para la función original

  // Funciones cacheadas para piezas originales
  private cachedOriginalFunctions: Array<{
    fn: (x: number) => number;
    start: number;
    end: number;
  }> = [];

  /* Lifecycle Methods */
  constructor(
    private router: Router,
    private mathquillService: MathquillService,
    private mathUtilsService: MathUtilsService,
    private apiService: ApiService,
    private themeService: ThemeService,
    private latexToMaximaService: LatexToMaximaService
  ) {}

  ngOnInit(): void {
    // Subscribe to theme changes
    this.themeSubscription = this.themeService.darkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
      this.updateThemeColors();
  
      // Update all canvases with new colors
      this.updateCanvasColors();
    });
  
    // Load data from router state
    // IMPORTANTE: El método getCurrentNavigation() solo está disponible durante la
    // navegación inicial. Por eso debemos usar history.state directamente
    const state = history.state;
    
    console.log("Estado recibido en DFTPlotComponent:", state);
    
    if (state && state.response) {
      this.intVar = state.intVar || 'x';
      this.originalLatex = state.originalLatex || [];
      this.dftParams = state.dftParams || { numSamples: 512, sampleRate: 10 };
      this.originalFunction = state.originalFunction || '';
  
      // Pre-calculate the functions for plotting
      this.precalculateOriginalFunctions();
    } else {
      console.error("No se recibieron datos de estado en DFTPlotComponent");
      // Redirect if no data
      this.router.navigate(['/fourier-calculator']);
    }
  
    // Initialize colors based on current theme
    this.updateThemeColors();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.mathquillService.renderMathJax();
      this.initializeCanvas();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
      this.themeSubscription = null;
    }
  }

  /* Navigation and UI Control Methods */
  toggleSidenav(): void {
    this.sidenavOpen = !this.sidenavOpen;
  }

  goBack(): void {
    this.router.navigate(['/fourier-calculator']);
  }

  /* Drawing Methods */
  redrawFunctions(): void {
    if (!this.cartesianCanvas) return;

    // Solo limpiamos el canvas sin resetear la vista
    this.cartesianCanvas.clearCanvas();

    // Redibujamos manteniendo la posición y zoom actuales
    if (this.showOriginalFunction) {
      this.drawOriginalFunction();
    }
  }

  initializeCanvas(): void {
    if (!this.cartesianCanvas) return;

    this.cartesianCanvas.clearCanvas();
    this.cartesianCanvas.resetView();

    // Dibujar las funciones
    this.redrawFunctions();
  }

  redrawCanvas(): void {
    this.redrawFunctions();
  }

  drawOriginalFunction(): void {
    if (!this.cartesianCanvas) return;

    try {
      // Usar las funciones precalculadas
      for (const { fn, start, end } of this.cachedOriginalFunctions) {
        try {
          this.cartesianCanvas.drawFunctionFromAToB(
            fn,
            this.functionColor,
            start,
            end,
            this.functionLineWidth
          );
        } catch (error) {
          console.error('Error al dibujar función original:', error);
        }
      }
    } catch (error) {
      console.error('Error general al dibujar función original:', error);
    }
  }

  /* Calculation and Preprocessing Methods */
  private precalculateOriginalFunctions(): void {
    if (!this.originalLatex || this.originalLatex.length === 0) {
      console.warn('No hay datos de funciones originales para precalcular');
      return;
    }

    this.cachedOriginalFunctions = [];

    try {
      // Para cada trozo de la función
      this.originalLatex.forEach((piece) => {
        try {
          // Extraer función y rango
          const functionExpr = this.latexToMaximaService.convertToMaxima(piece[0]);
          const startX = this.latexToMaximaService.convertToMaxima(piece[1]);
          const endX = this.latexToMaximaService.convertToMaxima(piece[2]);

          // Convertir la expresión de Maxima a JavaScript
          const jsExpr = this.mathUtilsService.maximaToJS(functionExpr);

          // Crear una función JavaScript cerrada
          try {
            const fn = new Function(this.intVar, `return ${jsExpr};`) as (x: number) => number;

            // Evaluar límites una sola vez
            const start = this.mathUtilsService.evaluateMaximaExpr(startX, {});
            const end = this.mathUtilsService.evaluateMaximaExpr(endX, {});

            // Verificar que la función es válida evaluándola en un punto de prueba
            try {
              const testPoint = (start + end) / 2;
              const testValue = fn(testPoint);

              if (isFinite(testValue) && !isNaN(testValue)) {
                this.cachedOriginalFunctions.push({
                  fn,
                  start,
                  end,
                });
              }
            } catch (evalError) {
              console.error('Error evaluando la función en punto de prueba:', evalError);
            }
          } catch (fnError) {
            console.error('Error creando la función JavaScript:', fnError, jsExpr);
          }
        } catch (error) {
          console.error('Error al precalcular función original:', error);
        }
      });

      console.log('Funciones originales precalculadas:', this.cachedOriginalFunctions.length);
    } catch (error) {
      console.error('Error en precalculateOriginalFunctions:', error);
    }
  }

  /* Utility Methods */
  private updateCanvasColors(): void {
    // Update main canvas colors
    if (this.cartesianCanvas) {
      this.cartesianCanvas.bgColor = this.bgColor;
      this.cartesianCanvas.axisColor = this.axisColor;
      this.cartesianCanvas.gridColor = this.gridColor;
      this.cartesianCanvas.fontColor = this.fontColor;
    }
  }

  // Update colors based on current theme
  private updateThemeColors(): void {
    if (this.isDarkMode) {
      // Dark theme colors - Main canvas
      this.bgColor = '#222';
      this.axisColor = '#90DCB5';
      this.gridColor = '#6BBCAC';
      this.fontColor = '#EBEBEB';
    } else {
      // Light theme colors - Main canvas
      this.bgColor = '#f8fafc';
      this.axisColor = '#3b82f6';
      this.gridColor = '#93c5fd';
      this.fontColor = '#334155';
    }
  }

  updateAxisScale(): void {
    // Update factor based on selected scale
    if (this.xAxisScale === 'pi') {
      this.xAxisFactor = Math.PI;
    } else if (this.xAxisScale === 'e') {
      this.xAxisFactor = Math.E;
    } else {
      this.xAxisFactor = 1;
    }

    // Update scale in cartesian canvas component
    if (this.cartesianCanvas) {
      this.cartesianCanvas.setXAxisScale(this.xAxisScale);
    }
  }
}