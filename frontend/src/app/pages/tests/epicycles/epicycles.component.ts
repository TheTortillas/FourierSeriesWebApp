import { AfterViewInit, Component, Inject, ViewChild, OnDestroy } from '@angular/core';
import { isPlatformBrowser, DOCUMENT, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartesianCanvasComponent } from '../../../shared/components/cartesian-canvas/cartesian-canvas.component';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { PlotConfig } from '../../../interfaces/plot-config.interface';

interface EpicycleData {
  amplitude: number;
  frequency: number;
  phase: number;
  color: string;
}

@Component({
  selector: 'app-epicycles',
  standalone: true,
  imports: [CommonModule, FormsModule, CartesianCanvasComponent],
  templateUrl: './epicycles.component.html',
  styleUrl: './epicycles.component.scss',
})
export class EpicyclesComponent implements AfterViewInit, OnDestroy {
  @ViewChild(CartesianCanvasComponent) cartesianCanvas!: CartesianCanvasComponent;

  // Configuración del canvas
  public isDarkMode = true;
  public bgColor = '#1a1a1a';
  public axisColor = '#4a5568';
  public gridColor = '#2d3748';
  public fontColor = '#e2e8f0';

  // Variables de animación
  private animationId: number | null = null;
  public time = 0;
  public isAnimating = false;
  private animationSpeed = 0.02;

  // Canvas context
  private ctx: CanvasRenderingContext2D | null = null;
  
  // Variables para detectar drag sin modificar el CartesianCanvasComponent
  private isMouseDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private isDragDetected = false;
  private wasAnimatingBeforeDrag = false; // Para recordar el estado antes del drag

  // Variables para el sistema de dibujo y DFT
  public showDrawingModal = false;
  private drawingCanvas: HTMLCanvasElement | null = null;
  private drawingCtx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private drawingPath: { x: number; y: number }[] = [];
  private sampledPath: { x: number; y: number }[] = [];
  public samplePoints = 200; // Número de puntos para muestrear
  public maxSamplePoints = 500;
  private dftEpicycles: EpicycleData[] = [];
  public epicycleCount = 50; // Número de epiciclos DFT a mostrar
  public maxEpicycleCount = 0;
  public showDftVisualization = false;
  
  // Toggles de visualización
  public showSampledPoints = false;
  public showApproximation = true;
  public showTrace = true; // Toggle para mostrar la estela

  // Variables para carga de datos
  public showDataModal = false;
  public csvData = '';
  public predefinedShapes: { [key: string]: string } = {
    'trex': `4884.994140222705,3584.99743634464
4875.836855173111,3580.9866884350777
4866.673131857533,3576.9703737233067
4857.5121613405645,3572.958475294523
4848.3566977112205,3568.957416277917
4839.184668243397,3564.9650966139743
4830.010255872912,3561.0043954251887
4821.000556945801,3556.658254623413
4812.251152800163,3551.8164255370502
4803.668696916895,3546.6828110492206
4795.223321330966,3541.3383213672205
4786.898873329163,3535.8063876628876
4778.740135373373,3530.0167272531107`,
    'circle': `100,0
98.48,17.36
93.96,34.2
86.6,50
76.6,64.28
64.28,76.6
50,86.6
34.2,93.96
17.36,98.48
0,100
-17.36,98.48
-34.2,93.96
-50,86.6
-64.28,76.6
-76.6,64.28
-86.6,50
-93.96,34.2
-98.48,17.36
-100,0
-98.48,-17.36
-93.96,-34.2
-86.6,-50
-76.6,-64.28
-64.28,-76.6
-50,-86.6
-34.2,-93.96
-17.36,-98.48`,
    'heart': `0,100
20,90
40,70
60,40
70,0
60,-30
40,-50
20,-60
0,-65
-20,-60
-40,-50
-60,-30
-70,0
-60,40
-40,70
-20,90`
  };

  // Variables para tracking del canvas
  private lastCanvasState = {
    offsetX: 0,
    offsetY: 0,
    unit: 75,
    scaleX: 1,
    scaleY: 1
  };

  // Datos de epiciclos
  public epicycles: EpicycleData[] = [
    { amplitude: 2, frequency: 1, phase: 0, color: '#ff6b6b' },
    { amplitude: 1.5, frequency: 2, phase: Math.PI / 4, color: '#4ecdc4' },
    { amplitude: 0.8, frequency: 3, phase: Math.PI / 2, color: '#45b7d1' },
    { amplitude: 0.5, frequency: 5, phase: 0, color: '#f9ca24' }
  ];

