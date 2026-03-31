import { RenderMode, ServerRoute } from '@angular/ssr';

const langParams = async () => [{ lang: 'es' }, { lang: 'en' }];

export const serverRoutes: ServerRoute[] = [
  // ── Client-only (requieren estado de auth o son muy interactivas) ──────────
  { path: ':lang/auth/**',    renderMode: RenderMode.Client },
  { path: ':lang/history',    renderMode: RenderMode.Client },
  { path: ':lang/profile',    renderMode: RenderMode.Client },
  { path: ':lang/admin/**',   renderMode: RenderMode.Client },
  { path: ':lang/dev/**',     renderMode: RenderMode.Client },
  { path: ':lang/results/**', renderMode: RenderMode.Client },
  { path: ':lang/calculator', renderMode: RenderMode.Client },

  // ── Prerenderizadas (una versión ES + EN) ─────────────────────────────────
  {
    path: ':lang/home',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: langParams,
  },
  {
    path: ':lang/transforms/continuous',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: langParams,
  },
  {
    path: ':lang/transforms/dft',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: langParams,
  },
  {
    path: ':lang',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: langParams,
  },

  // ── Resto (raíz redirect, catch-all) ─────────────────────────────────────
  { path: '**', renderMode: RenderMode.Prerender },
];
