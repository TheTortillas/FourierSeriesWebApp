import { Injectable } from '@angular/core';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
  alternates?: { hreflang: string; href: string }[];
}

@Injectable({
  providedIn: 'root',
})
export class SitemapService {
  private baseUrl = 'https://fouriersolver.com';
  private languages = ['es', 'en', 'pt'];
  private pages = [
    { path: '', priority: 1.0, changefreq: 'weekly' as const },
    {
      path: '/fourier-calculator',
      priority: 0.9,
      changefreq: 'weekly' as const,
    },
    { path: '/dft-plot', priority: 0.8, changefreq: 'weekly' as const },
    {
      path: '/fourier-series-plot',
      priority: 0.8,
      changefreq: 'weekly' as const,
    },
    { path: '/about-us', priority: 0.6, changefreq: 'monthly' as const },
    { path: '/tests', priority: 0.5, changefreq: 'monthly' as const },
  ];

  generateSitemap(): string {
    const urls: SitemapUrl[] = [];
    const lastmod = new Date().toISOString().split('T')[0];

    // Generate URLs for each page in each language
    this.pages.forEach((page) => {
      this.languages.forEach((lang) => {
        const loc = this.buildUrl(lang, page.path);
        const alternates = this.languages.map((altLang) => ({
          hreflang: altLang,
          href: this.buildUrl(altLang, page.path),
        }));

        urls.push({
          loc,
          lastmod,
          changefreq: page.changefreq,
          priority: page.priority,
          alternates,
        });
      });
    });

    return this.buildSitemapXML(urls);
  }

  private buildUrl(language: string, path: string): string {
    if (language === 'es') {
      return `${this.baseUrl}${path}`;
    }
    return `${this.baseUrl}/${language}${path}`;
  }

  private buildSitemapXML(urls: SitemapUrl[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml +=
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

    urls.forEach((url) => {
      xml += '  <url>\n';
      xml += `    <loc>${url.loc}</loc>\n`;
      if (url.lastmod) xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
      if (url.changefreq)
        xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
      if (url.priority) xml += `    <priority>${url.priority}</priority>\n`;

      // Add alternate language links
      if (url.alternates) {
        url.alternates.forEach((alt) => {
          xml += `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}" />\n`;
        });
      }

      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  }

  generateRobotsTxt(): string {
    return `User-agent: *
Allow: /

# Sitemaps
Sitemap: ${this.baseUrl}/sitemap.xml

# Language-specific sitemaps (optional)
Sitemap: ${this.baseUrl}/sitemap-es.xml
Sitemap: ${this.baseUrl}/sitemap-en.xml
Sitemap: ${this.baseUrl}/sitemap-pt.xml

# Block access to build files and source maps
Disallow: /*.js.map
Disallow: /*.css.map
Disallow: /assets/mathquill-0.10.1/

# Allow specific assets
Allow: /assets/
Allow: /*.css
Allow: /*.js
Allow: /image.png
Allow: /sum-sign.svg`;
  }
}
