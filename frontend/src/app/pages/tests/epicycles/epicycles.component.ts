import { AfterViewInit, Component, Inject, ViewChild, OnDestroy } from '@angular/core';
import { isPlatformBrowser, DOCUMENT, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartesianCanvasComponent } from '../../../shared/components/cartesian-canvas/cartesian-canvas.component';
import { PlotConfig } from '../../../interfaces/plot-config.interface';
import { EpicycleService } from '../../../core/services/epicycles/epicycle.service';
import { DFTService } from '../../../core/services/epicycles/dft.service';
import { EpicycleDrawingService } from '../../../core/services/epicycles/epicycle-drawing.service';
import { AnimationControlService } from '../../../core/services/epicycles/animation-control.service';
import { 
  EpicycleData, 
  Point2D, 
  EpicycleVisualizationConfig
} from '../../../interfaces/epicycle.interface';

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

  // Canvas context y animación
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;
  
  // Variables para detectar drag
  private isMouseDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private isDragDetected = false;
  private wasAnimatingBeforeDrag = false;

  // Sistema de dibujo y DFT
  public showDrawingModal = false;
  private drawingCanvas: HTMLCanvasElement | null = null;
  private drawingCtx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private drawingPath: Point2D[] = [];
  
  // Datos DFT
  private sampledPath: Point2D[] = [];
  public samplePoints = 200;
  public maxSamplePoints = 500;
  private dftEpicycles: EpicycleData[] = [];
  public epicycleCount = 50;
  public maxEpicycleCount = 0;
  
  // Epiciclos manuales (modo libre)
  private manualEpicycles: EpicycleData[] = [];
  
  // Control para agregar epiciclos personalizados
  public showAddCustomEpicycle = false;
  public newEpicycleParams = {
    amplitude: 1,
    frequency: 1,
    phase: 0
  };
  
  // Modales y datos
  public showDataModal = false;
  public csvData = '';
  
  // Configuración de visualización
  private visualConfig: EpicycleVisualizationConfig = {
    showSampledPoints: false,
    showApproximation: true,
    showTrace: true,
    showDftVisualization: false,
    epicycleCount: 50
  };

  // Variables para tracking del canvas
  private lastCanvasState = {
    offsetX: 0,
    offsetY: 0,
    unit: 75,
    scaleX: 1,
    scaleY: 1
  };

  // Datos predefinidos
  public predefinedShapes: { [key: string]: string } = {
    'trex': `4884.994140222705,3584.99743634464
4875.836855173111,3580.9866884350777
4866.673131857533,3576.9703737233067
4857.5121613405645,3572.958475294523
4848.3566977112205,3568.957416277917`,
    'circle': `100,0
98.48,17.36
93.96,34.2
86.6,50
76.6,64.28
64.28,76.6
50,86.6
34.2,93.96`,
    'heart': `0,100
20,90
40,70
60,40
70,0
60,-30
40,-50
20,-60
0,-65`
  };

  // Exponer Math para el template
  public Math = Math;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private epicycleService: EpicycleService,
    private dftService: DFTService,
    private epicycleDrawingService: EpicycleDrawingService,
    private animationControlService: AnimationControlService
  ) {
    // Inicializar con epiciclos por defecto
    this.manualEpicycles = this.epicycleService.getDefaultEpicycles();
  }

  // Getters para el template
  get epicycles(): EpicycleData[] {
    return this.showDftVisualization 
      ? this.dftEpicycles.slice(0, this.epicycleCount)
      : this.manualEpicycles;
  }

  get time(): number {
    return this.animationControlService.getCurrentTime();
  }

  get isAnimating(): boolean {
    return this.animationControlService.isCurrentlyAnimating();
  }

  get tracePoints(): Point2D[] {
    return this.animationControlService.getCurrentTracePoints();
  }

  get showDftVisualization(): boolean {
    return this.visualConfig.showDftVisualization;
  }

  get showSampledPoints(): boolean {
    return this.visualConfig.showSampledPoints;
  }

  set showSampledPoints(value: boolean) {
    this.visualConfig.showSampledPoints = value;
  }

  get showApproximation(): boolean {
    return this.visualConfig.showApproximation;
  }

  set showApproximation(value: boolean) {
    this.visualConfig.showApproximation = value;
  }

  get showTrace(): boolean {
    return this.visualConfig.showTrace;
  }

  set showTrace(value: boolean) {
    this.visualConfig.showTrace = value;
    this.animationControlService.setShowTrace(value);
  }

  ngAfterViewInit(): void {
    this.initEventListeners();
    this.setupCanvas();
  }

  ngOnDestroy(): void {
    this.animationControlService.stopAnimation();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  onCanvasReady(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
    this.setupMouseListeners();
    this.updateLastCanvasState();
    this.ensureRenderLoop();
  }

  // Métodos de control de animación
  public toggleAnimation(): void {
    this.animationControlService.toggleAnimation();
  }

  public clearTrace(): void {
    this.animationControlService.clearTrace();
    this.ensureRenderLoop();
  }

  public resetView(): void {
    this.animationControlService.setTime(0);
    this.animationControlService.clearTrace();
    if (this.cartesianCanvas) {
      this.cartesianCanvas.resetView();
    }
    this.ensureRenderLoop();
  }

  // Métodos de control de epiciclos
  public addRandomEpicycle(): void {
    if (!this.showDftVisualization) {
      this.manualEpicycles = this.epicycleService.addRandomEpicycle(this.manualEpicycles);
      this.ensureRenderLoop();
    }
  }

  public removeLastEpicycle(): void {
    if (!this.showDftVisualization) {
      this.manualEpicycles = this.epicycleService.removeLastEpicycle(this.manualEpicycles);
      this.ensureRenderLoop();
    }
  }

  public onSliderChange(index: number, property: keyof EpicycleData, event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = property === 'color' ? target.value : Number(target.value);
    
    if (!this.showDftVisualization) {
      this.manualEpicycles = this.epicycleService.updateEpicycle(
        this.manualEpicycles,
        index,
        property,
        value
      );
    }
    this.ensureRenderLoop();
  }

  public onEpicycleCountChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.epicycleCount = parseInt(target.value);
    this.visualConfig.epicycleCount = this.epicycleCount;
    this.ensureRenderLoop();
  }

  public onToggleChange(): void {
    this.ensureRenderLoop();
  }

  public onSpeedChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.animationControlService.setSpeed(parseFloat(target.value));
  }

  public addEpicycleWithParams(amplitude: number = 1, frequency: number = 1, phase: number = 0): void {
    if (!this.showDftVisualization) {
      const newEpicycle: EpicycleData = {
        amplitude,
        frequency,
        phase,
        color: this.getRandomColor()
      };
      this.manualEpicycles = [...this.manualEpicycles, newEpicycle];
      this.ensureRenderLoop();
    }
  }

  public removeEpicycleAt(index: number): void {
    if (!this.showDftVisualization && index >= 0 && index < this.manualEpicycles.length) {
      this.manualEpicycles = this.manualEpicycles.filter((_, i) => i !== index);
      this.ensureRenderLoop();
    }
  }

  public addCustomEpicycle(): void {
    if (!this.showDftVisualization) {
      this.addEpicycleWithParams(
        this.newEpicycleParams.amplitude,
        this.newEpicycleParams.frequency,
        this.newEpicycleParams.phase
      );
      
      // Reset valores por defecto
      this.newEpicycleParams = {
        amplitude: 1,
        frequency: 1,
        phase: 0
      };
    }
  }

  public resetToDefaults(): void {
    if (!this.showDftVisualization) {
      this.manualEpicycles = this.epicycleService.getDefaultEpicycles();
      this.animationControlService.clearTrace();
      this.ensureRenderLoop();
    }
  }

  private getRandomColor(): string {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#fd79a8', '#00b894', '#fdcb6e'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Métodos de dibujo y DFT
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

    // Muestrear y calcular DFT usando los servicios
    this.sampledPath = this.dftService.samplePath(this.drawingPath, this.samplePoints);
    this.dftEpicycles = this.dftService.calculateDFT(this.sampledPath);
    this.maxEpicycleCount = this.dftEpicycles.length;
    this.epicycleCount = Math.min(50, this.maxEpicycleCount);

    // Cambiar a modo DFT
    this.visualConfig.showDftVisualization = true;
    this.animationControlService.clearTrace();
    this.animationControlService.setTime(0);

    this.ensureRenderLoop();
    this.closeDrawingModal();
  }

  // Métodos de carga de datos
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
      const points = this.dftService.parseCsvData(this.csvData);
      if (points.length < 3) {
        alert('Se necesitan al menos 3 puntos válidos');
        return;
      }

      // Normalizar y procesar
      this.drawingPath = this.dftService.normalizePoints(points);
      this.processDrawingFromPoints();
      this.closeDataModal();
    } catch (error) {
      alert('Error al procesar los datos CSV');
    }
  }

  public toggleDftMode(): void {
    this.visualConfig.showDftVisualization = !this.visualConfig.showDftVisualization;
    this.animationControlService.clearTrace();
    this.animationControlService.setTime(0);
    this.ensureRenderLoop();
  }

  // Métodos privados de renderizado
  private ensureRenderLoop(): void {
    if (this.animationId === null) {
      this.animate();
    }
  }

  private animate(): void {
    if (!this.cartesianCanvas || !this.ctx) return;

    this.drawWithEpicycles();

    // Agregar punto al trazado si está animando
    if (this.animationControlService.isCurrentlyAnimating()) {
      const finalPoint = this.epicycleService.calculateFinalPoint(
        this.epicycles, 
        this.animationControlService.getCurrentTime()
      );
      this.animationControlService.addTracePoint(finalPoint);
      // El tiempo se actualiza automáticamente en el servicio
    }

    // Verificar cambios de vista del canvas
    if (this.checkViewChanged()) {
      this.updateLastCanvasState();
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  private drawWithEpicycles(): void {
    if (!this.cartesianCanvas || !this.ctx) return;

    const canvas2D = this.cartesianCanvas as any;
    
    // Cancelar redibujado pendiente del CartesianCanvasComponent
    if (canvas2D.redrawAnimationFrame !== null) {
      cancelAnimationFrame(canvas2D.redrawAnimationFrame);
      canvas2D.redrawAnimationFrame = null;
    }
    
    // Limpiar y redibujar fondo + funciones guardadas
    this.clearCanvasAndRedrawBackground();
    
    // Obtener configuración del plot
    const config = this.getPlotConfig();
    if (!config) return;

    // Dibujar elementos DFT si están habilitados
    if (this.showDftVisualization) {
      const approximationPoints = this.dftService.generateApproximation(
        this.dftEpicycles.slice(0, this.epicycleCount)
      );
      
      this.epicycleDrawingService.drawDFTElements(
        this.ctx,
        config,
        this.sampledPath,
        approximationPoints,
        this.visualConfig
      );
    }

    // Calcular y dibujar epiciclos
    const result = this.epicycleService.calculateEpicycles(
      this.epicycles,
      this.animationControlService.getCurrentTime()
    );
    
    this.epicycleDrawingService.drawEpicycles(this.ctx, config, result.epicycleStates);

    // Dibujar trazado si está habilitado
    if (this.showTrace) {
      const tracePoints = this.animationControlService.getCurrentTracePoints();
      if (tracePoints.length > 1) {
        this.epicycleDrawingService.drawConnectedPoints(
          this.ctx,
          config,
          tracePoints,
          this.showDftVisualization ? '#ffffff' : '#ffff00',
          this.showDftVisualization ? 2 : 3
        );
      }
    }
  }

  private clearCanvasAndRedrawBackground(): void {
    if (!this.cartesianCanvas || !this.ctx) return;
    
    const canvas2D = this.cartesianCanvas as any;
    
    // Limpiar canvas
    this.ctx.clearRect(0, 0, canvas2D.width, canvas2D.height);
    
    // Redibujar plano cartesiano
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
    
    // Redibujar funciones guardadas
    const config = this.getPlotConfig();
    if (config && canvas2D.plottingService) {
      ['functionPlots', 'intervalPlots', 'discretePlots', 'seriesPlots'].forEach(plotType => {
        if (canvas2D[plotType]) {
          canvas2D[plotType].forEach((plot: any) => {
            switch (plotType) {
              case 'functionPlots':
                canvas2D.plottingService.drawFunction(config, plot.fn, plot.color, plot.lineWidth || 2);
                break;
              case 'intervalPlots':
                canvas2D.plottingService.drawFunctionFromAToB(config, plot.fn, plot.color, plot.a, plot.b, plot.lineWidth || 2);
                break;
              case 'discretePlots':
                canvas2D.plottingService.drawDiscreteLine(config, plot.startX, plot.startY, plot.n, plot.color, plot.lineWidth || 2.5);
                break;
              case 'seriesPlots':
                canvas2D.plottingService.drawSeries(config, plot.seriesTerm, plot.terms, plot.color, plot.lineWidth || 2);
                break;
            }
          });
        }
      });
    }
  }

  private processDrawingFromPoints(): void {
    if (this.drawingPath.length < 3) {
      alert('Se necesitan al menos 3 puntos');
      return;
    }

    this.sampledPath = this.dftService.samplePath(this.drawingPath, this.samplePoints);
    this.dftEpicycles = this.dftService.calculateDFT(this.sampledPath);
    this.maxEpicycleCount = this.dftEpicycles.length;
    this.epicycleCount = Math.min(50, this.maxEpicycleCount);

    this.visualConfig.showDftVisualization = true;
    this.animationControlService.clearTrace();
    this.animationControlService.setTime(0);
  }

  // Métodos de utilidad (copiados del original, simplificados)
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

  private checkViewChanged(): boolean {
    if (!this.cartesianCanvas) return false;
    
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

  private setupCanvas(): void {
    if (this.cartesianCanvas) {
      this.cartesianCanvas.resetView();
      this.ensureRenderLoop();
    }
  }

  private initEventListeners(): void {
    setTimeout(() => {
      // Botones principales
      this.document.getElementById('toggle-animation')?.addEventListener('click', () => this.toggleAnimation());
      this.document.getElementById('clear-trace')?.addEventListener('click', () => this.clearTrace());
      this.document.getElementById('reset-view')?.addEventListener('click', () => this.resetView());
      this.document.getElementById('add-epicycle')?.addEventListener('click', () => this.addRandomEpicycle());
      this.document.getElementById('remove-epicycle')?.addEventListener('click', () => this.removeLastEpicycle());
      this.document.getElementById('draw-btn')?.addEventListener('click', () => this.openDrawingModal());
      
      // Control de velocidad
      const speedSlider = this.document.getElementById('speed-slider') as HTMLInputElement;
      speedSlider?.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        this.animationControlService.setSpeed(parseFloat(target.value));
      });
    }, 100);
  }

  private setupMouseListeners(): void {
    if (!this.ctx?.canvas) return;
    
    const canvas = this.ctx.canvas;
    
    canvas.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.isDragDetected = false;
    });
    
    canvas.addEventListener('mousemove', (e) => {
      if (this.isMouseDown) {
        const deltaX = Math.abs(e.clientX - this.lastMouseX);
        const deltaY = Math.abs(e.clientY - this.lastMouseY);
        if (deltaX > 3 || deltaY > 3) {
          if (!this.isDragDetected) {
            this.wasAnimatingBeforeDrag = this.animationControlService.isCurrentlyAnimating();
            this.animationControlService.stopAnimation();
            this.isDragDetected = true;
          }
          this.ensureRenderLoop();
        }
      }
    });
    
    canvas.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      if (this.isDragDetected) {
        if (this.wasAnimatingBeforeDrag) {
          this.animationControlService.startAnimation();
        }
        this.isDragDetected = false;
        this.wasAnimatingBeforeDrag = false;
      }
    });
    
    canvas.addEventListener('mouseleave', () => {
      this.isMouseDown = false;
      if (this.isDragDetected) {
        if (this.wasAnimatingBeforeDrag) {
          this.animationControlService.startAnimation();
        }
        this.isDragDetected = false;
        this.wasAnimatingBeforeDrag = false;
      }
    });
  }

  private setupDrawingCanvas(): void {
    this.drawingCanvas = this.document.getElementById('drawing-canvas') as HTMLCanvasElement;
    if (!this.drawingCanvas) return;

    this.drawingCtx = this.drawingCanvas.getContext('2d');
    if (!this.drawingCtx) return;

    this.drawingCanvas.width = 400;
    this.drawingCanvas.height = 400;

    this.drawingCtx.fillStyle = '#1a1a1a';
    this.drawingCtx.fillRect(0, 0, 400, 400);

    this.setupDrawingEvents();
  }

  private setupDrawingEvents(): void {
    if (!this.drawingCanvas) return;

    this.drawingCanvas.addEventListener('mousedown', (e) => {
      const rect = this.drawingCanvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.startDrawing(x, y);
      this.isDrawing = true;
    });

    this.drawingCanvas.addEventListener('mousemove', (e) => {
      if (this.isDrawing) {
        const rect = this.drawingCanvas!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.continueDrawing(x, y);
      }
    });

    this.drawingCanvas.addEventListener('mouseup', () => {
      this.isDrawing = false;
    });

    this.drawingCanvas.addEventListener('mouseleave', () => {
      this.isDrawing = false;
    });

    // Touch events
    this.drawingCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = this.drawingCanvas!.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this.startDrawing(x, y);
      this.isDrawing = true;
    });

    this.drawingCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.isDrawing && e.touches.length === 1) {
        const rect = this.drawingCanvas!.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this.continueDrawing(x, y);
      }
    });

    this.drawingCanvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isDrawing = false;
    });
  }

  private startDrawing(x: number, y: number): void {
    if (!this.drawingCtx) return;

    const centerX = x - 200;
    const centerY = 200 - y;

    this.drawingPath = [{ x: centerX, y: centerY }];
    
    this.drawingCtx.beginPath();
    this.drawingCtx.moveTo(x, y);
    this.drawingCtx.strokeStyle = '#00ff00';
    this.drawingCtx.lineWidth = 2;
  }

  private continueDrawing(x: number, y: number): void {
    if (!this.drawingCtx) return;

    const centerX = x - 200;
    const centerY = 200 - y;

    this.drawingPath.push({ x: centerX, y: centerY });
    
    this.drawingCtx.lineTo(x, y);
    this.drawingCtx.stroke();
  }
}