import {
  Component,
  ViewChild,
  OnInit,
  AfterViewInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
    SurveyButtonComponent,
  ],
  templateUrl: './dft-plot.component.html',
  styleUrl: './dft-plot.component.scss',
})
export class DFTPlotComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cartesianCanvas') cartesianCanvas!: CartesianCanvasComponent;
  @ViewChild('amplitudeCanvas') amplitudeCanvas!: CartesianCanvasComponent;
  @ViewChild('phaseCanvas') phaseCanvas!: CartesianCanvasComponent;

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

  public originalPoints: Array<{ x: number; y: number }> = [];
  public showOriginalPoints: boolean = false; // Por defecto desactivado
  public originalPointsColor: string = '#57e389'; // Verde
  public originalPointsWidth: number = 2;

  // Variables para la visualización
  public showOriginalFunction: boolean = true;
  public showReconstructedFunction: boolean = false;

  public functionColor: string = '#ddb3ff'; // Violeta
  public functionLineWidth: number = 2; // Grosor para la función original

  // Funciones cacheadas para piezas originales
  private cachedOriginalFunctions: Array<{
    fn: (x: number) => number;
    start: number;
    end: number;
  }> = [];

  public reconstructedPoints: Array<{ x: number; y: number }> = [];
  public reconstructedColor: string = '#ff8585'; // Rojo claro
  public reconstructedLineWidth: number = 2;

  // Propiedades para almacenar y gestionar los espectros
  public amplitudeSpectrum: Array<{ x: number; y: number }> = [];
  public phaseSpectrum: Array<{ x: number; y: number }> = [];

  // Controles de visualización para espectros
  public showAmplitudeSpectrum: boolean = true;
  public showPhaseSpectrum: boolean = true;

  // Personalización de apariencia para espectros
  public amplitudeColor: string = '#4ade80'; // Verde claro
  public amplitudeLineWidth: number = 2;
  public phaseColor: string = '#60a5fa'; // Azul claro
  public phaseLineWidth: number = 2;

  // Añadir también estas propiedades para configuración de visualización
  public amplitudeCanvasHeight: number = 200; // Altura en píxeles
  public phaseCanvasHeight: number = 200; // Altura en píxeles

  /* Lifecycle Methods */
  constructor(
    private router: Router,
    private mathquillService: MathquillService,
    private mathUtilsService: MathUtilsService,
    private apiService: ApiService,
    private themeService: ThemeService,
    private latexToMaximaService: LatexToMaximaService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Verificar si estamos en el navegador
    const isBrowser = isPlatformBrowser(this.platformId);

    // Subscribe to theme changes
    this.themeSubscription = this.themeService.darkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
      this.updateThemeColors();
      this.updateCanvasColors();
    });

    // Load data from router state
    if (isBrowser) {
      const state = history.state;
      console.log('Estado recibido en DFTPlotComponent:', state);

      if (state && state.response) {
        this.intVar = state.intVar || 'x';
        this.originalLatex = state.originalLatex || [];
        this.dftParams = state.dftParams || { numSamples: 512, sampleRate: 10 };
        this.originalFunction = state.originalFunction || '';

        // Procesar puntos de la función reconstruida
        if (state.response.data) {
          this.parseReconstructedPoints(state.response.data);
        }

        if (state.response.originalPoints) {
          this.parseOriginalPoints(state.response.originalPoints);
        }

        // Procesar espectro de amplitud
        if (state.response.amplitudeSpectrum) {
          this.parseAmplitudeSpectrum(state.response.amplitudeSpectrum);
        }

        // Procesar espectro de fase
        if (state.response.phaseSpectrum) {
          this.parsePhaseSpectrum(state.response.phaseSpectrum);
        }

        // Pre-calculate the functions for plotting
        this.precalculateOriginalFunctions();
      } else {
        console.error('No se recibieron datos de estado en DFTPlotComponent');
        this.router.navigate(['/fourier-calculator']);
      }
    } else {
      console.log(
        'Running in SSR environment, skipping history-dependent code'
      );
    }

    this.updateThemeColors();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.mathquillService.renderMathJax();
      
      // Inicializar canvas principal
      this.initializeCanvas();
      
      // Inicializar canvas de espectros
      this.initializeSpectrumCanvas();
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

    // Dibujamos cada elemento solo si su bandera correspondiente está activada
    if (this.showOriginalFunction) {
      console.log('Dibujando función original');
      this.drawOriginalFunction();
    }

    if (this.showOriginalPoints) {
      console.log('Dibujando puntos originales muestreados');
      this.drawOriginalPoints();
    }

    if (this.showReconstructedFunction) {
      console.log('Dibujando puntos reconstruidos');
      this.drawReconstructedPoints();
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
          const functionExpr = this.latexToMaximaService.convertToMaxima(
            piece[0]
          );
          const startX = this.latexToMaximaService.convertToMaxima(piece[1]);
          const endX = this.latexToMaximaService.convertToMaxima(piece[2]);

          // Convertir la expresión de Maxima a JavaScript
          const jsExpr = this.mathUtilsService.maximaToJS(functionExpr);

          // Crear una función JavaScript cerrada
          try {
            const fn = new Function(this.intVar, `return ${jsExpr};`) as (
              x: number
            ) => number;

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
              console.error(
                'Error evaluando la función en punto de prueba:',
                evalError
              );
            }
          } catch (fnError) {
            console.error(
              'Error creando la función JavaScript:',
              fnError,
              jsExpr
            );
          }
        } catch (error) {
          console.error('Error al precalcular función original:', error);
        }
      });

      console.log(
        'Funciones originales precalculadas:',
        this.cachedOriginalFunctions.length
      );
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

      // Redraw canvas with new colors
      this.redrawCanvas();
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

  // Método para parsear los puntos reconstruidos desde la respuesta JSON
  private parseReconstructedPoints(dataString: string): void {
    try {
      // Convertir la string de la respuesta a un array de puntos
      // Primero eliminamos los caracteres de Maxima (%pi, etc.)
      const cleanedData = dataString.replace(/%pi/g, 'Math.PI');

      // Evaluamos la expresión para obtener el array
      const pointsArray = eval('(' + cleanedData + ')');

      if (Array.isArray(pointsArray)) {
        // Convertir el formato [[x1,y1], [x2,y2], ...] a [{x: x1, y: y1}, {x: x2, y: y2}, ...]
        this.reconstructedPoints = pointsArray.map((point) => ({
          x: point[0],
          y: point[1],
        }));

        console.log(
          `Se han procesado ${this.reconstructedPoints.length} puntos reconstructivos`
        );
      }
    } catch (error) {
      console.error('Error al procesar puntos de la DFT:', error);
    }
  }

  // Método para dibujar los puntos reconstruidos
  drawReconstructedPoints(): void {
    if (!this.cartesianCanvas || !this.showReconstructedFunction) return;

    try {
      // Si tenemos puntos para graficar
      if (this.reconstructedPoints.length > 0) {
        console.log('Dibujando solo puntos discretos reconstruidos');

        // Eliminar el código que dibuja las líneas entre puntos
        // Solo mantener el código que dibuja puntos discretos
        for (const point of this.reconstructedPoints) {
          // Dibujar un punto en cada posición de muestra
          this.cartesianCanvas.drawDiscreteLine(
            point.x,
            0,
            point.y,
            this.reconstructedColor,
            this.reconstructedLineWidth // Usar el grosor configurable
          );
        }
      }
    } catch (error) {
      console.error('Error al dibujar puntos reconstruidos:', error);
    }
  }

  // Método para parsear los puntos originales desde la respuesta JSON
  private parseOriginalPoints(dataString: string): void {
    try {
      // Convertir la string de la respuesta a un array de puntos
      // Primero eliminamos los caracteres de Maxima (%pi, etc.)
      const cleanedData = dataString.replace(/%pi/g, 'Math.PI');

      // Evaluamos la expresión para obtener el array
      const pointsArray = eval('(' + cleanedData + ')');

      if (Array.isArray(pointsArray)) {
        // Convertir el formato [[x1,y1], [x2,y2], ...] a [{x: x1, y: y1}, {x: x2, y: y2}, ...]
        this.originalPoints = pointsArray.map((point) => ({
          x: point[0],
          y: point[1],
        }));

        console.log(
          `Se han procesado ${this.originalPoints.length} puntos originales muestreados`
        );
      }
    } catch (error) {
      console.error('Error al procesar puntos originales:', error);
    }
  }

  drawOriginalPoints(): void {
    if (!this.cartesianCanvas || !this.showOriginalPoints) return;

    try {
      // Si tenemos puntos para graficar
      if (this.originalPoints.length > 0) {
        console.log('Dibujando puntos originales muestreados');

        for (const point of this.originalPoints) {
          // Dibujar un punto en cada posición de muestra
          this.cartesianCanvas.drawDiscreteLine(
            point.x,
            0,
            point.y,
            this.originalPointsColor,
            this.originalPointsWidth
          );
        }
      }
    } catch (error) {
      console.error('Error al dibujar puntos originales muestreados:', error);
    }
  }

  toggleOriginalFunction(event: any): void {
    console.log('Toggle función original:', event.target.checked);
    this.showOriginalFunction = event.target.checked;
    this.redrawCanvas();
  }

  toggleReconstructedFunction(event: any): void {
    console.log('Toggle función reconstruida:', event.target.checked);
    this.showReconstructedFunction = event.target.checked;
    this.redrawCanvas();
  }

  // Método de toggle para los puntos originales
  toggleOriginalPoints(event: any): void {
    console.log('Toggle puntos originales:', event.target.checked);
    this.showOriginalPoints = event.target.checked;
    this.redrawCanvas();
  }

  // Métodos para parsear los espectros
  private parseAmplitudeSpectrum(dataString: string): void {
    try {
      const cleanedData = dataString
        .replace(/%pi/g, 'Math.PI')
        .replace(/%e/g, 'Math.E');

      // Usar un parser seguro en lugar de eval
      this.amplitudeSpectrum = this.parseMaximaPointArray(cleanedData);
      console.log(
        `Se han procesado ${this.amplitudeSpectrum.length} puntos del espectro de amplitud`
      );
    } catch (error) {
      console.error('Error al procesar espectro de amplitud:', error);
    }
  }

  private parsePhaseSpectrum(dataString: string): void {
    try {
      const cleanedData = dataString
        .replace(/%pi/g, 'Math.PI')
        .replace(/%e/g, 'Math.E');

      // Usar un parser seguro en lugar de eval
      this.phaseSpectrum = this.parseMaximaPointArray(cleanedData);
      console.log(
        `Se han procesado ${this.phaseSpectrum.length} puntos del espectro de fase`
      );
    } catch (error) {
      console.error('Error al procesar espectro de fase:', error);
    }
  }

  // Implementar un parser seguro para convertir arrays de Maxima a objetos JavaScript
  private parseMaximaPointArray(data: string): Array<{ x: number; y: number }> {
    // Limpiar caracteres específicos de Maxima
    let cleanedData = data
      .replace(/%pi/g, String(Math.PI))
      .replace(/%e/g, String(Math.E))
      .replace(/\[\s*\]/, '[]'); // Manejar arrays vacíos

    // Extraer valores numéricos simples como 1/2, -3/4, etc.
    const fractionRegex = /(-?\d+)\/(-?\d+)/g;
    cleanedData = cleanedData.replace(
      fractionRegex,
      (match, numerator, denominator) => {
        return String(Number(numerator) / Number(denominator));
      }
    );

    try {
      // Parsear el array con JSON.parse si es posible (después de las sustituciones)
      try {
        // Intentamos hacer que sea JSON válido
        const jsonCompatible = cleanedData
          .replace(/\(/g, '[')
          .replace(/\)/g, ']')
          .replace(/\]\s*,\s*\[/g, '],[')
          .replace(/\[\s*\[/g, '[[')
          .replace(/\]\s*\]/g, ']]');

        const parsed = JSON.parse(jsonCompatible);

        if (Array.isArray(parsed)) {
          return parsed.map((point) => ({
            x: Number(point[0]),
            y: Number(point[1]),
          }));
        }
      } catch (jsonError) {
        console.warn(
          'No se pudo parsear como JSON, usando método alternativo',
          jsonError
        );
      }

      // Si JSON.parse falla, usar un enfoque de análisis manual con regex
      const pointRegex =
        /\[([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?),\s*([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\]/g;
      const points: Array<{ x: number; y: number }> = [];

      let match;
      while ((match = pointRegex.exec(cleanedData)) !== null) {
        points.push({
          x: Number(match[1]),
          y: Number(match[2]),
        });
      }

      return points;
    } catch (error) {
      console.error('Error al parsear array de puntos de Maxima:', error);
      return [];
    }
  }

  // Métodos para dibujar los espectros
  drawAmplitudeSpectrum(): void {
    if (!this.amplitudeCanvas || !this.showAmplitudeSpectrum) return;

    try {
      if (this.amplitudeSpectrum.length > 0) {
        console.log('Dibujando espectro de amplitud');

        // Limpiar canvas y configurarlo para dibujo de espectro (barras discretas)
        this.amplitudeCanvas.clearCanvas();

        // Dibujar barras discretas para el espectro de amplitud
        for (const point of this.amplitudeSpectrum) {
          // Dibujar una línea vertical (barra) para cada componente
          this.amplitudeCanvas.drawDiscreteLine(
            point.x,
            0,
            point.y,
            this.amplitudeColor,
            this.amplitudeLineWidth
          );
        }
      }
    } catch (error) {
      console.error('Error al dibujar espectro de amplitud:', error);
    }
  }

  drawPhaseSpectrum(): void {
    if (!this.phaseCanvas || !this.showPhaseSpectrum) return;

    try {
      if (this.phaseSpectrum.length > 0) {
        console.log('Dibujando espectro de fase');

        // Limpiar canvas y configurarlo para dibujo de espectro
        this.phaseCanvas.clearCanvas();

        // Dibujar barras discretas para el espectro de fase
        for (const point of this.phaseSpectrum) {
          // Dibujar una línea vertical (barra) para cada componente
          this.phaseCanvas.drawDiscreteLine(
            point.x,
            0,
            point.y,
            this.phaseColor,
            this.phaseLineWidth
          );
        }
      }
    } catch (error) {
      console.error('Error al dibujar espectro de fase:', error);
    }
  }

  // Método para inicializar los canvas de espectros
initializeSpectrumCanvas(): void {
  // Inicializar canvas de amplitud
  if (this.amplitudeCanvas) {
    this.amplitudeCanvas.clearCanvas();
    this.amplitudeCanvas.resetView();
    this.drawAmplitudeSpectrum();
  }
  
  // Inicializar canvas de fase
  if (this.phaseCanvas) {
    this.phaseCanvas.clearCanvas();
    this.phaseCanvas.resetView();
    this.drawPhaseSpectrum();
  }
}

// Toggle methods para los espectros
toggleAmplitudeSpectrum(event: any): void {
  this.showAmplitudeSpectrum = event.target.checked;
  this.drawAmplitudeSpectrum();
}

togglePhaseSpectrum(event: any): void {
  this.showPhaseSpectrum = event.target.checked;
  this.drawPhaseSpectrum();
}
}
