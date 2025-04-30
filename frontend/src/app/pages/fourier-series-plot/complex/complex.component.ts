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
import { ComplexResponse } from '../../../interfaces/complex-response.interface';
import { MathquillService } from '../../../core/services/mathquill/mathquill.service';
import { MathUtilsService } from '../../../core/services/maximaToJS/math-utils.service';
import { ApiService } from '../../../core/services/api/api.service';
import { ThemeService } from '../../../core/services/theming/theme.service';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { SurveyButtonComponent } from '../../../shared/components/survey-button/survey-button.component';

import { Subscription } from 'rxjs';

@Component({
  selector: 'app-complex',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CartesianCanvasComponent,
    ThemeToggleComponent,
    SurveyButtonComponent,
  ],
  templateUrl: './complex.component.html',
  styleUrl: './complex.component.scss',
})
export class ComplexComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cartesianCanvas') cartesianCanvas!: CartesianCanvasComponent;
  @ViewChild('cnCanvas') cnCanvas!: CartesianCanvasComponent;
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

  // Datos de la serie
  public response: ComplexResponse | null = null;
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
  public termsStartColor: string = '#1940af'; // Azul inicial
  public termsEndColor: string = '#ef4444'; // Rojo final

  public functionLineWidth: number = 2; // Grosor para la función original
  public seriesLineWidth: number = 2;

  // Para formateo de LaTeX
  public latexRendered: any = {
    c0: '',
    cn: '',
    w0: '',
    T: '',
  };

  public maximaMatrix: string[][] = [];

  // Serie completa en formato LaTeX
  public fullLatexFormula: string = '';

  // Cache de coeficientes precalculados para mejorar rendimiento
  private cachedC0: number = 0;
  private cachedW0: number = 0;
  private cachedCnCoefs: Array<{
    n: number;
    real: number;
    imag: number;
    amplitude: number;
    phase: number;
  }> = [];

  public seriesTerms: any = {
    demoivreTerms: [],
    complexTerms: [],
  };

  public showIndividualTerms: boolean = false;
  private individualTermFunctions: Array<{
    fn: (x: number) => number;
    color: string;
  }> = [];

  public termsLatex: string[] = [];
  public termsLineWidth: number = 2;

  // Amplitude and phase graphs properties
  public showAmplitudePhaseGraphs: boolean = false;
  public cnLineWidth: number = 2;
  public amplitudeLineWidth: number = 2;
  public phaseLineWidth: number = 2;
  public cnColor: string = '#B794F4';
  public amplitudeColor: string = '#F6AD55';
  public phaseColor: string = '#4FD1C5';
  private resizeObserver: ResizeObserver | null = null;

  // Canvas background colors
  public cnBgColor: string = '#1A1A2E';
  public cnAxisColor: string = '#B794F4';
  public cnGridColor: string = '#553C9A';

  public amplitudeBgColor: string = '#2A1E17';
  public amplitudeAxisColor: string = '#F6AD55';
  public amplitudeGridColor: string = '#9C4221';

  public phaseBgColor: string = '#1C2A27';
  public phaseAxisColor: string = '#4FD1C5';
  public phaseGridColor: string = '#2C7A7B';

  // Points for interactivity
  private cnPoints: Array<{
    n: number;
    x: number;
    y: number;
    value: { real: number; imag: number };
  }> = [];
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
  private cnTooltip: HTMLElement | null = null;
  private amplitudeTooltip: HTMLElement | null = null;
  private phaseTooltip: HTMLElement | null = null;

  // Funciones cacheadas para piezas originales
  private cachedOriginalFunctions: Array<{
    fn: (x: number) => number;
    start: number;
    end: number;
  }> = [];

  // Parsed coefficient lists
  public coefficientList: Array<{ n: number; value: string }> = [];
  public amplitudePhaseList: Array<{
    n: number;
    amplitude: string;
    phase: string;
  }> = [];
  public parsedTerms: string[] = [];
  public parsedDemoivreTerms: string[] = [];

  private compiledTermFunctions: Array<(x: number) => number> = [];

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
      this.maximaMatrix = navigation.extras.state['maximaMatrix'];
      this.originalFunction = navigation.extras.state['originalFunction'];

      // Process complex series data
      this.processComplexSeriesData();

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

      // Update all canvases with new colors
      this.updateCanvasColors();
    });

    // Initialize colors based on current theme
    this.updateThemeColors();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.mathquillService.renderMathJax();
      this.initializeCanvas();

      // Initialize amplitude/phase graphs if visible
      if (this.showAmplitudePhaseGraphs) {
        this.drawAmplitudePhaseGraphs();
      }
    }, 100);

    // Setup resize observer for the amplitude/phase canvases
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.showAmplitudePhaseGraphs) {
          setTimeout(() => this.drawAmplitudePhaseGraphs(), 100);
        }
      });

      // Observe containers for canvases
      const canvasIds = ['cnCanvas', 'amplitudeCanvas', 'phaseCanvas'];
      canvasIds.forEach((id) => {
        const canvasElement = document.getElementById(id);
        if (canvasElement && this.resizeObserver)
          this.resizeObserver.observe(canvasElement);
      });
    }
  }

  ngOnDestroy(): void {
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

  /* Process Complex Series Data */
  private processComplexSeriesData(): void {
    if (!this.response || !this.response.simplified) return;

    // Parse coefficient list
    if (this.response.simplified.coefficientList) {
      this.coefficientList = this.apiService.parseCoefficients(
        this.response.simplified.coefficientList
      );
    }

    // Parse amplitude/phase list
    if (this.response.simplified.amplitudePhaseList) {
      this.amplitudePhaseList = this.apiService.parseAmplitudePhase(
        this.response.simplified.amplitudePhaseList
      );
    }

    // Parse terms
    if (this.response.simplified.seriesTerms) {
      this.parsedTerms = this.apiService.parseSeriesTerms(
        this.response.simplified.seriesTerms
      );
    }

    // Parse demoivre terms
    if (this.response.simplified.demoivreTerms) {
      this.parsedDemoivreTerms = this.apiService.parseSeriesTerms(
        this.response.simplified.demoivreTerms
      );
    }
  }

  /* Navigation and UI Control Methods */
  toggleSidenav(): void {
    this.sidenavOpen = !this.sidenavOpen;
  }

  toggleAmplitudePhaseGraphs(show: boolean): void {
    this.showAmplitudePhaseGraphs = show;

    if (show) {
      // Update colors for all canvases
      this.updateCanvasColors();

      setTimeout(() => {
        this.drawAmplitudePhaseGraphs();
        this.setupAmplitudeCanvasEvents();
        this.setupAmplitudeCanvasZoomEvents();
      }, 100);
    }
  }

  goBack(): void {
    this.router.navigate(['/fourier-calculator']);
  }

  exportResults(): void {
    //console.log('Exportar resultados');
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

    if (this.showSeriesApproximation) {
      this.drawSeriesApproximation();
    }

    // Siempre dibujar los términos individuales si están habilitados
    if (this.showIndividualTerms && this.individualTermFunctions.length > 0) {
      this.drawIndividualTerms();
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

    // Draw amplitude/phase graphs if enabled
    if (this.showAmplitudePhaseGraphs) {
      this.drawAmplitudePhaseGraphs();
    }
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

  drawSeriesApproximation(): void {
    if (!this.cartesianCanvas) return;

    try {
      const fourierSeries = (x: number): number => {
        let sum = 0;

        // Usar las funciones precompiladas
        for (
          let i = 0;
          i <= Math.min(this.termCount, this.compiledTermFunctions.length - 1);
          i++
        ) {
          const fn = this.compiledTermFunctions[i];
          if (fn) {
            sum += fn(x);
          }
        }

        return sum;
      };

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
    if (
      !this.cartesianCanvas ||
      !this.showIndividualTerms ||
      this.individualTermFunctions.length === 0
    )
      return;

    // Show terms up to termCount
    const termsToDraw = this.individualTermFunctions.slice(
      0,
      this.termCount + 1
    );

    termsToDraw.forEach(({ fn, color }) => {
      this.cartesianCanvas.drawFunction(fn, color, this.termsLineWidth);
    });
  }

  /* Calculation and Preprocessing Methods */
  private precalculateCoefficients(): void {
    if (!this.response || !this.response.simplified) return;

    try {
      const c0Expr = this.response.simplified.c0 || '0';
      const cnExpr = this.response.simplified.cn || '0';
      const w0Expr = this.response.simplified.w0 || '%pi';

      // Evaluate c0
      try {
        this.cachedC0 = this.mathUtilsService.evaluateMaximaExpr(c0Expr, {});
        //console.log('c0 evaluado:', this.cachedC0);
      } catch (error) {
        console.error('Error evaluando c0:', error);
        this.cachedC0 = 0;
      }

      // Evaluate w0
      try {
        this.cachedW0 = this.mathUtilsService.evaluateMaximaExpr(w0Expr, {});
        //console.log('w0 evaluado:', this.cachedW0);
      } catch (error) {
        console.error('Error evaluando w0:', error);
        this.cachedW0 = Math.PI;
      }

      // Process amplitude and phase data for visualization
      this.cachedCnCoefs = [];

      // Get coefficients from amplitudePhaseList
      for (const item of this.amplitudePhaseList) {
        try {
          const n = item.n;
          const amplitudeValue = this.mathUtilsService.evaluateMaximaExpr(
            item.amplitude,
            {}
          );
          const phaseValue = this.mathUtilsService.evaluateMaximaExpr(
            item.phase,
            {}
          );

          // Convert amplitude and phase to complex form
          const real = amplitudeValue * Math.cos(phaseValue);
          const imag = amplitudeValue * Math.sin(phaseValue);

          this.cachedCnCoefs.push({
            n,
            real,
            imag,
            amplitude: amplitudeValue,
            phase: phaseValue,
          });
        } catch (error) {
          console.error(`Error processing coefficient for n=${item.n}:`, error);
        }
      }

      //console.log('Complex coefficients processed:', this.cachedCnCoefs.length);
    } catch (error) {
      console.error('Error in precalculateCoefficients:', error);
    }
  }

  private precalculateOriginalFunctions(): void {
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

          // Convertir la expresión de Maxima a JavaScript
          const jsExpr = this.mathUtilsService.maximaToJS(functionExpr);

          // Crear una función JavaScript cerrada
          try {
            // eslint-disable-next-line no-new-func
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

      // console.log(
      //   'Funciones originales precalculadas:',
      //   this.cachedOriginalFunctions.length
      // );
    } catch (error) {
      console.error('Error en precalculateOriginalFunctions:', error);
    }
  }

  updateTermCount(): void {
    // Si los términos individuales están visibles, actualizar su visualización
    if (this.showIndividualTerms) {
      this.displaySeriesTerms();
    }

    // Redibujar el canvas
    this.redrawCanvas();
  }

  /* LaTeX Processing Methods */
  private prepareLatexFormulas(): void {
    if (!this.response || !this.response.latex) return;

    // Limpiamos los delimitadores LaTeX si existen
    const c0 = this.stripLatexDelimiters(this.response.latex.c0 || '');
    const cn = this.stripLatexDelimiters(this.response.latex.cn || '');
    const w0 = this.stripLatexDelimiters(this.response.latex.w0 || '');
    const T = this.stripLatexDelimiters(this.response.latex.T || '');
    const expPos = this.stripLatexDelimiters(
      this.response.latex.series_exp_core_pos || ''
    );
    const expNeg = this.stripLatexDelimiters(
      this.response.latex.series_exp_core_neg || ''
    );

    // Asignar valores LaTeX para los coeficientes
    this.latexRendered.c0 = `$$${c0}$$`;
    this.latexRendered.cn = `$$${cn}$$`;
    this.latexRendered.w0 = `$$${w0}$$`;
    this.latexRendered.T = `$$${T}$$`;

    // Build the full complex series formula
    this.buildCompleteSeriesFormula(c0, cn, expPos);
  }

  /**
   * Builds the complete complex Fourier series formula with the calculated coefficients
   * @param c0 The c0 coefficient in LaTeX format
   * @param cn The cn coefficient formula in LaTeX format
   * @param expCore The exponential core in LaTeX format
   */
  private buildCompleteSeriesFormula(
    c0: string,
    cn: string,
    expCore: string
  ): void {
    // Check if coefficients are available
    if (!c0 || !cn) {
      this.fullLatexFormula = '';
      return;
    }

    // Parse w0 for display in formula
    const w0Str = this.stripLatexDelimiters(this.response?.latex?.w0 || '1');
    let w0Display: string;

    // Format w0 based on its value (similar to trigonometric component)
    if (w0Str === '1') {
      // When w0 = 1, we don't need to show it in the formula
      w0Display = '';
    } else if (w0Str.includes('\\frac')) {
      // Handle fraction case
      w0Display = w0Str;
    } else if (w0Str === '\\pi') {
      // Handle pi case
      w0Display = '\\pi';
    } else {
      // Default case
      w0Display = w0Str;
    }

    // Create the full formula with summation notation
    this.fullLatexFormula = `$$f(${this.intVar}) = \\sum_{n=-\\infty}^{\\infty}{}`;

    // Replace 'n' in cn with actual variable
    // First, replace with temporary placeholder to avoid conflicts
    const cnWithVar = cn.replace(/n/g, '_VAR_');

    // Get the exponential core from the response
    let expCoreLatex = this.stripLatexDelimiters(
      this.response?.latex?.series_exp_core_pos || ''
    );

    // If series_exp_core_pos is not available, use default format
    if (!expCoreLatex) {
      const angularFreq =
        w0Display === '' ? this.intVar : `${w0Display} ${this.intVar}`;
      expCoreLatex = `e^{i\\,n\\,${angularFreq}}`;
    } else {
      // Replace any variable placeholders in the exponential core
      expCoreLatex = expCoreLatex.replace(/VAR/g, this.intVar);
    }

    // Build the formula: c_n * e^{i n w0 x}
    let termFormula =
      cnWithVar.replace(/_VAR_/g, 'n') + ' \\cdot ' + expCoreLatex;

    // Add term to complete formula
    this.fullLatexFormula += termFormula + '$$';
  }

  private stripLatexDelimiters(latex: string): string {
    return latex
      .replace(/^\$\$?/, '')
      .replace(/\$\$?$/, '')
      .trim();
  }

  /* Series Terms Management Methods */
  fetchIndividualTerms(): void {
    // In complex series, we already have the terms from response.smplified.demoivreTerms
    // We just need to prepare the JavaScript functions for each term
    this.precompileTermFunctions();
    this.prepareIndividualTermFunctions();

    // Display terms if toggle is on
    if (this.showIndividualTerms) {
      this.displaySeriesTerms();
    }
  }

  displaySeriesTerms(): void {
    const termsContainer = document.getElementById('series-terms-container');
    if (!termsContainer) return;

    termsContainer.innerHTML = '';

    if (!this.parsedDemoivreTerms || this.parsedDemoivreTerms.length === 0) {
      termsContainer.innerHTML =
        '<div class="text-center"><p class="text-white">No hay términos para mostrar</p></div>';
      return;
    }

    // Create HTML for terms
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';

    // Add c0 term first (constant term)
    const c0Term = this.parsedDemoivreTerms[0];
    const c0LatexClean = this.response?.latex?.c0
      ? this.stripLatexDelimiters(this.response.latex.c0)
      : c0Term;

    html += `
      <div class="term-card bg-gray-800 border border-gray-700 p-4 rounded-lg shadow">
        <div class="term-title font-semibold mb-2 text-green-300">Término constante (c₀)</div>
        <div class="term-latex text-white">$$${c0LatexClean}$$</div>
      </div>
    `;

    // Show additional terms up to termCount
    for (
      let i = 1;
      i <= Math.min(this.termCount, this.parsedDemoivreTerms.length - 1);
      i++
    ) {
      const term = this.parsedDemoivreTerms[i];

      // Get LaTeX from seriesExpansionLatex if available
      const termLatex = this.response?.seriesExpansionLatex?.demoivreTerms?.[i]
        ? this.stripLatexDelimiters(
            this.response.seriesExpansionLatex.demoivreTerms[i]
          )
        : term;

      html += `
        <div class="term-card bg-gray-800 border border-gray-700 p-4 rounded-lg shadow">
          <div class="term-title font-semibold mb-2 text-green-300">Término ${i}</div>
          <div class="term-latex text-white">$$${termLatex}$$</div>
        </div>
      `;
    }

    html += '</div>';
    termsContainer.innerHTML = html;

    // Render LaTeX
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 100);
  }

  prepareIndividualTermFunctions(): void {
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

      const ratio = index / (total || 1);

      const r = Math.round(startColor.r + (endColor.r - startColor.r) * ratio);
      const g = Math.round(startColor.g + (endColor.g - startColor.g) * ratio);
      const b = Math.round(startColor.b + (endColor.b - startColor.b) * ratio);

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Convert each demoivre term to a JavaScript function
    this.parsedDemoivreTerms.forEach((term, index) => {
      try {
        const jsExpr = this.mathUtilsService.maximaToJS(term);
        const fn = new Function(this.intVar, `return ${jsExpr};`) as (
          x: number
        ) => number;

        // Test the function to ensure it's valid
        try {
          const testValue = fn(0);
          if (!isNaN(testValue) && isFinite(testValue)) {
            this.individualTermFunctions.push({
              fn,
              color: getTermColor(index, this.parsedDemoivreTerms.length),
            });
          }
        } catch (evalError) {
          console.error(`Error testing term ${index}:`, evalError);
        }
      } catch (error) {
        console.error(`Error creating function for term ${index}:`, error);
      }
    });

    // console.log(
    //   `Created ${this.individualTermFunctions.length} individual term functions`
    // );
  }

  toggleIndividualTerms(show: boolean): void {
    this.showIndividualTerms = show;

    // Update UI to show/hide terms
    if (show) {
      this.displaySeriesTerms();
    }

    // Redraw canvas
    this.redrawCanvas();
  }

  updateTermColors(): void {
    this.prepareIndividualTermFunctions();
    this.redrawCanvas();
  }

  /* Coefficient visualization methods */
  drawAmplitudePhaseGraphs(): void {
    if (!this.showAmplitudePhaseGraphs) return;

    // Clear previous data
    this.cnPoints = [];
    this.amplitudePoints = [];
    this.phasePoints = [];

    // Initialize tooltips if they don't exist
    if (!this.cnTooltip) this.cnTooltip = document.getElementById('cnTooltip');
    if (!this.amplitudeTooltip)
      this.amplitudeTooltip = document.getElementById('amplitudeTooltip');
    if (!this.phaseTooltip)
      this.phaseTooltip = document.getElementById('phaseTooltip');

    // Draw cn graph (magnitude of complex coefficients)
    if (this.cnCanvas && this.cachedCnCoefs.length > 0) {
      this.cnCanvas.clearCanvas();

      // Draw positive and negative indices
      for (const coef of this.cachedCnCoefs) {
        // Calculate magnitude for complex number
        const magnitude = Math.sqrt(
          coef.real * coef.real + coef.imag * coef.imag
        );

        // Draw stem for the coefficient
        this.drawDiscreteLineWithBlur(
          this.cnCanvas,
          coef.n, // n can be positive or negative
          0,
          magnitude,
          this.cnColor,
          this.cnLineWidth,
          true
        );

        // Store point data for tooltip
        const pixelPos = this.canvasCoordToPixel(
          this.cnCanvas,
          coef.n,
          magnitude
        );
        if (pixelPos) {
          this.cnPoints.push({
            n: coef.n,
            x: pixelPos.x,
            y: pixelPos.y,
            value: { real: coef.real, imag: coef.imag },
          });
        }
      }
    }

    // Draw amplitude graph
    if (this.amplitudeCanvas && this.cachedCnCoefs.length > 0) {
      this.amplitudeCanvas.clearCanvas();

      // Only plot positive indices for amplitude
      const positiveCoefs = this.cachedCnCoefs.filter((coef) => coef.n >= 0);

      for (const coef of positiveCoefs) {
        this.drawDiscreteLineWithBlur(
          this.amplitudeCanvas,
          coef.n,
          0,
          coef.amplitude,
          this.amplitudeColor,
          this.amplitudeLineWidth,
          true
        );

        const pixelPos = this.canvasCoordToPixel(
          this.amplitudeCanvas,
          coef.n,
          coef.amplitude
        );
        if (pixelPos) {
          this.amplitudePoints.push({
            n: coef.n,
            x: pixelPos.x,
            y: pixelPos.y,
            value: coef.amplitude,
          });
        }
      }
    }

    // Draw phase graph
    if (this.phaseCanvas && this.cachedCnCoefs.length > 0) {
      this.phaseCanvas.clearCanvas();

      // Only plot positive indices for phase
      const positiveCoefs = this.cachedCnCoefs.filter((coef) => coef.n >= 0);

      for (const coef of positiveCoefs) {
        this.drawDiscreteLineWithBlur(
          this.phaseCanvas,
          coef.n,
          0,
          coef.phase,
          this.phaseColor,
          this.phaseLineWidth,
          true
        );

        const pixelPos = this.canvasCoordToPixel(
          this.phaseCanvas,
          coef.n,
          coef.phase
        );
        if (pixelPos) {
          this.phasePoints.push({
            n: coef.n,
            x: pixelPos.x,
            y: pixelPos.y,
            value: coef.phase,
          });
        }
      }
    }
  }

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

  private setupAmplitudeCanvasEvents(): void {
    // Get DOM elements
    const canvasElements = {
      cn: document.getElementById('cnCanvas'),
      amplitude: document.getElementById('amplitudeCanvas'),
      phase: document.getElementById('phaseCanvas'),
    };

    // Helper function to check if mouse is near a stem
    const isNearStem = (
      mouseX: number,
      mouseY: number,
      stemX: number,
      stemY0: number,
      stemY1: number,
      threshold: number
    ): boolean => {
      // If mouse is outside vertical range of stem, it's not near
      if (
        mouseY < Math.min(stemY0, stemY1) - threshold ||
        mouseY > Math.max(stemY0, stemY1) + threshold
      ) {
        return false;
      }

      // Calculate horizontal distance to stem
      const distance = Math.abs(mouseX - stemX);
      return distance < threshold;
    };

    // Setup events for cn canvas
    if (canvasElements.cn && this.cnTooltip) {
      canvasElements.cn.onmousemove = (event: MouseEvent) => {
        const rect = canvasElements.cn!.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Check if mouse is near any stem
        const threshold = 12;
        let closestPoint = null;
        let minDistance = Infinity;
        let isCloseToStem = false;

        for (const point of this.cnPoints) {
          const stemX = point.x;
          const stemEndY = point.y;

          // Calculate Y0 (origin of stem, usually Y=0)
          const origin = this.cnCanvas.origin;
          const offsetY = this.cnCanvas.offsetY;
          const unit = this.cnCanvas.unit;
          const stemStartY = origin.y - offsetY - unit * 0;

          if (
            isNearStem(mouseX, mouseY, stemX, stemStartY, stemEndY, threshold)
          ) {
            isCloseToStem = true;

            // Find closest point for tooltip
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
          // Format complex number for display
          const realPart = closestPoint.value.real.toFixed(6);
          const imagPart = closestPoint.value.imag.toFixed(6);
          const imagSign = closestPoint.value.imag >= 0 ? '+' : '';

          // Show tooltip
          this.cnTooltip!.innerHTML = `c<sub>${closestPoint.n}</sub> = ${realPart} ${imagSign} ${imagPart}i`;
          this.cnTooltip!.style.left = `${closestPoint.x}px`;
          this.cnTooltip!.style.top = `${closestPoint.y}px`;
          this.cnTooltip!.classList.add('visible');

          // Redraw with highlight
          this.drawAmplitudePhaseGraphs();

          const coef = this.cachedCnCoefs.find((c) => c.n === closestPoint!.n);
          if (coef) {
            const magnitude = Math.sqrt(
              coef.real * coef.real + coef.imag * coef.imag
            );
            this.drawDiscreteLineWithBlur(
              this.cnCanvas,
              coef.n,
              0,
              magnitude,
              this.cnColor,
              this.cnLineWidth + 0.5,
              false,
              true
            );
          }
        } else if (this.cnTooltip) {
          // Hide tooltip if no stem is nearby
          this.cnTooltip.classList.remove('visible');
          this.drawAmplitudePhaseGraphs();
        }
      };

      // Mouse leave event
      canvasElements.cn.onmouseleave = () => {
        if (this.cnTooltip) {
          this.cnTooltip.classList.remove('visible');
          this.drawAmplitudePhaseGraphs();
        }
      };
    }

    // Setup similar events for amplitude canvas
    if (canvasElements.amplitude && this.amplitudeTooltip) {
      // Similar event handling code as above but for amplitude points
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
          this.amplitudeTooltip!.innerHTML = `|c<sub>${
            closestPoint.n
          }</sub>| = ${closestPoint.value.toFixed(6)}`;
          this.amplitudeTooltip!.style.left = `${closestPoint.x}px`;
          this.amplitudeTooltip!.style.top = `${closestPoint.y}px`;
          this.amplitudeTooltip!.classList.add('visible');

          this.drawAmplitudePhaseGraphs();

          const coef = this.cachedCnCoefs.find((c) => c.n === closestPoint!.n);
          if (coef) {
            this.drawDiscreteLineWithBlur(
              this.amplitudeCanvas,
              coef.n,
              0,
              coef.amplitude,
              this.amplitudeColor,
              this.amplitudeLineWidth + 0.5,
              false,
              true
            );
          }
        } else if (this.amplitudeTooltip) {
          this.amplitudeTooltip.classList.remove('visible');
          this.drawAmplitudePhaseGraphs();
        }
      };

      canvasElements.amplitude.onmouseleave = () => {
        if (this.amplitudeTooltip) {
          this.amplitudeTooltip.classList.remove('visible');
          this.drawAmplitudePhaseGraphs();
        }
      };
    }

    // Setup similar events for phase canvas
    if (canvasElements.phase && this.phaseTooltip) {
      // Similar event handling code as above but for phase points
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
          // Convert phase to degrees for display
          const phaseDegrees = ((closestPoint.value * 180) / Math.PI).toFixed(
            2
          );

          this.phaseTooltip!.innerHTML = `∠c<sub>${closestPoint.n}</sub> = ${phaseDegrees}°`;
          this.phaseTooltip!.style.left = `${closestPoint.x}px`;
          this.phaseTooltip!.style.top = `${closestPoint.y}px`;
          this.phaseTooltip!.classList.add('visible');

          this.drawAmplitudePhaseGraphs();

          const coef = this.cachedCnCoefs.find((c) => c.n === closestPoint!.n);
          if (coef) {
            this.drawDiscreteLineWithBlur(
              this.phaseCanvas,
              coef.n,
              0,
              coef.phase,
              this.phaseColor,
              this.phaseLineWidth + 0.5,
              false,
              true
            );
          }
        } else if (this.phaseTooltip) {
          this.phaseTooltip.classList.remove('visible');
          this.drawAmplitudePhaseGraphs();
        }
      };

      canvasElements.phase.onmouseleave = () => {
        if (this.phaseTooltip) {
          this.phaseTooltip.classList.remove('visible');
          this.drawAmplitudePhaseGraphs();
        }
      };
    }
  }

  private setupAmplitudeCanvasZoomEvents(): void {
    const canvasElements = [
      { canvas: this.cnCanvas, elementId: 'cnCanvas' },
      { canvas: this.amplitudeCanvas, elementId: 'amplitudeCanvas' },
      { canvas: this.phaseCanvas, elementId: 'phaseCanvas' },
    ];

    for (const { canvas, elementId } of canvasElements) {
      if (canvas && canvas.canvasElement?.nativeElement) {
        const canvasEl = canvas.canvasElement.nativeElement;

        // Create wheel handler that calls original handler then redraws
        const originalWheel = canvasEl.onwheel;
        canvasEl.onwheel = (event: WheelEvent) => {
          // Call original handler
          if (originalWheel) originalWheel.call(canvasEl, event);

          // Redraw after a small delay to allow canvas update
          setTimeout(() => this.drawAmplitudePhaseGraphs(), 0);
        };
      }
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

    // Update cn canvas colors
    if (this.cnCanvas) {
      this.cnCanvas.bgColor = this.cnBgColor;
      this.cnCanvas.axisColor = this.cnAxisColor;
      this.cnCanvas.gridColor = this.cnGridColor;
      this.cnCanvas.fontColor = this.fontColor;
    }

    // Update amplitude canvas colors
    if (this.amplitudeCanvas) {
      this.amplitudeCanvas.bgColor = this.amplitudeBgColor;
      this.amplitudeCanvas.axisColor = this.amplitudeAxisColor;
      this.amplitudeCanvas.gridColor = this.amplitudeGridColor;
      this.amplitudeCanvas.fontColor = this.fontColor;
    }

    // Update phase canvas colors
    if (this.phaseCanvas) {
      this.phaseCanvas.bgColor = this.phaseBgColor;
      this.phaseCanvas.axisColor = this.phaseAxisColor;
      this.phaseCanvas.gridColor = this.phaseGridColor;
      this.phaseCanvas.fontColor = this.fontColor;
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

      // Dark theme colors - cn canvas
      this.cnBgColor = '#1A1A2E';
      this.cnAxisColor = '#B794F4';
      this.cnGridColor = '#553C9A';

      // Dark theme colors - amplitude canvas
      this.amplitudeBgColor = '#2A1E17';
      this.amplitudeAxisColor = '#F6AD55';
      this.amplitudeGridColor = '#9C4221';

      // Dark theme colors - phase canvas
      this.phaseBgColor = '#1C2A27';
      this.phaseAxisColor = '#4FD1C5';
      this.phaseGridColor = '#2C7A7B';
    } else {
      // Light theme colors - Main canvas
      this.bgColor = '#f8fafc';
      this.axisColor = '#3b82f6';
      this.gridColor = '#93c5fd';
      this.fontColor = '#334155';

      // Light theme colors - cn canvas
      this.cnBgColor = '#F5F7FF';
      this.cnAxisColor = '#805AD5';
      this.cnGridColor = '#D6BCFA';

      // Light theme colors - amplitude canvas
      this.amplitudeBgColor = '#FFFAF0';
      this.amplitudeAxisColor = '#ED8936';
      this.amplitudeGridColor = '#FEEBC8';

      // Light theme colors - phase canvas
      this.phaseBgColor = '#F0FFF4';
      this.phaseAxisColor = '#38B2AC';
      this.phaseGridColor = '#B2F5EA';
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

  private printAllCoefficients(): void {
    // Esperar un momento para asegurar que los coeficientes estén calculados
    setTimeout(() => {
      console.group(
        'Coeficientes Serie de Fourier Compleja - Valores numéricos'
      );
      //console.log('c0:', this.cachedC0);
      //console.log('w0:', this.cachedW0);

      // Crear un objeto para mostrar todos los coeficientes de manera estructurada
      const allCoefficients = {
        c0: this.cachedC0,
        w0: this.cachedW0,
        cn: this.cachedCnCoefs,
      };

      // Show cn coefficients
      console.table(this.cachedCnCoefs);

      // También puedes crear un arreglo con todos los valores para exportación
      const exportData = {
        c0: this.cachedC0,
        w0: this.cachedW0,
        cn: this.cachedCnCoefs,
      };

      // Almacenar en una propiedad para posible uso posterior (descarga, etc.)
      this.coefficientsData = exportData;

      //console.log('Datos completos para exportación:', exportData);
      console.groupEnd();
    }, 500);
  }

  public coefficientsData: any = null;

  private precompileTermFunctions(): void {
    this.compiledTermFunctions = [];

    if (this.parsedDemoivreTerms && this.parsedDemoivreTerms.length > 0) {
      for (const term of this.parsedDemoivreTerms) {
        try {
          const jsExpr = this.mathUtilsService.maximaToJS(term);
          const fn = new Function(this.intVar, `return ${jsExpr};`) as (
            x: number
          ) => number;

          // Verificar que la función es válida
          try {
            const testValue = fn(0);
            if (!isNaN(testValue) && isFinite(testValue)) {
              this.compiledTermFunctions.push(fn);
            } else {
              this.compiledTermFunctions.push(() => 0);
            }
          } catch (evalError) {
            console.error('Error evaluando función:', evalError);
            this.compiledTermFunctions.push(() => 0);
          }
        } catch (error) {
          console.error(`Error compilando función:`, error);
          this.compiledTermFunctions.push(() => 0);
        }
      }
    }
  }

  // Add these properties to control the modal
  public showSeriesTermsModal: boolean = false;
  public allTermsHtml: string = '';

  // Add the displayAllSeriesTermsInModal method
  displayAllSeriesTermsInModal(): void {
    // Show the modal dialog
    this.showSeriesTermsModal = true;

    // Check if we have term data available
    if (!this.response || !this.response.latex) {
      this.allTermsHtml =
        '<div class="py-4 text-center"><p>No hay términos para mostrar</p></div>';
      return;
    }

    // Define styles based on theme
    const cardStyle = this.isDarkMode
      ? 'bg-gray-800 border border-gray-700 text-white'
      : 'bg-white border border-gray-200 text-gray-800';

    const titleStyle = this.isDarkMode ? 'text-purple-300' : 'text-purple-600';
    const secondaryTitleStyle = this.isDarkMode
      ? 'text-teal-300'
      : 'text-teal-600';

    // Extract complex terms and demoivre terms from the response
    const termsLatex = this.parseTermsArray(this.response.latex.terms);
    const demoivreLatex = this.parseTermsArray(
      this.response.latex.demoivreTerms
    );

    // Generate HTML with both forms of terms
    let html = `<div class="grid grid-cols-1 gap-4 max-w-full">`;

    // Loop through terms and display both forms
    const maxTerms = Math.min(termsLatex.length, demoivreLatex.length);

    for (let i = 0; i < maxTerms; i++) {
      const complexTerm = this.stripLatexDelimiters(termsLatex[i]);
      const simplifiedTerm = this.stripLatexDelimiters(demoivreLatex[i]);

      html += `
        <div class="term-card ${cardStyle} p-4 rounded-lg shadow">
          <div class="term-title font-semibold mb-2 ${titleStyle}">$$\\text{Término ${i}}$$</div>
          
          <div class="mb-3">
            <div class="text-sm font-medium mb-1 ${secondaryTitleStyle}">Forma compleja:</div>
            <div class="term-latex pl-3 border-l-2 border-purple-500">$$${complexTerm}$$</div>
          </div>
          
          <div>
            <div class="text-sm font-medium mb-1 ${secondaryTitleStyle}">Forma simplificada (DeMoivre):</div>
            <div class="term-latex pl-3 border-l-2 border-teal-500">$$${simplifiedTerm}$$</div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    this.allTermsHtml = html;

    // Render LaTeX after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 200);
  }

  // Helper method to close the modal
  closeSeriesTermsModal(): void {
    this.showSeriesTermsModal = false;
  }

  // Updated helper method to handle both string and array
  private parseTermsArray(latexData: string | string[] | undefined): string[] {
    if (!latexData) return [];

    // If it's already an array, return it directly
    if (Array.isArray(latexData)) {
      return latexData;
    }

    // If it's a string, parse it as before
    const cleanedLatex = latexData
      .replace(/^\$\$/, '')
      .replace(/\$\$$/, '')
      .replace(/\\left\[/, '')
      .replace(/\\right\]/, '')
      .trim();

    // Split by commas, but handle nested expressions properly
    const terms: string[] = [];
    let currentTerm = '';
    let nestedLevel = 0;

    for (let i = 0; i < cleanedLatex.length; i++) {
      const char = cleanedLatex[i];

      if (char === '{') nestedLevel++;
      else if (char === '}') nestedLevel--;

      if (char === ',' && nestedLevel === 0) {
        terms.push(currentTerm.trim());
        currentTerm = '';
      } else {
        currentTerm += char;
      }
    }

    // Add the last term
    if (currentTerm.trim()) {
      terms.push(currentTerm.trim());
    }

    return terms;
  }
}
