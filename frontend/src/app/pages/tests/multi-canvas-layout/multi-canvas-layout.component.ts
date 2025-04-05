import { Component, Input, OnInit, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartesianCanvasComponent } from '../../../shared/components/cartesian-canvas/cartesian-canvas.component'; 
import { FormsModule } from '@angular/forms';

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
  
  // Acceso a las instancias de CartesianCanvasComponent
  @ViewChildren(CartesianCanvasComponent) 
  canvasList!: QueryList<CartesianCanvasComponent>;
  
  // Control de tabs
  activeTabIndex = 0;
  
  constructor() {}
  
  ngOnInit(): void {
    // Si no hay configuraciones proporcionadas, crear una por defecto
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
  }

  
  // Cambiar a una pestaña específica (para layout 'tabs')
  setActiveTab(index: number): void {
    this.activeTabIndex = index;
    // Redimensionar el canvas después de hacerlo visible
    setTimeout(() => {
      const canvas = this.getCanvasById(this.canvasConfigs[index].id);
      if (canvas) {
        // Actualizar tamaño si es necesario
        window.dispatchEvent(new Event('resize'));
      }
    }, 10);
  }
  
  // Obtener una instancia de canvas por su ID
  getCanvasById(id: string): CartesianCanvasComponent | undefined {
    return this.canvasList?.find((_, index) => 
      this.canvasConfigs[index]?.id === id
    );
  }
  
  // Obtener una instancia de canvas por su índice
  getCanvasByIndex(index: number): CartesianCanvasComponent | undefined {
    return this.canvasList?.toArray()[index];
  }
  
  // Métodos para dibujar en un canvas específico
  
  // Dibuja una función en el canvas con el ID especificado
  drawFunction(canvasId: string, fn: (x: number) => number, color: string = '#FF0000'): void {
    const canvas = this.getCanvasById(canvasId);
    if (canvas) {
      canvas.drawFunction(fn, color);
    }
  }
  
  // Dibuja una función en un intervalo en el canvas con el ID especificado
  drawFunctionFromAToB(
    canvasId: string, 
    fn: (x: number) => number, 
    color: string, 
    a: number, 
    b: number
  ): void {
    const canvas = this.getCanvasById(canvasId);
    if (canvas) {
      canvas.drawFunctionFromAToB(fn, color, a, b);
    }
  }
  
  // Limpia todos los canvas
  clearAllCanvases(): void {
    this.canvasList.forEach(canvas => {
      canvas.clearCanvas();
    });
  }
  
  // Limpia un canvas específico
  clearCanvas(canvasId: string): void {
    const canvas = this.getCanvasById(canvasId);
    if (canvas) {
      canvas.clearCanvas();
    }
  }
}