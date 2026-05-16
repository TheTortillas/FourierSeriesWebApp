import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { NavComponent } from '../../../shared/components/nav/nav.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';

@Component({
  selector: 'app-terms',
  imports: [RouterLink, NavComponent, FooterComponent],
  templateUrl: './terms.component.html',
})
export class TermsComponent implements OnInit {
  private readonly transloco = inject(TranslocoService);

  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly updated = '15 de mayo de 2026';
  readonly updatedEn = 'May 15, 2026';

  ngOnInit(): void {
    document.title = 'Términos de Uso · fouriersolver.com';
  }
}
