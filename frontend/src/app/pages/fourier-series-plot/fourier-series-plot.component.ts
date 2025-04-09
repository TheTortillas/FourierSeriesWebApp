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
  public termCount: number = 10;
  public showOriginalFunction: boolean = true;
  public showSeriesApproximation: boolean = true;

  public functionColor: string = '#1e40af'; // Azul oscuro
  public seriesColor: string = '#ef4444'; // Rojo

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
  private cachedW0: number = Math.PI;
  private cachedACoefs: number[] = [];
  private cachedBCoefs: number[] = [];

  // Funciones cacheadas para piezas originales
  private cachedOriginalFunctions: Array<{
    fn: (x: number) => number;
    start: number;
    end: number;
  }> = [];

  constructor(
    private router: Router,
    private mathquillService: MathquillService,
    private mathUtilsService: MathUtilsService
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

  // Método para alternar el sidenav
  toggleSidenav(): void {
    this.sidenavOpen = !this.sidenavOpen;
  }

  // Método para redibujar las funciones sin reiniciar la vista
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
  }

  // Inicializar el canvas con las gráficas
  initializeCanvas(): void {
    if (!this.cartesianCanvas) return;

    // Para inicialización completa SÍ queremos resetear la vista
    this.cartesianCanvas.clearCanvas();
    this.cartesianCanvas.resetView();

    // Dibujar las funciones
    this.redrawFunctions();
  }

  // Método para implementar el redibujado sin resetear la vista
  redrawCanvas(): void {
    this.redrawFunctions();
  }

  // Precalcular todos los coeficientes de la serie
  private precalculateCoefficients(): void {
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

      // Precalcular an
      if (anExpr !== '0') {
        for (let n = 1; n <= maxTerms; n++) {
          try {
            const an = this.mathUtilsService.evaluateMaximaExpr(anExpr, { n });
            this.cachedACoefs.push(an);
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
            const bn = this.mathUtilsService.evaluateMaximaExpr(bnExpr, { n });
            this.cachedBCoefs.push(bn);
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
  // Precalcular las funciones originales
  private precalculateOriginalFunctions(): void {
    // Usamos maximaMatrix si está disponible, sino el originalLatex como respaldo
    const dataSource = this.maximaMatrix.length > 0 ? this.maximaMatrix : this.originalLatex;
  
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
          const startX = piece[1];       // Límite inferior en Maxima
          const endX = piece[2];         // Límite superior en Maxima
  
          console.log(`Procesando función: ${functionExpr} en [${startX}, ${endX}]`);
  
          // Convertir la expresión de Maxima a JavaScript
          const jsExpr = this.mathUtilsService.maximaToJS(functionExpr);
          console.log(`Convertida a JS: ${jsExpr}`);
  
          // Crear una función JavaScript cerrada que no dependa de mathUtilsService
          try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(this.intVar, `return ${jsExpr};`) as (x: number) => number;
  
            // Evaluar límites una sola vez
            const start = this.mathUtilsService.evaluateMaximaExpr(startX, {});
            const end = this.mathUtilsService.evaluateMaximaExpr(endX, {});
  
            console.log(`Límites evaluados: [${start}, ${end}]`);
  
            // Verificar que la función es válida evaluándola en un punto de prueba
            try {
              const testPoint = (start + end) / 2;
              const testValue = fn(testPoint);
              console.log(`Prueba de función en x=${testPoint}: f(x)=${testValue}`);
              
              if (isFinite(testValue) && !isNaN(testValue)) {
                // Almacenar la función y sus límites en caché
                this.cachedOriginalFunctions.push({
                  fn,
                  start,
                  end,
                });
                console.log('Función añadida a caché con éxito');
              } else {
                console.error('La función devuelve un valor no numérico en prueba:', testValue);
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
  
      console.log(
        'Funciones originales precalculadas:',
        this.cachedOriginalFunctions.length
      );
    } catch (error) {
      console.error('Error en precalculateOriginalFunctions:', error);
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

    // Método para dibujar la serie con los coeficientes precalculados
  drawSeriesApproximation(): void {
    if (!this.cartesianCanvas) return;
  
    try {
      // Crear una función que sume todos los términos usando los coeficientes precalculados
      const fourierSeries = (x: number): number => {
        // Comenzar con el término constante a0/2 (dividido entre 2)
        let sum = this.cachedA0 / 2; 
        
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
  // Método para dibujar la serie de Fourier
  private drawFourierSeries(
    a0: number,
    aCoefs: number[],
    bCoefs: number[],
    w0: number,
    terms: number,
    color: string,
    lineWidth: number = 2 // Añadir parámetro de grosor
  ): void {
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

  // Método para actualizar el número de términos
  updateTermCount(): void {
    this.redrawCanvas();
  }

  // Método para volver a la calculadora
  goBack(): void {
    this.router.navigate(['/fourier-calculator']);
  }

  // Método auxiliar para obtener la configuración del plot
  private getPlotConfig(): PlotConfig {
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

  // Método para exportar los resultados
  exportResults(): void {
    console.log('Exportar resultados');
  }

  // Preparar fórmulas LaTeX para visualización (adaptado de TrigonometricPiecewiseSeriesComponent)
  private prepareLatexFormulas(): void {
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

  // Método para eliminar delimitadores LaTeX
  private stripLatexDelimiters(latex: string): string {
    return latex
      .replace(/^\$\$?/, '')
      .replace(/\$\$?$/, '')
      .trim();
  }
}
