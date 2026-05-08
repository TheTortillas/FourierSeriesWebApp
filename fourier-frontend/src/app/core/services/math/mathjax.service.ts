import { Injectable, inject } from '@angular/core';
import { PlatformService } from '../platform/platform.service';

/**
 * Wraps MathJax 3 loaded via CDN (window.MathJax).
 * Provides a simple `render(el)` that typesets LaTeX in a DOM element.
 */
@Injectable({ providedIn: 'root' })
export class MathjaxService {
  private readonly platform = inject(PlatformService);

  /** Promise that resolves once MathJax is ready. */
  private readonly ready: Promise<void>;

  constructor() {
    this.ready = this.loadMathJax();
  }

  private loadMathJax(): Promise<void> {
    if (!this.platform.isBrowser) return Promise.resolve();

    const win = this.platform.window as Window & {
      MathJax?: { startup?: { promise?: Promise<unknown> }; typesetPromise?: (els?: HTMLElement[]) => Promise<void> };
    };

    // Already loaded
    if (win.MathJax?.startup?.promise) {
      return win.MathJax.startup.promise.then(() => undefined);
    }

    // Configure before loading
    (win as unknown as Record<string, unknown>)['MathJax'] = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        packages: { '[+]': ['base', 'ams'] },
      },
      svg: { fontCache: 'global' },
      startup: { typeset: false },
    };

    return new Promise<void>((resolve, reject) => {
      const script = this.platform.document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
      script.async = true;
      script.onload = () => {
        win.MathJax?.startup?.promise?.then(() => resolve()).catch(reject);
      };
      script.onerror = reject;
      this.platform.document.head.appendChild(script);
    });
  }

  /** Typesets all LaTeX in `element` (or the whole document if omitted). */
  async render(element?: HTMLElement): Promise<void> {
    if (!this.platform.isBrowser) return;
    await this.ready;
    const win = this.platform.window as Window & {
      MathJax?: { typesetPromise?: (els?: HTMLElement[]) => Promise<void> };
    };
    if (win.MathJax?.typesetPromise) {
      await win.MathJax.typesetPromise(element ? [element] : undefined);
    }
  }
}
