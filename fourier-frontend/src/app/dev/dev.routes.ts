import { Routes } from '@angular/router';

export const devRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dev-sandbox/dev-sandbox.component').then(
        (m) => m.DevSandboxComponent,
      ),
    children: [
      // Los paneles se añadirán en cada fase
      // Fase 1: auth, fourier-trig, fourier-complex, fourier-half, dft, transforms, simplify
      // Fase 2: latex-maxima, mathquill
      // Fase 3: canvas, canvas-plot
    ],
  },
];
