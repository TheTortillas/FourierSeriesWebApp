import { AfterViewInit, Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { CanvasDrawingService } from '../../core/services/canvas-drawing.service';
import { PlottingService } from '../../core/services/plotting.service';
import { PlotConfig } from '../../interfaces/plot-config.interface';

@Component({
  selector: 'app-fourier-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fourier-main.component.html',
  styleUrl: './fourier-main.component.scss',
})
export class FourierMainComponent implements AfterViewInit {
  public sidenavOpen: boolean = false;

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

  private origin: { x: number; y: number } = { x: 0, y: 0 };

  private bgColor: string = '#222';
  private fontColor: string = '#EBEBEB';
  private axisColor: string = '#90DCB5';
  private gridColor: string = '#6BBCAC';

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

    // 3. Dibujar el plano cartesiano vacío
    this.drawScreen();
  }

  // Método para alternar el sidenav
  public toggleSidenav(): void {
    this.sidenavOpen = !this.sidenavOpen;
  }

  // ───────────────────────────────
  // Métodos privados de inicialización
  // ───────────────────────────────

  private getCanvasElement(): HTMLCanvasElement | null {
    return this.document.getElementById(
      'fourier-canvas'
    ) as HTMLCanvasElement | null;
  }

  private initCanvasProperties(canvas: HTMLCanvasElement) {
    // Ajustar el tamaño del canvas al tamaño de su contenedor
    this.resizeCanvas(canvas);

    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.unit = Math.max(75, Math.min(75, Math.floor(this.width / 500)));
    this.origin = { x: this.width / 2, y: this.height / 2 };
  }

  private resizeCanvas(canvas: HTMLCanvasElement) {
    // Hacer que el canvas ocupe todo el espacio disponible de su contenedor
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    } else {
      // Si no tiene contenedor, usar el tamaño de la ventana
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  private initCanvasEvents(canvas: HTMLCanvasElement) {
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
      event.preventDefault(); // Evita el comportamiento de desplazamiento predeterminado

      // Almacena el valor antiguo de 'unit'
      const oldUnit = this.unit;

      // Calcula el factor de zoom
      const zoomSpeed = 0.001; // Ajusta este valor para cambiar la sensibilidad del zoom
      const zoomFactor = Math.exp(-event.deltaY * zoomSpeed);

      // Ajusta 'unit' de forma multiplicativa
      this.unit *= zoomFactor;

      // Limita el nivel de zoom
      this.unit = Math.max(8, Math.min(this.unit, 1000));

      // Vuelve a calcular el factor de zoom real en caso de que 'unit' haya sido limitado
      const actualZoomFactor = this.unit / oldUnit;

      // Obtiene la posición del ratón relativa al canvas
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Calcula las coordenadas matemáticas (x0, y0) bajo el cursor antes del zoom
      const x0 = (mouseX - this.origin.x + this.offsetX) / oldUnit;
      const y0 = (mouseY - this.origin.y + this.offsetY) / oldUnit;

      // Ajusta 'offsetX' y 'offsetY' para mantener el punto bajo el cursor estacionario
      this.offsetX += x0 * (this.unit - oldUnit);
      this.offsetY += y0 * (this.unit - oldUnit);

      this.drawScreen(); // Redibuja el canvas con el nuevo nivel de zoom
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

  // ───────────────────────────────
  // Métodos privados de dibujo
  // ───────────────────────────────

  private drawScreen(): void {
    // Dibuja plano cartesiano (fondo, ejes, grilla)
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
  }

  // Método público que podría ser usado desde fuera para añadir gráficas
  public drawFunction(fn: (x: number) => number, color = '#FF0000'): void {
    const config: PlotConfig = {
      ctx: this.ctx,
      width: this.width,
      height: this.height,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      unit: this.unit,
      origin: this.origin,
    };

    this.plottingService.drawFunction(config, fn, color);
  }
}
