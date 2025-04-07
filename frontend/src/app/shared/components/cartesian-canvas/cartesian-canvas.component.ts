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
}

interface IntervalPlot {
  fn: (x: number) => number;
  color: string;
  a: number;
  b: number;
}

interface DiscretePlot {
  startX: number;
  startY: number;
  n: number;
  color: string;
}

interface SeriesPlot {
  seriesTerm: (n: number, x: number) => number;
  terms: number;
  color: string;
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

  // Verificar si estamos en el navegador
  private isBrowser: boolean;

  // Historial de gráficas
  private functionPlots: FunctionPlot[] = [];
  private intervalPlots: IntervalPlot[] = [];
  private discretePlots: DiscretePlot[] = [];
  private seriesPlots: SeriesPlot[] = [];

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
  public drawFunction(fn: (x: number) => number, color = '#FF0000'): void {
    if (!this.isBrowser) return;

    // Guardar la función en el historial
    this.functionPlots.push({ fn, color });

    // Dibujar la función
    const config: PlotConfig = this.getPlotConfig();
    this.plottingService.drawFunction(config, fn, color);
  }

  /**
   * Dibuja una función en un intervalo específico [a,b]
   */
  public drawFunctionFromAToB(
    fn: (x: number) => number,
    color: string,
    a: number,
    b: number
  ): void {
    if (!this.isBrowser) return;

    // Guardar la función en el historial
    this.intervalPlots.push({ fn, color, a, b });

    // Dibujar la función en el intervalo
    const config: PlotConfig = this.getPlotConfig();
    this.plottingService.drawFunctionFromAToB(config, fn, color, a, b);
  }

  /**
   * Dibuja puntos discretos o líneas verticales
   */
  public drawDiscreteLine(
    startX: number,
    startY: number,
    n: number,
    color: string
  ): void {
    if (!this.isBrowser) return;

    // Guardar el punto discreto en el historial
    this.discretePlots.push({ startX, startY, n, color });

    // Dibujar el punto discreto
    const config: PlotConfig = this.getPlotConfig();
    this.plottingService.drawDiscreteLine(config, startX, startY, n, color);
  }

  /**
   * Dibuja una serie (ej: Serie de Fourier)
   */
  public drawSeries(
    seriesTerm: (n: number, x: number) => number,
    terms: number,
    color: string
  ): void {
    if (!this.isBrowser) return;

    // Guardar la serie en el historial
    this.seriesPlots.push({ seriesTerm, terms, color });

    // Dibujar la serie
    const config: PlotConfig = this.getPlotConfig();
    this.plottingService.drawSeries(config, seriesTerm, terms, color);
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
    };
  }

  private drawScreen(): void {
    if (!this.ctx || !this.isBrowser) return;

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
    });

    // 2. Configuración para dibujar gráficas
    const config: PlotConfig = this.getPlotConfig();

    // 3. Redibujar todas las funciones guardadas
    this.functionPlots.forEach((plot) => {
      this.plottingService.drawFunction(config, plot.fn, plot.color);
    });

    // 4. Redibujar todas las funciones en intervalo
    this.intervalPlots.forEach((plot) => {
      this.plottingService.drawFunctionFromAToB(
        config,
        plot.fn,
        plot.color,
        plot.a,
        plot.b
      );
    });

    // 5. Redibujar todos los puntos discretos
    this.discretePlots.forEach((plot) => {
      this.plottingService.drawDiscreteLine(
        config,
        plot.startX,
        plot.startY,
        plot.n,
        plot.color
      );
    });

    // 6. Redibujar todas las series
    this.seriesPlots.forEach((plot) => {
      this.plottingService.drawSeries(
        config,
        plot.seriesTerm,
        plot.terms,
        plot.color
      );
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

    // Redibujar al cambiar tamaño
    window.addEventListener('resize', () => {
      this.resizeCanvas(canvas);
      this.width = canvas.width;
      this.height = canvas.height;
      this.origin = { x: this.width / 2, y: this.height / 2 };
      this.drawScreen();
    });

    // Implementar zoom dinámico respecto a la posición del cursor
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();

      // Almacena el valor antiguo de 'unit'
      const oldUnit = this.unit;

      // Obtiene la posición del ratón relativa al canvas
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Calcula las coordenadas matemáticas bajo el cursor antes del zoom
      const x0 = (mouseX - this.origin.x + this.offsetX) / oldUnit;
      const y0 = (mouseY - this.origin.y + this.offsetY) / oldUnit;

      // Calcula el factor de zoom
      const zoomSpeed = 0.001;
      const zoomFactor = Math.exp(-event.deltaY * zoomSpeed);

      // Ajusta 'unit' de forma multiplicativa
      this.unit *= zoomFactor;

      // Limita el nivel de zoom
      this.unit = Math.max(this.minZoom, Math.min(this.unit, this.maxZoom));

      // Ajusta offsets para mantener el punto bajo el cursor estacionario
      this.offsetX += x0 * (this.unit - oldUnit);
      this.offsetY += y0 * (this.unit - oldUnit);

      this.drawScreen();
    });

    // Drag start
    canvas.addEventListener('mousedown', (event) => {
      this.drag = true;
      this.mouseX = event.clientX + this.offsetX;
      this.mouseY = event.clientY + this.offsetY;
    });

    // Drag move
    canvas.addEventListener('mousemove', (event) => {
      if (this.drag) {
        this.offsetX = this.mouseX - event.clientX;
        this.offsetY = this.mouseY - event.clientY;
        this.drawScreen();
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
  }
}
