import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SUPPORTED_LANG_CODES, DEFAULT_LANG } from '../config/languages';

/**
 * Validates that the `:lang` segment is a supported language.
 * If not (e.g. someone navigates to `/calculator` directly),
 * redirects to `/<default>/home` as fallback.
 */
export const langGuard: CanActivateFn = (route) => {
  const lang = route.paramMap.get('lang') ?? '';
  if (SUPPORTED_LANG_CODES.includes(lang)) return true;
  return inject(Router).createUrlTree([`/${DEFAULT_LANG}/home`]);
};
