import { Routes } from '@angular/router';
import { devOnlyGuard } from './core/guards/dev-only.guard';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/calculator/calculator.component').then(
        (m) => m.CalculatorComponent,
      ),
  },
  {
    path: 'calculator',
    loadComponent: () =>
      import('./features/calculator/calculator.component').then(
        (m) => m.CalculatorComponent,
      ),
  },
  {
    path: 'results',
    loadChildren: () =>
      import('./features/results/results.routes').then((m) => m.resultsRoutes),
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'history',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/history/history.component').then(
        (m) => m.HistoryComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () =>
      import('./features/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'dev',
    canMatch: [devOnlyGuard],
    loadChildren: () =>
      import('./dev/dev.routes').then((m) => m.devRoutes),
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
