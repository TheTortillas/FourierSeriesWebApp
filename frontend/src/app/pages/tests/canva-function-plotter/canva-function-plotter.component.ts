import { AfterViewInit, Component, Inject, ViewChild } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { CartesianCanvasComponent } from '../../../shared/components/cartesian-canvas/cartesian-canvas.component';

@Component({
  selector: 'app-canva-function-plotter',
  standalone: true,
  imports: [CartesianCanvasComponent],
  templateUrl: './canva-function-plotter.component.html',
  styleUrl: './canva-function-plotter.component.scss',
})
export class CanvaFunctionPlotterComponent implements AfterViewInit {
  @ViewChild(CartesianCanvasComponent) cartesianCanvas!: CartesianCanvasComponent;

  constructor(@Inject(DOCUMENT) private document: Document) {}

  ngAfterViewInit(): void {
    this.initEventListeners();
  }

  // ───────────────────────────────
  // Métodos privados de inicialización
  // ───────────────────────────────

  private initEventListeners(): void {
    setTimeout(() => {
      // 1) Botón para graficar función y = f(x)
      const plotFunctionBtn = this.document.getElementById(
        'plot-function'
      ) as HTMLButtonElement;
      plotFunctionBtn?.addEventListener('click', () => {
        // Lee inputs
        const fnInput = (
          this.document.getElementById('function-input') as HTMLInputElement
        ).value;
        const colorInput =
          (this.document.getElementById('function-color') as HTMLInputElement)
            .value || '#FF0000';
  
        if (!fnInput || !this.cartesianCanvas) return;
  
        try {
          // Crea una función a partir del string
          const fn = new Function('x', `return ${fnInput}`) as (
            x: number
          ) => number;
  
          // Limpia el canvas primero
          this.cartesianCanvas.clearCanvas();
          // Dibuja la nueva función
          this.cartesianCanvas.drawFunction(fn, colorInput);
        } catch (error) {
          console.error('Error al parsear la función:', error);
        }
      });
  
      // 2) Botón para graficar función en un intervalo
      const plotIntervalBtn = this.document.getElementById(
        'plot-interval'
      ) as HTMLButtonElement;
      plotIntervalBtn?.addEventListener('click', () => {
        const fnInput = (
          this.document.getElementById(
            'interval-function-input'
          ) as HTMLInputElement
        ).value;
        const aInput = (
          this.document.getElementById('interval-a') as HTMLInputElement
        ).value;
        const bInput = (
          this.document.getElementById('interval-b') as HTMLInputElement
        ).value;
        const colorInput =
          (this.document.getElementById('interval-color') as HTMLInputElement)
            .value || '#00FFAA';
  
        if (!fnInput || !aInput || !bInput || !this.cartesianCanvas) return;
  
        try {
          const fn = new Function('x', `return ${fnInput}`) as (
            x: number
          ) => number;
          const a = parseFloat(aInput);
          const b = parseFloat(bInput);
  
          // Limpia el canvas primero
          this.cartesianCanvas.clearCanvas();
          // Dibuja la nueva función en intervalo
          this.cartesianCanvas.drawFunctionFromAToB(fn, colorInput, a, b);
        } catch (error) {
          console.error('Error al parsear la función de intervalo:', error);
        }
      });
  
      // 3) Botón para graficar punto discreto
      const plotDiscreteBtn = this.document.getElementById(
        'plot-discrete'
      ) as HTMLButtonElement;
      plotDiscreteBtn?.addEventListener('click', () => {
        const xInput = (
          this.document.getElementById('discrete-x') as HTMLInputElement
        ).value;
        const yInput = (
          this.document.getElementById('discrete-y') as HTMLInputElement
        ).value;
        const nInput = (
          this.document.getElementById('discrete-n') as HTMLInputElement
        ).value;
        const colorInput =
          (this.document.getElementById('discrete-color') as HTMLInputElement)
            .value || '#FFFF00';
  
        if (!xInput || !yInput || !nInput || !this.cartesianCanvas) return;
  
        const startX = parseFloat(xInput);
        const startY = parseFloat(yInput);
        const n = parseFloat(nInput);
  
        // Añadir el punto discreto sin limpiar el canvas
        this.cartesianCanvas.drawDiscreteLine(startX, startY, n, colorInput);
      });
  
      // 4) Botón para graficar serie de funciones
      const plotSeriesBtn = this.document.getElementById(
        'plot-series'
      ) as HTMLButtonElement;
      plotSeriesBtn?.addEventListener('click', () => {
        const seriesInput = (
          this.document.getElementById('series-input') as HTMLInputElement
        ).value;
        const termsInput = (
          this.document.getElementById('series-terms') as HTMLInputElement
        ).value;
        const colorInput =
          (this.document.getElementById('series-color') as HTMLInputElement)
            .value || '#FF55FF';
  
        if (!seriesInput || !termsInput || !this.cartesianCanvas) return;
  
        try {
          // Por ejemplo, si seriesInput = "Math.sin(n*x)/n"
          // creamos una función con parámetros (n, x)
          const seriesTerm = new Function('n', 'x', `return ${seriesInput}`) as (
            n: number,
            x: number
          ) => number;
          const terms = parseInt(termsInput, 10);
  
          // Limpia el canvas primero
          this.cartesianCanvas.clearCanvas();
          // Dibuja la serie
          this.cartesianCanvas.drawSeries(seriesTerm, terms, colorInput);
        } catch (error) {
          console.error('Error al parsear la serie:', error);
        }
      });
  
      // 5) Botón para limpiar el canvas
      const clearCanvasBtn = this.document.getElementById(
        'clear-canvas'
      ) as HTMLButtonElement;
      clearCanvasBtn?.addEventListener('click', () => {
        if (this.cartesianCanvas) {
          this.cartesianCanvas.clearCanvas();
        }
      });
    }, 0);
  }
}