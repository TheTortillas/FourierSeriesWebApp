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
import { FourierResponse } from '../../interfaces/fourier-response.interface';
import { MathquillService } from '../../core/services/mathquill/mathquill.service';
import { MathUtilsService } from '../../core/services/maximaToJS/math-utils.service';
import { PlotConfig } from '../../interfaces/plot-config.interface';
import { ApiService } from '../../core/services/api/api.service';

@Component({
  selector: 'app-fourier-series-plot',
  standalone: true,
  imports: [CommonModule, FormsModule, CartesianCanvasComponent],
  templateUrl: './fourier-series-plot.component.html',
  styleUrls: ['./fourier-series-plot.component.scss'],
})
export class FourierSeriesPlotComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('cartesianCanvas') cartesianCanvas!: CartesianCanvasComponent;

  public sidenavOpen = true;

  // Datos de la serie
  public response: FourierResponse | null = null;
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
    private apiService: ApiService
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
  }

  ngAfterViewInit(): void {
    // Renderizar MathJax
    setTimeout(() => {
      this.mathquillService.renderMathJax();
      this.initializeCanvas();
    }, 100);
  }

  ngOnDestroy(): void {
    // Limpieza si es necesaria
  }

  /* Navigation and UI Control Methods */
  toggleSidenav(): void {
    // Método para alternar el sidenav
    this.sidenavOpen = !this.sidenavOpen;
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
    // Método para implementar el redibujado sin resetear la vista
    this.redrawFunctions();
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
    if (this.termCount === 0 && this.individualTermFunctions.length > 0) {
      // Asumimos que el primer término es a0/2
      const { fn, color } = this.individualTermFunctions[0];
      this.cartesianCanvas.drawFunction(fn, color, this.termsLineWidth);
    } else {
      // Para termCount > 0, mostramos los términos correspondientes
      // El primer término siempre es a0/2, luego los siguientes son los términos de la serie
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

  // Modificar el método prepareIndividualTermFunctions para manejar valores indeterminados
  prepareIndividualTermFunctions(): void {
    // Reset array of functions
    this.individualTermFunctions = [];
  
    // Function to generate colors - a gradient based on the term index
    const getTermColor = (index: number, total: number) => {
      // Start with blue (RGB: 25, 64, 175) and end with red (RGB: 239, 68, 68)
      const startR = 25,
        startG = 64,
        startB = 175;
      const endR = 239,
        endG = 68,
        endB = 68;
  
      const ratio = index / (total || 2);
  
      const r = Math.round(startR + (endR - startR) * ratio);
      const g = Math.round(startG + (endG - startG) * ratio);
      const b = Math.round(startB + (endB - startB) * ratio);
  
      return `rgb(${r}, ${g}, ${b})`;
    };
  
    // Add a0/2 term first if present (término constante)
    if (this.seriesTerms?.string?.a0 && this.seriesTerms.string.a0 !== '0') {
      try {
        const a0 = this.mathUtilsService.evaluateMaximaExpr(
          this.seriesTerms.string.a0,
          {}
        );
        // The constant term is a0/2
        const a0Term = (x: number) => a0 / 2;
        this.individualTermFunctions.push({
          fn: a0Term,
          color: getTermColor(
            0,
            Math.max(
              this.seriesTerms.string.an?.length || 0,
              this.seriesTerms.string.bn?.length || 0
            ) + 1
          ),
        });
      } catch (error) {
        console.error('Error creating a0 term function:', error);
      }
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
            const limitVal = this.mathUtilsService.evaluateMaximaExpr(anLimit, {});
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
            const limitVal = this.mathUtilsService.evaluateMaximaExpr(bnLimit, {});
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
    };
  }
}
