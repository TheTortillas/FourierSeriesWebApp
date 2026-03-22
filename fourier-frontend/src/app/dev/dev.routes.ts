import { Routes } from '@angular/router';

export const devRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dev-sandbox/dev-sandbox.component').then((m) => m.DevSandboxComponent),
    children: [
      // ── Fase 1: API & Auth ──────────────────────────────────────────────
      {
        path: 'auth',
        loadComponent: () =>
          import('./panels/api-auth/api-auth-panel.component').then(
            (m) => m.ApiAuthPanelComponent,
          ),
      },
      {
        path: 'fourier',
        loadComponent: () =>
          import('./panels/api-fourier/api-fourier-panel.component').then(
            (m) => m.ApiFourierPanelComponent,
          ),
      },
      // ── Fases siguientes: se añadirán aquí ─────────────────────────────
      // Fase 2: latex-maxima, mathquill
      // Fase 3: canvas, canvas-plot
    ],
  },
];
