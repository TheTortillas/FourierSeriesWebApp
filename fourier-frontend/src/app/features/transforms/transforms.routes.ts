import { Routes } from '@angular/router';

export const transformRoutes: Routes = [
  {
    path: '',
    redirectTo: 'continuous',
    pathMatch: 'full',
  },
  {
    path: 'continuous',
    loadComponent: () =>
      import('./continuous/continuous-transform.component').then(
        (m) => m.ContinuousTransformComponent,
      ),
  },
  {
    path: 'fourier-integral',
    loadComponent: () =>
      import('./fourier-integral/fourier-integral.component').then(
        (m) => m.FourierIntegralComponent,
      ),
  },
  {
    path: 'dft',
    loadComponent: () =>
      import('./dft/dft.component').then((m) => m.DftComponent),
  },
];
