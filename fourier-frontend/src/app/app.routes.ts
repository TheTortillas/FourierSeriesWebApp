import { Routes } from '@angular/router';
import { devOnlyGuard } from './core/guards/dev-only.guard';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { langGuard } from './core/guards/lang.guard';
import { LangLayoutComponent } from './features/lang-layout/lang-layout.component';
import { getSavedLang, DEFAULT_LANG } from './core/config/languages';

export const routes: Routes = [
  // Raíz → redirige al idioma guardado en localStorage (o al idioma por defecto)
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => `${getSavedLang()}/home`,
  },

  // Auth routes without lang prefix (email links) → redirect to default lang preserving query params
  // Must be before :lang to avoid 'auth' being captured as a language segment
  {
    path: 'auth/verify-email',
    redirectTo: ({ queryParams }) => {
      const token = queryParams['token'];
      return token
        ? `/${DEFAULT_LANG}/auth/verify-email?token=${encodeURIComponent(token as string)}`
        : `/${DEFAULT_LANG}/home`;
    },
  },
  {
    path: 'auth/reset-password',
    redirectTo: ({ queryParams }) => {
      const token = queryParams['token'];
      return token
        ? `/${DEFAULT_LANG}/auth/reset-password?token=${encodeURIComponent(token as string)}`
        : `/${DEFAULT_LANG}/home`;
    },
  },

  // Rutas prefijadas con el idioma: /:lang/...
  {
    path: ':lang',
    component: LangLayoutComponent,
    canActivate: [langGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'calculator',
        loadComponent: () =>
          import('./features/calculator/calculator.component').then(
            (m) => m.CalculatorComponent,
          ),
      },
      {
        path: 'transforms',
        loadChildren: () =>
          import('./features/transforms/transforms.routes').then(
            (m) => m.transformRoutes,
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
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/profile/profile.component').then(
            (m) => m.ProfileComponent,
          ),
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
        path: 'feedback',
        loadComponent: () =>
          import('./features/feedback/feedback.component').then(
            (m) => m.FeedbackComponent,
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
    ],
  },

  // Catch-all — langGuard redirige rutas planas antiguas a /es/home
  { path: '**', redirectTo: `${DEFAULT_LANG}/home` },
];
