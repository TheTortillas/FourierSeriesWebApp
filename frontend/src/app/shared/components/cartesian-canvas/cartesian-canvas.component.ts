import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  Output,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CanvasDrawingService } from '../../../core/services/canvas/canvas-drawing.service';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { PlotConfig } from '../../../interfaces/plot-config.interface';

// Interfaces para almacenar las gráficas
interface FunctionPlot {
  fn: (x: number) => number;
  color: string;
  lineWidth?: number;
}

interface IntervalPlot {
  fn: (x: number) => number;
  color: string;
  a: number;
  b: number;
  lineWidth?: number;
}

interface DiscretePlot {
  startX: number;
  startY: number;
  n: number;
  color: string;
  lineWidth?: number;
}

interface SeriesPlot {
  seriesTerm: (n: number, x: number) => number;
  terms: number;
  color: string;
  lineWidth?: number;
}

@Component({
  selector: 'app-cartesian-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cartesian-canvas.component.html',
  styleUrl: './cartesian-canvas.component.scss',
})
export class CartesianCanvasComponent implements AfterViewInit {
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  // Propiedades configurables
  @Input() canvasId = 'cartesian-canvas';
  @Input() bgColor = '#222';
  @Input() fontColor = '#EBEBEB';
  @Input() axisColor = '#90DCB5';
  @Input() gridColor = '#6BBCAC';
  @Input() initialZoom = 75;
  @Input() minZoom = 8;
  @Input() maxZoom = 1000;
  @Input() xAxisScale: 'integer' | 'pi' | 'e' = 'integer';
  @Input() xAxisFactor = 1;

  // Eventos
  @Output() canvasReady = new EventEmitter<CanvasRenderingContext2D>();

  // Variables internas
  ctx: CanvasRenderingContext2D | null = null;
  width = 0;
  height = 0;
  unit = 0;

  // Variables para drag & zoom
  drag = false;
  offsetX = 0;
  offsetY = 0;
  mouseX = 0;
  mouseY = 0;
  origin: { x: number; y: number } = { x: 0, y: 0 };
  lastPinchDistance: number | null = null; // Para manejar pinch-zoom

  // Verificar si estamos en el navegador
  private isBrowser: boolean;

  // Historial de gráficas
  private functionPlots: FunctionPlot[] = [];
  private intervalPlots: IntervalPlot[] = [];
  private discretePlots: DiscretePlot[] = [];
  private seriesPlots: SeriesPlot[] = [];

  // Optimización de redibujado
  private redrawPending = false;
  private redrawAnimationFrame: number | null = null;

  constructor(
    private canvasDrawingService: CanvasDrawingService,
    private plottingService: PlottingService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    // Verificar si estamos en el navegador (cliente) o en el servidor
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    // Solo inicializar el canvas si estamos en el navegador
    if (this.isBrowser) {
      setTimeout(() => {
        const canvas = this.canvasElement?.nativeElement;
        if (!canvas) return;

        // Inicializar propiedades del canvas
        this.initCanvasProperties(canvas);

        // Inicializar eventos (zoom, drag, resize)
        this.initCanvasEvents(canvas);

        // Dibujar el plano cartesiano vacío
        this.drawScreen();

        // Emitir el contexto para que los componentes padres puedan usarlo
        if (this.ctx) {
          this.canvasReady.emit(this.ctx);
        }
      }, 0);
    }
  }

  // ───────────────────────────────
  // Métodos públicos
  // ───────────────────────────────

  /**
   * Dibuja una función en todo el dominio visible
   */
  public drawFunction(
    fn: (x: number) => number,
    color = '#FF0000',
    lineWidth = 2
  ): void {
    if (!this.isBrowser) return;

    // Guardar la función en el historial
    this.functionPlots.push({ fn, color, lineWidth });

    // Dibujar la función
    const config: PlotConfig = this.getPlotConfig();
    this.plottingService.drawFunction(config, fn, color, lineWidth);
  }

  /**
   * Dibuja una función en un intervalo específico [a,b]
   */
  public drawFunctionFromAToB(
    fn: (x: number) => number,
    color: string,
    a: number,
    b: number,
    lineWidth = 2
  ): void {
    if (!this.isBrowser) return;

    // Guardar la función en el historial
    this.intervalPlots.push({ fn, color, a, b, lineWidth });

    // Dibujar la función en el intervalo
    const config: PlotConfig = this.getPlotConfig();
    this.plottingService.drawFunctionFromAToB(
      config,
      fn,
      color,
      a,
      b,
      lineWidth
    );
  }

