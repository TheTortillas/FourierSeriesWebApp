import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

import { UserStore } from '../services/auth/user.store';

function getLang(route: ActivatedRouteSnapshot): string {
  return route.parent?.paramMap.get('lang') ?? 'es';
}

/** Protege rutas exclusivas del administrador. */
export const adminGuard: CanActivateFn = (route) => {
  const store  = inject(UserStore);
  const router = inject(Router);

  const resolve = () => {
    const lang = getLang(route);
    return store.isAdmin() ? true : router.createUrlTree([`/${lang}/home`]);
  };

  if (store.initialized()) return resolve();

  return toObservable(store.initialized).pipe(
    filter(Boolean),
    take(1),
    map(resolve),
  );
};
