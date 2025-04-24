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
import { CartesianCanvasComponent } from '../../../shared/components/cartesian-canvas/cartesian-canvas.component';
import { TrigonometricResponse } from '../../../interfaces/trigonometric-response.interface';
import { MathquillService } from '../../../core/services/mathquill/mathquill.service';
import { MathUtilsService } from '../../../core/services/maximaToJS/math-utils.service';
import { PlotConfig } from '../../../interfaces/plot-config.interface';
import { ApiService } from '../../../core/services/api/api.service';
import { ThemeService } from '../../../core/services/theming/theme.service';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { Subscription } from 'rxjs';
import { SurveyButtonComponent } from '../../../shared/components/survey-button/survey-button.component';

@Component({
  selector: 'app-trig',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CartesianCanvasComponent,
    ThemeToggleComponent,
    SurveyButtonComponent
  ],
  templateUrl: './trig.component.html',
  styleUrl: './trig.component.scss',
})
export class TrigComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cartesianCanvas') cartesianCanvas!: CartesianCanvasComponent;
  @ViewChild('anCanvas') anCanvas!: CartesianCanvasComponent;
  @ViewChild('bnCanvas') bnCanvas!: CartesianCanvasComponent;

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

  // Datos de la serie
  public response: TrigonometricResponse | null = null;
  public seriesType: string = '';
  public intVar: string = 'x';
  public originalLatex: string[][] = [];
  public originalFunction: string = '';

  // Variables para la visualización
  public termCount: number = 0;
  public showOriginalFunction: boolean = true;
  public showSeriesApproximation: boolean = true;

  public functionColor: string = '#ddb3ff'; // Violeta
  public seriesColor: string = '#ff8585'; // Rojo

  // Propiedades para personalizar los colores de términos individuales
  public termsStartColor: string = '#1940af'; // Azul inicial (RGB: 25, 64, 175)
  public termsEndColor: string = '#ef4444'; // Rojo final (RGB: 239, 68, 68)

  public functionLineWidth: number = 2; // Grosor para la función original
  public seriesLineWidth: number = 2;

  // Para formateo de LaTeX
  public latexRendered: any = {
    a0: '',
    an: '',
    bn: '',
    w0: '',
  };

  public maximaMatrix: string[][] = [];

  // Serie completa en formato LaTeX
  public fullLatexFormula: string = '';

  // Cache de coeficientes precalculados para mejorar rendimiento
  private cachedA0: number = 0;
  private cachedW0: number = 0;
  private cachedACoefs: number[] = [];
  private cachedBCoefs: number[] = [];

  public seriesTerms: any = {
    a0: '',
    an: [],
    bn: [],
  };

  public showIndividualTerms: boolean = false;
  private individualTermFunctions: Array<{
    fn: (x: number) => number;
    color: string;
  }> = [];

  public termsLatex: string[] = [];
  public termsLineWidth: number = 2;

  // Add these properties to control the visibility of amplitude graphs
  public showAmplitudeGraphs: boolean = false;
  public anLineWidth: number = 2;
  public bnLineWidth: number = 2;
  public anColor: string = '#B794F4'; // Purple for an coefficients
  public bnColor: string = '#F6AD55'; // Orange for bn coefficients
  private resizeObserver: ResizeObserver | null = null;

  public anBgColor: string = '#1A1A2E'; // Dark mode default
  public anAxisColor: string = '#B794F4'; // Dark mode default
  public anGridColor: string = '#553C9A'; // Dark mode default

  public bnBgColor: string = '#2A1E17'; // Dark mode default
  public bnAxisColor: string = '#F6AD55'; // Dark mode default
  public bnGridColor: string = '#9C4221'; // Dark mode default

  private anPoints: Array<{ n: number; x: number; y: number; value: number }> =
    [];
  private bnPoints: Array<{ n: number; x: number; y: number; value: number }> =
    [];
  private anTooltip: HTMLElement | null = null;
  private bnTooltip: HTMLElement | null = null;

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
    private themeService: ThemeService
  ) {
    // Recuperar los datos pasados por el router
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.response = navigation.extras.state['response'];
      this.seriesType = navigation.extras.state['seriesType'];
      this.intVar = navigation.extras.state['intVar'];
      this.originalLatex = navigation.extras.state['originalLatex'];
      this.maximaMatrix = navigation.extras.state['maximaMatrix']; // Recuperamos el maximaMatrix
      this.originalFunction = navigation.extras.state['originalFunction'];

      // Generar fórmulas LaTeX para los resultados
      this.prepareLatexFormulas();
    } else {
      // Redirigir si no hay datos
      this.router.navigate(['/fourier-calculator']);
    }
  }

  ngOnInit(): void {
    // Precalcular coeficientes para mejorar rendimiento
    this.precalculateCoefficients();
    this.precalculateOriginalFunctions();
    this.fetchIndividualTerms();
    this.printAllCoefficients();
    // Subscribe to theme changes
    this.themeSubscription = this.themeService.darkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
      this.updateThemeColors();

      // Directly update the properties instead of calling setter methods
      if (this.cartesianCanvas) {
        this.cartesianCanvas.bgColor = this.bgColor;
        this.cartesianCanvas.axisColor = this.axisColor;
        this.cartesianCanvas.gridColor = this.gridColor;
        this.cartesianCanvas.fontColor = this.fontColor;

        // Force a redraw to apply the new colors
        this.cartesianCanvas.clearCanvas();
        this.redrawFunctions();
      }
    });

    this.themeSubscription = this.themeService.darkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
      this.updateThemeColors();

      // Actualizar el canvas principal
      if (this.cartesianCanvas) {
        this.cartesianCanvas.bgColor = this.bgColor;
        this.cartesianCanvas.axisColor = this.axisColor;
        this.cartesianCanvas.gridColor = this.gridColor;
        this.cartesianCanvas.fontColor = this.fontColor;

        // Redraw para aplicar los nuevos colores
        this.cartesianCanvas.clearCanvas();
        this.redrawFunctions();
      }

      // Actualizar los canvas de amplitud
      if (this.anCanvas) {
        this.anCanvas.bgColor = this.anBgColor;
        this.anCanvas.axisColor = this.anAxisColor;
        this.anCanvas.gridColor = this.anGridColor;
        this.anCanvas.fontColor = this.fontColor;

        if (this.showAmplitudeGraphs) {
          this.anCanvas.clearCanvas();
        }
      }

      if (this.bnCanvas) {
        this.bnCanvas.bgColor = this.bnBgColor;
        this.bnCanvas.axisColor = this.bnAxisColor;
        this.bnCanvas.gridColor = this.bnGridColor;
        this.bnCanvas.fontColor = this.fontColor;

        if (this.showAmplitudeGraphs) {
          this.bnCanvas.clearCanvas();
        }
      }

      // Redibujar los gráficos de amplitud si están visibles
      if (this.showAmplitudeGraphs) {
        setTimeout(() => this.drawAmplitudeGraphs(), 100);
      }
    });

    // Initialize colors based on current theme
    this.updateThemeColors();
  }

  private printAllCoefficients(): void {
    // Esperar un momento para asegurar que los coeficientes estén calculados
    setTimeout(() => {
      console.group('Coeficientes Serie de Fourier - Valores numéricos');
      console.log('a0:', this.cachedA0);
      console.log('w0:', this.cachedW0);

      // Crear un objeto para mostrar todos los coeficientes de manera estructurada
      const allCoefficients = {
        a0: this.cachedA0,
        w0: this.cachedW0,
        an: this.cachedACoefs.map((value, index) => ({ n: index + 1, value })),
        bn: this.cachedBCoefs.map((value, index) => ({ n: index + 1, value })),
      };

      console.table(allCoefficients.an); // Mostrar an como tabla
      console.table(allCoefficients.bn); // Mostrar bn como tabla

      // También puedes crear un arreglo con todos los valores para exportación
      const exportData = {
        a0: this.cachedA0,
        w0: this.cachedW0,
        an: this.cachedACoefs,
        bn: this.cachedBCoefs,
      };

      // Almacenar en una propiedad para posible uso posterior (descarga, etc.)
      this.coefficientsData = exportData;

      console.log('Datos completos para exportación:', exportData);
      console.groupEnd();
    }, 500);
  }

  // Añadir esta propiedad para almacenar los coeficientes
  public coefficientsData: any = null;

  // Para hacer los datos accesibles desde la UI, podemos añadir un método para descargarlos
  public downloadCoefficients(): void {
    if (!this.coefficientsData) {
      console.warn('No hay coeficientes disponibles para descargar');
      return;
    }

    const dataStr = JSON.stringify(this.coefficientsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'fourier_coefficients.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  ngAfterViewInit(): void {
    // Existing code
    setTimeout(() => {
      this.mathquillService.renderMathJax();
      this.initializeCanvas();

      // Initialize amplitude graphs if visible
      if (this.showAmplitudeGraphs) {
        this.drawAmplitudeGraphs();
      }
    }, 100);

    // Setup resize observer for the amplitude canvases
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.showAmplitudeGraphs) {
          setTimeout(() => this.drawAmplitudeGraphs(), 100);
        }
      });

      // Observe containers for both canvases
      const anCanvasElement = document.getElementById('anCanvas');
      const bnCanvasElement = document.getElementById('bnCanvas');

      if (anCanvasElement) this.resizeObserver.observe(anCanvasElement);
      if (bnCanvasElement) this.resizeObserver.observe(bnCanvasElement);
    }
  }

  // Cleanup in ngOnDestroy
  ngOnDestroy(): void {
    // Existing theme subscription cleanup
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
      this.themeSubscription = null;
    }

    // Clean up resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /* Navigation and UI Control Methods */
  toggleSidenav(): void {
    // Método para alternar el sidenav
    this.sidenavOpen = !this.sidenavOpen;
  }

  toggleAmplitudeGraphs(show: boolean): void {
    this.showAmplitudeGraphs = show;

    if (show) {
      // Asegurar que los colores de los canvas estén actualizados
      if (this.anCanvas) {
        this.anCanvas.bgColor = this.anBgColor;
        this.anCanvas.axisColor = this.anAxisColor;
        this.anCanvas.gridColor = this.anGridColor;
        this.anCanvas.fontColor = this.fontColor;
      }

      if (this.bnCanvas) {
        this.bnCanvas.bgColor = this.bnBgColor;
        this.bnCanvas.axisColor = this.bnAxisColor;
        this.bnCanvas.gridColor = this.bnGridColor;
        this.bnCanvas.fontColor = this.fontColor;
      }

      setTimeout(() => {
        this.drawAmplitudeGraphs();
        // Una vez dibujados, configurar los eventos
        this.setupAmplitudeCanvasEvents();
        // Configurar eventos de zoom
        this.setupAmplitudeCanvasZoomEvents();
      }, 1000);
    }
  }

  goBack(): void {
    // Método para volver a la calculadora
    this.router.navigate(['/fourier-calculator']);
  }

  exportResults(): void {
    // Método para exportar los resultados
    console.log('Exportar resultados');
  }

  /* Drawing Methods */
  redrawFunctions(): void {
    // Método para redibujar las funciones sin reiniciar la vista
    if (!this.cartesianCanvas) return;

    // Solo limpiamos el canvas sin resetear la vista
    this.cartesianCanvas.clearCanvas();

    // Redibujamos manteniendo la posición y zoom actuales
    if (this.showOriginalFunction) {
      this.drawOriginalFunction();
    }

    if (this.showSeriesApproximation) {
      this.drawSeriesApproximation();
    }

    // Siempre dibujar los términos individuales si están habilitados
    if (this.showIndividualTerms && this.individualTermFunctions.length > 0) {
      this.drawIndividualTerms();
    }
  }

  initializeCanvas(): void {
    // Inicializar el canvas con las gráficas
    if (!this.cartesianCanvas) return;

    // Para inicialización completa SÍ queremos resetear la vista
    this.cartesianCanvas.clearCanvas();
    this.cartesianCanvas.resetView();

    // Dibujar las funciones
    this.redrawFunctions();
  }

  redrawCanvas(): void {
    // Existing code
    this.redrawFunctions();

    // Draw amplitude graphs if enabled
    if (this.showAmplitudeGraphs) {
      this.drawAmplitudeGraphs();
    }
  }

  drawOriginalFunction(): void {
    if (!this.cartesianCanvas) return;

    try {
      // Usar las funciones precalculadas
      for (const { fn, start, end } of this.cachedOriginalFunctions) {
        try {
          // Pasar el grosor de línea como parámetro
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

  drawSeriesApproximation(): void {
    // Método para dibujar la serie con los coeficientes precalculados
    if (!this.cartesianCanvas) return;

    try {
      // Crear una función que sume todos los términos usando los coeficientes precalculados
      const fourierSeries = (x: number): number => {
        // Comenzar con el término constante a0/2 (dividido entre 2)
        let sum = this.cachedA0 / 2;

        // Si termCount es 0, solo mostramos el término constante
        if (this.termCount === 0) {
          return sum;
        }

        // Sumar todos los términos desde n=1 hasta termCount
        for (let n = 1; n <= this.termCount; n++) {
          const idx = n - 1;

          if (idx < this.cachedACoefs.length && this.cachedACoefs[idx] !== 0) {
            sum += this.cachedACoefs[idx] * Math.cos(n * this.cachedW0 * x);
          }

          if (idx < this.cachedBCoefs.length && this.cachedBCoefs[idx] !== 0) {
            sum += this.cachedBCoefs[idx] * Math.sin(n * this.cachedW0 * x);
          }
        }

        return sum;
      };

      // Utilizar el método drawFunction del canvas para dibujar la serie
      this.cartesianCanvas.drawFunction(
        fourierSeries,
        this.seriesColor,
        this.seriesLineWidth
      );
    } catch (error) {
      console.error('Error al dibujar la aproximación de la serie:', error);
    }
  }

  drawIndividualTerms(): void {
    // Método para dibujar los términos individuales (extraído de redrawWithIndividualTerms)
    if (
      !this.cartesianCanvas ||
      !this.showIndividualTerms ||
      this.individualTermFunctions.length === 0
    )
      return;

    // Si termCount es 0, solo mostramos el término constante (a0/2)
    // Nos aseguramos de que el arreglo tenga al menos un elemento
    if (this.termCount === 0 && this.individualTermFunctions.length > 0) {
      // El primer término siempre es a0/2
      const { fn, color } = this.individualTermFunctions[0];
      this.cartesianCanvas.drawFunction(fn, color, this.termsLineWidth);
    } else {
      // Para termCount > 0, mostramos los términos correspondientes
      // El primer término siempre es a0/2, luego los términos de la serie
      const termsToDraw = this.individualTermFunctions.slice(
        0,
        this.termCount + 1
      );

      termsToDraw.forEach(({ fn, color }) => {
        this.cartesianCanvas.drawFunction(fn, color, this.termsLineWidth);
      });
    }
  }

  private drawFourierSeries(
    a0: number,
    aCoefs: number[],
    bCoefs: number[],
    w0: number,
    terms: number,
    color: string,
    lineWidth: number = 2 // Añadir parámetro de grosor
  ): void {
    // Método para dibujar la serie de Fourier
    const config = this.getPlotConfig();
    if (!config.ctx) return;

    const { ctx, width, unit, offsetX, offsetY, origin } = config;

    let previousX: number | undefined = undefined;
    let previousY: number | undefined = undefined;

    // Para cada pixel en el ancho del canvas
    for (let px = 0; px < width; px++) {
      // Convertir de pixel a coordenada matemática
      const x = (px + offsetX - origin.x) / unit;

      // Inicializar la suma con el término constante a0
      let sum = a0;

      // Sumar términos de la serie para cada n
      for (let n = 1; n <= Math.min(terms, aCoefs.length); n++) {
        if (n - 1 < aCoefs.length && aCoefs[n - 1] !== 0) {
          sum += aCoefs[n - 1] * Math.cos(n * w0 * x);
        }

        if (n - 1 < bCoefs.length && bCoefs[n - 1] !== 0) {
          sum += bCoefs[n - 1] * Math.sin(n * w0 * x);
        }
      }

      // Convertir de coordenada matemática a pixel
      const canvasX = px;
      const canvasY = origin.y - offsetY - unit * sum;

      // Dibujar línea desde el punto anterior
      if (previousX !== undefined && previousY !== undefined) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(canvasX, canvasY);
        ctx.lineWidth = lineWidth; // Usar el parámetro lineWidth
        ctx.stroke();
      }

      previousX = canvasX;
      previousY = canvasY;
    }
  }

  /* Calculation and Preprocessing Methods */
  private precalculateCoefficients(): void {
    // Precalcular todos los coeficientes de la serie
    if (!this.response || !this.response.simplified) return;

    try {
      const a0Expr = this.response.simplified.a0 || '0';
      const anExpr = this.response.simplified.an || '0';
      const bnExpr = this.response.simplified.bn || '0';
      const w0Expr = this.response.simplified.w0 || '%pi';

      // Evaluar a0 - sólo una vez
      try {
        this.cachedA0 = this.mathUtilsService.evaluateMaximaExpr(a0Expr, {});
        console.log('a0 evaluado:', this.cachedA0);
      } catch (error) {
        console.error('Error evaluando a0:', error);
        this.cachedA0 = 0;
      }

      // Evaluar w0 - sólo una vez
      try {
        this.cachedW0 = this.mathUtilsService.evaluateMaximaExpr(w0Expr, {});
        console.log('w0 evaluado:', this.cachedW0);
      } catch (error) {
        console.error('Error evaluando w0:', error);
        this.cachedW0 = Math.PI;
      }

      // Precalcular coeficientes para un número grande de términos
      const maxTerms = 100; // Límite razonable para precalcular
      this.cachedACoefs = [];
      this.cachedBCoefs = [];

      // Referencias a las indeterminaciones
      const indetAN = this.response.indeterminateValues?.an || [];
      const indetBN = this.response.indeterminateValues?.bn || [];

      // Precalcular an
      if (anExpr !== '0') {
        for (let n = 1; n <= maxTerms; n++) {
          try {
            // Verificar si el coeficiente an es indeterminado en este n
            const match = indetAN.find((item) => item.n === n);
            if (match) {
              // Reemplazar con el valor de límite
              const limitVal = this.mathUtilsService.evaluateMaximaExpr(
                match.limit,
                {}
              );
              this.cachedACoefs.push(limitVal);
            } else {
              // Evaluación normal
              const anVal = this.mathUtilsService.evaluateMaximaExpr(anExpr, {
                n,
              });
              this.cachedACoefs.push(anVal);
            }
          } catch (error) {
            console.error(`Error calculando a${n}:`, error);
            this.cachedACoefs.push(0);
          }
        }
      } else {
        // Si an es 0, rellenar con ceros
        this.cachedACoefs = Array(maxTerms).fill(0);
      }

      // Precalcular bn
      if (bnExpr !== '0') {
        for (let n = 1; n <= maxTerms; n++) {
          try {
            // Verificar si el coeficiente bn es indeterminado en este n
            const match = indetBN.find((item) => item.n === n);
            if (match) {
              // Reemplazar con el valor de límite
              const limitVal = this.mathUtilsService.evaluateMaximaExpr(
                match.limit,
                {}
              );
              this.cachedBCoefs.push(limitVal);
            } else {
              // Evaluación normal
              const bnVal = this.mathUtilsService.evaluateMaximaExpr(bnExpr, {
                n,
              });
              this.cachedBCoefs.push(bnVal);
            }
          } catch (error) {
            console.error(`Error calculando b${n}:`, error);
            this.cachedBCoefs.push(0);
          }
        }
      } else {
        // Si bn es 0, rellenar con ceros
        this.cachedBCoefs = Array(maxTerms).fill(0);
      }

      console.log('Coeficientes precalculados:', {
        a0: this.cachedA0,
        w0: this.cachedW0,
        an: this.cachedACoefs.slice(0, 5), // Solo mostrar los primeros 5 para debug
        bn: this.cachedBCoefs.slice(0, 5),
      });
    } catch (error) {
      console.error('Error en precalculateCoefficients:', error);
    }
  }

  private precalculateOriginalFunctions(): void {
    // Precalcular las funciones originales
    // Usamos maximaMatrix si está disponible, sino el originalLatex como respaldo
    const dataSource =
      this.maximaMatrix.length > 0 ? this.maximaMatrix : this.originalLatex;

    if (!dataSource || dataSource.length === 0) {
      console.warn('No hay datos de funciones originales para precalcular');
      return;
    }

    this.cachedOriginalFunctions = [];

    try {
      // Para cada trozo de la función
      dataSource.forEach((piece) => {
        try {
          // Extraer función y rango
          const functionExpr = piece[0]; // Expresión Maxima
          const startX = piece[1]; // Límite inferior en Maxima
          const endX = piece[2]; // Límite superior en Maxima

          console.log(
            `Procesando función: ${functionExpr} en [${startX}, ${endX}]`
          );

          // Convertir la expresión de Maxima a JavaScript
          const jsExpr = this.mathUtilsService.maximaToJS(functionExpr);
          console.log(`Convertida a JS: ${jsExpr}`);

          // Crear una función JavaScript cerrada que no dependa de mathUtilsService
          try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(this.intVar, `return ${jsExpr};`) as (
              x: number
            ) => number;

            // Evaluar límites una sola vez
            const start = this.mathUtilsService.evaluateMaximaExpr(startX, {});
            const end = this.mathUtilsService.evaluateMaximaExpr(endX, {});

            console.log(`Límites evaluados: [${start}, ${end}]`);

            // Verificar que la función es válida evaluándola en un punto de prueba
            try {
              const testPoint = (start + end) / 2;
              const testValue = fn(testPoint);
              console.log(
                `Prueba de función en x=${testPoint}: f(x)=${testValue}`
              );

              if (isFinite(testValue) && !isNaN(testValue)) {
                // Almacenar la función y sus límites en caché
                this.cachedOriginalFunctions.push({
                  fn,
                  start,
                  end,
                });
                console.log('Función añadida a caché con éxito');
              } else {
                console.error(
                  'La función devuelve un valor no numérico en prueba:',
                  testValue
                );
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

  updateTermCount(): void {
    // Método para actualizar el número de términos
    // Si los términos individuales están visibles, actualizar su visualización
    if (this.showIndividualTerms) {
      this.displaySeriesTerms();
    }

    // Redibujar el canvas
    this.redrawCanvas();
  }

  /* LaTeX Processing Methods */
  private prepareLatexFormulas(): void {
    // Preparar fórmulas LaTeX para visualización (adaptado de TrigonometricPiecewiseSeriesComponent)
    if (!this.response || !this.response.latex) return;

    // Limpiamos los delimitadores LaTeX si existen
    const a0 = this.stripLatexDelimiters(this.response.latex.a0 || '');
    const an = this.stripLatexDelimiters(this.response.latex.an || '');
    const bn = this.stripLatexDelimiters(this.response.latex.bn || '');
    const cosine = this.stripLatexDelimiters(
      this.response.latex.cosineCore || ''
    );
    const sine = this.stripLatexDelimiters(this.response.latex.sineCore || '');

    // Asignar valores LaTeX para los coeficientes
    this.latexRendered.a0 = `$$${a0}$$`;
    this.latexRendered.an = `$$${an}$$`;
    this.latexRendered.bn = `$$${bn}$$`;
    if (this.response.latex.w0) {
      this.latexRendered.w0 = `$$${this.stripLatexDelimiters(
        this.response.latex.w0
      )}$$`;
    }

    // Construimos los términos de la suma si no son cero
    const terms = [];

    if (an !== '0') {
      terms.push(`${an} \\cdot ${cosine}`);
    }

    if (bn !== '0') {
      terms.push(`${bn} \\cdot ${sine}`);
    }

    // Formamos la fórmula completa según los coeficientes disponibles
    if (a0 !== '0') {
      this.fullLatexFormula = `$$f(${
        this.intVar
      }) = ${a0} + \\sum_{n=1}^{\\infty} \\left( ${terms.join(
        ' + '
      )} \\right)$$`;
    } else if (terms.length > 0) {
      this.fullLatexFormula = `$$f(${
        this.intVar
      }) = \\sum_{n=1}^{\\infty} \\left( ${terms.join(' + ')} \\right)$$`;
    } else {
      this.fullLatexFormula = `$$f(${this.intVar}) = 0$$`;
    }
  }

  private stripLatexDelimiters(latex: string): string {
    // Método para eliminar delimitadores LaTeX
    return latex
      .replace(/^\$\$?/, '')
      .replace(/\$\$?$/, '')
      .trim();
  }

  /* Series Terms Management Methods */
  fetchIndividualTerms(): void {
    if (!this.response || !this.response.simplified) return;

    // Prepare data for API call
    const data = {
      coefficients: {
        a0: this.response.simplified.a0 || '0',
        an: this.response.simplified.an || '0',
        bn: this.response.simplified.bn || '0',
      },
      w0: this.response.simplified.w0 || '%pi',
      intVar: this.intVar,
      terms: 100, // Always fetch 100 terms
    };

    // Show loading indicator
    const termsContainer = document.getElementById('series-terms-container');
    if (termsContainer) {
      termsContainer.innerHTML =
        '<div class="text-center"><p class="text-white">Calculando términos...</p></div>';
    }

    // Call API to get individual terms
    this.apiService.expandTrigonometricSeries(data).subscribe({
      next: (response) => {
        this.seriesTerms = response;

        // Process and display terms in LaTeX format
        this.termsLatex = [];

        // Store the a0 term
        if (
          response.latex.a0 &&
          response.latex.a0 !== '0' &&
          response.latex.a0 !== '$$0$$'
        ) {
          this.termsLatex.push(response.latex.a0);
        }

        // Add an terms
        if (response.latex.an && response.latex.an.length > 0) {
          this.termsLatex = [...this.termsLatex, ...response.latex.an];
        }

        // Add bn terms
        if (response.latex.bn && response.latex.bn.length > 0) {
          this.termsLatex = [...this.termsLatex, ...response.latex.bn];
        }

        // Create JavaScript functions for each term using mathUtilsService
        this.prepareIndividualTermFunctions();

        // Display terms if toggle is on
        if (this.showIndividualTerms) {
          this.displaySeriesTerms();
        }
      },
      error: (error) => {
        console.error('Error fetching series terms:', error);
        const termsContainer = document.getElementById(
          'series-terms-container'
        );
        if (termsContainer) {
          termsContainer.innerHTML =
            '<div class="text-center text-red-500"><p>Error calculando términos</p></div>';
        }
      },
    });
  }

  displaySeriesTerms(): void {
    // Actualizar el método displaySeriesTerms
    const termsContainer = document.getElementById('series-terms-container');
    if (!termsContainer) return;

    // Clear previous content
    termsContainer.innerHTML = '';

    if (!this.seriesTerms || !this.seriesTerms.latex) {
      termsContainer.innerHTML =
        '<div class="text-center"><p class="text-white">No hay términos para mostrar</p></div>';
      return;
    }

    // Create HTML for terms
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';

    // Add a0/2 term first if present - siempre mostramos este término
    if (
      this.seriesTerms.latex.a0 &&
      this.seriesTerms.latex.a0 !== '0' &&
      this.seriesTerms.latex.a0 !== '$$0$$'
    ) {
      const a0LatexClean = this.stripLatexDelimiters(this.seriesTerms.latex.a0);
      html += `
        <div class="term-card bg-gray-800 border border-gray-700 p-4 rounded-lg shadow">
          <div class="term-title font-semibold mb-2 text-green-300">Término constante (a₀/2)</div>
          <div class="term-latex text-white">$$\\frac{${a0LatexClean}}{2}$$</div>
        </div>
      `;
    }

    // Si termCount es mayor que 0, mostramos los términos combinados
    if (this.termCount > 0) {
      // Determinar el número máximo de términos a mostrar
      const maxTermsToShow = Math.min(
        this.termCount,
        Math.max(
          this.seriesTerms.latex.an?.length || 0,
          this.seriesTerms.latex.bn?.length || 0
        )
      );

      // Mostrar términos combinados (an*cos + bn*sin) para cada n
      for (let n = 1; n <= maxTermsToShow; n++) {
        const index = n - 1;

        // Comprobar si tenemos an y/o bn para este n
        const hasAn =
          index < (this.seriesTerms.latex.an?.length || 0) &&
          this.seriesTerms.latex.an[index] !== '$$0$$';
        const hasBn =
          index < (this.seriesTerms.latex.bn?.length || 0) &&
          this.seriesTerms.latex.bn[index] !== '$$0$$';

        // Si no hay ningún término para este n, continuar con el siguiente
        if (!hasAn && !hasBn) continue;

        // Construir el LaTeX para el término combinado
        let termLatex = '$$';

        if (hasAn) {
          const anLatexClean = this.stripLatexDelimiters(
            this.seriesTerms.latex.an[index]
          );
          termLatex += anLatexClean;
        }

        if (hasAn && hasBn) {
          termLatex += ' + ';
        }

        if (hasBn) {
          const bnLatexClean = this.stripLatexDelimiters(
            this.seriesTerms.latex.bn[index]
          );
          termLatex += bnLatexClean;
        }

        termLatex += '$$';

        // Construir el título del término
        let termTitle = `Término ${n}: `;

        if (hasAn) {
          termTitle += `a${n}·cos(${n}ω₀${this.intVar})`;
        }

        if (hasAn && hasBn) {
          termTitle += ' + ';
        }

        if (hasBn) {
          termTitle += `b${n}·sin(${n}ω₀${this.intVar})`;
        }

        // Agregar el término a la visualización
        html += `
          <div class="term-card bg-gray-800 border border-gray-700 p-4 rounded-lg shadow">
            <div class="term-title font-semibold mb-2 text-green-300">${termTitle}</div>
            <div class="term-latex text-white">${termLatex}</div>
          </div>
        `;
      }
    }

    html += '</div>';
    termsContainer.innerHTML = html;

    // Render LaTeX
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 100);
  }

  prepareIndividualTermFunctions(): void {
    // Reset array of functions
    // Reset array of functions
    this.individualTermFunctions = [];

    // Function to generate colors - a gradient based on the term index
    const getTermColor = (index: number, total: number) => {
      // Parse the hex colors to RGB components
      const parseColor = (hexColor: string) => {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return { r, g, b };
      };

      const startColor = parseColor(this.termsStartColor);
      const endColor = parseColor(this.termsEndColor);

      const ratio = index / (total || 2);

      const r = Math.round(startColor.r + (endColor.r - startColor.r) * ratio);
      const g = Math.round(startColor.g + (endColor.g - startColor.g) * ratio);
      const b = Math.round(startColor.b + (endColor.b - startColor.b) * ratio);

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Siempre añadir el término a0/2, incluso si a0 es 0
    // Esto garantiza que cuando termCount=0, siempre se dibuje la línea en cero
    try {
      // Si a0 existe y no es cero, usarlo. Si no, usar 0 explícitamente
      const a0 =
        this.seriesTerms?.string?.a0 && this.seriesTerms.string.a0 !== '0'
          ? this.mathUtilsService.evaluateMaximaExpr(
              this.seriesTerms.string.a0,
              {}
            )
          : 0;

      // El término constante es a0/2
      const a0Term = (x: number) => a0 / 2;
      this.individualTermFunctions.push({
        fn: a0Term,
        color: getTermColor(
          0,
          Math.max(
            this.seriesTerms?.string?.an?.length || 0,
            this.seriesTerms?.string?.bn?.length || 0
          ) + 1
        ),
      });
    } catch (error) {
      console.error('Error creating a0 term function:', error);
      // Incluso en caso de error, añadimos un término constante cero
      this.individualTermFunctions.push({
        fn: () => 0,
        color: getTermColor(0, 1),
      });
    }

    // Determinar el número máximo de términos
    const maxTerms = Math.max(
      this.seriesTerms?.string?.an?.length || 0,
      this.seriesTerms?.string?.bn?.length || 0
    );

    // Referencias a las indeterminaciones (si existen)
    const indetAN = this.response?.indeterminateValues?.an || [];
    const indetBN = this.response?.indeterminateValues?.bn || [];

    // Crear términos combinados (an*cos + bn*sin) para cada n
    for (let n = 1; n <= maxTerms; n++) {
      try {
        const anIndex = n - 1;
        const bnIndex = n - 1;

        let anTerm: ((x: number) => number) | null = null;
        let bnTerm: ((x: number) => number) | null = null;

        // Verificar si el coeficiente an es indeterminado en este n
        const anIndet = indetAN.find((item) => item.n === n);

        // Crear función para el término an*cos si existe o tiene límite
        if (anIndet) {
          // Usar el valor del límite si existe indeterminación
          const anLimit = anIndet.limit;
          const jsExpr = this.mathUtilsService.maximaToJS(anLimit);
          try {
            // Crear la función combinada con el límite y cos(nx)
            const limitVal = this.mathUtilsService.evaluateMaximaExpr(
              anLimit,
              {}
            );
            anTerm = (x: number) => limitVal * Math.cos(n * this.cachedW0 * x);
          } catch (error) {
            console.error(`Error evaluando límite an para n=${n}:`, error);
          }
        } else if (
          anIndex < (this.seriesTerms?.string?.an?.length || 0) &&
          this.seriesTerms.string.an[anIndex] !== '0'
        ) {
          // Evaluación normal si no hay indeterminación
          const anExpr = this.seriesTerms.string.an[anIndex];
          const jsExpr = this.mathUtilsService.maximaToJS(anExpr);
          anTerm = new Function(this.intVar, `return ${jsExpr};`) as (
            x: number
          ) => number;
        }

        // Verificar si el coeficiente bn es indeterminado en este n
        const bnIndet = indetBN.find((item) => item.n === n);

        // Crear función para el término bn*sin si existe o tiene límite
        if (bnIndet) {
          // Usar el valor del límite si existe indeterminación
          const bnLimit = bnIndet.limit;
          const jsExpr = this.mathUtilsService.maximaToJS(bnLimit);
          try {
            // Crear la función combinada con el límite y sin(nx)
            const limitVal = this.mathUtilsService.evaluateMaximaExpr(
              bnLimit,
              {}
            );
            bnTerm = (x: number) => limitVal * Math.sin(n * this.cachedW0 * x);
          } catch (error) {
            console.error(`Error evaluando límite bn para n=${n}:`, error);
          }
        } else if (
          bnIndex < (this.seriesTerms?.string?.bn?.length || 0) &&
          this.seriesTerms.string.bn[bnIndex] !== '0'
        ) {
          // Evaluación normal si no hay indeterminación
          const bnExpr = this.seriesTerms.string.bn[bnIndex];
          const jsExpr = this.mathUtilsService.maximaToJS(bnExpr);
          bnTerm = new Function(this.intVar, `return ${jsExpr};`) as (
            x: number
          ) => number;
        }

        // Si al menos uno de los términos existe, crear la función combinada
        if (anTerm || bnTerm) {
          // Función que combina ambos términos
          const combinedTerm = (x: number): number => {
            let result = 0;
            if (anTerm) result += anTerm(x);
            if (bnTerm) result += bnTerm(x);
            return result;
          };

          this.individualTermFunctions.push({
            fn: combinedTerm,
            color: getTermColor(n, maxTerms + 1),
          });
        }
      } catch (error) {
        console.error(`Error creating combined term for n=${n}:`, error);
      }
    }
  }

  updateTermColors(): void {
    this.prepareIndividualTermFunctions();
    this.redrawWithIndividualTerms();
  }

  toggleIndividualTerms(show: boolean): void {
    // Method to toggle showing individual terms on the graph
    this.showIndividualTerms = show;

    // Update UI to show/hide terms
    if (show) {
      this.displaySeriesTerms();
    }

    // Redibujar el canvas para mostrar/ocultar los términos individuales
    this.redrawCanvas();
  }

  redrawWithIndividualTerms(): void {
    // Method to redraw the graph with individual terms
    // Simplemente llamamos a redrawCanvas que ya incluye la lógica para términos individuales
    this.redrawCanvas();
  }

  /* Utility Methods */
  private getPlotConfig(): PlotConfig {
    // Método auxiliar para obtener la configuración del plot
    return {
      ctx: this.cartesianCanvas.ctx,
      width: this.cartesianCanvas.width,
      height: this.cartesianCanvas.height,
      origin: this.cartesianCanvas.origin,
      offsetX: this.cartesianCanvas.offsetX,
      offsetY: this.cartesianCanvas.offsetY,
      unit: this.cartesianCanvas.unit,
      xAxisScale: this.xAxisScale,
      xAxisFactor: this.xAxisFactor,
    };
  }

  updateAxisScale(): void {
    // Actualiza el factor según la escala seleccionada
    if (this.xAxisScale === 'pi') {
      this.xAxisFactor = Math.PI;
    } else if (this.xAxisScale === 'e') {
      this.xAxisFactor = Math.E;
    } else {
      this.xAxisFactor = 1;
    }

    // Actualiza la escala en el componente cartesianCanvas
    if (this.cartesianCanvas) {
      this.cartesianCanvas.setXAxisScale(this.xAxisScale);
      // No necesitas llamar a redrawFunctions porque setXAxisScale ya redibuja el canvas
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

      // Dark theme colors - an canvas
      this.anBgColor = '#1A1A2E';
      this.anAxisColor = '#B794F4';
      this.anGridColor = '#553C9A';

      // Dark theme colors - bn canvas
      this.bnBgColor = '#2A1E17';
      this.bnAxisColor = '#F6AD55';
      this.bnGridColor = '#9C4221';
    } else {
      // Light theme colors - Main canvas
      this.bgColor = '#f8fafc';
      this.axisColor = '#3b82f6';
      this.gridColor = '#93c5fd';
      this.fontColor = '#334155';

      // Light theme colors - an canvas
      this.anBgColor = '#F5F7FF';
      this.anAxisColor = '#805AD5';
      this.anGridColor = '#D6BCFA';

      // Light theme colors - bn canvas
      this.bnBgColor = '#FFFAF0';
      this.bnAxisColor = '#ED8936';
      this.bnGridColor = '#FEEBC8';
    }
  }

  // Add this method to draw amplitude graphs
  drawAmplitudeGraphs(): void {
    if (!this.showAmplitudeGraphs || !this.cachedACoefs || !this.cachedBCoefs)
      return;

    // Limpiar puntos anteriores
    this.anPoints = [];
    this.bnPoints = [];

    // Inicializar referencias a los tooltips si no existen
    if (!this.anTooltip) {
      this.anTooltip = document.getElementById('anTooltip');
    }
    if (!this.bnTooltip) {
      this.bnTooltip = document.getElementById('bnTooltip');
    }

    // Dibujar gráfico de an
    if (this.anCanvas) {
      this.anCanvas.clearCanvas();

      // Encontrar el valor máximo absoluto para escalar adecuadamente
      const maxAbsValue = Math.max(
        ...this.cachedACoefs
          .slice(0, Math.min(100, this.cachedACoefs.length))
          .map((val) => Math.abs(val))
      );

      // Mostrar los valores de an como barras discretas con efecto de blur
      for (let i = 0; i < Math.min(100, this.cachedACoefs.length); i++) {
        const n = i + 1; // n comienza en 1
        const height = this.cachedACoefs[i];

        // Usar un método personalizado para dibujar con blur
        this.drawDiscreteLineWithBlur(
          this.anCanvas,
          n,
          0,
          height,
          this.anColor,
          this.anLineWidth,
          true
        );

        // Guardar la posición y valor del punto para tooltip
        const pixelPos = this.canvasCoordToPixel(this.anCanvas, n, height);
        if (pixelPos) {
          this.anPoints.push({
            n,
            x: pixelPos.x,
            y: pixelPos.y,
            value: height,
          });
        }
      }

      // Añadir etiqueta para el valor máximo
      // if (maxAbsValue > 0) {
      //   this.addOverlayLabel('anCanvas', `Max: ${maxAbsValue.toFixed(4)}`);
      // }
    }

    // Configuración similar para bn
    if (this.bnCanvas) {
      this.bnCanvas.clearCanvas();

      const maxAbsValue = Math.max(
        ...this.cachedBCoefs
          .slice(0, Math.min(100, this.cachedBCoefs.length))
          .map((val) => Math.abs(val))
      );

      for (let i = 0; i < Math.min(100, this.cachedBCoefs.length); i++) {
        const n = i + 1;
        const height = this.cachedBCoefs[i];

        this.drawDiscreteLineWithBlur(
          this.bnCanvas,
          n,
          0,
          height,
          this.bnColor,
          this.bnLineWidth,
          true
        );

        const pixelPos = this.canvasCoordToPixel(this.bnCanvas, n, height);
        if (pixelPos) {
          this.bnPoints.push({
            n,
            x: pixelPos.x,
            y: pixelPos.y,
            value: height,
          });
        }
      }

      // if (maxAbsValue > 0) {
      //   this.addOverlayLabel('bnCanvas', `Max: ${maxAbsValue.toFixed(4)}`);
      // }
    }

    // Configurar los eventos de mouse para los tooltips
    this.setupAmplitudeCanvasEvents();
  }

  // Método auxiliar para dibujar líneas discretas con efecto de blur
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
    // Esta función es un wrapper para drawDiscreteLine
    // que agrega efectos visuales adicionales

    if (!canvas || !canvas.ctx) return;

    const ctx = canvas.ctx;
    const origin = canvas.origin;
    const unit = canvas.unit;
    const offsetX = canvas.offsetX;
    const offsetY = canvas.offsetY;

    // Calcular coordenadas en píxeles
    const xPx = origin.x - offsetX + unit * startX;
    const y0Px = origin.y - offsetY - unit * startY;
    const yEndPx = origin.y - offsetY - unit * (startY + height);

    // Guardar estado actual del contexto
    ctx.save();

    // Aplicar blur si está activado
    if (applyBlur) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 1.5;
      ctx.globalAlpha = 0.9;
    }

    // Si está destacado, aplicar un efecto más pronunciado
    if (isHighlighted) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.globalAlpha = 1;
      lineWidth += 0.5; // Hacerlo ligeramente más grueso
    }

    // Dibujar línea vertical
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(xPx, y0Px);
    ctx.lineTo(xPx, yEndPx);
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Dibujar punto en el extremo con efecto brillante
    ctx.beginPath();
    ctx.arc(xPx, yEndPx, isHighlighted ? 6 : 5, 0, 2 * Math.PI);
    ctx.stroke();

    // Añadir un pequeño relleno para el punto
    ctx.fillStyle = color;
    ctx.globalAlpha = isHighlighted ? 0.5 : 0.3;
    ctx.fill();

    // Restaurar estado original del contexto
    ctx.restore();
  }

  // Método para convertir coordenadas matemáticas a coordenadas de píxeles
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

    // Convertir de unidades matemáticas a píxeles
    const pixelX = origin.x - offsetX + unit * x;
    const pixelY = origin.y - offsetY - unit * y;

    return { x: pixelX, y: pixelY };
  }

  // Configurar eventos de mouse para los tooltips
  private setupAmplitudeCanvasEvents(): void {
    if (!this.anCanvas || !this.bnCanvas) return;

    // Obtener elementos DOM
    const anCanvasElement = document.getElementById('anCanvas');
    const bnCanvasElement = document.getElementById('bnCanvas');

    if (!anCanvasElement || !bnCanvasElement) return;

    // Función auxiliar para comprobar si el mouse está cerca de un tallo
    const isNearStem = (
      mouseX: number,
      mouseY: number,
      stemX: number,
      stemY0: number,
      stemY1: number,
      threshold: number
    ): boolean => {
      // Si el mouse está fuera del rango vertical del tallo, no está cerca
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

    // Eventos para anCanvas
    anCanvasElement.onmousemove = (event: MouseEvent) => {
      const rect = anCanvasElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Comprobar cercanía a algún tallo o punto
      const threshold = 12; // Umbral más amplio para detectar todo el tallo
      let closestPoint = null;
      let minDistance = Infinity;
      let isCloseToStem = false;

      for (const point of this.anPoints) {
        // Convertir coordenadas del punto a píxeles
        const stemX = point.x;
        const stemEndY = point.y;

        // Calcular Y0 (origen del tallo, generalmente Y=0)
        const origin = this.anCanvas.origin;
        const offsetY = this.anCanvas.offsetY;
        const unit = this.anCanvas.unit;
        const stemStartY = origin.y - offsetY - unit * 0; // 0 es el valor Y inicial

        // Comprobar si el mouse está cerca del tallo
        if (
          isNearStem(mouseX, mouseY, stemX, stemStartY, stemEndY, threshold)
        ) {
          isCloseToStem = true;

          // También determinamos el punto más cercano para mostrar el tooltip
          const dx = mouseX - stemX;
          const dy = mouseY - stemEndY; // Distancia al punto final (donde está el valor)
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
          }
        }
      }

      // Si está cerca de algún tallo
      if (isCloseToStem && closestPoint && this.anTooltip) {
        // Mostrar tooltip
        this.anTooltip.innerHTML = `a<sub>${
          closestPoint.n
        }</sub>: ${closestPoint.value.toFixed(6)}`;
        this.anTooltip.style.left = `${closestPoint.x}px`;
        this.anTooltip.style.top = `${closestPoint.y}px`;
        this.anTooltip.classList.add('visible');

        // Primero redibujar todos los puntos con blur normal
        this.drawAmplitudeGraphs();

        // Luego resaltar solo el tallo seleccionado
        this.drawDiscreteLineWithBlur(
          this.anCanvas,
          closestPoint.n,
          0,
          closestPoint.value,
          this.anColor,
          this.anLineWidth + 0.5,
          false,
          true // Indicador de que está resaltado
        );
      } else if (this.anTooltip) {
        // Ocultar tooltip si no hay tallo cercano
        this.anTooltip.classList.remove('visible');

        // Redibujar todos los puntos con blur normal
        this.drawAmplitudeGraphs();
      }
    };

    // Código similar para bnCanvas
    bnCanvasElement.onmousemove = (event: MouseEvent) => {
      const rect = bnCanvasElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Comprobar cercanía a algún tallo o punto
      const threshold = 12; // Umbral más amplio para detectar todo el tallo
      let closestPoint = null;
      let minDistance = Infinity;
      let isCloseToStem = false;

      for (const point of this.bnPoints) {
        // Convertir coordenadas del punto a píxeles
        const stemX = point.x;
        const stemEndY = point.y;

        // Calcular Y0 (origen del tallo, generalmente Y=0)
        const origin = this.bnCanvas.origin;
        const offsetY = this.bnCanvas.offsetY;
        const unit = this.bnCanvas.unit;
        const stemStartY = origin.y - offsetY - unit * 0; // 0 es el valor Y inicial

        // Comprobar si el mouse está cerca del tallo
        if (
          isNearStem(mouseX, mouseY, stemX, stemStartY, stemEndY, threshold)
        ) {
          isCloseToStem = true;

          // También determinamos el punto más cercano para mostrar el tooltip
          const dx = mouseX - stemX;
          const dy = mouseY - stemEndY; // Distancia al punto final (donde está el valor)
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
          }
        }
      }

      // Si está cerca de algún tallo
      if (isCloseToStem && closestPoint && this.bnTooltip) {
        // Mostrar tooltip
        this.bnTooltip.innerHTML = `b<sub>${
          closestPoint.n
        }</sub>: ${closestPoint.value.toFixed(6)}`;
        this.bnTooltip.style.left = `${closestPoint.x}px`;
        this.bnTooltip.style.top = `${closestPoint.y}px`;
        this.bnTooltip.classList.add('visible');

        // Primero redibujar todos los puntos con blur normal
        this.drawAmplitudeGraphs();

        // Luego resaltar solo el tallo seleccionado
        this.drawDiscreteLineWithBlur(
          this.bnCanvas,
          closestPoint.n,
          0,
          closestPoint.value,
          this.bnColor,
          this.bnLineWidth + 0.5,
          false,
          true // Indicador de que está resaltado
        );
      } else if (this.bnTooltip) {
        // Ocultar tooltip si no hay tallo cercano
        this.bnTooltip.classList.remove('visible');

        // Redibujar todos los puntos con blur normal
        this.drawAmplitudeGraphs();
      }
    };

    // Gestores de eventos para salir del canvas
    anCanvasElement.onmouseleave = () => {
      if (this.anTooltip) {
        this.anTooltip.classList.remove('visible');
        // Redibujar sin resaltado
        this.drawAmplitudeGraphs();
      }
    };

    bnCanvasElement.onmouseleave = () => {
      if (this.bnTooltip) {
        this.bnTooltip.classList.remove('visible');
        // Redibujar sin resaltado
        this.drawAmplitudeGraphs();
      }
    };
  }

  // Helper method to add labels as overlays since drawText isn't available
  // private addOverlayLabel(canvasId: string, text: string): void {
  //   const canvasElement = document.getElementById(canvasId);
  //   if (!canvasElement) return;

  //   // Find existing label or create a new one
  //   let label = document.getElementById(`${canvasId}-label`);
  //   if (!label) {
  //     label = document.createElement('div');
  //     label.id = `${canvasId}-label`;
  //     label.style.position = 'absolute';
  //     label.style.top = '10px';
  //     label.style.right = '15px';
  //     label.style.padding = '4px 8px';
  //     label.style.borderRadius = '4px';
  //     label.style.fontSize = '12px';
  //     label.style.fontWeight = 'bold';
  //     label.style.background = 'rgba(0,0,0,0.7)';
  //     label.style.zIndex = '10';

  //     // Set color based on canvas
  //     label.style.color = canvasId === 'anCanvas' ? this.anColor : this.bnColor;

  //     // Add to the parent container of the canvas
  //     const parent = canvasElement.parentElement;
  //     if (parent) {
  //       parent.style.position = 'relative';
  //       parent.appendChild(label);
  //     }
  //   }

  //   // Update text
  //   if (label) {
  //     label.textContent = text;
  //   }
  // }
  // Añadir este método a TrigComponent
  private setupAmplitudeCanvasZoomEvents(): void {
    if (this.anCanvas && this.anCanvas.canvasElement?.nativeElement) {
      const anCanvas = this.anCanvas.canvasElement.nativeElement;

      // Crear un nuevo manejador de wheel que primero ejecute el original y luego redibuje
      const originalWheel = anCanvas.onwheel;
      anCanvas.onwheel = (event: WheelEvent) => {
        // Llamar al manejador original
        if (originalWheel) originalWheel.call(anCanvas, event);

        // Redibujar después de un breve retraso para permitir que se actualice el canvas
        setTimeout(() => this.drawAmplitudeGraphs(), 0);
      };
    }

    if (this.bnCanvas && this.bnCanvas.canvasElement?.nativeElement) {
      const bnCanvas = this.bnCanvas.canvasElement.nativeElement;

      // Crear un nuevo manejador de wheel que primero ejecute el original y luego redibuje
      const originalWheel = bnCanvas.onwheel;
      bnCanvas.onwheel = (event: WheelEvent) => {
        // Llamar al manejador original
        if (originalWheel) originalWheel.call(bnCanvas, event);

        // Redibujar después de un breve retraso para permitir que se actualice el canvas
        setTimeout(() => this.drawAmplitudeGraphs(), 0);
      };
    }
  }
}
