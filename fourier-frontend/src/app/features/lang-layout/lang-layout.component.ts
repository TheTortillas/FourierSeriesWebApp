import { Component, inject } from '@angular/core';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

const SUPPORTED_LANGS = ['es', 'en'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/**
 * Shell transparente para todas las rutas con prefijo de idioma `/:lang/`.
 * Lee el parámetro `:lang` de la URL y establece el idioma activo en Transloco.
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
      if ((SUPPORTED_LANGS as readonly string[]).includes(lang)) {
        transloco.setActiveLang(lang as SupportedLang);
      }
    });
  }
}
