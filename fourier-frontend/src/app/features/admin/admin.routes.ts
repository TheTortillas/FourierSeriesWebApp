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
        loadComponent: () => import('./users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'audit',
        loadComponent: () => import('./audit/audit.component').then((m) => m.AuditComponent),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./history/admin-history.component').then((m) => m.AdminHistoryComponent),
      },
      {
        path: 'rate-limit',
        loadComponent: () =>
          import('./rate-limit/rate-limit.component').then((m) => m.RateLimitComponent),
      },
      {
        path: 'cache',
        loadComponent: () =>
          import('./cache/cache.component').then((m) => m.CacheComponent),
      },
      {
        path: 'system',
        loadComponent: () =>
          import('./system/system-stats.component').then((m) => m.SystemStatsComponent),
      },
      {
        path: 'calculations',
        loadComponent: () =>
          import('./calc-stats/calc-stats.component').then((m) => m.CalcStatsComponent),
      },
      {
        path: 'feedback',
        loadComponent: () =>
          import('./feedback-stats/feedback-stats.component').then((m) => m.FeedbackStatsComponent),
      },
      {
        path: 'survey',
        loadComponent: () =>
          import('./survey-stats/survey-stats.component').then((m) => m.SurveyStatsComponent),
      },
    ],
  },
];
