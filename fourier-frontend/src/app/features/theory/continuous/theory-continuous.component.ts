import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';

@Component({
  selector: 'app-theory-continuous',
  imports: [RouterLink, TranslocoPipe, MathjaxDirective],
  templateUrl: './theory-continuous.component.html',
})
export class TheoryContinuousComponent {
  private readonly transloco = inject(TranslocoService);
  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly tex = {
    forward:   String.raw`\[ \hat{f}(\xi) = \int_{-\infty}^{\infty} f(t)\,e^{-i2\pi\xi t}\,dt \]`,
    inverse:   String.raw`\[ f(t) = \int_{-\infty}^{\infty} \hat{f}(\xi)\,e^{\,i2\pi\xi t}\,d\xi \]`,
    forwardW:  String.raw`\[ F(\omega) = \int_{-\infty}^{\infty} f(t)\,e^{-i\omega t}\,dt \]`,
    inverseW:  String.raw`\[ f(t) = \frac{1}{2\pi}\int_{-\infty}^{\infty} F(\omega)\,e^{\,i\omega t}\,d\omega \]`,
    linearity: String.raw`\[ \mathcal{F}\{af+bg\} = a\,\hat{f} + b\,\hat{g} \]`,
    shift:     String.raw`\[ \mathcal{F}\{f(t-t_0)\}(\xi) = e^{-i2\pi\xi t_0}\,\hat{f}(\xi) \]`,
    scaling:   String.raw`\[ \mathcal{F}\{f(at)\}(\xi) = \frac{1}{|a|}\hat{f}\!\left(\frac{\xi}{a}\right) \]`,
    convolution: String.raw`\[ \mathcal{F}\{f*g\} = \hat{f}\cdot\hat{g} \]`,
    parseval:  String.raw`\[ \int_{-\infty}^{\infty}|f(t)|^2\,dt = \int_{-\infty}^{\infty}|\hat{f}(\xi)|^2\,d\xi \]`,
    gaussian:  String.raw`\[ f(t)=e^{-\pi t^2} \;\xrightarrow{\;\mathcal{F}\;}\; \hat{f}(\xi)=e^{-\pi\xi^2} \]`,
    rect:      String.raw`\[ \mathrm{rect}(t) \;\xrightarrow{\;\mathcal{F}\;}\; \mathrm{sinc}(\xi) = \frac{\sin(\pi\xi)}{\pi\xi} \]`,
  } as const;
}
