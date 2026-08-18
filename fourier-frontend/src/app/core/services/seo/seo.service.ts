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

const SITE_NAME = 'AEM-Lab';

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
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
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
   * @param keywords       Optional: comma-separated keywords for this page.
   */
  setPage(titleKey: string, descriptionKey: string, keywords?: string): void {
    const lang = this.transloco.getActiveLang();

    this.transloco
      .selectTranslation(lang)
      .pipe(take(1))
      .subscribe(() => {
        const pageTitle = this.transloco.translate(titleKey);
        const description = this.transloco.translate(descriptionKey);
        const fullTitle = `${pageTitle} | ${SITE_NAME}`;
        const canonical = this.buildCanonical();
        const ogLocale = OG_LOCALE[lang] ?? 'es_ES';

        // ── Basic ────────────────────────────────────────────────────────────
        this.titleSvc.setTitle(fullTitle);
        this.meta.updateTag({ name: 'description', content: description });
        this.meta.updateTag({ name: 'robots', content: 'index, follow' });

        if (keywords) {
          this.meta.updateTag({ name: 'keywords', content: keywords });
        }

        // ── Open Graph ───────────────────────────────────────────────────────
        this.meta.updateTag({ property: 'og:type', content: 'website' });
        this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
        this.meta.updateTag({ property: 'og:title', content: fullTitle });
        this.meta.updateTag({ property: 'og:description', content: description });
        this.meta.updateTag({ property: 'og:url', content: canonical });
        this.meta.updateTag({ property: 'og:locale', content: ogLocale });

        // ── Twitter Card ─────────────────────────────────────────────────────
        this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
        this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
        this.meta.updateTag({ name: 'twitter:description', content: description });

        // ── Canonical ────────────────────────────────────────────────────────
        this.setCanonical(canonical);
      });
  }

  /** Sets `noindex, nofollow` — use on auth, profile, and history pages. */
  setNoIndex(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  /**
   * Injects Schema.org JSON-LD structured data into <head>.
   * Replaces any previously injected block with the same id.
   * Call from home.component.ts after setPage() so translations are loaded.
   */
  setStructuredData(): void {
    const lang = this.transloco.getActiveLang();
    this.transloco
      .selectTranslation(lang)
      .pipe(take(1))
      .subscribe(() => {
        const t = (key: string) => this.transloco.translate(key);
        const base = environment.baseUrl;
        const langPrefix = `/${lang}`;

        const data = [
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            alternateName: 'Fourier Web Calculator',
            url: base,
            description: t('seo.home.description'),
            inLanguage: ['es', 'en'],
          },
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: SITE_NAME,
            alternateName: 'Fourier Web Calculator',
            url: base,
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            featureList: [
              t('home.series.description'),
              t('home.transforms.description'),
              t('home.integral.description'),
              t('home.dft.description'),
              t('home.laplace.description'),
              t('home.ode.description'),
            ],
            hasPart: [
              {
                '@type': 'WebPage',
                name: t('nav.series'),
                url: `${base}${langPrefix}/calculator`,
                description: t('home.series.description'),
              },
              {
                '@type': 'WebPage',
                name: t('nav.transforms'),
                url: `${base}${langPrefix}/transforms/continuous`,
                description: t('home.transforms.description'),
              },
              {
                '@type': 'WebPage',
                name: t('nav.laplace'),
                url: `${base}${langPrefix}/transforms/laplace`,
                description: t('home.laplace.description'),
              },
              {
                '@type': 'WebPage',
                name: t('nav.ode'),
                url: `${base}${langPrefix}/ode`,
                description: t('home.ode.description'),
              },
              {
                '@type': 'WebPage',
                name: t('nav.fourierIntegral'),
                url: `${base}${langPrefix}/transforms/fourier-integral`,
                description: t('home.integral.description'),
              },
              {
                '@type': 'WebPage',
                name: t('nav.dft'),
                url: `${base}${langPrefix}/transforms/dft`,
                description: t('home.dft.description'),
              },
            ],
          },
        ];

        this.upsertJsonLd('aem-lab-structured-data', data);
      });
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

  private upsertJsonLd(id: string, data: object[]): void {
    const existing = this.doc.getElementById(id);
    const script = existing ?? this.doc.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.id = id;
    script.textContent = JSON.stringify(data);
    if (!existing) this.doc.head.appendChild(script);
  }
}
