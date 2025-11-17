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
import { MathquillService } from '../../../core/services/mathquill/mathquill.service';
import { MathUtilsService } from '../../../core/services/maximaToJS/math-utils.service';
import { ApiService } from '../../../core/services/api/api.service';
import { ThemeService } from '../../../core/services/theming/theme.service';
import { TrigonometricResponse } from '../../../interfaces/trigonometric-response.interface';
import { Subscription } from 'rxjs';

import { CanvasControlsComponent } from '../../../shared/components/canvas-controls/canvas-controls.component';

@Component({
  selector: 'app-half-range',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CartesianCanvasComponent,
    CanvasControlsComponent,
  ],
  templateUrl: './half-range.component.html',
  styleUrls: ['./half-range.component.scss'],
})
export class HalfRangeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cartesianCanvas') cartesianCanvas!: CartesianCanvasComponent;
  @ViewChild('coeffCanvas') coeffCanvas!: CartesianCanvasComponent; // New canvas for coefficients

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
  public response: TrigonometricResponse | null = null;
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
    T: '',
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

  // Add properties for amplitude graph
  public showCoefficientsGraph: boolean = false;
  public coeffLineWidth: number = 2;
  public coeffColor: string = '#B794F4'; // Default color (will be updated based on series type)
  private resizeObserver: ResizeObserver | null = null;

  public coeffBgColor: string = '#1A1A2E'; // Dark mode default
  public coeffAxisColor: string = '#B794F4'; // Dark mode default
  public coeffGridColor: string = '#553C9A'; // Dark mode default

  public showNonIntegerCoeffs: boolean = false;
  public nonIntegerCosineLatexFormula: string = '';
  public nonIntegerSineLatexFormula: string = '';

  private coeffPoints: Array<{
    n: number;
    x: number;
    y: number;
    value: number;
  }> = [];
  private coeffTooltip: HTMLElement | null = null;

  // Add modal control properties
  public showSeriesTermsModal: boolean = false;
  public allTermsHtml: string = '';

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

    // Set coeff color based on active series type
    this.updateCoeffColor();
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

      // Update coefficient canvas colors
      if (this.coeffCanvas) {
        this.coeffCanvas.bgColor = this.coeffBgColor;
        this.coeffCanvas.axisColor = this.coeffAxisColor;
        this.coeffCanvas.gridColor = this.coeffGridColor;
        this.coeffCanvas.fontColor = this.fontColor;

        if (this.showCoefficientsGraph) {
          this.coeffCanvas.clearCanvas();
          this.drawCoefficientsGraph();
        }
      }
    });

    this.updateThemeColors();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.mathquillService.renderMathJax();
      this.initializeCanvas();

      // Initialize coefficient graph if visible
      if (this.showCoefficientsGraph) {
        this.drawCoefficientsGraph();
      }
    }, 100);

    // Setup resize observer for the coefficient canvas
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.showCoefficientsGraph) {
          setTimeout(() => this.drawCoefficientsGraph(), 100);
        }
      });

      // Observe container for coefficient canvas
      const coeffCanvasElement = document.getElementById('coeffCanvas');
      if (coeffCanvasElement) this.resizeObserver.observe(coeffCanvasElement);
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

    // Update coefficient color based on series type
    this.updateCoeffColor();

    // Redibujar el canvas con la nueva serie activa
    this.redrawCanvas();

    // Redraw the coefficients graph if visible
    if (this.showCoefficientsGraph) {
      setTimeout(() => this.drawCoefficientsGraph(), 100);
    }

    // Actualizar visualización de términos si están mostrados
    if (this.showIndividualTerms) {
      this.displaySeriesTerms();
    }

    // Re-renderizar las fórmulas LaTeX para asegurar que se muestren correctamente
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 100);
  }

  // Update coefficient color based on active series type
  private updateCoeffColor(): void {
    if (this.activeSeriesType === 'cosine') {
      this.coeffColor = '#B794F4'; // Purple for an coefficients
      this.coeffAxisColor = '#B794F4';
      this.coeffGridColor = '#553C9A';
      this.coeffBgColor = '#1A1A2E';
    } else {
      this.coeffColor = '#F6AD55'; // Orange for bn coefficients
      this.coeffAxisColor = '#F6AD55';
      this.coeffGridColor = '#9C4221';
      this.coeffBgColor = '#2A1E17';
    }

    // Update canvas colors if already initialized
    if (this.coeffCanvas) {
      this.coeffCanvas.bgColor = this.coeffBgColor;
      this.coeffCanvas.axisColor = this.coeffAxisColor;
      this.coeffCanvas.gridColor = this.coeffGridColor;
    }
  }

  // Toggle coefficient graph visibility
  toggleCoefficientsGraph(show: boolean): void {
    this.showCoefficientsGraph = show;

    if (show) {
      // Ensure the canvas colors are updated
      if (this.coeffCanvas) {
        this.coeffCanvas.bgColor = this.coeffBgColor;
        this.coeffCanvas.axisColor = this.coeffAxisColor;
        this.coeffCanvas.gridColor = this.coeffGridColor;
        this.coeffCanvas.fontColor = this.fontColor;
      }

      setTimeout(() => {
        this.drawCoefficientsGraph();
        // Setup events after drawing
        this.setupCoeffCanvasEvents();
        // Setup zoom events
        this.setupCoeffCanvasZoomEvents();
      }, 100);
    }
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

    // Redraw coefficient graph if visible
    if (this.showCoefficientsGraph && this.coeffCanvas) {
      this.drawCoefficientsGraph();
    }
  }

  // Draw coefficients graph
  drawCoefficientsGraph(): void {
    if (!this.showCoefficientsGraph || !this.coeffCanvas) return;

    // Clear previous points
    this.coeffPoints = [];

    // Initialize tooltip reference if it doesn't exist
    if (!this.coeffTooltip) {
      this.coeffTooltip = document.getElementById('coeffTooltip');
    }

    this.coeffCanvas.clearCanvas();

    // Get the appropriate coefficients based on active series type
    const coefficients =
      this.activeSeriesType === 'cosine'
        ? this.cachedACoefs
        : this.cachedBCoefs;

    // Find the maximum absolute value for proper scaling
    const maxAbsValue = Math.max(
      ...coefficients
        .slice(0, Math.min(50, coefficients.length))
        .map((val) => Math.abs(val))
    );

    // Draw coefficient bars
    for (let i = 0; i < Math.min(50, coefficients.length); i++) {
      const n = i + 1; // n starts at 1
      const height = coefficients[i];

      // Usar el método del canvas para agregar al historial
      this.coeffCanvas.drawDiscreteLine(
        n,
        0,
        height,
        this.coeffColor,
        this.coeffLineWidth
      );

      // Save position and value for tooltip
      const pixelPos = this.canvasCoordToPixel(this.coeffCanvas, n, height);
      if (pixelPos) {
        this.coeffPoints.push({
          n,
          x: pixelPos.x,
          y: pixelPos.y,
          value: height,
        });
      }
    }
  }

  // Method to draw discrete line with blur effect
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

    // Apply blur if enabled
    if (applyBlur) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 1.5;
      ctx.globalAlpha = 0.9;
    }

    // If highlighted, apply more pronounced effect
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

  // Method to convert mathematical coordinates to pixel coordinates
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

    // Convert from mathematical units to pixels
    const pixelX = origin.x - offsetX + unit * x;
    const pixelY = origin.y - offsetY - unit * y;

    return { x: pixelX, y: pixelY };
  }

  // Configure mouse events for tooltips
  private setupCoeffCanvasEvents(): void {
    if (!this.coeffCanvas) return;

    const coeffCanvasElement = document.getElementById('coeffCanvas');

    if (!coeffCanvasElement) return;

    // Helper function to check if mouse is near a stem
    const isNearStem = (
      mouseX: number,
      mouseY: number,
      stemX: number,
      stemY0: number,
      stemY1: number,
      threshold: number
    ): boolean => {
      // If mouse is outside the vertical range of the stem, it's not near
      if (
        mouseY < Math.min(stemY0, stemY1) - threshold ||
        mouseY > Math.max(stemY0, stemY1) + threshold
      ) {
        return false;
      }

      // Calculate horizontal distance to the stem
      const distance = Math.abs(mouseX - stemX);
      return distance < threshold;
    };

    // Events for coeffCanvas
    coeffCanvasElement.onmousemove = (event: MouseEvent) => {
      const rect = coeffCanvasElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Check proximity to any stem or point
      const threshold = 12; // Wider threshold to detect the entire stem
      let closestPoint = null;
      let minDistance = Infinity;
      let isCloseToStem = false;

      for (const point of this.coeffPoints) {
        // Convert point coordinates to pixels
        const stemX = point.x;
        const stemEndY = point.y;

        // Calculate Y0 (stem origin, usually Y=0)
        const origin = this.coeffCanvas.origin;
        const offsetY = this.coeffCanvas.offsetY;
        const unit = this.coeffCanvas.unit;
        const stemStartY = origin.y - offsetY - unit * 0; // 0 is the initial Y value

        // Check if mouse is near the stem
        if (
          isNearStem(mouseX, mouseY, stemX, stemStartY, stemEndY, threshold)
        ) {
          isCloseToStem = true;

          // Also determine the closest point to show tooltip
          const dx = mouseX - stemX;
          const dy = mouseY - stemEndY; // Distance to end point (where the value is)
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
          }
        }
      }

      // If close to any stem
      if (isCloseToStem && closestPoint && this.coeffTooltip) {
        // Show tooltip with the coefficient name based on series type
        const coeffName = this.activeSeriesType === 'cosine' ? 'a' : 'b';
        this.coeffTooltip.innerHTML = `${coeffName}<sub>${
          closestPoint.n
        }</sub>: ${closestPoint.value.toFixed(6)}`;
        this.coeffTooltip.style.left = `${closestPoint.x}px`;
        this.coeffTooltip.style.top = `${closestPoint.y}px`;
        this.coeffTooltip.classList.add('visible');

        // Los stems ya están en el historial y se redibujan automáticamente
      } else if (this.coeffTooltip) {
        // Hide tooltip if no stem is nearby
        this.coeffTooltip.classList.remove('visible');
      }
    };

    // Event handlers for leaving the canvas
    coeffCanvasElement.onmouseleave = () => {
      if (this.coeffTooltip) {
        this.coeffTooltip.classList.remove('visible');
      }
    };
  }

  // Setup zoom events for coefficient canvas
  private setupCoeffCanvasZoomEvents(): void {
    if (this.coeffCanvas && this.coeffCanvas.canvasElement?.nativeElement) {
      const coeffCanvas = this.coeffCanvas.canvasElement.nativeElement;

      // Create a new wheel handler that only updates tooltip positions
      const originalWheel = coeffCanvas.onwheel;
      coeffCanvas.onwheel = (event: WheelEvent) => {
        // Call the original handler (canvas redraws automatically from history)
        if (originalWheel) originalWheel.call(coeffCanvas, event);

        // Only update tooltip positions
        setTimeout(() => this.updateCoeffTooltipPositions(), 0);
      };
    }
  }

  // Update only tooltip positions without redrawing
  private updateCoeffTooltipPositions(): void {
    this.coeffPoints = [];
    // Get the appropriate coefficients based on active series type
    const coefficients =
      this.activeSeriesType === 'cosine'
        ? this.cachedACoefs
        : this.cachedBCoefs;

    for (let i = 0; i < Math.min(50, coefficients.length); i++) {
      const n = i + 1;
      const height = coefficients[i];
      const pixelPos = this.canvasCoordToPixel(this.coeffCanvas, n, height);
      if (pixelPos) {
        this.coeffPoints.push({
          n,
          x: pixelPos.x,
          y: pixelPos.y,
          value: height,
        });
      }
    }
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
      // 1. Verificar si existen singularidades para valores n distintos de cero
      const hasAnSingularities =
        this.response.indeterminateValues?.an?.some(
          (item) => item.n !== 0 // Consideramos singularidad si n NO es cero
        ) || false;

      const hasBnSingularities =
        this.response.indeterminateValues?.bn?.some(
          (item) => item.n !== 0 // Consideramos singularidad si n NO es cero
        ) || false;

      // 2. Decidir qué set de coeficientes usar basado en la presencia de singularidades
      const hasSingularities = hasAnSingularities || hasBnSingularities;

      // 3. Seleccionar expresiones de coeficientes apropiadas
      let a0Expr, anExpr, bnExpr;

      if (hasSingularities && this.response.nonIntegerCoeffs) {
        // Si hay singularidades en n ≠ 0, usar coeficientes sin restricción de n entero
        a0Expr = this.response.nonIntegerCoeffs.a0 || '0';
        anExpr = this.response.nonIntegerCoeffs.an || '0';
        bnExpr = this.response.nonIntegerCoeffs.bn || '0';

        console.log(
          'Usando coeficientes sin restricción de n entero debido a singularidades para n ≠ 0'
        );
      } else {
        // Si no hay singularidades n ≠ 0, usar coeficientes simplificados
        a0Expr = this.response.simplified.a0 || '0';
        anExpr = this.response.simplified.an || '0';
        bnExpr = this.response.simplified.bn || '0';

        console.log('Usando coeficientes simplificados (con n entero)');
      }

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

      console.log('Coeficientes seleccionados para graficar:', {
        a0: a0Expr,
        an: anExpr,
        bn: bnExpr,
        tieneIndeterminaciones: hasSingularities,
      });
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

    // Limpiamos los delimitadores LaTeX - coeficientes con n entero
    const a0 = this.stripLatexDelimiters(this.response.latex.a0 || '');
    const an = this.stripLatexDelimiters(this.response.latex.an || '');
    const bn = this.stripLatexDelimiters(this.response.latex.bn || '');
    const cosine = this.stripLatexDelimiters(
      this.response.latex.cosineCore || ''
    );
    const sine = this.stripLatexDelimiters(this.response.latex.sineCore || '');

    // Para los coeficientes sin restricción de n entero
    const nonIntA0 = this.response.latex.nonInteger?.a0
      ? this.stripLatexDelimiters(this.response.latex.nonInteger.a0)
      : a0;
    const nonIntAn = this.response.latex.nonInteger?.an
      ? this.stripLatexDelimiters(this.response.latex.nonInteger.an)
      : an;
    const nonIntBn = this.response.latex.nonInteger?.bn
      ? this.stripLatexDelimiters(this.response.latex.nonInteger.bn)
      : bn;

    // Asignar valores LaTeX para los coeficientes
    this.latexRendered = {
      a0: `$$${a0}$$`,
      an: `$$${an}$$`,
      bn: `$$${bn}$$`,
      w0: this.response.latex.w0
        ? `$$${this.stripLatexDelimiters(this.response.latex.w0)}$$`
        : '',
      T: this.response.latex.T,
      // Añadir los coeficientes sin restricción
      nonInteger: {
        a0: `$$${nonIntA0}$$`,
        an: `$$${nonIntAn}$$`,
        bn: `$$${nonIntBn}$$`,
      },
    };

    // Formular serie coseno con n entero
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

    // Formular serie seno con n entero
    if (bn !== '0') {
      this.sineLatexFormula = `$$f_s(${this.intVar}) = \\sum_{n=1}^{\\infty} ${bn} \\cdot ${sine}$$`;
    } else {
      this.sineLatexFormula = `$$f_s(${this.intVar}) = 0$$`;
    }

    // Formular serie coseno sin restricción n entero
    if (nonIntA0 !== '0') {
      if (nonIntAn !== '0') {
        this.nonIntegerCosineLatexFormula = `$$f_c(${this.intVar}) = \\frac{${nonIntA0}}{2} + \\sum_{n=1}^{\\infty} ${nonIntAn} \\cdot ${cosine}$$`;
      } else {
        this.nonIntegerCosineLatexFormula = `$$f_c(${this.intVar}) = \\frac{${nonIntA0}}{2}$$`;
      }
    } else if (nonIntAn !== '0') {
      this.nonIntegerCosineLatexFormula = `$$f_c(${this.intVar}) = \\sum_{n=1}^{\\infty} ${nonIntAn} \\cdot ${cosine}$$`;
    } else {
      this.nonIntegerCosineLatexFormula = `$$f_c(${this.intVar}) = 0$$`;
    }

    // Formular serie seno sin restricción n entero
    if (nonIntBn !== '0') {
      this.nonIntegerSineLatexFormula = `$$f_s(${this.intVar}) = \\sum_{n=1}^{\\infty} ${nonIntBn} \\cdot ${sine}$$`;
    } else {
      this.nonIntegerSineLatexFormula = `$$f_s(${this.intVar}) = 0$$`;
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
    if (
      !this.response ||
      (!this.response.simplified && !this.response.nonIntegerCoeffs)
    ) {
      console.warn('No hay respuesta o datos de coeficientes');
      return;
    }

    // Mostrar loading
    const termsContainer = document.getElementById('series-terms-container');
    if (termsContainer) {
      termsContainer.innerHTML =
        '<div class="text-center p-4"><p>Calculando términos...</p></div>';
    }

    // Intentar usar los términos directamente desde la respuesta
    try {
      // Usar preferentemente los coeficientes no enteros para evitar singularidades
      // Procesar y mostrar términos en LaTeX
      this.prepareIndividualTermFunctions({
        string: {
          a0:
            this.response.nonIntegerCoeffs?.a0 ||
            this.response.simplified?.a0 ||
            '0',
          an:
            this.response.nonIntegerCoeffs?.an ||
            this.response.simplified?.an ||
            '0',
          bn:
            this.response.nonIntegerCoeffs?.bn ||
            this.response.simplified?.bn ||
            '0',
        },
        latex: {
          a0:
            this.response.latex?.nonInteger?.a0 ||
            this.response.latex?.a0 ||
            '',
          an: [], // Se llenará en displaySeriesTerms según necesidades
          bn: [], // Se llenará en displaySeriesTerms según necesidades
        },
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
        termsContainer.innerHTML =
          '<div class="text-center text-red-500 p-4"><p>Error calculando términos</p></div>';
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
      // console.log('No hay términos an (coeficientes = 0 o indefinidos)');
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
      // console.log('No hay términos bn (coeficientes = 0 o indefinidos)');
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

      // Mostrar términos an*cos según el valor de termCount
      if (this.termCount > 0) {
        // Solo dibujamos hasta el número de términos seleccionado o disponible
        for (
          let i = 1;
          i <= Math.min(this.termCount, this.termsLatex.cosine.length - 1);
          i++
        ) {
          if (
            i < this.termsLatex.cosine.length &&
            this.termsLatex.cosine[i] !== '$$0$$'
          ) {
            const anLatexClean = this.stripLatexDelimiters(
              this.termsLatex.cosine[i]
            );
            const termTitle = `Término ${i}: a${i}·cos(${i}ω₀${this.intVar})`;

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
      // Mostrar términos bn*sin según el valor de termCount
      if (this.termCount > 0) {
        // Solo dibujamos hasta el número de términos seleccionado o disponible
        for (
          let i = 1;
          i <= Math.min(this.termCount, this.termsLatex.sine.length);
          i++
        ) {
          const index = i - 1;

          if (
            index < this.termsLatex.sine.length &&
            this.termsLatex.sine[index] !== '$$0$$'
          ) {
            const bnLatexClean = this.stripLatexDelimiters(
              this.termsLatex.sine[index]
            );
            const termTitle = `Término ${i}: b${i}·sin(${i}ω₀${this.intVar})`;

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

  // Show all series terms in a modal dialog
  displayAllSeriesTermsInModal(): void {
    // Show the modal dialog
    this.showSeriesTermsModal = true;

    // Prepare LaTeX expressions for the current active series type
    const data = {
      coefficients: {
        a0: this.response?.simplified?.a0 || '0',
        an: this.response?.simplified?.an || '0',
        bn: this.response?.simplified?.bn || '0',
      },
      w0: this.response?.simplified?.w0 || '%pi',
      intVar: this.intVar,
      terms: 100, // Request a larger number to ensure we have enough terms
    };

    // Call the API to get the LaTeX expressions for the terms
    this.apiService.expandTrigonometricSeries(data).subscribe({
      next: (response) => {
        // Define card style based on theme
        const cardStyle = this.isDarkMode
          ? 'bg-gray-800 border border-gray-700 text-white'
          : 'bg-white border border-gray-200 text-gray-800';

        // Define title style based on theme and series type
        const titleStyle = this.isDarkMode
          ? this.activeSeriesType === 'cosine'
            ? 'text-green-300'
            : 'text-blue-300'
          : this.activeSeriesType === 'cosine'
          ? 'text-green-600'
          : 'text-blue-600';

        let html = `<div class="grid grid-cols-1 gap-4 max-w-full">`;

        let localW0 = this.stripLatexDelimiters(this.latexRendered.w0 || '');
        if (localW0 === '1') {
          localW0 = '';
        } else if (localW0) {
          localW0 += ' ';
        }

        if (this.activeSeriesType === 'cosine') {
          // For cosine series, add a0/2 term first if present
          if (
            response.latex.a0 &&
            response.latex.a0 !== '0' &&
            response.latex.a0 !== '$$0$$'
          ) {
            const a0LatexClean = this.stripLatexDelimiters(response.latex.a0);
            html += `
              <div class="term-card ${cardStyle} p-4 rounded-lg shadow">
                <div class="term-title font-semibold mb-2 ${titleStyle}">$$\\text{Término constante } \\frac{a_0}{2}$$</div>
                <div class="term-latex">$$\\frac{${a0LatexClean}}{2}$$</div>
              </div>
            `;
          }

          // Add an terms
          if (response.latex.an && response.latex.an.length > 0) {
            for (let n = 1; n <= Math.min(50, response.latex.an.length); n++) {
              const index = n - 1;

              let anLatexClean = '';

              // Check if the array has aₙ
              if (index < (response.latex.an?.length || 0)) {
                anLatexClean = this.stripLatexDelimiters(
                  response.latex.an[index]
                );
                const indetAn = this.response?.indeterminateValues?.an?.find(
                  (i) => i.n === n
                );
                if (indetAn) {
                  if (this.stripLatexDelimiters(indetAn.limitTex) === '0') {
                    anLatexClean = '';
                  } else {
                    const argument = [
                      n === 1 ? '' : String(n),
                      localW0,
                      this.intVar,
                    ]
                      .filter(Boolean)
                      .join('');
                    anLatexClean = `\\left (${this.stripLatexDelimiters(
                      indetAn.limitTex
                    )} \\right ) \\cos \\left (${argument} \\right )`;
                  }
                }
              }

              if (anLatexClean && anLatexClean !== '0') {
                html += `
                  <div class="term-card ${cardStyle} p-4 rounded-lg shadow">
                    <div class="term-title font-semibold mb-2 ${titleStyle}">$$\\text{Término ${n}: } a_{${n}} \\cdot \\cos(${n}\\omega_0 ${this.intVar})$$</div>
                    <div class="term-latex">$$${anLatexClean}$$</div>
                  </div>
                `;
              }
            }
          }
        } else {
          // For sine series, just add bn terms
          if (response.latex.bn && response.latex.bn.length > 0) {
            for (let n = 1; n <= Math.min(50, response.latex.bn.length); n++) {
              const index = n - 1;

              let bnLatexClean = '';

              // Check if the array has bₙ
              if (index < (response.latex.bn?.length || 0)) {
                bnLatexClean = this.stripLatexDelimiters(
                  response.latex.bn[index]
                );
                const indetBn = this.response?.indeterminateValues?.bn?.find(
                  (i) => i.n === n
                );
                if (indetBn) {
                  if (this.stripLatexDelimiters(indetBn.limitTex) === '0') {
                    bnLatexClean = '';
                  } else {
                    const argument = [
                      n === 1 ? '' : String(n),
                      localW0,
                      this.intVar,
                    ]
                      .filter(Boolean)
                      .join('');
                    bnLatexClean = `\\left (${this.stripLatexDelimiters(
                      indetBn.limitTex
                    )} \\right ) \\sin \\left (${argument} \\right )`;
                  }
                }
              }

              if (bnLatexClean && bnLatexClean !== '0') {
                html += `
                  <div class="term-card ${cardStyle} p-4 rounded-lg shadow">
                    <div class="term-title font-semibold mb-2 ${titleStyle}">$$\\text{Término ${n}: } b_{${n}} \\cdot \\sin(${n}\\omega_0 ${this.intVar})$$</div>
                    <div class="term-latex">$$${bnLatexClean}$$</div>
                  </div>
                `;
              }
            }
          }
        }

        html += '</div>';
        this.allTermsHtml = html;

        // Render LaTeX after a short delay to ensure DOM is ready
        setTimeout(() => {
          this.mathquillService.renderMathJax();
        }, 200);
      },
      error: (error) => {
        console.error('Error fetching series terms for modal:', error);

        // Show error message if API call fails
        const errorHtml = `
          <div class="text-center py-6">
            <p class="${this.isDarkMode ? 'text-red-400' : 'text-red-600'}">
              Error al cargar los términos. Por favor, intente nuevamente.
            </p>
          </div>
        `;
        this.allTermsHtml = errorHtml;
      },
    });
  }

  closeSeriesTermsModal(): void {
    this.showSeriesTermsModal = false;
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
      // Dark theme colors - Main canvas
      this.bgColor = '#222';
      this.axisColor = '#90DCB5';
      this.gridColor = '#6BBCAC';
      this.fontColor = '#EBEBEB';

      // Dark theme colors - coefficient canvas (depends on series type)
      if (this.activeSeriesType === 'cosine') {
        this.coeffBgColor = '#1A1A2E';
        this.coeffAxisColor = '#B794F4';
        this.coeffGridColor = '#553C9A';
      } else {
        this.coeffBgColor = '#2A1E17';
        this.coeffAxisColor = '#F6AD55';
        this.coeffGridColor = '#9C4221';
      }
    } else {
      // Light theme colors - Main canvas
      this.bgColor = '#f8fafc';
      this.axisColor = '#3b82f6';
      this.gridColor = '#93c5fd';
      this.fontColor = '#334155';

      // Light theme colors - coefficient canvas (depends on series type)
      if (this.activeSeriesType === 'cosine') {
        this.coeffBgColor = '#F5F7FF';
        this.coeffAxisColor = '#805AD5';
        this.coeffGridColor = '#D6BCFA';
      } else {
        this.coeffBgColor = '#FFFAF0';
        this.coeffAxisColor = '#ED8936';
        this.coeffGridColor = '#FEEBC8';
      }
    }
  }

  toggleCoefficientsView(): void {
    // Re-renderizar fórmulas LaTeX cuando cambia el toggle
    setTimeout(() => {
      this.mathquillService.renderMathJax();
    }, 100);
  }
}
