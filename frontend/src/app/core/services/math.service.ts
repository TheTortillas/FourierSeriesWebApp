import { Injectable } from '@angular/core';
declare var MathQuill: any;
declare var MathJax: any;

@Injectable({
  providedIn: 'root'
})
export class MathService {
  private MQ: any;

  constructor() {
    // Wait for document to be ready
    if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', () => {
        this.initMathQuill();
      });
    }
  }

  private initMathQuill() {
    if (typeof MathQuill !== 'undefined') {
      this.MQ = MathQuill.getInterface(2);
    }
  }

  createMathField(element: HTMLElement, config = {}) {
    if (!this.MQ) {
      this.initMathQuill();
    }
    
    if (this.MQ) {
      return this.MQ.MathField(element, {
        spaceBehavesLikeTab: true,
        handlers: {
          edit: () => {},
          ...config
        }
      });
    }
    return null;
  }

  renderMathJax() {
    if (typeof MathJax !== 'undefined' && MathJax.typeset) {
      MathJax.typeset();
    }
  }
}