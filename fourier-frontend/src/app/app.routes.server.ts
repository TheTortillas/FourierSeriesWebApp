import { RenderMode, ServerRoute } from '@angular/ssr';
import { SUPPORTED_LANG_CODES } from './core/config/languages';

const langParams = async () => SUPPORTED_LANG_CODES.map((lang) => ({ lang }));

export const serverRoutes: ServerRoute[] = [
  // ── Client-only (require auth state or are highly interactive) ───────────────
  { path: ':lang/auth/**',    renderMode: RenderMode.Client },
  { path: ':lang/history',    renderMode: RenderMode.Client },
  { path: ':lang/profile',    renderMode: RenderMode.Client },
  { path: ':lang/admin/**',   renderMode: RenderMode.Client },
  { path: ':lang/dev/**',     renderMode: RenderMode.Client },
  { path: ':lang/results/**', renderMode: RenderMode.Client },
  { path: ':lang/calculator', renderMode: RenderMode.Client },

  // ── Prerendered (one version per supported language) ─────────────────────────
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

  // ── Fallback ──────────────────────────────────────────────────────────────────
  { path: '**', renderMode: RenderMode.Prerender },
];
