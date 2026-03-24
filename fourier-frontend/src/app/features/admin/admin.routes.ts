import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./audit/audit.component').then((m) => m.AuditComponent),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./history/admin-history.component').then((m) => m.AdminHistoryComponent),
      },
    ],
  },
];
