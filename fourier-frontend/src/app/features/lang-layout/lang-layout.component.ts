import { Component, inject } from '@angular/core';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { SUPPORTED_LANG_CODES, saveLang } from '../../core/config/languages';

/**
 * Transparent shell for all routes with the `/:lang/` prefix.
 * Reads the `:lang` URL param, sets it as the active Transloco language,
 * and persists the choice to localStorage for future visits.
 */
@Component({
  selector: 'app-lang-layout',
  template: '<router-outlet />',
  imports: [RouterOutlet],
})
export class LangLayoutComponent {
  constructor() {
    const route = inject(ActivatedRoute);
    const transloco = inject(TranslocoService);

    route.params.pipe(takeUntilDestroyed()).subscribe((params) => {
      const lang = params['lang'] as string;
      if (SUPPORTED_LANG_CODES.includes(lang)) {
        transloco.setActiveLang(lang);
        saveLang(lang);
      }
    });
  }
}
