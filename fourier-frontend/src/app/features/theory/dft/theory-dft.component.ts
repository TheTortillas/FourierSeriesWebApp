import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';

@Component({
  selector: 'app-theory-dft',
  imports: [RouterLink, TranslocoPipe, MathjaxDirective],
  templateUrl: './theory-dft.component.html',
})
export class TheoryDftComponent {
  private readonly transloco = inject(TranslocoService);
  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly tex = {
    dft:         String.raw`\[ X[k] = \sum_{n=0}^{N-1} x[n]\,e^{-i\,\frac{2\pi}{N}\,kn},\quad k=0,1,\ldots,N-1 \]`,
    idft:        String.raw`\[ x[n] = \frac{1}{N}\sum_{k=0}^{N-1} X[k]\,e^{\,i\,\frac{2\pi}{N}\,kn} \]`,
    fftComplexity: String.raw`\[ \underbrace{N^2}_{\text{DFT}} \;\gg\; \underbrace{N\log_2 N}_{\text{FFT}} \]`,
    nyquist:     String.raw`\[ f_s > 2\,f_{\max} \]`,
    freqResol:   String.raw`\[ \Delta f = \frac{f_s}{N} \]`,
    fftShift:    String.raw`\[ k \mapsto \begin{cases} k & k \le N/2 \\ k - N & k > N/2 \end{cases} \]`,
    amplitude:   String.raw`\[ |C_k| = \frac{|X[k]|}{N} \]`,
    parseval:    String.raw`\[ \sum_{n=0}^{N-1}|x[n]|^2 = \frac{1}{N}\sum_{k=0}^{N-1}|X[k]|^2 \]`,
    epicycles:   String.raw`\[ \vec{z}(t) = \sum_{k} |C_k|\,e^{\,i\,(k\,\omega_0\,t + \phi_k)} \]`,
  } as const;
}
