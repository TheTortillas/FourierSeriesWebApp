import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../../environments/environment';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  init(): void {
    if (!this.isBrowser || !environment.ga4Id) return;

    const id = environment.ga4Id;

    // Bootstrap dataLayer + gtag function FIRST (before script loads)
    window.dataLayer = window.dataLayer || [];
    window.gtag = function (...args: unknown[]) {
      window.dataLayer.push(args);
    };
    window.gtag('js', new Date());
    window.gtag('config', id, { send_page_view: false });

    // Inject gtag script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    script.onload = () => {
      // Send initial page_view after script loads
      window.gtag('event', 'page_view', {
        page_path: window.location.pathname + window.location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    };
    document.head.appendChild(script);

    // Track SPA navigation as page_view events
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        window.gtag('event', 'page_view', {
          page_path: e.urlAfterRedirects,
          page_location: window.location.origin + e.urlAfterRedirects,
          page_title: document.title,
        });
      });
  }

  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    if (!this.isBrowser || !environment.ga4Id) return;
    window.gtag?.('event', eventName, params);
  }
}
