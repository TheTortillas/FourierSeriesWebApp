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

  createMathField(element: HTMLElement, config = {}) {
    if (!this.isBrowser) return null;

    if (!this.MQ) {
      this.initMathQuill();
    }

    if (this.MQ) {
      return this.MQ.MathField(element, {
        spaceBehavesLikeTab: true,
        autoCommands: 'pi theta sqrt sum',
        // Ampliar la lista de operadores para incluir los hiperbólicos
        autoOperatorNames:
          'sin cos tan sinh cosh tanh arcsin arccos arctan arcsinh arccosh arctanh exp ln log',
        handlers: {
          edit: () => {},
          ...config,
        },
      });
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
