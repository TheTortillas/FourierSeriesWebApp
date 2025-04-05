import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartesianCanvasComponent } from '../../../shared/components/cartesian-canvas/cartesian-canvas.component';

@Component({
  selector: 'app-canva-sidenav',
  standalone: true,
  imports: [CommonModule, FormsModule, CartesianCanvasComponent],
  templateUrl: './canva-sidenav.component.html',
  styleUrl: './canva-sidenav.component.scss',
})
export class CanvaSidenavComponent {
  public sidenavOpen = false;

  // Variables para el input de función
  public functionInput = '';
  public functionColor = '#FF0000';

  // Variables para el input de serie de Fourier
  public seriesInput = '';
  public seriesTerms = 10;
  public seriesColor = '#4287f5';

  // Referencia al componente canvas
  private cartesianCanvas: CartesianCanvasComponent | null = null;

  // Método para guardar referencia al canvas
  public setCanvasComponent(canvas: CartesianCanvasComponent): void {
    this.cartesianCanvas = canvas;
  }

  // Método para alternar el sidenav
  public toggleSidenav(): void {
    this.sidenavOpen = !this.sidenavOpen;
  }

  // Método para graficar una función
  public graficarFuncion(): void {
    if (!this.cartesianCanvas || !this.functionInput) return;
    this.limpiarCanvas();
    try {
      const fn = new Function('x', `return ${this.functionInput}`);
      this.cartesianCanvas.drawFunction(
        fn as (x: number) => number,
        this.functionColor
      );
    } catch (error) {
      console.error('Error al parsear la función:', error);
      // Aquí podrías mostrar un mensaje de error al usuario
    }
  }

  // Método para graficar una serie
  public graficarSerie(): void {
    if (!this.cartesianCanvas || !this.seriesInput) return;
    this.limpiarCanvas();
    try {
      const seriesTerm = new Function('n', 'x', `return ${this.seriesInput}`);
      this.cartesianCanvas.drawSeries(
        seriesTerm as (n: number, x: number) => number,
        this.seriesTerms,
        this.seriesColor
      );
    } catch (error) {
      console.error('Error al parsear la serie:', error);
      // Aquí podrías mostrar un mensaje de error al usuario
    }
  }

  // Método para limpiar el canvas
  public limpiarCanvas(): void {
    if (this.cartesianCanvas) {
      this.cartesianCanvas.clearCanvas();
    }
  }

  // Método para resetear la vista
  public resetearVista(): void {
    if (this.cartesianCanvas) {
      this.cartesianCanvas.resetView();
    }
  }
}
