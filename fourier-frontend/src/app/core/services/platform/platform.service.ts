import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT } from '@angular/common';

/**
 * SSR-safe wrapper for browser-only APIs.
 * Always use this service instead of accessing window, document,
 * or localStorage directly. This ensures the app works correctly
 * on both the server (SSR) and the browser.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly doc = inject(DOCUMENT);

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  get isServer(): boolean {
    return !this.isBrowser;
  }

  get document(): Document {
    return this.doc;
  }

  get window(): Window | null {
    return this.isBrowser ? (this.doc.defaultView ?? null) : null;
  }

  get localStorage(): Storage | null {
    return this.isBrowser ? (this.window?.localStorage ?? null) : null;
  }

  get sessionStorage(): Storage | null {
    return this.isBrowser ? (this.window?.sessionStorage ?? null) : null;
  }

  getLocalStorageItem(key: string): string | null {
    return this.localStorage?.getItem(key) ?? null;
  }

  setLocalStorageItem(key: string, value: string): void {
    this.localStorage?.setItem(key, value);
  }

  removeLocalStorageItem(key: string): void {
    this.localStorage?.removeItem(key);
  }
}
