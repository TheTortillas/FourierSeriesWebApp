import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { NavComponent } from '../../shared/components/nav/nav.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-about',
  imports: [RouterLink, NavComponent, FooterComponent, TranslocoPipe],
  templateUrl: './about.component.html',
})
export class AboutComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly transloco = inject(TranslocoService);

  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly seriesItems = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10'].map(
    (k) => `about.series.${k}`,
  );
  readonly transformItems = ['f1', 'f3', 'f4', 'f5', 'f7', 'f8', 'f9', 'f6'].map((k) => `about.transforms.${k}`);
  readonly dftItems = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9'].map((k) => `about.dft.${k}`);
  readonly inputItems = ['f1', 'f2', 'f3', 'f4'].map((k) => `about.input.${k}`);
  readonly accountItems = ['f1', 'f2', 'f3', 'f4'].map((k) => `about.account.${k}`);
  readonly uxItems = ['f1', 'f2', 'f3', 'f4'].map((k) => `about.ux.${k}`);

  ngOnInit(): void {
    this.seo.setPage('seo.about.title', 'seo.about.description');
  }
}
