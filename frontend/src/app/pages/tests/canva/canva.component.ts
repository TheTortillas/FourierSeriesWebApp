import { AfterViewInit, Component } from '@angular/core';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-canva',
  standalone: true,
  imports: [],
  templateUrl: './canva.component.html',
  styleUrl: './canva.component.scss'
})

@Injectable()
export class CanvaComponent {
 private isBrowser: boolean;                           // Variable para saber si el código se está ejecutando en el navegador
  private ctx: CanvasRenderingContext2D | null = null;  // Contexto del canvas
  private width: number = 0;                            // Ancho del canvas 
  private height: number = 0;                           // Alto del canvas
  private unit: number = 0;                             // Unidad de medida para la cuadrícula
  
  private drag: boolean = false;                        // Variable para saber si se está arrastrando el canvas
  private offsetX: number = 0;                          // Offset en X  (para arrastrar el canvas)
  private offsetY: number = 0;                          // Offset en Y  (para arrastrar el canvas)
  private mouseX: number = 0;                           // Posición del ratón en X            
  private mouseY: number = 0;                           // Posición del ratón en Y 

  private origin: { x: number, y: number } = { x: 0, y: 0 };  // Origen del plano cartesiano

  private bgColor: string = "#222";                     // Color de fondo del canvas
  private fontColor: string = "#EBEBEB";                // Color de la fuente
  private axisColor: string = "#90DCB5";                // Color de los ejes X y Y
  private gridColor: string = "#6BBCAC";                // Color de la cuadrícula

  // Constructor de la clase
  constructor(@Inject(PLATFORM_ID) private platformId: Object, @Inject(DOCUMENT) private document: Document) {
    this.isBrowser = isPlatformBrowser(this.platformId);  // Verifica si el código se está ejecutando en el navegador
  }

  // Función que se ejecuta después de que la vista se haya inicializado
  ngAfterViewInit(): void {
    // Verifica si el código se está ejecutando en el navegador
    if (this.isBrowser) {
      const canvas = <HTMLCanvasElement>this.document.getElementById('stage'); // Obtiene el canvas

      // Verifica si el canvas es soportado por el navegador
      if (canvas.getContext) {
        this.ctx = canvas.getContext('2d');               // Obtiene el contexto del canvas
        this.width = canvas.width;                        // Obtiene el ancho del canvas
        this.height = canvas.height;                      // Obtiene el alto del canvas
        this.unit = Math.max(75, Math.min(75, Math.floor(this.width / 500))); // Establece la unidad de medida para la cuadrícula
        this.origin = { x: this.width / 2, y: this.height / 2 }; // Establece el origen del plano cartesiano
         
        // Evento para redimensionar el canvas
        window.onresize = (event) => {
          this.width = canvas.width;
          this.height = canvas.height;
          this.drawScreen();
        };

        // Evento para hacer zoom con la rueda del ratón
        canvas.onwheel = (event) => {
          // Ajusta el nivel/velocidad de zoom
          this.unit -= event.deltaY / 10;  

          // Limita el nivel de zoom mínimo
          if (this.unit < 8) {
            // Este es el nivel de zoom mínimo.
            this.unit = 8;  
          }

          // Limita el nivel de zoom máximo
          if (this.unit > 1000) {
            // Este es el nivel de zoom máximo.
            this.unit = 1000;  
          }

          // Redibuja el canvas con el nuevo nivel de zoom
          this.drawScreen();  
        };

        // Evento para arrastrar el canvas
        canvas.onmousedown = (event) => {
          this.drag = true;
          this.mouseX = event.clientX + this.offsetX;
          this.mouseY = event.clientY + this.offsetY;
        };

        // Eventos para arrastrar el canvas
        canvas.onmousemove = (event) => {
          let currentMouseX = event.clientX;    
          let currentMouseY = event.clientY;

          // Verifica si se está arrastrando el canvas
          if (this.drag) {
            this.offsetX = this.mouseX - currentMouseX;
            this.offsetY = this.mouseY - currentMouseY;
            this.drawScreen();
          }
        };

        // Eventos para arrastrar el canvas
        canvas.onmouseup = (event) => {
          this.drag = false;
        };

        // Dibuja el plano cartesiano
        this.drawScreen();
      }
    }
  }

