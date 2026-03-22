import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Rutas autenticadas o muy interactivas — solo cliente, sin SSR
  { path: 'auth/**', renderMode: RenderMode.Client },
  { path: 'history', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'dev/**', renderMode: RenderMode.Client },

  // Rutas dinámicas — Client por ahora hasta configurar RenderMode.Server
  // correctamente con servidor dedicado
  { path: 'results/**', renderMode: RenderMode.Client },
  { path: 'calculator', renderMode: RenderMode.Client },

  // Rutas estáticas — prerenderizadas en build time para máximo SEO
  { path: '**', renderMode: RenderMode.Prerender },
];
