import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { NavComponent } from '../../shared/components/nav/nav.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { MathjaxDirective } from '../../shared/directives/mathjax.directive';
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-about',
  imports: [RouterLink, NavComponent, FooterComponent, TranslocoPipe, MathjaxDirective],
  templateUrl: './about.component.html',
})
export class AboutComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly transloco = inject(TranslocoService);

  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly specialFns = [
    { key: 'u',     lt: true  },
    { key: 'sgn',   lt: false },
    { key: 'delta', lt: true  },
    { key: 'rect',  lt: false },
    { key: 'tri',   lt: false },
    { key: 'sinc',  lt: false },
  ];

  readonly seriesItems        = ['f1','f2','f3','f4','f5','f6','f7','f8','f9','f10','f11'].map(k => `about.series.${k}`);
  readonly transformItems     = ['f1','f3','f4','f5','f7','f8','f9','f6'].map(k => `about.transforms.${k}`);
  readonly integralItems      = ['f1','f2','f3','f4','f5','f6'].map(k => `about.integral.${k}`);
  readonly dftItems           = ['f1','f2','f3','f4','f5','f6','f7','f8','f9'].map(k => `about.dft.${k}`);
  readonly laplaceDirectItems  = ['f1','f2','f3','f4'].map(k => `about.laplace.direct.${k}`);
  readonly laplaceInverseItems = ['f1','f2','f3','f4'].map(k => `about.laplace.inverse.${k}`);
  readonly laplaceOdeItems     = ['f1','f2','f3','f4'].map(k => `about.laplace.ode.${k}`);
  readonly laplaceComplexItems = ['f1','f2','f3','f4'].map(k => `about.laplace.complex.${k}`);
  readonly odeGeneralItems    = ['f1','f2','f3','f4'].map(k => `about.ode.general.${k}`);
  readonly odeIvpItems        = ['f1','f2','f3','f4'].map(k => `about.ode.ivp.${k}`);
  readonly odeBvpItems        = ['f1','f2','f3','f4'].map(k => `about.ode.bvp.${k}`);
  readonly grapherFeatures         = ['f1','f2','f3','f4','f5'].map(k => `about.grapher.features.${k}`);
  readonly complexGrapherFeatures  = ['f1','f2','f3','f4','f5'].map(k => `about.complexGrapher.features.${k}`);
  readonly inputItems         = ['f1','f2','f3','f4'].map(k => `about.input.${k}`);
  readonly accountItems       = ['f1','f2','f3','f4'].map(k => `about.account.${k}`);
  readonly uxItems            = ['f1','f2','f3','f4'].map(k => `about.ux.${k}`);

  readonly grapherIntegrals = [
    { key: 'Si' }, { key: 'Ci' }, { key: 'Shi' }, { key: 'Chi' },
    { key: 'Ei' }, { key: 'E1' }, { key: 'li' },
  ];
  readonly grapherError = [
    { key: 'erf' }, { key: 'erfc' }, { key: 'gamma' },
  ];
  readonly grapherGammaInc = [
    { key: 'GammaU' }, { key: 'GammaL' }, { key: 'GammaQ' }, { key: 'Beta' },
  ];

  ngOnInit(): void {
    const lang = this.transloco.getActiveLang();
    const keywords = lang === 'es'
      ? 'Fourier, series, transformada, identidad de Parseval, Parseval, DFT, análisis, cálculo simbólico, Maxima'
      : 'Fourier, series, transform, Parseval identity, Parseval, DFT, analysis, symbolic computation, Maxima';
    this.seo.setPage('seo.about.title', 'seo.about.description', keywords);
  }
}