  // Historial de trazado
  public tracePoints: { x: number; y: number }[] = [];
  private maxTracePoints = 500;

  // Exponer Math para el template
  public Math = Math;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private plottingService: PlottingService
  ) {}

  ngAfterViewInit(): void {
    this.initEventListeners();
    this.setupCanvas();
  }

  ngOnDestroy(): void {
    this.isAnimating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  onCanvasReady(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
    this.setupMouseListeners();
    this.updateLastCanvasState();
    // Iniciar el bucle de renderizado para mostrar los epiciclos inmediatamente
    this.ensureRenderLoop();
  }

  private checkViewChanged(): boolean {
    if (!this.cartesianCanvas) return false;
    
    // Usar reflexión para acceder a las propiedades privadas del CartesianCanvasComponent
    const canvas = this.cartesianCanvas as any;
    
    return (
      this.lastCanvasState.offsetX !== canvas.offsetX ||
      this.lastCanvasState.offsetY !== canvas.offsetY ||
      this.lastCanvasState.unit !== canvas.unit ||
      this.lastCanvasState.scaleX !== canvas.scaleX ||
      this.lastCanvasState.scaleY !== canvas.scaleY
    );
  }

  private updateLastCanvasState(): void {
    if (!this.cartesianCanvas) return;
    
    const canvas = this.cartesianCanvas as any;
    this.lastCanvasState = {
      offsetX: canvas.offsetX || 0,
      offsetY: canvas.offsetY || 0,
      unit: canvas.unit || 75,
      scaleX: canvas.scaleX || 1,
      scaleY: canvas.scaleY || 1
    };
  }

  private getPlotConfig(): PlotConfig | null {
    if (!this.cartesianCanvas) return null;
    
    const canvas = this.cartesianCanvas as any;
    return {
      ctx: this.ctx,
      width: canvas.width || 0,
      height: canvas.height || 0,
      offsetX: canvas.offsetX || 0,
      offsetY: canvas.offsetY || 0,
      unit: canvas.unit || 75,
      origin: canvas.origin || { x: (canvas.width || 0) / 2, y: (canvas.height || 0) / 2 },
      xAxisScale: 'integer',
      xAxisFactor: 1,
      scaleX: canvas.scaleX || 1,
      scaleY: canvas.scaleY || 1,
    };
  }



  private setupMouseListeners(): void {
    if (!this.ctx?.canvas) return;
    
    const canvas = this.ctx.canvas;
    
    // Detectar cuando empieza el drag
    canvas.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.isDragDetected = false;
    });
    
    // Detectar movimiento durante drag
    canvas.addEventListener('mousemove', (e) => {
      if (this.isMouseDown) {
        const deltaX = Math.abs(e.clientX - this.lastMouseX);
        const deltaY = Math.abs(e.clientY - this.lastMouseY);
        if (deltaX > 3 || deltaY > 3) { // Umbral para considerar drag
          if (!this.isDragDetected) {
            // Primera vez que detectamos drag, recordar si estaba animando
            this.wasAnimatingBeforeDrag = this.isAnimating;
            // Pausar solo la animación del tiempo, no el bucle de renderizado
            this.isAnimating = false;
            this.isDragDetected = true;
          }
          // Asegurar que el renderizado continúe durante el drag
          this.ensureRenderLoop();
        }
      }
    });
    
    // Detectar cuando termina el drag
    canvas.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      if (this.isDragDetected) {
        // Si la animación estaba corriendo antes del drag, reanudarla
        if (this.wasAnimatingBeforeDrag) {
          this.startAnimation();
        }
        this.isDragDetected = false;
        this.wasAnimatingBeforeDrag = false;
      }
    });
    
    canvas.addEventListener('mouseleave', () => {
      this.isMouseDown = false;
      if (this.isDragDetected) {
        // Si la animación estaba corriendo antes del drag, reanudarla
        if (this.wasAnimatingBeforeDrag) {
          this.startAnimation();
        }
        this.isDragDetected = false;
        this.wasAnimatingBeforeDrag = false;
      }
    });

    // También detectar eventos táctiles para dispositivos móviles
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isMouseDown = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
        this.isDragDetected = false;
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      if (this.isMouseDown && e.touches.length === 1) {
        const deltaX = Math.abs(e.touches[0].clientX - this.lastMouseX);
        const deltaY = Math.abs(e.touches[0].clientY - this.lastMouseY);
        if (deltaX > 3 || deltaY > 3) {
          if (!this.isDragDetected) {
            // Primera vez que detectamos drag táctil, recordar si estaba animando
            this.wasAnimatingBeforeDrag = this.isAnimating;
            // Pausar solo la animación del tiempo, no el bucle de renderizado
            this.isAnimating = false;
            this.isDragDetected = true;
          }
          // Asegurar que el renderizado continúe durante el drag táctil
          this.ensureRenderLoop();
        }
      }
    });

    canvas.addEventListener('touchend', () => {
      this.isMouseDown = false;
      if (this.isDragDetected) {
        // Si la animación estaba corriendo antes del drag, reanudarla
        if (this.wasAnimatingBeforeDrag) {
          this.startAnimation();
        }
        this.isDragDetected = false;
        this.wasAnimatingBeforeDrag = false;
      }
    });
  }

  private setupCanvas(): void {
    if (this.cartesianCanvas) {
      // Configurar el canvas para centrar en el origen
      this.cartesianCanvas.resetView();
      // No iniciar la animación automáticamente, solo el bucle de renderizado
      this.ensureRenderLoop();
    }
  }

  private initEventListeners(): void {
    setTimeout(() => {
      // Botón para iniciar/pausar animación
      const toggleBtn = this.document.getElementById('toggle-animation') as HTMLButtonElement;
      toggleBtn?.addEventListener('click', () => {
        this.toggleAnimation();
      });

      // Botón para limpiar el trazado
      const clearBtn = this.document.getElementById('clear-trace') as HTMLButtonElement;
      clearBtn?.addEventListener('click', () => {
        this.clearTrace();
      });

      // Botón para resetear vista
      const resetBtn = this.document.getElementById('reset-view') as HTMLButtonElement;
      resetBtn?.addEventListener('click', () => {
        this.resetView();
      });

      // Controles de velocidad
      const speedSlider = this.document.getElementById('speed-slider') as HTMLInputElement;
      speedSlider?.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement;
        this.animationSpeed = parseFloat(target.value);
      });

      // Agregar epiciclo
      const addBtn = this.document.getElementById('add-epicycle') as HTMLButtonElement;
      addBtn?.addEventListener('click', () => {
        this.addRandomEpicycle();
      });

      // Remover último epiciclo
      const removeBtn = this.document.getElementById('remove-epicycle') as HTMLButtonElement;
      removeBtn?.addEventListener('click', () => {
        this.removeLastEpicycle();
      });

      // Botón para abrir modal de dibujo
      const drawBtn = this.document.getElementById('draw-btn') as HTMLButtonElement;
      drawBtn?.addEventListener('click', () => {
        this.openDrawingModal();
      });

    }, 100);
  }

  private startAnimation(): void {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    this.ensureRenderLoop();
  }

  private stopAnimation(): void {
    this.isAnimating = false;
    // No cancelar el animationFrame aquí para mantener el redibujado adaptativo
    // Solo se cancela cuando se destruye el componente
  }

  private ensureRenderLoop(): void {
    if (this.animationId === null) {
      this.animate();
    }
  }

  private drawWithEpicycles(): void {
    if (!this.cartesianCanvas || !this.ctx) return;

    const canvas2D = this.cartesianCanvas as any;
    
    // Cancelar cualquier redibujado pendiente del CartesianCanvasComponent
    if (canvas2D.redrawAnimationFrame !== null) {
      cancelAnimationFrame(canvas2D.redrawAnimationFrame);
      canvas2D.redrawAnimationFrame = null;
    }
    
    // Limpiar canvas completamente
    this.ctx.clearRect(0, 0, canvas2D.width, canvas2D.height);
    
    // Redibujar plano cartesiano de forma síncrona
    if (canvas2D.canvasDrawingService) {
      canvas2D.canvasDrawingService.drawScreen({
        ctx: this.ctx,
        width: canvas2D.width,
        height: canvas2D.height,
        offsetX: canvas2D.offsetX || 0,
        offsetY: canvas2D.offsetY || 0,
        origin: canvas2D.origin || { x: canvas2D.width / 2, y: canvas2D.height / 2 },
        bgColor: this.bgColor,
        axisColor: this.axisColor,
        gridColor: this.gridColor,
        fontColor: this.fontColor,
        unit: canvas2D.unit || 75,
        xAxisScale: canvas2D.xAxisScale || 'integer',
        xAxisFactor: canvas2D.xAxisFactor || 1,
        scaleX: canvas2D.scaleX || 1,
        scaleY: canvas2D.scaleY || 1,
      });
    }
    
    // Redibujar todas las funciones guardadas de forma síncrona
    const config = this.getPlotConfig();
    if (config && canvas2D.plottingService) {
      // Funciones normales
      if (canvas2D.functionPlots) {
        canvas2D.functionPlots.forEach((plot: any) => {
          canvas2D.plottingService.drawFunction(
            config,
            plot.fn,
            plot.color,
            plot.lineWidth || 2
          );
        });
      }
      
      // Funciones en intervalo
      if (canvas2D.intervalPlots) {
        canvas2D.intervalPlots.forEach((plot: any) => {
          canvas2D.plottingService.drawFunctionFromAToB(
            config,
            plot.fn,
            plot.color,
            plot.a,
            plot.b,
            plot.lineWidth || 2
          );
        });
      }
      
      // Puntos discretos
      if (canvas2D.discretePlots) {
        canvas2D.discretePlots.forEach((plot: any) => {
          canvas2D.plottingService.drawDiscreteLine(
            config,
            plot.startX,
            plot.startY,
            plot.n,
            plot.color,
            plot.lineWidth || 2.5
          );
        });
      }
      
      // Series
      if (canvas2D.seriesPlots) {
        canvas2D.seriesPlots.forEach((plot: any) => {
          canvas2D.plottingService.drawSeries(
            config,
            plot.seriesTerm,
            plot.terms,
            plot.color,
            plot.lineWidth || 2
          );
        });
      }
    }
    
    // Ahora dibujar nuestros elementos encima
    // Dibujar elementos DFT si están habilitados
    if (this.showDftVisualization) {
      this.drawDftElements();
    }

    // Dibujar epiciclos
    this.drawEpicycles();

    // Dibujar el trazado si está habilitado
    if (this.showTrace) {
      this.drawTrace();
    }
  }

  private animate(): void {
    if (!this.cartesianCanvas || !this.ctx) return;

    // Verificar si la vista del canvas ha cambiado
    const hasViewChanged = this.checkViewChanged();
    if (hasViewChanged) {
      this.updateLastCanvasState();
    }

    // En lugar de limpiar nosotros, usar el sistema del CartesianCanvasComponent
    // pero extender su drawScreen para incluir nuestros epiciclos
    this.drawWithEpicycles();

    // Agregar punto al trazado solo si la animación está activa
    if (this.isAnimating) {
      const finalPoint = this.calculateEpicyclesFinalPoint();
      if (finalPoint) {
        this.tracePoints.push(finalPoint);
        
        // Limitar el número de puntos del trazado
        if (this.tracePoints.length > this.maxTracePoints) {
          this.tracePoints = this.tracePoints.slice(-this.maxTracePoints);
        }
      }
    }

    // Incrementar tiempo solo si está animando
    if (this.isAnimating) {
      this.time += this.animationSpeed;
    }

    // Continuar el bucle de renderizado
    this.animationId = requestAnimationFrame(() => this.animate());
  }



  private calculateEpicyclesFinalPoint(): { x: number; y: number } | null {
    let currentX = 0;
    let currentY = 0;

    // Elegir qué epiciclos calcular
    const activeEpicycles = this.showDftVisualization 
      ? this.dftEpicycles.slice(0, this.epicycleCount)
      : this.epicycles;

    // Calcular cada epiciclo
    activeEpicycles.forEach((epicycle) => {
      const angle = this.time * epicycle.frequency + epicycle.phase;
      currentX += epicycle.amplitude * Math.cos(angle);
      currentY += epicycle.amplitude * Math.sin(angle);
    });

    return { x: currentX, y: currentY };
  }

  private drawEpicycles(): { x: number; y: number } | null {
    if (!this.cartesianCanvas) return null;

    let currentX = 0;
    let currentY = 0;

    // Elegir qué epiciclos dibujar
    const activeEpicycles = this.showDftVisualization 
      ? this.dftEpicycles.slice(0, this.epicycleCount)
      : this.epicycles;

    // Dibujar cada epiciclo
    activeEpicycles.forEach((epicycle, index) => {
      const prevX = currentX;
      const prevY = currentY;

      // Calcular nueva posición
      const angle = this.time * epicycle.frequency + epicycle.phase;
      currentX = prevX + epicycle.amplitude * Math.cos(angle);
      currentY = prevY + epicycle.amplitude * Math.sin(angle);

      // Dibujar círculo del epiciclo
      this.drawCircle(prevX, prevY, epicycle.amplitude, epicycle.color, 1);

      // Dibujar línea radial
      this.drawLine(prevX, prevY, currentX, currentY, epicycle.color, 2);

      // Dibujar punto en el borde del círculo
      this.drawPoint(currentX, currentY, epicycle.color, 4);
    });

    return { x: currentX, y: currentY };
  }

  private drawCircle(centerX: number, centerY: number, radius: number, color: string, lineWidth: number): void {
    if (!this.ctx) return;

    const config = this.getPlotConfig();
    if (!config) return;

    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;
    
    const centerXPixel = origin.x + centerX * unit * scaleX - offsetX;
    const centerYPixel = origin.y - centerY * unit * scaleY - offsetY;
    const radiusPixel = radius * unit * scaleX; // Usar scaleX para el radio

    this.ctx.beginPath();
    this.ctx.arc(centerXPixel, centerYPixel, radiusPixel, 0, 2 * Math.PI);
    this.ctx.strokeStyle = color + '40'; // Semi-transparente
    this.ctx.lineWidth = lineWidth;
    this.ctx.stroke();
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth: number): void {
    if (!this.ctx) return;

    const config = this.getPlotConfig();
    if (!config) return;

    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;

    const x1Pixel = origin.x + x1 * unit * scaleX - offsetX;
    const y1Pixel = origin.y - y1 * unit * scaleY - offsetY;
    const x2Pixel = origin.x + x2 * unit * scaleX - offsetX;
    const y2Pixel = origin.y - y2 * unit * scaleY - offsetY;

    this.ctx.beginPath();
    this.ctx.moveTo(x1Pixel, y1Pixel);
    this.ctx.lineTo(x2Pixel, y2Pixel);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.stroke();
  }

  private drawPoint(x: number, y: number, color: string, radius: number): void {
    if (!this.ctx) return;

    const config = this.getPlotConfig();
    if (!config) return;

    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;

    const xPixel = origin.x + x * unit * scaleX - offsetX;
    const yPixel = origin.y - y * unit * scaleY - offsetY;

    this.ctx.beginPath();
    this.ctx.arc(xPixel, yPixel, radius, 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawTrace(): void {
    if (!this.cartesianCanvas || this.tracePoints.length < 2) return;

    // Dibujar el trazado como una línea continua
    const points = this.tracePoints.map(point => ({
      x: point.x,
      y: point.y
    }));

    // Usar diferentes colores según el modo
    const traceColor = this.showDftVisualization ? '#ffffff' : '#ffff00'; // Blanco en DFT, amarillo en normal
    const traceWidth = this.showDftVisualization ? 2 : 3;

    // Usar el sistema de canvas para dibujar líneas conectadas
    this.drawConnectedPoints(points, traceColor, traceWidth);
  }

  private drawConnectedPoints(points: { x: number; y: number }[], color: string, lineWidth: number): void {
    if (!this.ctx || points.length < 2) return;

    const config = this.getPlotConfig();
    if (!config) return;

    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;

    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;

    // Mover al primer punto
    const firstPoint = points[0];
    const firstXPixel = origin.x + firstPoint.x * unit * scaleX - offsetX;
    const firstYPixel = origin.y - firstPoint.y * unit * scaleY - offsetY;
    this.ctx.moveTo(firstXPixel, firstYPixel);

    // Dibujar líneas a los puntos restantes
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const xPixel = origin.x + point.x * unit * scaleX - offsetX;
      const yPixel = origin.y - point.y * unit * scaleY - offsetY;
      this.ctx.lineTo(xPixel, yPixel);
    }

    this.ctx.stroke();
  }

  // Métodos de control
  public toggleAnimation(): void {
    if (this.isAnimating) {
      this.stopAnimation();
    } else {
      this.startAnimation();
    }
  }

  public clearTrace(): void {
    this.tracePoints = [];
    this.ensureRenderLoop();
    // Si la estela está deshabilitada, no volver a habilitar automáticamente
  }

  public resetView(): void {
    this.time = 0;
    this.tracePoints = [];
    if (this.cartesianCanvas) {
      this.cartesianCanvas.resetView();
    }
    this.ensureRenderLoop();
  }

  public addRandomEpicycle(): void {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#a55eea', '#26de81', '#fd79a8'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newEpicycle: EpicycleData = {
      amplitude: Math.random() * 1.5 + 0.3,
      frequency: Math.floor(Math.random() * 8) + 1,
      phase: Math.random() * 2 * Math.PI,
      color: randomColor
    };

    this.epicycles.push(newEpicycle);
    this.ensureRenderLoop();
  }

  public removeLastEpicycle(): void {
    if (this.epicycles.length > 1) {
      this.epicycles.pop();
      this.ensureRenderLoop();
    }
  }

  public onSliderChange(index: number, property: keyof EpicycleData, event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = property === 'color' ? target.value : Number(target.value);
    this.updateEpicycle(index, property, value);
  }

  public updateEpicycle(index: number, property: keyof EpicycleData, value: any): void {
    if (index >= 0 && index < this.epicycles.length) {
      (this.epicycles[index] as any)[property] = value;
      this.ensureRenderLoop();
    }
  }

  // Métodos para el sistema de dibujo y DFT
  public openDrawingModal(): void {
    this.showDrawingModal = true;
    setTimeout(() => {
      this.setupDrawingCanvas();
    }, 100);
  }

  public closeDrawingModal(): void {
    this.showDrawingModal = false;
    this.clearDrawing();
  }

  private setupDrawingCanvas(): void {
    this.drawingCanvas = this.document.getElementById('drawing-canvas') as HTMLCanvasElement;
    if (!this.drawingCanvas) return;

    this.drawingCtx = this.drawingCanvas.getContext('2d');
    if (!this.drawingCtx) return;

    // Configurar tamaño del canvas
    this.drawingCanvas.width = 400;
    this.drawingCanvas.height = 400;

    // Limpiar canvas
    this.drawingCtx.fillStyle = '#1a1a1a';
    this.drawingCtx.fillRect(0, 0, 400, 400);

    // Configurar eventos de dibujo
    this.setupDrawingEvents();
  }

  private setupDrawingEvents(): void {
    if (!this.drawingCanvas) return;

    // Mouse events
    this.drawingCanvas.addEventListener('mousedown', (e) => {
      this.isDrawing = true;
      const rect = this.drawingCanvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.startDrawing(x, y);
    });

    this.drawingCanvas.addEventListener('mousemove', (e) => {
      if (!this.isDrawing) return;
      const rect = this.drawingCanvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.continueDrawing(x, y);
    });

    this.drawingCanvas.addEventListener('mouseup', () => {
      this.isDrawing = false;
    });

    this.drawingCanvas.addEventListener('mouseleave', () => {
      this.isDrawing = false;
    });

    // Touch events para móviles
    this.drawingCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const rect = this.drawingCanvas!.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this.startDrawing(x, y);
    });

    this.drawingCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.isDrawing) return;
      const rect = this.drawingCanvas!.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this.continueDrawing(x, y);
    });

    this.drawingCanvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isDrawing = false;
    });
  }

  private startDrawing(x: number, y: number): void {
    if (!this.drawingCtx) return;

    // Convertir coordenadas de canvas a coordenadas centradas
    const centerX = x - 200;
    const centerY = 200 - y; // Invertir Y para coordenadas matemáticas

    this.drawingPath = [{ x: centerX, y: centerY }];
    
    this.drawingCtx.beginPath();
    this.drawingCtx.moveTo(x, y);
    this.drawingCtx.strokeStyle = '#00ff00';
    this.drawingCtx.lineWidth = 2;
  }

  private continueDrawing(x: number, y: number): void {
    if (!this.drawingCtx) return;

    // Convertir coordenadas de canvas a coordenadas centradas
    const centerX = x - 200;
    const centerY = 200 - y; // Invertir Y para coordenadas matemáticas

    this.drawingPath.push({ x: centerX, y: centerY });
    
    this.drawingCtx.lineTo(x, y);
    this.drawingCtx.stroke();
  }

  public clearDrawing(): void {
    if (!this.drawingCtx || !this.drawingCanvas) return;

    this.drawingCtx.fillStyle = '#1a1a1a';
    this.drawingCtx.fillRect(0, 0, 400, 400);
    this.drawingPath = [];
  }

  public processDrawing(): void {
    if (this.drawingPath.length < 10) {
      alert('Dibuja algo más complejo para procesarlo');
      return;
    }

    // Muestrear el path a la cantidad de puntos especificada
    this.sampledPath = this.samplePath(this.drawingPath, this.samplePoints);
    
    // Calcular DFT
    this.dftEpicycles = this.calculateDFT(this.sampledPath);
    this.maxEpicycleCount = this.dftEpicycles.length;
    this.epicycleCount = Math.min(50, this.maxEpicycleCount);

    // Cambiar a modo DFT
    this.showDftVisualization = true;
    this.clearTrace();
    this.time = 0;

    // Asegurar que el bucle de renderizado esté activo
    this.ensureRenderLoop();

    // Cerrar modal
    this.closeDrawingModal();
  }

  private samplePath(path: { x: number; y: number }[], numSamples: number): { x: number; y: number }[] {
    if (path.length <= numSamples) return path;

    const sampled: { x: number; y: number }[] = [];
    const step = (path.length - 1) / (numSamples - 1);

    for (let i = 0; i < numSamples; i++) {
      const index = Math.round(i * step);
      sampled.push(path[index]);
    }

    return sampled;
  }

  private calculateDFT(path: { x: number; y: number }[]): EpicycleData[] {
    const N = path.length;
    const epicycles: EpicycleData[] = [];

    // Calcular DFT para frecuencias de -N/2 a N/2
    for (let k = -Math.floor(N/2); k < Math.floor(N/2); k++) {
      let realPart = 0;
      let imagPart = 0;

      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        realPart += (path[n].x * cos - path[n].y * sin) / N;
        imagPart += (path[n].x * sin + path[n].y * cos) / N;
      }

      const amplitude = Math.sqrt(realPart * realPart + imagPart * imagPart);
      const phase = Math.atan2(imagPart, realPart);

      if (amplitude > 0.01) { // Filtrar componentes muy pequeñas
        epicycles.push({
          amplitude: amplitude / 100, // Escalar para visualización
          frequency: k,
          phase: phase,
          color: this.getFrequencyColor(k, Math.floor(N/2))
        });
      }
    }

    // Ordenar por amplitud (los más importantes primero)
    return epicycles.sort((a, b) => b.amplitude - a.amplitude);
  }

  private getFrequencyColor(freq: number, maxFreq: number): string {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#a55eea', '#26de81', '#fd79a8', '#feca57', '#48dbfb', '#ff9ff3'];
    const index = Math.abs(freq) % colors.length;
    return colors[index];
  }

  // Métodos para carga de datos
  public openDataModal(): void {
    this.showDataModal = true;
    this.csvData = '';
  }

  public closeDataModal(): void {
    this.showDataModal = false;
    this.csvData = '';
  }

  public loadPredefinedShape(shapeName: string): void {
    if (this.predefinedShapes[shapeName]) {
      this.csvData = this.predefinedShapes[shapeName];
    }
  }

  public processCsvData(): void {
    try {
      const points = this.parseCsvData(this.csvData);
      if (points.length < 3) {
        alert('Se necesitan al menos 3 puntos para generar epiciclos');
        return;
      }

      // Convertir puntos a formato interno y normalizar
      this.drawingPath = this.normalizePoints(points);
      
      // Procesar como si fuera un dibujo
      this.processDrawingFromPoints();
      
      // Cerrar modal
      this.closeDataModal();
    } catch (error) {
      alert('Error al procesar los datos: ' + error);
    }
  }

  private parseCsvData(csvText: string): { x: number; y: number }[] {
    const lines = csvText.trim().split('\n');
    const points: { x: number; y: number }[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const parts = trimmedLine.split(',');
      if (parts.length !== 2) {
        throw new Error(`Formato inválido en línea: ${line}. Use formato: x,y`);
      }

      const x = parseFloat(parts[0].trim());
      const y = parseFloat(parts[1].trim());

      if (isNaN(x) || isNaN(y)) {
        throw new Error(`Valores numéricos inválidos en línea: ${line}`);
      }

      points.push({ x, y });
    }

    return points;
  }

  private normalizePoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
    if (points.length === 0) return [];

    // Encontrar el centro y rango de los datos
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const maxRange = Math.max(rangeX, rangeY);

    // Normalizar a un rango aproximado de -100 a 100
    const scale = maxRange > 0 ? 200 / maxRange : 1;

    return points.map(point => ({
      x: (point.x - centerX) * scale,
      y: (point.y - centerY) * scale
    }));
  }

  private processDrawingFromPoints(): void {
    if (this.drawingPath.length < 3) {
      alert('Se necesitan al menos 3 puntos para generar epiciclos');
      return;
    }

    // Muestrear el path
    this.sampledPath = this.samplePath(this.drawingPath, this.samplePoints);
    
    // Calcular DFT
    this.dftEpicycles = this.calculateDFT(this.sampledPath);
    this.maxEpicycleCount = this.dftEpicycles.length;
    this.epicycleCount = Math.min(50, this.maxEpicycleCount);

    // Cambiar a modo DFT
    this.showDftVisualization = true;
    this.clearTrace();
    this.time = 0;
  }

  public toggleDftMode(): void {
    this.showDftVisualization = !this.showDftVisualization;
    this.clearTrace();
    this.time = 0;
    this.ensureRenderLoop();
  }

  public onEpicycleCountChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.epicycleCount = parseInt(target.value);
    this.ensureRenderLoop();
  }

  public onToggleChange(): void {
    this.ensureRenderLoop();
  }

  private drawDftElements(): void {
    // Dibujar puntos muestreados
    if (this.showSampledPoints && this.sampledPath.length > 0) {
      this.drawSampledPoints();
    }

    // Dibujar aproximación completa
    if (this.showApproximation && this.dftEpicycles.length > 0) {
      this.drawCompleteApproximation();
    }
  }

  private drawCompleteApproximation(): void {
    if (!this.ctx) return;

    const config = this.getPlotConfig();
    if (!config) return;

    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;

    // Generar puntos de la aproximación completa usando solo los epiciclos del slider
    const activeEpicycles = this.dftEpicycles.slice(0, this.epicycleCount);
    const approximationPoints: { x: number; y: number }[] = [];
    
    // Generar puntos para un ciclo completo
    const numPoints = 1000; // Más puntos para una curva suave
    for (let i = 0; i < numPoints; i++) {
      const t = (i / numPoints) * 2 * Math.PI;
      let x = 0;
      let y = 0;
      
      // Calcular posición usando los epiciclos activos
      activeEpicycles.forEach(epicycle => {
        const angle = t * epicycle.frequency + epicycle.phase;
        x += epicycle.amplitude * Math.cos(angle);
        y += epicycle.amplitude * Math.sin(angle);
      });
      
      approximationPoints.push({ x, y });
    }

    // Dibujar la aproximación completa
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#00ff88'; // Verde para la aproximación
    this.ctx.lineWidth = 2;

    if (approximationPoints.length > 0) {
      // Mover al primer punto
      const firstPoint = approximationPoints[0];
      const firstXPixel = origin.x + firstPoint.x * unit * scaleX - offsetX;
      const firstYPixel = origin.y - firstPoint.y * unit * scaleY - offsetY;
      this.ctx.moveTo(firstXPixel, firstYPixel);

      // Dibujar líneas a los puntos restantes
      for (let i = 1; i < approximationPoints.length; i++) {
        const point = approximationPoints[i];
        const xPixel = origin.x + point.x * unit * scaleX - offsetX;
        const yPixel = origin.y - point.y * unit * scaleY - offsetY;
        this.ctx.lineTo(xPixel, yPixel);
      }

      this.ctx.stroke();
    }
  }

  private drawSampledPoints(): void {
    if (!this.sampledPath.length || !this.ctx) return;

    const config = this.getPlotConfig();
    if (!config) return;

    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;

    this.ctx.fillStyle = '#ff6b6b'; // Rojo para los puntos muestreados

    this.sampledPath.forEach((point, index) => {
      const xPixel = origin.x + (point.x / 100) * unit * scaleX - offsetX;
      const yPixel = origin.y - (point.y / 100) * unit * scaleY - offsetY;

      this.ctx!.beginPath();
      this.ctx!.arc(xPixel, yPixel, 3, 0, 2 * Math.PI);
      this.ctx!.fill();

      // Numerar algunos puntos para referencia
      if (index % 10 === 0) {
        this.ctx!.fillStyle = '#ffffff';
        this.ctx!.font = '10px monospace';
        this.ctx!.fillText(index.toString(), xPixel + 5, yPixel - 5);
        this.ctx!.fillStyle = '#ff6b6b';
      }
    });
  }
}