  // Función para dibujar el plano cartesiano (ejes y cuadrícula)
  drawScreen() {
    // Verifica si el contexto del canvas es nulo
    if (!this.ctx) return;
    
    // Limpia el canvas
    this.ctx.clearRect(0, 0, this.width, this.height);  // Limpia el canvas
    this.ctx.fillStyle = this.bgColor;                  // Establece el color de fondo del canvas
    this.ctx.fillRect(0, 0, this.width, this.height);   // Dibuja el fondo del canvas

    // Establece el estilo de la fuente
    this.ctx.font = "14px CMU Serif";

    // Dibuja el eje X 
    const XAxis = {
      start: { x: 0, y: this.height / 2 },        // Punto de inicio del eje X
      end: { x: this.width, y: this.height / 2 }  // Punto final del eje X
    };

    // Dibuja el eje Y
    const YAxis = {
      start: { x: this.width / 2, y: 0 },         // Punto de inicio del eje Y
      end: { x: this.width / 2, y: this.height }  // Punto final del eje Y
    };

    // Establece el origen del plano cartesiano
    this.origin = { x: this.width / 2, y: this.height / 2 };

    // Dibuja los ejes X y Y
    this.drawAxes(XAxis, YAxis, this.axisColor);
    // Dibuja la cuadrícula de los ejes X y Y
    this.drawGrid(this.origin, XAxis, YAxis, this.unit, this.gridColor, this.fontColor);
  }

  // FUnción para dibujar los ejes X y Y
  drawAxes(XAxis: any, YAxis: any, axisColor: string) {
    // Verifica si el contexto del canvas es nulo
    if (!this.ctx) return;

    // Dibuja los ejes X y Y
    this.ctx.beginPath();
    this.ctx.moveTo(XAxis.start.x, XAxis.start.y - this.offsetY);   // X Axis
    this.ctx.lineTo(XAxis.end.x, XAxis.end.y - this.offsetY);       // X Axis
    this.ctx.moveTo(YAxis.start.x - this.offsetX, YAxis.start.y);   // Y Axis
    this.ctx.lineTo(YAxis.end.x - this.offsetX, YAxis.end.y);       // Y Axis
    this.ctx.strokeStyle = axisColor;                               // Color de los ejes X y Y
    this.ctx.lineWidth = 1;                                         // Grosor de los ejes X y Y         
    this.ctx.stroke();                                              // Dibuja los ejes X y Y         
  }

  // Función para dibujar la cuadrícula de los ejes X y Y
  drawGrid(origin: any, XAxis: any, YAxis: any, unit: number, gridColor: string, fontColor: string) {
    // Verifica si el contexto del canvas es nulo
    if (!this.ctx) return;

    this.ctx.strokeStyle = gridColor;     // Color de la cuadrícula
    this.ctx.fillStyle = fontColor;       // Color de la fuente

    let cuadrosGrandesFrecuencia = (unit >= 65) ? 1 : 5;  // Frecuencia de los cuadros grandes

    // Dibujar líneas verticales
    for (let i = -1000; i < 1000; i++) {
      const x = origin.x + unit * i - this.offsetX;

      // Dibujar líneas pequeñas
      if (unit >= 25 && cuadrosGrandesFrecuencia === 1) {
        for (let j = 1; j < 5; j++) {
          const smallX = x + unit * (j / 5);
          this.ctx.beginPath();
          this.ctx.moveTo(smallX, YAxis.start.y);
          this.ctx.lineTo(smallX, YAxis.end.y);
          this.ctx.lineWidth = 0.25;
          this.ctx.stroke();
        }
      }

      this.ctx.beginPath();
      this.ctx.moveTo(x, YAxis.start.y);
      this.ctx.lineTo(x, YAxis.end.y);
      this.ctx.lineWidth = (i % cuadrosGrandesFrecuencia === 0) ? 1 : 0.25;
      this.ctx.stroke();

      // Dibujar números en el eje X
      if (i !== 0 && i % cuadrosGrandesFrecuencia === 0) {
        this.ctx.fillText(i.toString(), x, origin.y - this.offsetY);
      }
    }

    // Dibujar líneas horizontales
    for (let i = -1000; i < 1000; i++) {
      const y = origin.y + unit * i - this.offsetY;
      
      // Dibujar líneas pequeñas
      if (unit >= 25 && cuadrosGrandesFrecuencia === 1) {
        for (let j = 1; j < 5; j++) {
          const smallY = y + unit * (j / 5);
          this.ctx.beginPath();
          this.ctx.moveTo(XAxis.start.x, smallY);
          this.ctx.lineTo(XAxis.end.x, smallY);
          this.ctx.lineWidth = 0.25;
          this.ctx.stroke();
        }
      }

      this.ctx.beginPath();
      this.ctx.moveTo(XAxis.start.x, y);
      this.ctx.lineTo(XAxis.end.x, y);
      this.ctx.lineWidth = (i % cuadrosGrandesFrecuencia === 0) ? 1 : 0.25;
      this.ctx.stroke();

      if (i !== 0 && i % cuadrosGrandesFrecuencia === 0) {
        this.ctx.fillText((-i).toString(), origin.x - this.offsetX, y);
      }
    }
  }
}