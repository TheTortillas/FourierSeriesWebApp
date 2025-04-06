import { Component, Input, OnInit, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartesianCanvasComponent } from '../../../shared/components/cartesian-canvas/cartesian-canvas.component';

// Interfaz para la configuración de cada canvas
export interface CanvasConfig {
  id: string;
  title: string;
  bgColor?: string;
  axisColor?: string;
  gridColor?: string;
  fontColor?: string;
  initialZoom?: number;
}

// Interfaz para almacenar los inputs de cada canvas
interface CanvasInputs {
  functionInput: string;
  functionColor: string;
  seriesInput: string;
  seriesTerms: number;
  seriesColor: string;
  rangeStart: number;
  rangeEnd: number;
  discreteX: number;
  discreteY: number;
  discreteHeight: number;
}

@Component({
  selector: 'app-multi-canvas-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, CartesianCanvasComponent],
  templateUrl: './multi-canvas-layout.component.html',
  styleUrl: './multi-canvas-layout.component.scss'
})
export class MultiCanvasLayoutComponent implements OnInit {
  // Configuración de cada canvas
  @Input() canvasConfigs: CanvasConfig[] = [];
  
  // Opciones de layout
  @Input() layout: 'grid' | 'tabs' | 'split' = 'grid';
  @Input() columns: number = 2; // Para layout 'grid'
  @Input() useCustomLayout: boolean = true; 
  
  // Control de sidenav
  sidenavOpen = false;
  
  // Canal activo
  activeCanvas = ''; 
  
  // Control de visibilidad de canvas
  hiddenCanvasIds: Set<string> = new Set();
  
  // Inputs específicos para cada canvas
  canvasInputs: { [key: string]: CanvasInputs } = {};
  
  // Acceso a las instancias de CartesianCanvasComponent
  @ViewChildren(CartesianCanvasComponent) 
  canvasList!: QueryList<CartesianCanvasComponent>;
  
  // Control de tabs
  activeTabIndex = 0;
  
  constructor() {}
  
  ngOnInit(): void {
    // Si no hay configuraciones proporcionadas, crear unas por defecto
    if (this.canvasConfigs.length === 0) {
      this.canvasConfigs = [
        {
          id: 'canvas1',
          title: 'Funciones',
          bgColor: '#222',
          axisColor: '#90DCB5',
          gridColor: '#6BBCAC',
          fontColor: '#EBEBEB',
          initialZoom: 75
        },
        {
          id: 'canvas2',
          title: 'Funciones en un intervalo a, b', 
          bgColor: '#202030',
          axisColor: '#F0C674',
          gridColor: '#8ABEB7',
          fontColor: '#FFFFFF',
          initialZoom: 75
        },
        {
          id: 'canvas3',
          title: 'Puntos discretos',
          bgColor: '#302020',
          axisColor: '#81A2BE',
          gridColor: '#707880',
          fontColor: '#C5C8C6',
          initialZoom: 75
        },
        {
          id: 'canvas4',
          title: 'Series de funciones',
          bgColor: '#203020',
          axisColor: '#B5BD68',
          gridColor: '#5F9EA0',
          fontColor: '#E0E0E0',
          initialZoom: 75
        }
      ];
    }
    
    // Inicializar los inputs para cada canvas
    this.initializeCanvasInputs();
    
    // Establecer el canvas activo inicial
    if (this.canvasConfigs.length > 0) {
      this.activeCanvas = this.canvasConfigs[0].id;
    }
  }
  
  // Inicializar los inputs para cada canvas
  initializeCanvasInputs(): void {
    this.canvasConfigs.forEach(config => {
      this.canvasInputs[config.id] = {
        functionInput: '',
        functionColor: '#FF0000',
        seriesInput: '',
        seriesTerms: 10,
        seriesColor: '#4287f5',
        rangeStart: -2,
        rangeEnd: 2,
        discreteX: 1,
        discreteY: 0,
        discreteHeight: 2
      };
    });
  }
  
  // Alternar sidenav
  toggleSidenav(): void {
    this.sidenavOpen = !this.sidenavOpen;
  }
  
