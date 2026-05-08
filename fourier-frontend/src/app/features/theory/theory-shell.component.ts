import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { NavComponent } from '../../shared/components/nav/nav.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-theory-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NavComponent, FooterComponent, TranslocoPipe],
  templateUrl: './theory-shell.component.html',
})
export class TheoryShellComponent {
  private readonly transloco = inject(TranslocoService);
  private readonly seo = inject(SeoService);

  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  constructor() {
    this.seo.setPage('seo.theory.title', 'seo.theory.description');
  }

  readonly sections = [
    { key: 'series',     labelKey: 'theory.nav.series' },
    { key: 'continuous', labelKey: 'theory.nav.continuous' },
    { key: 'dft',        labelKey: 'theory.nav.dft' },
  ] as const;
}
