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
  private initialized = false;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private get hasGtag(): boolean {
    return typeof window.gtag === 'function';
  }

  private withDebugMode(params?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!this.isBrowser) return params;

    const debugEnabled = new URLSearchParams(window.location.search).get('ga_debug') === '1';
    if (!debugEnabled) return params;

    return { ...(params ?? {}), debug_mode: true };
  }

  init(): void {
    if (!this.isBrowser || !environment.ga4Id || !this.hasGtag || this.initialized) return;

    this.initialized = true;

    window.gtag(
      'event',
      'page_view',
      this.withDebugMode({
        page_path: window.location.pathname + window.location.search,
        page_location: window.location.href,
        page_title: document.title,
      }),
    );

    // Track SPA navigation as page_view events
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        window.gtag(
          'event',
          'page_view',
          this.withDebugMode({
            page_path: e.urlAfterRedirects,
            page_location: window.location.origin + e.urlAfterRedirects,
            page_title: document.title,
          }),
        );
      });
  }

  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    if (!this.isBrowser || !environment.ga4Id || !this.hasGtag) return;
    window.gtag('event', eventName, this.withDebugMode(params));
  }
}
