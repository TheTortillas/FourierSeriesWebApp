import { inject, Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

import { environment } from '../../../../environments/environment';

/** Maps Transloco language codes to BCP 47 / OG locale format. */
const OG_LOCALE: Record<string, string> = {
  es: 'es_ES',
  en: 'en_US',
};

const SITE_NAME = 'Fourier Web Calculator';

/**
 * Centralizes all SEO concerns: page title, meta description, Open Graph,
 * Twitter Card and canonical URL.
 *
 * Call `setPage()` in `ngOnInit` of every prerendered or public route
 * so that baked HTML includes the correct tags for search engines.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleSvc = inject(Title);
  private readonly meta     = inject(Meta);
  private readonly router   = inject(Router);
  private readonly doc      = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);

  /**
   * Sets all SEO tags for a public page.
   *
   * Uses selectTranslation() so the tags are applied only after the
   * translation file is fully loaded — preventing the raw key from
   * appearing in the browser tab on hard refresh.
   * On SSR, TranslocoServerLoader loads synchronously so it emits immediately.
   *
   * @param titleKey       Transloco key for the page title (without site name).
   * @param descriptionKey Transloco key for the meta description.
   */
  setPage(titleKey: string, descriptionKey: string): void {
    const lang = this.transloco.getActiveLang();

    this.transloco.selectTranslation(lang).pipe(take(1)).subscribe(() => {
      const pageTitle   = this.transloco.translate(titleKey);
      const description = this.transloco.translate(descriptionKey);
      const fullTitle   = `${pageTitle} | ${SITE_NAME}`;
      const canonical   = this.buildCanonical();
      const ogLocale    = OG_LOCALE[lang] ?? 'es_ES';

      // ── Basic ────────────────────────────────────────────────────────────
      this.titleSvc.setTitle(fullTitle);
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ name: 'robots',      content: 'index, follow' });

      // ── Open Graph ───────────────────────────────────────────────────────
      this.meta.updateTag({ property: 'og:type',        content: 'website' });
      this.meta.updateTag({ property: 'og:site_name',   content: SITE_NAME });
      this.meta.updateTag({ property: 'og:title',       content: fullTitle });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ property: 'og:url',         content: canonical });
      this.meta.updateTag({ property: 'og:locale',      content: ogLocale });

      // ── Twitter Card ─────────────────────────────────────────────────────
      this.meta.updateTag({ name: 'twitter:card',        content: 'summary' });
      this.meta.updateTag({ name: 'twitter:title',       content: fullTitle });
      this.meta.updateTag({ name: 'twitter:description', content: description });

      // ── Canonical ────────────────────────────────────────────────────────
      this.setCanonical(canonical);
    });
  }

  /** Sets `noindex, nofollow` — use on auth, profile, and history pages. */
  setNoIndex(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildCanonical(): string {
    const path = this.router.url.split('?')[0].split('#')[0];
    return environment.baseUrl + path;
  }

  private setCanonical(url: string): void {
    const existing = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (existing) {
      existing.href = url;
    } else {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      link.setAttribute('href', url);
      this.doc.head.appendChild(link);
    }
  }
}
