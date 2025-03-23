import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare var MathQuill: any;
declare var MathJax: any;

@Injectable({
  providedIn: 'root',
})
export class MathquillService {
  private MQ: any;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
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
        handlers: {
          edit: () => {},
          ...config,
        },
      });
    }
    return null;
  }

  renderMathJax() {
    if (this.isBrowser && typeof MathJax !== 'undefined' && MathJax.typeset) {
      MathJax.typeset();
    }
  }
}
