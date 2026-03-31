import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { filter } from 'rxjs';

import { environment } from '../../../../environments/environment';

const SUPPORTED_LANGS = ['es', 'en'] as const;

/**
 * Inyecta etiquetas `<link rel="alternate" hreflang>` en el `<head>` del
 * documento en cada cambio de ruta, habilitando el señalado de idioma para
 * los motores de búsqueda (Google Search Console, etc.).
 *
 * Debe inicializarse UNA vez en el componente raíz via `setup()`.
 */
@Injectable({ providedIn: 'root' })
export class HreflangService {
  private readonly doc    = inject(DOCUMENT);
  private readonly router = inject(Router);

  setup(): void {
    // Emite la primera vez con la URL actual en SSR
    this.updateTags(this.router.url);

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTags(e.urlAfterRedirects));
  }

  private updateTags(url: string): void {
    // Elimina etiquetas previas para evitar duplicados
    this.doc.querySelectorAll('link[hreflang]').forEach((el) => el.remove());

    // Limpia query-string y fragmentos
    const path = url.split('?')[0].split('#')[0];
    const base = environment.baseUrl;

    for (const lang of SUPPORTED_LANGS) {
      const altPath = path.replace(/^\/(es|en)(?=\/|$)/, `/${lang}`);
      const link = this.doc.createElement('link');
      link.rel = 'alternate';
      link.setAttribute('hreflang', lang);
      link.setAttribute('href', base + altPath);
      this.doc.head.appendChild(link);
    }

    // x-default apunta siempre a la versión en español
    const esPath = path.replace(/^\/(es|en)(?=\/|$)/, '/es');
    const xDefault = this.doc.createElement('link');
    xDefault.rel = 'alternate';
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('href', base + esPath);
    this.doc.head.appendChild(xDefault);
  }
}
