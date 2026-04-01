import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { filter } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { LANGUAGES, DEFAULT_LANG, SUPPORTED_LANG_CODES } from '../../config/languages';

/**
 * Injects `<link rel="alternate" hreflang>` tags into the document `<head>`
 * on every route change, enabling language signalling for search engines.
 *
 * Must be initialised once in the root component via `setup()`.
 */
@Injectable({ providedIn: 'root' })
export class HreflangService {
  private readonly doc    = inject(DOCUMENT);
  private readonly router = inject(Router);

  /** Matches the leading /:lang segment dynamically from the central config. */
  private readonly langSegmentRe = new RegExp(
    `^\\/(${SUPPORTED_LANG_CODES.join('|')})(?=\\/|$)`,
  );

  setup(): void {
    this.updateTags(this.router.url);

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTags(e.urlAfterRedirects));
  }

  private updateTags(url: string): void {
    this.doc.querySelectorAll('link[hreflang]').forEach((el) => el.remove());

    const path = url.split('?')[0].split('#')[0];
    const base = environment.baseUrl;

    for (const { code, label: _ } of LANGUAGES) {
      const altPath = path.replace(this.langSegmentRe, `/${code}`);
      const link = this.doc.createElement('link');
      link.rel = 'alternate';
      link.setAttribute('hreflang', code);
      link.setAttribute('href', base + altPath);
      this.doc.head.appendChild(link);
    }

    // x-default points to the default language version
    const defaultPath = path.replace(this.langSegmentRe, `/${DEFAULT_LANG}`);
    const xDefault = this.doc.createElement('link');
    xDefault.rel = 'alternate';
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('href', base + defaultPath);
    this.doc.head.appendChild(xDefault);
  }
}