  /**
   * Dibuja puntos discretos o líneas verticales
   */
  public drawDiscreteLine(
    startX: number,
    startY: number,
    n: number,
    color: string,
    lineWidth = 2
  ): void {
    if (!this.isBrowser) return;

    // Guardar el punto discreto en el historial
    this.discretePlots.push({ startX, startY, n, color, lineWidth });

    // Dibujar el punto discreto
    const config: PlotConfig = this.getPlotConfig();
    this.plottingService.drawDiscreteLine(
      config,
      startX,
      startY,
      n,
      color,
      lineWidth
    );
  }

  /**
   * Dibuja una serie (ej: Serie de Fourier)
   */
  public drawSeries(
    seriesTerm: (n: number, x: number) => number,
    terms: number,
    color: string,
    lineWidth = 2
  ): void {
    if (!this.isBrowser) return;

    // Guardar la serie en el historial
    this.seriesPlots.push({ seriesTerm, terms, color, lineWidth });

    // Dibujar la serie
    const config: PlotConfig = this.getPlotConfig();
    this.plottingService.drawSeries(
      config,
      seriesTerm,
      terms,
      color,
      lineWidth
    );
  }

  /**
   * Dibuja múltiples funciones de manera optimizada (usado para términos individuales)
   * OPTIMIZACIÓN: Agrupa las operaciones de dibujo para mejor rendimiento
   */
  public drawMultipleFunctions(
    functions: Array<{ fn: (x: number) => number; color: string; lineWidth?: number }>
  ): void {
    if (!this.isBrowser || !this.ctx) return;

    const config: PlotConfig = this.getPlotConfig();
    
    // Agrupar funciones por color y lineWidth para reducir cambios de estado
    const grouped = new Map<string, Array<(x: number) => number>>();
    
    functions.forEach(({ fn, color, lineWidth = 2 }) => {
      const key = `${color}-${lineWidth}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(fn);
    });

    // Dibujar cada grupo
    grouped.forEach((fns, key) => {
      const [color, lineWidthStr] = key.split('-');
      const lineWidth = parseFloat(lineWidthStr);
      
      fns.forEach(fn => {
        this.plottingService.drawFunction(config, fn, color, lineWidth);
      });
    });
  }

  /**
   * Limpia el canvas y redibuja solo el plano cartesiano
   */
  public clearCanvas(): void {
    if (!this.isBrowser) return;

    // Limpiar el historial de gráficas
    this.functionPlots = [];
    this.intervalPlots = [];
    this.discretePlots = [];
    this.seriesPlots = [];

    // Redibujar solo el plano cartesiano
    this.drawScreen();
  }

  /**
   * Restablece la vista a la posición inicial
   */
  public resetView(): void {
    if (!this.isBrowser) return;

    this.offsetX = 0;
    this.offsetY = 0;
    this.unit = this.initialZoom;
    this.drawScreen();
  }

  /**
   * Establece el nivel de zoom
   */
  public setZoom(zoom: number): void {
    if (!this.isBrowser) return;

    this.unit = Math.max(this.minZoom, Math.min(zoom, this.maxZoom));
    this.drawScreen();
  }

  // ───────────────────────────────
  // Métodos privados
  // ───────────────────────────────

  private getPlotConfig(): PlotConfig {
    return {
      ctx: this.ctx,
      width: this.width,
      height: this.height,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      unit: this.unit,
      origin: this.origin,
      xAxisScale: this.xAxisScale,
      xAxisFactor: this.xAxisFactor,
    };
  }

  private drawScreen(): void {
    if (!this.ctx || !this.isBrowser) return;

    // Cancelar cualquier redibujado pendiente
    if (this.redrawAnimationFrame !== null) {
      cancelAnimationFrame(this.redrawAnimationFrame);
    }

    // Usar requestAnimationFrame para redibujado suave
    this.redrawAnimationFrame = requestAnimationFrame(() => {
      if (!this.ctx) return;

      // 1. Dibujar el plano cartesiano
      this.canvasDrawingService.drawScreen({
        ctx: this.ctx,
        width: this.width,
        height: this.height,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        origin: this.origin,
        bgColor: this.bgColor,
        axisColor: this.axisColor,
        gridColor: this.gridColor,
        fontColor: this.fontColor,
        unit: this.unit,
        xAxisScale: this.xAxisScale,
        xAxisFactor: this.xAxisFactor,
      });

      // 2. Configuración para dibujar gráficas
      const config: PlotConfig = this.getPlotConfig();

      // 3. Redibujar todas las funciones guardadas
      this.functionPlots.forEach((plot) => {
        this.plottingService.drawFunction(
          config,
          plot.fn,
          plot.color,
          plot.lineWidth || 2
        );
      });

      // 4. Redibujar todas las funciones en intervalo
      this.intervalPlots.forEach((plot) => {
        this.plottingService.drawFunctionFromAToB(
          config,
          plot.fn,
          plot.color,
          plot.a,
          plot.b,
          plot.lineWidth || 2
        );
      });

      // 5. Redibujar todos los puntos discretos
      this.discretePlots.forEach((plot) => {
        this.plottingService.drawDiscreteLine(
          config,
          plot.startX,
          plot.startY,
          plot.n,
          plot.color,
          plot.lineWidth || 2.5
        );
      });

      // 6. Redibujar todas las series
      this.seriesPlots.forEach((plot) => {
        this.plottingService.drawSeries(
          config,
          plot.seriesTerm,
          plot.terms,
          plot.color,
          plot.lineWidth || 2
        );
      });

      this.redrawAnimationFrame = null;
    });
  }

  private initCanvasProperties(canvas: HTMLCanvasElement): void {
    if (!this.isBrowser) return;

    // Ajustar el tamaño del canvas al tamaño de su contenedor
    this.resizeCanvas(canvas);

    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.unit = this.initialZoom;
    this.origin = { x: this.width / 2, y: this.height / 2 };
  }

  private resizeCanvas(canvas: HTMLCanvasElement): void {
    if (!this.isBrowser) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    } else {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  private initCanvasEvents(canvas: HTMLCanvasElement): void {
    if (!this.isBrowser) return;

    // Redibujar al cambiar tamaño (con debounce)
    let resizeTimeout: number | null = null;
    window.addEventListener('resize', () => {
      if (resizeTimeout !== null) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        this.resizeCanvas(canvas);
        this.width = canvas.width;
        this.height = canvas.height;
        this.origin = { x: this.width / 2, y: this.height / 2 };
        this.drawScreen();
      }, 100);
    });

    // Implementar zoom dinámico respecto a la posición del cursor
    // Con throttling para mejor rendimiento
    let wheelTimeout: number | null = null;
    let pendingZoomData: {
      deltaY: number;
      mouseX: number;
      mouseY: number;
    } | null = null;

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();

      // Acumular datos del evento
      const rect = canvas.getBoundingClientRect();
      pendingZoomData = {
        deltaY: event.deltaY,
        mouseX: event.clientX - rect.left,
        mouseY: event.clientY - rect.top,
      };

      // Si ya hay un timeout pendiente, no hacer nada más
      if (wheelTimeout !== null) {
        return;
      }

      // Procesar el zoom después de un pequeño delay
      wheelTimeout = window.setTimeout(() => {
        if (pendingZoomData) {
          // Almacena el valor antiguo de 'unit'
          const oldUnit = this.unit;

          const { mouseX, mouseY, deltaY } = pendingZoomData;

          // Calcula las coordenadas matemáticas bajo el cursor antes del zoom
          const x0 = (mouseX - this.origin.x + this.offsetX) / oldUnit;
          const y0 = (mouseY - this.origin.y + this.offsetY) / oldUnit;

          // Calcula el factor de zoom
          const zoomSpeed = 0.001;
          const zoomFactor = Math.exp(-deltaY * zoomSpeed);

          // Ajusta 'unit' de forma multiplicativa
          this.unit *= zoomFactor;

          // Limita el nivel de zoom
          this.unit = Math.max(this.minZoom, Math.min(this.unit, this.maxZoom));

          // Ajusta offsets para mantener el punto bajo el cursor estacionario
          this.offsetX += x0 * (this.unit - oldUnit);
          this.offsetY += y0 * (this.unit - oldUnit);

          this.drawScreen();
        }

        wheelTimeout = null;
        pendingZoomData = null;
      }, 16); // ~60fps
    });

    // Drag start
    canvas.addEventListener('mousedown', (event) => {
      this.drag = true;
      this.mouseX = event.clientX + this.offsetX;
      this.mouseY = event.clientY + this.offsetY;
    });

    // Drag move con throttling
    let dragAnimationFrame: number | null = null;
    canvas.addEventListener('mousemove', (event) => {
      if (this.drag) {
        if (dragAnimationFrame !== null) {
          return; // Ya hay un frame pendiente
        }
        
        dragAnimationFrame = requestAnimationFrame(() => {
          this.offsetX = this.mouseX - event.clientX;
          this.offsetY = this.mouseY - event.clientY;
          this.drawScreen();
          dragAnimationFrame = null;
        });
      }
    });

    // Drag end
    canvas.addEventListener('mouseup', () => {
      this.drag = false;
    });

    // Si el ratón sale del canvas mientras se está arrastrando
    canvas.addEventListener('mouseleave', () => {
      this.drag = false;
    });

    // Eventos táctiles para dispositivos móviles
    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault(); // Prevenir el comportamiento predeterminado
      if (event.touches.length === 1) {
        // Un solo dedo para arrastrar
        this.drag = true;
        this.mouseX = event.touches[0].clientX + this.offsetX;
        this.mouseY = event.touches[0].clientY + this.offsetY;
      } else if (event.touches.length === 2) {
        // Dos dedos para zoom (implementación de pinch-zoom)
        this.drag = false;
      }
    });

    canvas.addEventListener('touchmove', (event) => {
      event.preventDefault(); // Prevenir el comportamiento predeterminado
      if (event.touches.length === 1 && this.drag) {
        // Un solo dedo para arrastrar
        this.offsetX = this.mouseX - event.touches[0].clientX;
        this.offsetY = this.mouseY - event.touches[0].clientY;
        this.drawScreen();
      } else if (event.touches.length === 2) {
        // Gestión del zoom con dos dedos (pinch gesture)
        // Implementación de pinch-zoom
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];

        // Calcular la distancia entre los dos dedos
        const currentDistance = Math.hypot(
          touch1.clientX - touch2.clientX,
          touch1.clientY - touch2.clientY
        );

        if (this.lastPinchDistance) {
          // Cambiar el zoom basado en el cambio de distancia
          const pinchRatio = currentDistance / this.lastPinchDistance;
          const zoomFactor = pinchRatio;

          // Obtener el punto medio entre los dos dedos
          const midX = (touch1.clientX + touch2.clientX) / 2;
          const midY = (touch1.clientY + touch2.clientY) / 2;

          // Lo mismo que hacemos con el zoom de rueda
          const rect = canvas.getBoundingClientRect();
          const canvasX = midX - rect.left;
          const canvasY = midY - rect.top;

          const oldUnit = this.unit;
          const x0 = (canvasX - this.origin.x + this.offsetX) / oldUnit;
          const y0 = (canvasY - this.origin.y + this.offsetY) / oldUnit;

          this.unit *= zoomFactor;
          this.unit = Math.max(this.minZoom, Math.min(this.unit, this.maxZoom));

          this.offsetX += x0 * (this.unit - oldUnit);
          this.offsetY += y0 * (this.unit - oldUnit);

          this.drawScreen();
        }

        this.lastPinchDistance = currentDistance;
      }
    });

    canvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.drag = false;
      this.lastPinchDistance = null;
    });
  }

  /**
   * Establece la escala del eje X
   * @param scale La escala a establecer ('integer', 'pi', 'e')
   */
  public setXAxisScale(scale: 'integer' | 'pi' | 'e'): void {
    if (!this.isBrowser) return;

    this.xAxisScale = scale;

    // Actualizar el factor según la escala seleccionada
    if (scale === 'pi') {
      this.xAxisFactor = Math.PI;
    } else if (scale === 'e') {
      this.xAxisFactor = Math.E;
    } else {
      this.xAxisFactor = 1;
    }

    this.drawScreen();
  }
}
