import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const SUPPORTED_LANGS = ['es', 'en'] as const;

/**
 * Valida que el segmento `:lang` sea un idioma soportado.
 * Si no lo es (e.g. alguien navega a `/calculator` directamente),
 * redirige a `/es/home` como fallback.
 */
export const langGuard: CanActivateFn = (route) => {
  const lang = route.paramMap.get('lang') ?? '';
  if ((SUPPORTED_LANGS as readonly string[]).includes(lang)) {
    return true;
  }
  return inject(Router).createUrlTree(['/es/home']);
};
