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
          import('./panels/api-auth/api-auth-panel.component').then((m) => m.ApiAuthPanelComponent),
      },
      {
        path: 'fourier',
        loadComponent: () =>
          import('./panels/api-fourier/api-fourier-panel.component').then(
            (m) => m.ApiFourierPanelComponent,
          ),
      },
      // ── Fase 2: Math input engine ───────────────────────────────────────
      {
        path: 'latex-maxima',
        loadComponent: () =>
          import('./panels/latex-maxima/latex-maxima-panel.component').then(
            (m) => m.LatexMaximaPanelComponent,
          ),
      },
      {
        path: 'mathquill',
        loadComponent: () =>
          import('./panels/mathquill/mathquill-panel.component').then(
            (m) => m.MathquillPanelComponent,
          ),
      },
      // ── Fase 3: Canvas ──────────────────────────────────────────────────
      {
        path: 'canvas',
        loadComponent: () =>
          import('./panels/canvas/canvas-panel.component').then((m) => m.CanvasPanelComponent),
      },
      {
        path: 'canvas-plot',
        loadComponent: () =>
          import('./panels/canvas-plot/canvas-plot-panel.component').then(
            (m) => m.CanvasPlotPanelComponent,
          ),
      },
      {
        path: 'epicycles',
        loadComponent: () =>
          import('./panels/epicycles/epicycles-panel.component').then(
            (m) => m.EpicyclesPanelComponent,
          ),
      },
      {
        path: 'dft-signal-lab',
        loadComponent: () =>
          import('./panels/dft-signal-lab/dft-signal-lab-panel.component').then(
            (m) => m.DftSignalLabPanelComponent,
          ),
      },
      {
        path: 'dft-signal-lab-ab',
        data: { labView: 'signal' },
        loadComponent: () =>
          import('./panels/dft-signal-lab/dft-signal-lab-panel.component').then(
            (m) => m.DftSignalLabPanelComponent,
          ),
      },
      {
        path: 'dft-signal-lab-c',
        data: { labView: 'filter' },
        loadComponent: () =>
          import('./panels/dft-signal-lab/dft-signal-lab-panel.component').then(
            (m) => m.DftSignalLabPanelComponent,
          ),
      },
      {
        path: 'dft-signal-lab-image',
        data: { labView: 'image' },
        loadComponent: () =>
          import('./panels/dft-signal-lab/dft-signal-lab-panel.component').then(
            (m) => m.DftSignalLabPanelComponent,
          ),
      },
    ],
  },
];
