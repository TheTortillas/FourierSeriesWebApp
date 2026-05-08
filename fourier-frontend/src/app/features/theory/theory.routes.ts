import { Routes } from '@angular/router';

export const theoryRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./theory-shell.component').then((m) => m.TheoryShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'series' },
      {
        path: 'series',
        loadComponent: () =>
          import('./series/theory-series.component').then((m) => m.TheorySeriesComponent),
      },
      {
        path: 'continuous',
        loadComponent: () =>
          import('./continuous/theory-continuous.component').then(
            (m) => m.TheoryContinuousComponent,
          ),
      },
      {
        path: 'dft',
        loadComponent: () =>
          import('./dft/theory-dft.component').then((m) => m.TheoryDftComponent),
      },
    ],
  },
];
