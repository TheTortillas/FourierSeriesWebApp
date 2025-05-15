import { Injectable, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare var MathQuill: any;
declare var MathJax: any;

@Injectable({
  providedIn: 'root',
})
export class MathquillService {
  private MQ: any;
  private isBrowser: boolean;
  private renderPending = false;

  constructor(@Inject(PLATFORM_ID) platformId: Object, private ngZone: NgZone) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Wait for document to be ready
    if (this.isBrowser) {
      window.addEventListener('DOMContentLoaded', () => {
        this.initMathQuill();
      });
    }
  }

  private initMathQuill() {
    if (this.isBrowser && typeof MathQuill !== 'undefined') {
      this.MQ = MathQuill.getInterface(2);
    }
  }

  // Cambiamos a público para poder usarlo desde otros componentes
  isMobileDevice(): boolean {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  createMathField(element: HTMLElement, config = {}) {
    if (!this.isBrowser) return null;

    if (!this.MQ) {
      this.initMathQuill();
    }

    if (this.MQ) {
      const isMobile = this.isMobileDevice();

      const finalConfig = {
        spaceBehavesLikeTab: true,
        autoCommands: 'pi theta sqrt sum',
        autoOperatorNames:
          'sin sen cos tan cot sec csc sinh cosh tanh coth sech csch ' +
          'arcsin arccos arctan arccot arcsec arccsc ' +
          'arcsinh arccosh arctanh arccoth arcsech arccsch ' +
          'exp log',
        // Solo usar substituteTextarea en móviles
        ...(isMobile && {
          substituteTextarea: () => {
            const span = document.createElement('span');
            span.setAttribute('tabindex', '0');
            return span;
          },
        }),
        handlers: {
          edit: () => {},
          ...config,
        },
      };

      return this.MQ.MathField(element, finalConfig);
    }

    return null;
  }

  // Optimized version with debouncing
  renderMathJax() {
    if (this.isBrowser && typeof MathJax !== 'undefined' && MathJax.typeset) {
      // Prevent multiple rapid render calls
      if (!this.renderPending) {
        this.renderPending = true;

        // Run outside Angular to avoid unnecessary change detection
        this.ngZone.runOutsideAngular(() => {
          requestAnimationFrame(() => {
            MathJax.typeset();
            this.renderPending = false;
          });
        });
      }
    }
  }
}
