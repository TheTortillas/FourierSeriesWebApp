import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <footer class="shrink-0 border-t border-border dark:border-dark-border px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p class="text-[10px] font-mono text-muted dark:text-dark-muted">
        Fourier Web Calculator · {{ 'nav.footerText' | transloco }}
      </p>
      <nav class="flex items-center gap-4">
        <a [routerLink]="'/' + lang() + '/about'"
          class="text-[10px] font-mono text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink hover:underline underline-offset-2 transition-colors">
          {{ 'nav.about' | transloco }}
        </a>
        <a [routerLink]="'/' + lang() + '/legal/privacy'"
          class="text-[10px] font-mono text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink hover:underline underline-offset-2 transition-colors">
          {{ 'nav.privacy' | transloco }}
        </a>
        <a [routerLink]="'/' + lang() + '/legal/terms'"
          class="text-[10px] font-mono text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink hover:underline underline-offset-2 transition-colors">
          {{ 'nav.terms' | transloco }}
        </a>
      </nav>
    </footer>
  `,
})
export class FooterComponent {
  private readonly transloco = inject(TranslocoService);
  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
}
