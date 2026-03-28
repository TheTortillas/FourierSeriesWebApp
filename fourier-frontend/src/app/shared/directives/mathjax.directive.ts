import { Directive, ElementRef, Input, OnChanges, inject } from '@angular/core';
import { MathjaxService } from '../../core/services/math/mathjax.service';

/**
 * Usage:  <span [mathjax]="'\\( a_0 = \\frac{1}{L}\\int_{-L}^{L} f(x)\\,dx \\)'"></span>
 *
 * Sets the element's innerHTML to the raw LaTeX string (wrapped in \( \) delimiters
 * if not already present), then calls MathJax to typeset it.
 */
@Directive({ selector: '[mathjax]', standalone: true })
export class MathjaxDirective implements OnChanges {
  @Input('mathjax') tex: string | null | undefined;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly mj = inject(MathjaxService);

  ngOnChanges(): void {
    if (!this.tex) {
      this.el.nativeElement.innerHTML = '';
      return;
    }
    // Wrap in display-math delimiters if not already wrapped
    const content =
      this.tex.startsWith('\\(') || this.tex.startsWith('\\[') || this.tex.startsWith('$')
        ? this.tex
        : `\\(${this.tex}\\)`;
    this.el.nativeElement.innerHTML = content;
    this.mj.render(this.el.nativeElement);
  }
}
