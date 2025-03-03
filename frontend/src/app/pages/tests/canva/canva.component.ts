import { AfterViewInit, Component, Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { CanvasDrawingService } from '../../../core/services/canvas-drawing.service'; 
import { PlottingService } from '../../../core/services/plotting.service'; 

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

    // 3. Primer dibujado
    this.drawScreen();
  }

   /**
   * 1. Método para obtener el elemento canvas 
   */
   private getCanvasElement(): HTMLCanvasElement | null {
    return this.document.getElementById('stage') as HTMLCanvasElement | null;
  }

  /**
   * 2. Método que inicializa propiedades (contexto, width, height, etc.)
   */
  private initCanvasProperties(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.unit = Math.max(75, Math.min(75, Math.floor(this.width / 500)));
    this.origin = { x: this.width / 2, y: this.height / 2 };
  }

  /**
   * 3. Método que configura los eventos (wheel, mousedown, mousemove, resize, etc.)
   */
  private initCanvasEvents(canvas: HTMLCanvasElement) {
    window.onresize = () => {
      this.width = canvas.width;
      this.height = canvas.height;
      this.drawScreen();
    };
    canvas.onwheel = (event) => {
      this.unit -= event.deltaY / 10;
      if (this.unit < 8)  this.unit = 8;
      if (this.unit > 1000) this.unit = 1000;
      this.drawScreen();
    };
    canvas.onmousedown = (event) => {
      this.drag = true;
      this.mouseX = event.clientX + this.offsetX;
      this.mouseY = event.clientY + this.offsetY;
    };
    canvas.onmousemove = (event) => {
      if (this.drag) {
        this.offsetX = this.mouseX - event.clientX;
        this.offsetY = this.mouseY - event.clientY;
        this.drawScreen();
      }
    };
    canvas.onmouseup = () => {
      this.drag = false;
    };
  }

 /**
 * 4. Método que dibuja el plano cartesiano completo (fondo, ejes, cuadrícula)
 */
  private drawScreen(): void {
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
}
