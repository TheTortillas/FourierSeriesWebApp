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
  public amplitudeCanvasHeight: number = 300; // Altura en píxeles
  public phaseCanvasHeight: number = 300; // Altura en píxeles

  private amplitudePoints: Array<{
    n: number;
    x: number;
    y: number;
    value: number;
  }> = [];

  private phasePoints: Array<{
    n: number;
    x: number;
    y: number;
    value: number;
  }> = [];

  private amplitudeTooltip: HTMLElement | null = null;
  private phaseTooltip: HTMLElement | null = null;

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
      // console.log('Estado recibido en DFTPlotComponent:', state);

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
      // console.log('Running in SSR environment, skipping history-dependent code');
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

      // Configurar eventos para los tooltips solo en el navegador
      if (isPlatformBrowser(this.platformId)) {
        this.setupSpectrumCanvasEvents();
      }
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
      this.drawOriginalFunction();
    }

    if (this.showOriginalPoints) {
      this.drawOriginalPoints();
    }

    if (this.showReconstructedFunction) {
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

      // console.log('Funciones originales precalculadas:',this.cachedOriginalFunctions.length);
    } catch (error) {
      console.error('Error en precalculateOriginalFunctions:', error);
    }
  }

  /* Utility Methods */
  // Método para actualizar los colores en todos los canvas
  private updateCanvasColors(): void {
    // Update main canvas colors
    if (this.cartesianCanvas) {
      this.cartesianCanvas.bgColor = this.bgColor;
      this.cartesianCanvas.axisColor = this.axisColor;
      this.cartesianCanvas.gridColor = this.gridColor;
      this.cartesianCanvas.fontColor = this.fontColor;

      // Redraw main canvas with new colors
      this.redrawCanvas();
    }

    // Update amplitude canvas colors
    if (this.amplitudeCanvas) {
      this.amplitudeCanvas.bgColor = this.bgColor;
      this.amplitudeCanvas.axisColor = this.axisColor;
      this.amplitudeCanvas.gridColor = this.gridColor;
      this.amplitudeCanvas.fontColor = this.fontColor;

      // Redraw amplitude spectrum with new colors
      this.drawAmplitudeSpectrum();
    }

    // Update phase canvas colors
    if (this.phaseCanvas) {
      this.phaseCanvas.bgColor = this.bgColor;
      this.phaseCanvas.axisColor = this.axisColor;
      this.phaseCanvas.gridColor = this.gridColor;
      this.phaseCanvas.fontColor = this.fontColor;

      // Redraw phase spectrum with new colors
      this.drawPhaseSpectrum();
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

        // console.log(`Se han procesado ${this.reconstructedPoints.length} puntos reconstructivos`);
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

        // console.log(`Se han procesado ${this.originalPoints.length} puntos originales muestreados`);
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
    this.showOriginalFunction = event.target.checked;
    this.redrawCanvas();
  }

  toggleReconstructedFunction(event: any): void {
    this.showReconstructedFunction = event.target.checked;
    this.redrawCanvas();
  }

  // Método de toggle para los puntos originales
  toggleOriginalPoints(event: any): void {
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
      // console.log( `Se han procesado ${this.amplitudeSpectrum.length} puntos del espectro de amplitud` );
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
      // console.log( `Se han procesado ${this.phaseSpectrum.length} puntos del espectro de fase` );
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
        // Limpiar canvas y resetear puntos
        this.amplitudeCanvas.clearCanvas();
        this.amplitudePoints = [];

        // Encontrar la mitad de la longitud del espectro para reflejar correctamente
        const n = this.amplitudeSpectrum.length;
        const halfN = Math.floor(n / 2);

        // Dibujar barras discretas para el espectro de amplitud (parte positiva)
        for (const point of this.amplitudeSpectrum) {
          // Dibujar una línea vertical (barra) para cada componente
          this.drawDiscreteLineWithBlur(
            this.amplitudeCanvas,
            point.x,
            0,
            point.y,
            this.amplitudeColor,
            this.amplitudeLineWidth,
            true
          );

          // Almacenar punto para tooltips
          const pixelPos = this.canvasCoordToPixel(
            this.amplitudeCanvas,
            point.x,
            point.y
          );

          if (pixelPos) {
            this.amplitudePoints.push({
              n: point.x, // Usamos x como índice
              x: pixelPos.x,
              y: pixelPos.y,
              value: point.y,
            });
          }

          // Reflejar el punto en la parte negativa del espectro
          // (Evitamos reflejar el punto en frecuencia cero)
          if (point.x > 0) {
            // La frecuencia negativa correspondiente
            const negativeX = -point.x;

            // Dibujar el punto reflejado
            this.drawDiscreteLineWithBlur(
              this.amplitudeCanvas,
              negativeX,
              0,
              point.y, // La amplitud es la misma para la frecuencia reflejada
              this.amplitudeColor,
              this.amplitudeLineWidth,
              true
            );

            // Almacenar el punto reflejado para tooltip
            const negPixelPos = this.canvasCoordToPixel(
              this.amplitudeCanvas,
              negativeX,
              point.y
            );

            if (negPixelPos) {
              this.amplitudePoints.push({
                n: negativeX,
                x: negPixelPos.x,
                y: negPixelPos.y,
                value: point.y,
              });
            }
          }
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
        // Limpiar canvas y resetear puntos
        this.phaseCanvas.clearCanvas();
        this.phasePoints = [];

        // Dibujar barras discretas para el espectro de fase
        for (const point of this.phaseSpectrum) {
          // Dibujar una línea vertical (barra) para cada componente
          this.drawDiscreteLineWithBlur(
            this.phaseCanvas,
            point.x,
            0,
            point.y,
            this.phaseColor,
            this.phaseLineWidth,
            true
          );

          // Almacenar punto para tooltips
          const pixelPos = this.canvasCoordToPixel(
            this.phaseCanvas,
            point.x,
            point.y
          );

          if (pixelPos) {
            this.phasePoints.push({
              n: point.x, // Usamos x como índice
              x: pixelPos.x,
              y: pixelPos.y,
              value: point.y,
            });
          }
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

    // Configurar eventos de zoom
    this.setupSpectrumCanvasZoomEvents();
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

  // Método para dibujar líneas con efecto blur
  private drawDiscreteLineWithBlur(
    canvas: CartesianCanvasComponent,
    startX: number,
    startY: number,
    height: number,
    color: string,
    lineWidth: number = 2.5,
    applyBlur: boolean = false,
    isHighlighted: boolean = false
  ): void {
    if (!canvas || !canvas.ctx) return;

    const ctx = canvas.ctx;
    const origin = canvas.origin;
    const unit = canvas.unit;
    const offsetX = canvas.offsetX;
    const offsetY = canvas.offsetY;

    // Calculate pixel coordinates
    const xPx = origin.x - offsetX + unit * startX;
    const y0Px = origin.y - offsetY - unit * startY;
    const yEndPx = origin.y - offsetY - unit * (startY + height);

    // Save current context state
    ctx.save();

    // Apply blur effect if needed
    if (applyBlur) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 1.5;
      ctx.globalAlpha = 0.9;
    }

    // Add highlight effect if needed
    if (isHighlighted) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.globalAlpha = 1;
      lineWidth += 0.5; // Make it slightly thicker
    }

    // Draw vertical line
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(xPx, y0Px);
    ctx.lineTo(xPx, yEndPx);
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Draw point at the end with glow effect
    ctx.beginPath();
    ctx.arc(xPx, yEndPx, isHighlighted ? 6 : 5, 0, 2 * Math.PI);
    ctx.stroke();

    // Add a small fill for the point
    ctx.fillStyle = color;
    ctx.globalAlpha = isHighlighted ? 0.5 : 0.3;
    ctx.fill();

    // Restore original context state
    ctx.restore();
  }

  // Método para convertir coordenadas matemáticas a píxeles
  private canvasCoordToPixel(
    canvas: CartesianCanvasComponent,
    x: number,
    y: number
  ): { x: number; y: number } | null {
    if (!canvas || !canvas.ctx) return null;

    const origin = canvas.origin;
    const unit = canvas.unit;
    const offsetX = canvas.offsetX;
    const offsetY = canvas.offsetY;

    // Convert from math units to pixels
    const pixelX = origin.x - offsetX + unit * x;
    const pixelY = origin.y - offsetY - unit * y;

    return { x: pixelX, y: pixelY };
  }

  private setupSpectrumCanvasEvents(): void {
    // Inicializar tooltips

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.amplitudeTooltip = document.getElementById('amplitudeTooltip');
    this.phaseTooltip = document.getElementById('phaseTooltip');

    // Obtener elementos del DOM
    const canvasElements = {
      amplitude: document.getElementById('amplitudeCanvas'),
      phase: document.getElementById('phaseCanvas'),
    };

    // Función auxiliar para verificar si el ratón está cerca de un tallo
    const isNearStem = (
      mouseX: number,
      mouseY: number,
      stemX: number,
      stemY0: number,
      stemY1: number,
      threshold: number
    ): boolean => {
      // Si el ratón está fuera del rango vertical del tallo, no está cerca
      if (
        mouseY < Math.min(stemY0, stemY1) - threshold ||
        mouseY > Math.max(stemY0, stemY1) + threshold
      ) {
        return false;
      }

      // Calcular la distancia horizontal al tallo
      const distance = Math.abs(mouseX - stemX);
      return distance < threshold;
    };

    // Eventos para el canvas de amplitud
    if (canvasElements.amplitude && this.amplitudeTooltip) {
      canvasElements.amplitude.onmousemove = (event: MouseEvent) => {
        const rect = canvasElements.amplitude!.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const threshold = 12;
        let closestPoint = null;
        let minDistance = Infinity;
        let isCloseToStem = false;

        for (const point of this.amplitudePoints) {
          const stemX = point.x;
          const stemEndY = point.y;

          // Calcular Y0 (origen del tallo, normalmente Y=0)
          const origin = this.amplitudeCanvas.origin;
          const offsetY = this.amplitudeCanvas.offsetY;
          const unit = this.amplitudeCanvas.unit;
          const stemStartY = origin.y - offsetY - unit * 0;

          if (
            isNearStem(mouseX, mouseY, stemX, stemStartY, stemEndY, threshold)
          ) {
            isCloseToStem = true;

            const dx = mouseX - stemX;
            const dy = mouseY - stemEndY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
              minDistance = distance;
              closestPoint = point;
            }
          }
        }

        if (isCloseToStem && closestPoint) {
          this.amplitudeTooltip!.innerHTML = `A<sub>${Math.round(
            closestPoint.n
          )}</sub> = ${closestPoint.value.toFixed(6)}`;
          this.amplitudeTooltip!.style.left = `${closestPoint.x}px`;
          this.amplitudeTooltip!.style.top = `${closestPoint.y}px`;
          this.amplitudeTooltip!.classList.add('visible');

          // Redibujar con resaltado
          this.drawAmplitudeSpectrum();
          const point = this.amplitudeSpectrum.find(
            (p) => p.x === closestPoint!.n
          );
          if (point) {
            this.drawDiscreteLineWithBlur(
              this.amplitudeCanvas,
              point.x,
              0,
              point.y,
              this.amplitudeColor,
              this.amplitudeLineWidth + 0.5,
              false,
              true
            );
          }
        } else if (this.amplitudeTooltip) {
          this.amplitudeTooltip.classList.remove('visible');
          this.drawAmplitudeSpectrum();
        }
      };

      canvasElements.amplitude.onmouseleave = () => {
        if (this.amplitudeTooltip) {
          this.amplitudeTooltip.classList.remove('visible');
          this.drawAmplitudeSpectrum();
        }
      };
    }

    // Eventos para el canvas de fase
    if (canvasElements.phase && this.phaseTooltip) {
      canvasElements.phase.onmousemove = (event: MouseEvent) => {
        const rect = canvasElements.phase!.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const threshold = 12;
        let closestPoint = null;
        let minDistance = Infinity;
        let isCloseToStem = false;

        for (const point of this.phasePoints) {
          const stemX = point.x;
          const stemEndY = point.y;

          const origin = this.phaseCanvas.origin;
          const offsetY = this.phaseCanvas.offsetY;
          const unit = this.phaseCanvas.unit;
          const stemStartY = origin.y - offsetY - unit * 0;

          if (
            isNearStem(mouseX, mouseY, stemX, stemStartY, stemEndY, threshold)
          ) {
            isCloseToStem = true;

            const dx = mouseX - stemX;
            const dy = mouseY - stemEndY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
              minDistance = distance;
              closestPoint = point;
            }
          }
        }

        if (isCloseToStem && closestPoint) {
          // Convertir fase a grados para mostrar
          const phaseDegrees = ((closestPoint.value * 180) / Math.PI).toFixed(
            2
          );

          this.phaseTooltip!.innerHTML = `φ<sub>${Math.round(
            closestPoint.n
          )}</sub> = ${phaseDegrees}°`;
          this.phaseTooltip!.style.left = `${closestPoint.x}px`;
          this.phaseTooltip!.style.top = `${closestPoint.y}px`;
          this.phaseTooltip!.classList.add('visible');

          // Redibujar con resaltado
          this.drawPhaseSpectrum();
          const point = this.phaseSpectrum.find((p) => p.x === closestPoint!.n);
          if (point) {
            this.drawDiscreteLineWithBlur(
              this.phaseCanvas,
              point.x,
              0,
              point.y,
              this.phaseColor,
              this.phaseLineWidth + 0.5,
              false,
              true
            );
          }
        } else if (this.phaseTooltip) {
          this.phaseTooltip.classList.remove('visible');
          this.drawPhaseSpectrum();
        }
      };

      canvasElements.phase.onmouseleave = () => {
        if (this.phaseTooltip) {
          this.phaseTooltip.classList.remove('visible');
          this.drawPhaseSpectrum();
        }
      };
    }
  }

  private setupSpectrumCanvasZoomEvents(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const canvasElements = [
      { canvas: this.amplitudeCanvas, elementId: 'amplitudeCanvas' },
      { canvas: this.phaseCanvas, elementId: 'phaseCanvas' },
    ];

    for (const { canvas, elementId } of canvasElements) {
      if (canvas && canvas.canvasElement?.nativeElement) {
        const canvasEl = canvas.canvasElement.nativeElement;

        // Crear un manejador de rueda que llame al manejador original y luego redibuje
        const originalWheel = canvasEl.onwheel;
        canvasEl.onwheel = (event: WheelEvent) => {
          // Llamar al manejador original
          if (originalWheel) originalWheel.call(canvasEl, event);

          // Redibujar después de un pequeño retraso para permitir la actualización del canvas
          setTimeout(() => {
            if (elementId === 'amplitudeCanvas') {
              this.drawAmplitudeSpectrum();
            } else if (elementId === 'phaseCanvas') {
              this.drawPhaseSpectrum();
            }
          }, 0);
        };
      }
    }
  }
}
