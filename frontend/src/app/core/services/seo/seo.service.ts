import { Injectable, Inject, LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT } from '@angular/common';

export interface SEOData {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  canonical?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SEOService {
  private seoData: { [locale: string]: SEOData } = {
    es: {
      title:
        'Calculadora de Series de Fourier y DFT | Herramienta de Análisis Matemático Online',
      description:
        'Calcula series de Fourier online. Introduce tu función (incluso definida a trozos), obtén coeficientes y visualiza su representación gráfica. Herramienta matemática gratuita.',
      keywords:
        'series de fourier, calculadora fourier, coeficientes de fourier, transformada de fourier, análisis matemático, funciones periódicas, armónicos, transformada discreta de Fourier, serie compleja de Fourier, series de medio rango, expansiones de medio rango, calculadora online series fourier, calculadora fourier definida a trozos',
      ogTitle:
        'Calculadora de Series de Fourier y DFT | Análisis Matemático Online',
      ogDescription:
        'Calcula series de Fourier online. Herramienta gratuita para análisis de funciones periódicas y visualización matemática.',
      twitterTitle:
        'Calculadora de Series de Fourier y DFT | Análisis Matemático Online',
      twitterDescription:
        'Calcula series de Fourier online. Herramienta gratuita para análisis de funciones periódicas y visualización matemática.',
    },
    en: {
      title:
        'Fourier Series & DFT Calculator | Online Mathematical Analysis Tool',
      description:
        'Calculate Fourier series online. Enter your function (including piecewise), get coefficients and visualize their graphical representation. Free mathematical analysis tool.',
      keywords:
        'fourier series, fourier calculator, fourier coefficients, fourier transform, mathematical analysis, periodic functions, harmonics, DFT, discrete fourier transform, complex fourier series, half-range series, half-range expansions, online fourier series calculator, piecewise fourier series calculator',
      ogTitle: 'Fourier Series & DFT Calculator | Online Mathematical Analysis',
      ogDescription:
        'Calculate Fourier series online. Free tool for periodic function analysis and mathematical visualization.',
      twitterTitle:
        'Fourier Series & DFT Calculator | Online Mathematical Analysis',
      twitterDescription:
        'Calculate Fourier series online. Free tool for periodic function analysis and mathematical visualization.',
    },
    pt: {
      title:
        'Calculadora de Séries de Fourier e DFT | Ferramenta de Análise Matemática Online',
      description:
        'Calcule séries de Fourier online. Digite sua função (incluindo definida por partes), obtenha coeficientes e visualize sua representação gráfica. Ferramenta matemática gratuita.',
      keywords:
        'séries de fourier, calculadora fourier, coeficientes de fourier, transformada de fourier, análise matemática, funções periódicas, harmônicos, transformada discreta de Fourier, série complexa de Fourier, séries de meio alcance, expansões de meio alcance, calculadora online séries fourier',
      ogTitle:
        'Calculadora de Séries de Fourier e DFT | Análise Matemática Online',
      ogDescription:
        'Calcule séries de Fourier online. Ferramenta gratuita para análise de funções periódicas e visualização matemática.',
      twitterTitle:
        'Calculadora de Séries de Fourier e DFT | Análise Matemática Online',
      twitterDescription:
        'Calcule séries de Fourier online. Ferramenta gratuita para análise de funções periódicas e visualização matemática.',
    },
  };

  private baseUrl = 'https://fouriersolver.com';

  constructor(
    private titleService: Title,
    private metaService: Meta,
    @Inject(LOCALE_ID) private locale: string,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document
  ) {}

  updateSEOTags(pageKey?: string): void {
    const currentLocale = this.locale || 'es';
    const data = this.seoData[currentLocale] || this.seoData['es'];

    // Update title
    this.titleService.setTitle(data.title);

    // Update meta description
    this.metaService.updateTag({
      name: 'description',
      content: data.description,
    });

    // Update keywords
    this.metaService.updateTag({
      name: 'keywords',
      content: data.keywords,
    });

    // Update Open Graph tags
    this.metaService.updateTag({
      property: 'og:title',
      content: data.ogTitle,
    });

    this.metaService.updateTag({
      property: 'og:description',
      content: data.ogDescription,
    });

    this.metaService.updateTag({
      property: 'og:locale',
      content: this.getOGLocale(currentLocale),
    });

    // Update Twitter Card tags
    this.metaService.updateTag({
      name: 'twitter:title',
      content: data.twitterTitle,
    });

    this.metaService.updateTag({
      name: 'twitter:description',
      content: data.twitterDescription,
    });

    // Update canonical URL
    const canonicalUrl = this.buildCanonicalUrl(currentLocale, pageKey);
    this.metaService.updateTag({
      rel: 'canonical',
      href: canonicalUrl,
    });

    // Update alternate language links
    this.updateAlternateLanguageLinks(pageKey);

    // Update HTML lang attribute (only in browser)
    if (isPlatformBrowser(this.platformId)) {
      this.document.documentElement.lang = currentLocale;
    }
  }

  private getOGLocale(locale: string): string {
    const localeMap: { [key: string]: string } = {
      es: 'es_ES',
      en: 'en_US',
      pt: 'pt_PT',
    };
    return localeMap[locale] || 'es_ES';
  }

  private buildCanonicalUrl(locale: string, pageKey?: string): string {
    const path = pageKey ? `/${pageKey}` : '';
    return locale === 'es'
      ? `${this.baseUrl}${path}`
      : `${this.baseUrl}/${locale}${path}`;
  }

  private updateAlternateLanguageLinks(pageKey?: string): void {
    // Only run in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Remove existing alternate links
    const existingLinks = this.document.querySelectorAll(
      'link[rel="alternate"][hreflang]'
    );
    existingLinks.forEach((link) => link.remove());

    // Add new alternate links
    const languages = ['es', 'en', 'pt'];
    const head = this.document.getElementsByTagName('head')[0];

    languages.forEach((lang) => {
      const link = this.document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = lang;
      link.href = this.buildCanonicalUrl(lang, pageKey);
      head.appendChild(link);
    });

    // Add x-default
    const defaultLink = this.document.createElement('link');
    defaultLink.rel = 'alternate';
    defaultLink.hreflang = 'x-default';
    defaultLink.href = this.buildCanonicalUrl('es', pageKey);
    head.appendChild(defaultLink);
  }

  getSEOData(locale?: string): SEOData {
    const currentLocale = locale || this.locale || 'es';
    return this.seoData[currentLocale] || this.seoData['es'];
  }

  updatePageSEO(pageKey: string, customData?: Partial<SEOData>): void {
    const currentLocale = this.locale || 'es';
    const baseData = this.seoData[currentLocale] || this.seoData['es'];
    const finalData = { ...baseData, ...customData };

    this.titleService.setTitle(finalData.title);
    this.metaService.updateTag({
      name: 'description',
      content: finalData.description,
    });
    this.metaService.updateTag({
      name: 'keywords',
      content: finalData.keywords,
    });
    this.metaService.updateTag({
      property: 'og:title',
      content: finalData.ogTitle,
    });
    this.metaService.updateTag({
      property: 'og:description',
      content: finalData.ogDescription,
    });
    this.metaService.updateTag({
      name: 'twitter:title',
      content: finalData.twitterTitle,
    });
    this.metaService.updateTag({
      name: 'twitter:description',
      content: finalData.twitterDescription,
    });

    const canonicalUrl = this.buildCanonicalUrl(currentLocale, pageKey);
    this.metaService.updateTag({ rel: 'canonical', href: canonicalUrl });
    this.updateAlternateLanguageLinks(pageKey);
  }
}
