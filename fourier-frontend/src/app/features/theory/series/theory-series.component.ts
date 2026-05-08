import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';

@Component({
  selector: 'app-theory-series',
  imports: [RouterLink, TranslocoPipe, MathjaxDirective],
  templateUrl: './theory-series.component.html',
})
export class TheorySeriesComponent {
  private readonly transloco = inject(TranslocoService);
  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly activeTab = signal<'trig' | 'complex' | 'half'>('trig');

  readonly tabs = [
    { id: 'trig'    as const, label: 'theory.series.forms.trig.tab' },
    { id: 'complex' as const, label: 'theory.series.forms.complex.tab' },
    { id: 'half'    as const, label: 'theory.series.forms.half.tab' },
  ];

  setTab(id: 'trig' | 'complex' | 'half'): void {
    this.activeTab.set(id);
  }

  // ── LaTeX formulas ──────────────────────────────────────────────────────────

  readonly tex = {
    // General trigonometric form
    trigSeries:   String.raw`\[ f(x) = \frac{a_0}{2} + \sum_{n=1}^{\infty} \left[ a_n \cos\!\left(\frac{n\pi x}{L}\right) + b_n \sin\!\left(\frac{n\pi x}{L}\right) \right] \]`,
    trigA0:       String.raw`\[ a_0 = \frac{1}{L}\int_{-L}^{L} f(x)\,dx \]`,
    trigAn:       String.raw`\[ a_n = \frac{1}{L}\int_{-L}^{L} f(x)\cos\!\left(\frac{n\pi x}{L}\right)dx,\quad n=1,2,3,\ldots \]`,
    trigBn:       String.raw`\[ b_n = \frac{1}{L}\int_{-L}^{L} f(x)\sin\!\left(\frac{n\pi x}{L}\right)dx,\quad n=1,2,3,\ldots \]`,
    omega0:       String.raw`\( \omega_0 = \dfrac{\pi}{L} \)`,
    periodDef:    String.raw`\( T = 2L \)`,

    // Complex form
    complexSeries: String.raw`\[ f(x) = \sum_{n=-\infty}^{\infty} c_n\, e^{\,i\,n\omega_0 x} \]`,
    complexCn:     String.raw`\[ c_n = \frac{1}{2L}\int_{-L}^{L} f(x)\,e^{-i\,n\omega_0 x}\,dx \]`,
    complexToTrig: String.raw`\[ a_n = 2\,\mathrm{Re}(c_n),\qquad b_n = -2\,\mathrm{Im}(c_n) \]`,
    complexMag:    String.raw`\[ |c_n| = \tfrac{1}{2}\sqrt{a_n^2 + b_n^2},\qquad \arg(c_n) = \arctan\!\left(\tfrac{-b_n}{a_n}\right) \]`,

    // Half-range
    halfSine:      String.raw`\[ f(x) = \sum_{n=1}^{\infty} b_n \sin\!\left(\frac{n\pi x}{L}\right),\quad x\in[0,L] \]`,
    halfSineBn:    String.raw`\[ b_n = \frac{2}{L}\int_{0}^{L} f(x)\sin\!\left(\frac{n\pi x}{L}\right)dx \]`,
    halfCosine:    String.raw`\[ f(x) = \frac{a_0}{2} + \sum_{n=1}^{\infty} a_n \cos\!\left(\frac{n\pi x}{L}\right),\quad x\in[0,L] \]`,
    halfCosineA0:  String.raw`\[ a_0 = \frac{2}{L}\int_{0}^{L} f(x)\,dx \]`,
    halfCosineAn:  String.raw`\[ a_n = \frac{2}{L}\int_{0}^{L} f(x)\cos\!\left(\frac{n\pi x}{L}\right)dx \]`,

    // Parseval
    parseval:      String.raw`\[ \frac{1}{2L}\int_{-L}^{L} |f(x)|^2\,dx = \frac{|a_0|^2}{4} + \frac{1}{2}\sum_{n=1}^{\infty}\left(a_n^2 + b_n^2\right) \]`,
    parsevalC:     String.raw`\[ \frac{1}{2L}\int_{-L}^{L} |f(x)|^2\,dx = \sum_{n=-\infty}^{\infty} |c_n|^2 \]`,

    // Gibbs
    gibbsOvershoot: String.raw`\( \approx 8.9\% \)`,

    // Dirichlet
    dirichlet: String.raw`\[ \lim_{N\to\infty} S_N(x) = \begin{cases} f(x) & \text{if } f \text{ is continuous at } x \\ \dfrac{f(x^+)+f(x^-)}{2} & \text{if } x \text{ is a jump discontinuity} \end{cases} \]`,

    // Square wave example
    squareWave: String.raw`\[ f(x) = \frac{4}{\pi}\sum_{n=0}^{\infty} \frac{\sin\!\bigl((2n+1)x\bigr)}{2n+1} = \frac{4}{\pi}\left[\sin x + \frac{\sin 3x}{3} + \frac{\sin 5x}{5} + \cdots\right] \]`,
  } as const;
}
