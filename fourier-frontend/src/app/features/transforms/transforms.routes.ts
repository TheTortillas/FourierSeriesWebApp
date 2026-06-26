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
    path: 'dft',
    loadComponent: () =>
      import('./dft/dft.component').then((m) => m.DftComponent),
  },
];