  // Cambiar a una pestaña específica (para layout 'tabs')
  setActiveTab(index: number): void {
    this.activeTabIndex = index;
    
    // Actualizar el canvas activo al cambiar de pestaña
    if (this.canvasConfigs[index]) {
      this.setActiveCanvas(this.canvasConfigs[index].id);
    }
    
    // Redimensionar el canvas después de hacerlo visible
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 10);
  }
  
  // Establecer el canvas activo
  setActiveCanvas(id: string): void {
    this.activeCanvas = id;
    
    // Actualizar el tab index si estamos en modo tabs
    if (this.layout === 'tabs') {
      const index = this.canvasConfigs.findIndex(config => config.id === id);
      if (index >= 0) {
        this.activeTabIndex = index;
      }
    }
  }
  
  // Comprobar si un canvas está oculto
  isCanvasHidden(id: string): boolean {
    return this.hiddenCanvasIds.has(id);
  }
  
  // Alternar visibilidad de un canvas
  toggleCanvas(id: string): void {
    if (this.isCanvasHidden(id)) {
      this.hiddenCanvasIds.delete(id);
    } else {
      this.hiddenCanvasIds.add(id);
      
      // Si el canvas que estamos ocultando es el activo, cambiamos a otro visible
      if (id === this.activeCanvas) {
        const visibleCanvas = this.canvasConfigs.find(c => !this.isCanvasHidden(c.id));
        if (visibleCanvas) {
          this.setActiveCanvas(visibleCanvas.id);
        }
      }
    }
    
    // Si estamos en modo tabs, actualizar la pestaña activa
    if (this.layout === 'tabs') {
      const index = this.canvasConfigs.findIndex(config => config.id === this.activeCanvas);
      if (index >= 0) {
        this.activeTabIndex = index;
      }
    }
    
    // Redimensionar después de cambiar la visibilidad
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 10);
  }
  
  // Mostrar todos los canvas
  showAllCanvas(): void {
    this.hiddenCanvasIds.clear();
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 10);
  }
  
  // Obtener la cantidad de canvas visibles
  getVisibleCanvasCount(): number {
    return this.canvasConfigs.filter(config => !this.isCanvasHidden(config.id)).length;
  }
  
  // Obtener una instancia de canvas por su ID
  getCanvasById(id: string): CartesianCanvasComponent | undefined {
    if (!this.canvasList) return undefined;
    return this.canvasList.find(canvas => 
      canvas.canvasId === id
    );
  }
  
  // Obtener una instancia de canvas por su índice
  getCanvasByIndex(index: number): CartesianCanvasComponent | undefined {
    if (!this.canvasList) return undefined;
    return this.canvasList.toArray()[index];
  }
  
  // Método para graficar una función en un canvas específico
  graficarFuncion(canvasId: string): void {
    const input = this.canvasInputs[canvasId];
    if (!input?.functionInput) return;
    
    const canvas = this.getCanvasById(canvasId);
    if (!canvas) return;
    
    try {
      const fn = new Function('x', `return ${input.functionInput}`);
      canvas.drawFunction(
        fn as (x: number) => number,
        input.functionColor
      );
    } catch (error) {
      console.error('Error al parsear la función:', error);
      // Aquí podrías mostrar un mensaje de error al usuario
    }
  }
  
  // Método para graficar una función en un intervalo específico
  graficarFuncionEnIntervalo(canvasId: string): void {
    const input = this.canvasInputs[canvasId];
    if (!input?.functionInput) return;
    
    const canvas = this.getCanvasById(canvasId);
    if (!canvas) return;
    
    try {
      const fn = new Function('x', `return ${input.functionInput}`);
      canvas.drawFunctionFromAToB(
        fn as (x: number) => number,
        input.functionColor,
        input.rangeStart,
        input.rangeEnd
      );
    } catch (error) {
      console.error('Error al parsear la función en intervalo:', error);
    }
  }
  
  // Método para graficar un punto discreto
  graficarPuntoDiscreto(canvasId: string): void {
    const input = this.canvasInputs[canvasId];
    const canvas = this.getCanvasById(canvasId);
    if (!canvas) return;
    
    canvas.drawDiscreteLine(
      input.discreteX,
      input.discreteY,
      input.discreteHeight,
      input.functionColor
    );
  }
  
  // Método para graficar una serie en un canvas específico
  graficarSerie(canvasId: string): void {
    const input = this.canvasInputs[canvasId];
    if (!input?.seriesInput) return;
    
    const canvas = this.getCanvasById(canvasId);
    if (!canvas) return;
    
    try {
      const seriesTerm = new Function('n', 'x', `return ${input.seriesInput}`);
      canvas.drawSeries(
        seriesTerm as (n: number, x: number) => number,
        input.seriesTerms,
        input.seriesColor
      );
    } catch (error) {
      console.error('Error al parsear la serie:', error);
    }
  }
  
  // Método para limpiar un canvas específico
  limpiarCanvas(canvasId: string): void {
    const canvas = this.getCanvasById(canvasId);
    if (canvas) {
      canvas.clearCanvas();
    }
  }
  
  // Método para limpiar todos los canvas
  clearAllCanvases(): void {
    if (this.canvasList) {
      this.canvasList.forEach(canvas => {
        canvas.clearCanvas();
      });
    }
  }
  
  // Método para resetear la vista de un canvas específico
  resetearVista(canvasId: string): void {
    const canvas = this.getCanvasById(canvasId);
    if (canvas) {
      canvas.resetView();
    }
  }
  
  // Método para resetear la vista de todos los canvas
  resetAllCanvasViews(): void {
    if (this.canvasList) {
      this.canvasList.forEach(canvas => {
        canvas.resetView();
      });
    }
  }
}