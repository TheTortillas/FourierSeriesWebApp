import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-fourier-series-plot',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="min-h-screen w-full">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [],
})
export class FourierSeriesPlotComponent {}