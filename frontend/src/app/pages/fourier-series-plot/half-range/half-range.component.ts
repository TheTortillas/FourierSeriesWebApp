import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CartesianCanvasComponent } from '../../../shared/components/cartesian-canvas/cartesian-canvas.component';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { MathquillService } from '../../../core/services/mathquill/mathquill.service';
import { MathUtilsService } from '../../../core/services/maximaToJS/math-utils.service';
import { ApiService } from '../../../core/services/api/api.service';
import { ThemeService } from '../../../core/services/theming/theme.service';
import { FourierResponse } from '../../../interfaces/fourier-response.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-half-range',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CartesianCanvasComponent,
    ThemeToggleComponent,
  ],
  templateUrl: './half-range.component.html',
  styleUrls: ['./half-range.component.scss'],
})
export class HalfRangeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cartesianCanvas') cartesianCanvas!: CartesianCanvasComponent;

  // Propiedades generales similares a TrigComponent
  public sidenavOpen = true;
  public isDarkMode = true;
  private themeSubscription: Subscription | null = null;

  // Propiedades de colores para el canvas
  public bgColor: string = '#222';
  public axisColor: string = '#90DCB5';
  public gridColor: string = '#6BBCAC';
  public fontColor: string = '#EBEBEB';

  // Configuración del eje X
  public xAxisScale: 'integer' | 'pi' | 'e' = 'integer';
  public xAxisFactor: number = 1;

  // Datos de la serie
  public response: FourierResponse | null = null;
  public seriesType: string = '';
  public intVar: string = 'x';
  public originalLatex: string[][] = [];
  public maximaMatrix: string[][] = [];
  public originalFunction: string = '';

  // Variables específicas para medio rango
  public activeSeriesType: 'cosine' | 'sine' = 'cosine'; // Para alternar entre serie coseno y serie seno
  public termCount: number = 0;
  public showOriginalFunction: boolean = true;
  public showSeriesApproximation: boolean = true;

  // Colores para las gráficas
  public functionColor: string = '#ddb3ff'; // Color para función original
  public cosineSeriesColor: string = '#ff8585'; // Color para serie coseno
  public sineSeriesColor: string = '#85a5ff'; // Color para serie seno

  // Propiedades para términos individuales
  public termsStartColor: string = '#1940af';
  public termsEndColor: string = '#ef4444';
  public functionLineWidth: number = 2;
  public seriesLineWidth: number = 2;

  // Para formateo de LaTeX
  public latexRendered: any = {
    a0: '',
    an: '',
    bn: '',
    w0: '',
  };

  // Serie completa en formato LaTeX
  public cosineLatexFormula: string = '';
  public sineLatexFormula: string = '';

  // Cache de coeficientes precalculados
  private cachedA0: number = 0;
  private cachedW0: number = 0;
  private cachedACoefs: number[] = [];
  private cachedBCoefs: number[] = [];

  // Términos individuales
  public showIndividualTerms: boolean = false;
  private cosineTermFunctions: Array<{
    fn: (x: number) => number;
    color: string;
  }> = [];
  private sineTermFunctions: Array<{
    fn: (x: number) => number;
    color: string;
  }> = [];

  public termsLatex: { cosine: string[]; sine: string[] } = {
    cosine: [],
    sine: [],
  };
  public termsLineWidth: number = 2;

  // Funciones originales
  private cachedOriginalFunctions: Array<{
    fn: (x: number) => number;
    start: number;
    end: number;
  }> = [];

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

      // Generar fórmulas LaTeX para los resultados
      this.prepareLatexFormulas();
    } else {
      // Redirigir si no hay datos
      this.router.navigate(['/fourier-calculator']);
    }
  }

  ngOnInit(): void {
    // Similar al componente TrigComponent pero adaptado para medio rango
    this.precalculateCoefficients();
    this.precalculateOriginalFunctions();
    this.fetchIndividualTerms();

    // Suscribirse a cambios de tema
    this.themeSubscription = this.themeService.darkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
      this.updateThemeColors();

      if (this.cartesianCanvas) {
        this.cartesianCanvas.bgColor = this.bgColor;
        this.cartesianCanvas.axisColor = this.axisColor;
        this.cartesianCanvas.gridColor = this.gridColor;
        this.cartesianCanvas.fontColor = this.fontColor;

        this.cartesianCanvas.clearCanvas();
        this.redrawFunctions();
      }
    });

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

  // Métodos para UI y navegación
  toggleSidenav(): void {
    this.sidenavOpen = !this.sidenavOpen;
  }

  goBack(): void {
    this.router.navigate(['/fourier-calculator']);
  }

  // Método para cambiar entre serie coseno y serie seno
  toggleSeriesType(type: 'cosine' | 'sine'): void {
    this.activeSeriesType = type;
    
    // Redibujar el canvas con la nueva serie activa
    this.redrawCanvas();
    
    // Actualizar visualización de términos si están mostrados
    if (this.showIndividualTerms) {
      this.displaySeriesTerms();
    }
    
    // Re-renderizar las fórmulas LaTeX para asegurar que se muestren correctamente
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 100);
  }

  // Métodos para dibujo
  redrawFunctions(): void {
    if (!this.cartesianCanvas) return;

    this.cartesianCanvas.clearCanvas();

    if (this.showOriginalFunction) {
      this.drawOriginalFunction();
    }

    if (this.showSeriesApproximation) {
      this.drawSeriesApproximation();
    }

    if (this.showIndividualTerms) {
      this.drawIndividualTerms();
    }
  }

  initializeCanvas(): void {
    if (!this.cartesianCanvas) return;

    this.cartesianCanvas.clearCanvas();
    this.cartesianCanvas.resetView();

    this.redrawFunctions();
  }

  redrawCanvas(): void {
    this.redrawFunctions();
  }

  // Método para dibujar la función original
  drawOriginalFunction(): void {
    if (!this.cartesianCanvas) return;

    try {
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

  // Método para dibujar la serie de medio rango seleccionada
  drawSeriesApproximation(): void {
    if (!this.cartesianCanvas) return;

    try {
      // Determinar qué serie dibujar según el tipo activo
      if (this.activeSeriesType === 'cosine') {
        // Dibujar serie coseno: a0/2 + sum(an * cos(n*w0*x))
        const cosineSeries = (x: number): number => {
          // Comenzar con el término constante a0/2
          let sum = this.cachedA0 / 2;

          // Si termCount es 0, solo mostramos el término constante
          if (this.termCount === 0) {
            return sum;
          }

          // Sumar términos de coseno
          for (let n = 1; n <= this.termCount; n++) {
            const idx = n - 1;
            if (
              idx < this.cachedACoefs.length &&
              this.cachedACoefs[idx] !== 0
            ) {
              sum += this.cachedACoefs[idx] * Math.cos(n * this.cachedW0 * x);
            }
          }

          return sum;
        };

        // Dibujar la serie coseno
        this.cartesianCanvas.drawFunction(
          cosineSeries,
          this.cosineSeriesColor,
          this.seriesLineWidth
        );
      } else {
        // Dibujar serie seno: sum(bn * sin(n*w0*x))
        const sineSeries = (x: number): number => {
          // Serie seno no tiene término constante
          let sum = 0;

          // Si termCount es 0, mostrar línea en cero
          if (this.termCount === 0) {
            return sum;
          }

          // Sumar términos de seno
          for (let n = 1; n <= this.termCount; n++) {
            const idx = n - 1;
            if (
              idx < this.cachedBCoefs.length &&
              this.cachedBCoefs[idx] !== 0
            ) {
              sum += this.cachedBCoefs[idx] * Math.sin(n * this.cachedW0 * x);
            }
          }

          return sum;
        };

        // Dibujar la serie seno
        this.cartesianCanvas.drawFunction(
          sineSeries,
          this.sineSeriesColor,
          this.seriesLineWidth
        );
      }
    } catch (error) {
      console.error(
        `Error al dibujar la serie de ${this.activeSeriesType}:`,
        error
      );
    }
  }

  // Método para dibujar términos individuales
  drawIndividualTerms(): void {
    if (!this.cartesianCanvas || !this.showIndividualTerms) {
      console.log('Canvas no disponible o términos no activos');
      return;
    }

    try {
      // console.log(
      //   'Dibujando términos individuales para tipo:',
      //   this.activeSeriesType
      // );
      // console.log('Cosine terms:', this.cosineTermFunctions.length);
      // console.log('Sine terms:', this.sineTermFunctions.length);

      // Seleccionar la lista de términos según el tipo activo
      const termFunctions =
        this.activeSeriesType === 'cosine'
          ? this.cosineTermFunctions
          : this.sineTermFunctions;

      if (!termFunctions || termFunctions.length === 0) {
        console.warn('No hay términos disponibles para dibujar');
        return;
      }

      if (this.activeSeriesType === 'cosine') {
        // Para serie coseno: siempre dibujamos a0/2
        if (termFunctions.length > 0) {
          const a0Term = termFunctions[0];
          // console.log('Dibujando término a0/2');
          this.cartesianCanvas.drawFunction(
            a0Term.fn,
            a0Term.color,
            this.termsLineWidth
          );
        }

        // Dibujar los términos an*cos según el valor de termCount
        if (this.termCount > 0) {
          // Solo dibujamos hasta el número de términos seleccionado o disponible
          for (
            let i = 1;
            i <= Math.min(this.termCount, termFunctions.length - 1);
            i++
          ) {
            if (i < termFunctions.length) {
              // console.log(`Dibujando término an*cos con n=${i}`);
              const { fn, color } = termFunctions[i];
              this.cartesianCanvas.drawFunction(fn, color, this.termsLineWidth);
            }
          }
        }
      } else {
        // Para serie seno: no hay término constante
        if (this.termCount > 0) {
          // Solo dibujamos hasta el número de términos seleccionado o disponible
          for (
            let i = 0;
            i < Math.min(this.termCount, termFunctions.length);
            i++
          ) {
            // console.log(`Dibujando término bn*sin con n=${i + 1}`);
            const { fn, color } = termFunctions[i];
            this.cartesianCanvas.drawFunction(fn, color, this.termsLineWidth);
          }
        }
      }
    } catch (error) {
      console.error('Error en drawIndividualTerms:', error);
    }
  }

  // Método para precalcular coeficientes (similar a TrigComponent pero adaptado)
  private precalculateCoefficients(): void {
    if (!this.response || !this.response.simplified) return;

    try {
      const a0Expr = this.response.simplified.a0 || '0';
      const anExpr = this.response.simplified.an || '0';
      const bnExpr = this.response.simplified.bn || '0';
      const w0Expr = this.response.simplified.w0 || '%pi';

      // Evaluar a0
      try {
        this.cachedA0 = this.mathUtilsService.evaluateMaximaExpr(a0Expr, {});
      } catch (error) {
        console.error('Error evaluando a0:', error);
        this.cachedA0 = 0;
      }

      // Evaluar w0
      try {
        this.cachedW0 = this.mathUtilsService.evaluateMaximaExpr(w0Expr, {});
      } catch (error) {
        console.error('Error evaluando w0:', error);
        this.cachedW0 = Math.PI;
      }

      // Precalcular coeficientes an y bn
      const maxTerms = 100;
      this.cachedACoefs = [];
      this.cachedBCoefs = [];

      // Manejar indeterminaciones
      const indetAN = this.response.indeterminateValues?.an || [];
      const indetBN = this.response.indeterminateValues?.bn || [];

      // Precalcular an
      if (anExpr !== '0') {
        for (let n = 1; n <= maxTerms; n++) {
          try {
            const match = indetAN.find((item) => item.n === n);
            if (match) {
              const limitVal = this.mathUtilsService.evaluateMaximaExpr(
                match.limit,
                {}
              );
              this.cachedACoefs.push(limitVal);
            } else {
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
        this.cachedACoefs = Array(maxTerms).fill(0);
      }

      // Precalcular bn
      if (bnExpr !== '0') {
        for (let n = 1; n <= maxTerms; n++) {
          try {
            const match = indetBN.find((item) => item.n === n);
            if (match) {
              const limitVal = this.mathUtilsService.evaluateMaximaExpr(
                match.limit,
                {}
              );
              this.cachedBCoefs.push(limitVal);
            } else {
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
        this.cachedBCoefs = Array(maxTerms).fill(0);
      }
    } catch (error) {
      console.error('Error en precalculateCoefficients:', error);
    }
  }

  // Método para precalcular funciones originales (similar a TrigComponent)
  private precalculateOriginalFunctions(): void {
    // Código similar al de TrigComponent
    const dataSource =
      this.maximaMatrix.length > 0 ? this.maximaMatrix : this.originalLatex;

    if (!dataSource || dataSource.length === 0) {
      console.warn('No hay datos de funciones originales para precalcular');
      return;
    }

    this.cachedOriginalFunctions = [];

    try {
      dataSource.forEach((piece) => {
        try {
          const functionExpr = piece[0];
          const startX = piece[1];
          const endX = piece[2];

          const jsExpr = this.mathUtilsService.maximaToJS(functionExpr);

          try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(this.intVar, `return ${jsExpr};`) as (
              x: number
            ) => number;

            const start = this.mathUtilsService.evaluateMaximaExpr(startX, {});
            const end = this.mathUtilsService.evaluateMaximaExpr(endX, {});

            const testPoint = (start + end) / 2;
            const testValue = fn(testPoint);

            if (isFinite(testValue) && !isNaN(testValue)) {
              this.cachedOriginalFunctions.push({
                fn,
                start,
                end,
              });
            }
          } catch (error) {
            console.error('Error procesando función:', error);
          }
        } catch (error) {
          console.error('Error al precalcular función original:', error);
        }
      });
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

  // Método para preparar fórmulas LaTeX
  private prepareLatexFormulas(): void {
    if (!this.response || !this.response.latex) return;

    // Limpiamos los delimitadores LaTeX
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

    // Formular serie coseno
    if (a0 !== '0') {
      if (an !== '0') {
        this.cosineLatexFormula = `$$f_c(${this.intVar}) = \\frac{${a0}}{2} + \\sum_{n=1}^{\\infty} ${an} \\cdot ${cosine}$$`;
      } else {
        this.cosineLatexFormula = `$$f_c(${this.intVar}) = \\frac{${a0}}{2}$$`;
      }
    } else if (an !== '0') {
      this.cosineLatexFormula = `$$f_c(${this.intVar}) = \\sum_{n=1}^{\\infty} ${an} \\cdot ${cosine}$$`;
    } else {
      this.cosineLatexFormula = `$$f_c(${this.intVar}) = 0$$`;
    }

    // Formular serie seno
    if (bn !== '0') {
      this.sineLatexFormula = `$$f_s(${this.intVar}) = \\sum_{n=1}^{\\infty} ${bn} \\cdot ${sine}$$`;
    } else {
      this.sineLatexFormula = `$$f_s(${this.intVar}) = 0$$`;
    }
  }

  // Método para eliminar delimitadores LaTeX
  private stripLatexDelimiters(latex: string): string {
    return latex
      .replace(/^\$\$?/, '')
      .replace(/\$\$?$/, '')
      .trim();
  }

  fetchIndividualTerms(): void {
    if (!this.response || !this.response.simplified) {
      console.warn('No hay respuesta o datos simplificados');
      return;
    }
  
    // Mostrar loading
    const termsContainer = document.getElementById('series-terms-container');
    if (termsContainer) {
      termsContainer.innerHTML = '<div class="text-center p-4"><p>Calculando términos...</p></div>';
    }
  
    // Intentar usar los términos directamente desde la respuesta
    // No necesitamos llamar al API nuevamente si ya tenemos los datos
    try {
      // Procesar y mostrar términos en LaTeX
      this.prepareIndividualTermFunctions({
        string: {
          a0: this.response.simplified.a0,
          an: this.response.simplified.an,
          bn: this.response.simplified.bn
        },
        latex: {
          a0: this.response.latex?.a0,
          an: [],  // Se llenará en displaySeriesTerms según necesidades
          bn: []   // Se llenará en displaySeriesTerms según necesidades
        }
      });
  
      // Mostrar términos si el toggle está activado
      if (this.showIndividualTerms) {
        this.displaySeriesTerms();
      }
      
      // Redibujar el canvas
      this.redrawCanvas();
    } catch (error) {
      console.error('Error preparando términos individuales:', error);
      if (termsContainer) {
        termsContainer.innerHTML = '<div class="text-center text-red-500 p-4"><p>Error calculando términos</p></div>';
      }
    }
  }

  // Método para preparar funciones de términos individuales
  prepareIndividualTermFunctions(seriesTerms: any): void {
    // console.log('Preparando funciones para términos individuales', seriesTerms);

    // Resetear arrays
    this.cosineTermFunctions = [];
    this.sineTermFunctions = [];

    // Función para generar colores
    const getTermColor = (index: number, total: number) => {
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

    // --- Serie Coseno ---
    // Agregar término a0/2 para la serie coseno
    try {
      const a0 =
        seriesTerms?.string?.a0 && seriesTerms.string.a0 !== '0'
          ? this.mathUtilsService.evaluateMaximaExpr(seriesTerms.string.a0, {})
          : 0;

      // Término constante a0/2
      const a0Term = (x: number) => a0 / 2;
      this.cosineTermFunctions.push({
        fn: a0Term,
        color: getTermColor(0, 100), // Usamos un valor fijo grande para mejor distribución de colores
      });
      // console.log('Agregado término a0/2 con valor:', a0 / 2);
    } catch (error) {
      console.error('Error creating a0 term function:', error);
      this.cosineTermFunctions.push({
        fn: () => 0,
        color: getTermColor(0, 100),
      });
    }

    // --- Serie Coseno: Términos an*cos(n*w0*x) ---
    if (this.response?.simplified?.an && this.response.simplified.an !== '0') {
      const anExpr = this.response.simplified.an;
      const w0 = this.cachedW0;

      // console.log(`Expresión an: ${anExpr}, w0: ${w0}`);

      // Generar términos an*cos para n=1 hasta 50
      for (let n = 1; n <= 100; n++) {
        try {
          // Verificar si hay indeterminaciones para este n
          const anIndet = this.response.indeterminateValues?.an?.find(
            (item) => item.n === n
          );

          let anVal;
          if (anIndet) {
            // Usar el valor de límite para indeterminación
            anVal = this.mathUtilsService.evaluateMaximaExpr(anIndet.limit, {});
            // console.log(`Usando valor de límite para an con n=${n}: ${anVal}`);
          } else {
            // Evaluar an con el valor específico de n
            anVal = this.mathUtilsService.evaluateMaximaExpr(anExpr, { n });
          }

          if (!isNaN(anVal) && isFinite(anVal)) {
            // Crear función para an*cos(n*w0*x)
            const anCosTerm = (x: number) => anVal * Math.cos(n * w0 * x);

            this.cosineTermFunctions.push({
              fn: anCosTerm,
              color: getTermColor(n, 100),
            });
            // console.log(`Agregado término an*cos con n=${n}: ${anVal}`);
          } else {
            console.warn(`Valor no válido para an con n=${n}: ${anVal}`);
          }
        } catch (error) {
          console.error(`Error al evaluar an para n=${n}:`, error);
        }
      }
    } else {
      console.log('No hay términos an (coeficientes = 0 o indefinidos)');
    }

    // --- Serie Seno: Términos bn*sin(n*w0*x) ---
    if (this.response?.simplified?.bn && this.response.simplified.bn !== '0') {
      const bnExpr = this.response.simplified.bn;
      const w0 = this.cachedW0;

      // console.log(`Expresión bn: ${bnExpr}, w0: ${w0}`);

      // Generar términos bn*sin para n=1 hasta 50
      for (let n = 1; n <= 100; n++) {
        try {
          // Verificar si hay indeterminaciones para este n
          const bnIndet = this.response.indeterminateValues?.bn?.find(
            (item) => item.n === n
          );

          let bnVal;
          if (bnIndet) {
            // Usar el valor de límite para indeterminación
            bnVal = this.mathUtilsService.evaluateMaximaExpr(bnIndet.limit, {});
            // console.log(`Usando valor de límite para bn con n=${n}: ${bnVal}`);
          } else {
            // Evaluar bn con el valor específico de n
            bnVal = this.mathUtilsService.evaluateMaximaExpr(bnExpr, { n });
          }

          if (!isNaN(bnVal) && isFinite(bnVal)) {
            // Crear función para bn*sin(n*w0*x)
            const bnSinTerm = (x: number) => bnVal * Math.sin(n * w0 * x);

            this.sineTermFunctions.push({
              fn: bnSinTerm,
              color: getTermColor(n - 1, 100),
            });
            // console.log(`Agregado término bn*sin con n=${n}: ${bnVal}`);
          } else {
            console.warn(`Valor no válido para bn con n=${n}: ${bnVal}`);
          }
        } catch (error) {
          console.error(`Error al evaluar bn para n=${n}:`, error);
        }
      }
    } else {
      console.log('No hay términos bn (coeficientes = 0 o indefinidos)');
    }

    // console.log(
    //   `Total términos generados - Coseno: ${this.cosineTermFunctions.length}, Seno: ${this.sineTermFunctions.length}`
    // );
  }
  // Método para mostrar términos individuales en la UI
  displaySeriesTerms(): void {
    const termsContainer = document.getElementById('series-terms-container');
    if (!termsContainer) return;

    termsContainer.innerHTML = '';

    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';

    // Mostrar términos según el tipo de serie activo
    if (this.activeSeriesType === 'cosine') {
      // Mostrar término constante a0/2 si existe
      if (
        this.termsLatex.cosine.length > 0 &&
        this.termsLatex.cosine[0] !== '$$0$$'
      ) {
        const a0LatexClean = this.stripLatexDelimiters(
          this.termsLatex.cosine[0]
        );
        html += `
          <div class="term-card bg-gray-800 border border-gray-700 p-4 rounded-lg shadow">
            <div class="term-title font-semibold mb-2 text-green-300">Término constante (a₀/2)</div>
            <div class="term-latex text-white">$$\\frac{${a0LatexClean}}{2}$$</div>
          </div>
        `;
      }

      // Mostrar términos an*cos
      if (this.termCount > 0) {
        const maxTermsToShow = Math.min(
          this.termCount,
          this.termsLatex.cosine.length - 1
        );

        for (let n = 1; n <= maxTermsToShow; n++) {
          // Índice en termsLatex.cosine (el primero es a0)
          const index = n;

          if (
            index < this.termsLatex.cosine.length &&
            this.termsLatex.cosine[index] !== '$$0$$'
          ) {
            const anLatexClean = this.stripLatexDelimiters(
              this.termsLatex.cosine[index]
            );
            const termTitle = `Término ${n}: a${n}·cos(${n}ω₀${this.intVar})`;

            html += `
              <div class="term-card bg-gray-800 border border-gray-700 p-4 rounded-lg shadow">
                <div class="term-title font-semibold mb-2 text-green-300">${termTitle}</div>
                <div class="term-latex text-white">$$${anLatexClean}$$</div>
              </div>
            `;
          }
        }
      }
    } else {
      // Mostrar términos bn*sin
      if (this.termCount > 0) {
        const maxTermsToShow = Math.min(
          this.termCount,
          this.termsLatex.sine.length
        );

        for (let n = 1; n <= maxTermsToShow; n++) {
          const index = n - 1;

          if (
            index < this.termsLatex.sine.length &&
            this.termsLatex.sine[index] !== '$$0$$'
          ) {
            const bnLatexClean = this.stripLatexDelimiters(
              this.termsLatex.sine[index]
            );
            const termTitle = `Término ${n}: b${n}·sin(${n}ω₀${this.intVar})`;

            html += `
              <div class="term-card bg-gray-800 border border-gray-700 p-4 rounded-lg shadow">
                <div class="term-title font-semibold mb-2 text-blue-300">${termTitle}</div>
                <div class="term-latex text-white">$$${bnLatexClean}$$</div>
              </div>
            `;
          }
        }
      }
    }

    html += '</div>';
    termsContainer.innerHTML = html;

    // Renderizar LaTeX
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 100);
  }

  // Método para actualizar colores de términos
  updateTermColors(): void {
    // Recrear funciones con nuevos colores
    this.fetchIndividualTerms();

    // Redibujar canvas
    this.redrawCanvas();
  }

  // Método para mostrar/ocultar términos individuales
  toggleIndividualTerms(show: boolean): void {
    // console.log('Toggle individual terms:', show);
    this.showIndividualTerms = show;

    if (show) {
      // Siempre recargamos los términos al activar la visualización
      this.fetchIndividualTerms();
    } else {
      // Si ocultamos los términos, simplemente redibujamos sin ellos
      this.redrawCanvas();
    }
  }

  // Método para actualizar escala del eje X
  updateAxisScale(): void {
    if (this.xAxisScale === 'pi') {
      this.xAxisFactor = Math.PI;
    } else if (this.xAxisScale === 'e') {
      this.xAxisFactor = Math.E;
    } else {
      this.xAxisFactor = 1;
    }

    if (this.cartesianCanvas) {
      this.cartesianCanvas.setXAxisScale(this.xAxisScale);
    }
  }

  // Método para actualizar colores de tema
  private updateThemeColors(): void {
    if (this.isDarkMode) {
      // Dark theme colors
      this.bgColor = '#222';
      this.axisColor = '#90DCB5';
      this.gridColor = '#6BBCAC';
      this.fontColor = '#EBEBEB';
    } else {
      // Light theme colors
      this.bgColor = '#f8fafc';
      this.axisColor = '#3b82f6';
      this.gridColor = '#93c5fd';
      this.fontColor = '#334155';
    }
  }
}
