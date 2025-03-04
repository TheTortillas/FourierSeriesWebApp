import { AfterViewInit, Component, Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { CanvasDrawingService } from '../../../core/services/canvas-drawing.service'; 
import { PlottingService } from '../../../core/services/plotting.service'; 
import { PlotConfig } from '../../../interfaces/plot-config.interface';

@Component({
  selector: 'app-canva',
  standalone: true,
  imports: [],
  templateUrl: './canva.component.html',
  styleUrl: './canva.component.scss'
})

@Injectable()
export class CanvaComponent implements AfterViewInit {
  private isBrowser: boolean;
  private ctx: CanvasRenderingContext2D | null = null;
  private width: number = 0;
  private height: number = 0;
  private unit: number = 0;
  
  private drag: boolean = false;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private mouseX: number = 0;
  private mouseY: number = 0;

  private origin: { x: number, y: number } = { x: 0, y: 0 };

  private bgColor: string = "#222";
  private fontColor: string = "#EBEBEB";
  private axisColor: string = "#90DCB5";
  private gridColor: string = "#6BBCAC";

  // ───────────────────────────────
  // Arreglos para las distintas gráficas
  // ───────────────────────────────
  private functionPlots: Array<{ fn: (x: number) => number; color: string }> = [];
  private discretePlots: Array<{ startX: number; startY: number; n: number; color: string }> = [];
  private intervalPlots: Array<{ fn: (x: number) => number; color: string; a: number; b: number }> = [];
  private seriesPlots: Array<{ seriesTerm: (n: number, x: number) => number; terms: number; color: string }> = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document,
    private canvasDrawingService: CanvasDrawingService,
    private plottingService: PlottingService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

ngAfterViewInit(): void {
  if (!this.isBrowser) return;
    
  const canvas = this.getCanvasElement();
  if (!canvas?.getContext) return;
    
  // 1. Inicializar propiedades del canvas
  this.initCanvasProperties(canvas);

  // 2. Inicializar eventos (zoom, drag, resize)
  this.initCanvasEvents(canvas);

  // 3. Inicializar listeners de botones e inputs
  this.initEventListeners();

  // 4. Dibujar el plano cartesiano vacío (sin funciones)
  this.drawScreen();
}

  // ───────────────────────────────
  // Métodos privados de inicialización
  // ───────────────────────────────

  private getCanvasElement(): HTMLCanvasElement | null {
    return this.document.getElementById('stage') as HTMLCanvasElement | null;
  }

  private initCanvasProperties(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.unit = Math.max(75, Math.min(75, Math.floor(this.width / 500)));
    this.origin = { x: this.width / 2, y: this.height / 2 };
  }

  private initCanvasEvents(canvas: HTMLCanvasElement) {
    // Redibujar al cambiar tamaño
    window.onresize = () => {
      this.width = canvas.width;
      this.height = canvas.height;
      this.drawScreen();
    };
    // Redibujar al hacer zoom
    canvas.onwheel = (event) => {
      this.unit -= event.deltaY / 10;
      if (this.unit < 8) this.unit = 8;
      if (this.unit > 1000) this.unit = 1000;
      this.drawScreen();
    };
    // Drag start
    canvas.onmousedown = (event) => {
      this.drag = true;
      this.mouseX = event.clientX + this.offsetX;
      this.mouseY = event.clientY + this.offsetY;
    };
    // Drag move
    canvas.onmousemove = (event) => {
      if (this.drag) {
        this.offsetX = this.mouseX - event.clientX;
        this.offsetY = this.mouseY - event.clientY;
        this.drawScreen();
      }
    };
    // Drag end
    canvas.onmouseup = () => {
      this.drag = false;
    };
  }

  // ───────────────────────────────
  // Métodos privados de dibujo
  // ───────────────────────────────

  private drawScreen(): void {
    // 1) Dibuja plano cartesiano (fondo, ejes, grilla)
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

    // 2) Dibuja todas las gráficas guardadas
    this.drawAllPlots();
  }

  private drawAllPlots(): void {
    const config: PlotConfig = {
      ctx: this.ctx,
      width: this.width,
      height: this.height,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      unit: this.unit,
      origin: this.origin,
    };

    // Funciones en todo el canvas
    this.functionPlots.forEach(plot => {
      this.plottingService.drawFunction(config, plot.fn, plot.color);
    });

    // Líneas/puntos discretos
    this.discretePlots.forEach(plot => {
      this.plottingService.drawDiscreteLine(config, plot.startX, plot.startY, plot.n, plot.color);
    });

    // Funciones en intervalos
    this.intervalPlots.forEach(plot => {
      this.plottingService.drawFunctionFromAToB(config, plot.fn, plot.color, plot.a, plot.b);
    });

    // Series
    this.seriesPlots.forEach(plot => {
      this.plottingService.drawSeries(config, plot.seriesTerm, plot.terms, plot.color);
    });
  }

  private initEventListeners(): void {
    // 1) Botón para graficar función y = f(x)
    const plotFunctionBtn = this.document.getElementById('plot-function') as HTMLButtonElement;
    plotFunctionBtn?.addEventListener('click', () => {
      // Lee inputs
      const fnInput = (this.document.getElementById('function-input') as HTMLInputElement).value;
      const colorInput = (this.document.getElementById('function-color') as HTMLInputElement).value || '#FF0000';
  
      if (!fnInput) return; // Si está vacío, no hace nada.
  
      try {
        // Crea una función a partir del string
        const fn = new Function('x', `return ${fnInput}`) as (x: number) => number;
  
        // Solo UNA función => limpias el array
        this.functionPlots = [];
        // Agregas la nueva
        this.addFunction(fn, colorInput);
  
      } catch (error) {
        console.error('Error al parsear la función:', error);
      }
    });
  
    // 2) Botón para graficar función en un intervalo
    const plotIntervalBtn = this.document.getElementById('plot-interval') as HTMLButtonElement;
    plotIntervalBtn?.addEventListener('click', () => {
      const fnInput = (this.document.getElementById('interval-function-input') as HTMLInputElement).value;
      const aInput = (this.document.getElementById('interval-a') as HTMLInputElement).value;
      const bInput = (this.document.getElementById('interval-b') as HTMLInputElement).value;
      const colorInput = (this.document.getElementById('interval-color') as HTMLInputElement).value || '#00FFAA';
  
      if (!fnInput || !aInput || !bInput) return;
  
      try {
        const fn = new Function('x', `return ${fnInput}`) as (x: number) => number;
        const a = parseFloat(aInput);
        const b = parseFloat(bInput);
  
        // Solo UNA función de intervalo => limpias el array
        this.intervalPlots = [];
        // Agregas la nueva
        this.addIntervalFunction(fn, a, b, colorInput);
  
      } catch (error) {
        console.error('Error al parsear la función de intervalo:', error);
      }
    });
  
    // 3) Botón para graficar punto discreto
    const plotDiscreteBtn = this.document.getElementById('plot-discrete') as HTMLButtonElement;
    plotDiscreteBtn?.addEventListener('click', () => {
      const xInput = (this.document.getElementById('discrete-x') as HTMLInputElement).value;
      const yInput = (this.document.getElementById('discrete-y') as HTMLInputElement).value;
      const nInput = (this.document.getElementById('discrete-n') as HTMLInputElement).value;
      const colorInput = (this.document.getElementById('discrete-color') as HTMLInputElement).value || '#FFFF00';
  
      if (!xInput || !yInput || !nInput) return;
  
      // A diferencia de las otras, aquí SÍ acumulamos
      const startX = parseFloat(xInput);
      const startY = parseFloat(yInput);
      const n = parseFloat(nInput);
      
      this.addDiscrete(startX, startY, n, colorInput);
    });
  
    // 4) Botón para graficar serie de funciones
    const plotSeriesBtn = this.document.getElementById('plot-series') as HTMLButtonElement;
    plotSeriesBtn?.addEventListener('click', () => {
      const seriesInput = (this.document.getElementById('series-input') as HTMLInputElement).value;
      const termsInput = (this.document.getElementById('series-terms') as HTMLInputElement).value;
      const colorInput = (this.document.getElementById('series-color') as HTMLInputElement).value || '#FF55FF';
  
      if (!seriesInput || !termsInput) return;
  
      try {
        // Por ejemplo, si seriesInput = "Math.sin(n*x)/n"
        // creamos una función con parámetros (n, x)
        const seriesTerm = new Function('n', 'x', `return ${seriesInput}`) as (n: number, x: number) => number;
        const terms = parseInt(termsInput, 10);
  
        // Solo UNA serie => limpias el array
        this.seriesPlots = [];
        // Agregas la nueva
        this.addSeries(seriesTerm, terms, colorInput);
  
      } catch (error) {
        console.error('Error al parsear la serie:', error);
      }
    });
  
    // 5) Botón para limpiar el canvas
    const clearCanvasBtn = this.document.getElementById('clear-canvas') as HTMLButtonElement;
    clearCanvasBtn?.addEventListener('click', () => {
      // Limpia todos los arreglos
      this.functionPlots = [];
      this.discretePlots = [];
      this.intervalPlots = [];
      this.seriesPlots = [];
  
      // Redibuja la pantalla en blanco
      this.drawScreen();
    });
  }
  

  // ───────────────────────────────
  // Métodos públicos para añadir gráficas dinámicamente
  // ───────────────────────────────

  /**
   * Agrega una función a graficar en todo el dominio [canvas.width], y redibuja.
   */
  public addFunction(fn: (x: number) => number, color = '#FF0000'): void {
    this.functionPlots.push({ fn, color });
    this.drawScreen();
  }

  public addDiscrete(startX: number, startY: number, n: number, color: string): void {
    this.discretePlots.push({ startX, startY, n, color });
    this.drawScreen();
  }

  public addIntervalFunction(fn: (x: number) => number, a: number, b: number, color = '#00FFAA'): void {
    this.intervalPlots.push({ fn, a, b, color });
    this.drawScreen();
  }

  public addSeries(seriesTerm: (n: number, x: number) => number, terms: number, color = '#FF55FF'): void {
    this.seriesPlots.push({ seriesTerm, terms, color });
    this.drawScreen();
  }
}
