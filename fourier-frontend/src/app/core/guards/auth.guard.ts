import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

import { UserStore } from '../services/auth/user.store';

/** Lee el parámetro `:lang` del segmento padre para construir redirects correctos. */
function getLang(route: ActivatedRouteSnapshot): string {
  return route.parent?.paramMap.get('lang') ?? 'es';
}

/** Protege rutas que requieren autenticación. */
export const authGuard: CanActivateFn = (route) => {
  const store  = inject(UserStore);
  const router = inject(Router);

  const resolve = () => {
    const lang = getLang(route);
    return store.isAuthenticated()
      ? true
      : router.createUrlTree([`/${lang}/auth/login`]);
  };

  if (store.initialized()) return resolve();

  return toObservable(store.initialized).pipe(
    filter(Boolean),
    take(1),
    map(resolve),
  );
};
