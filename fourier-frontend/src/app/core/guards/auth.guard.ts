import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

import { UserStore } from '../services/auth/user.store';

/** Protege rutas que requieren autenticación. */
export const authGuard: CanActivateFn = () => {
  const store  = inject(UserStore);
  const router = inject(Router);

  const resolve = () =>
    store.isAuthenticated() ? true : router.createUrlTree(['/auth/login']);

  if (store.initialized()) return resolve();

  return toObservable(store.initialized).pipe(
    filter(Boolean),
    take(1),
    map(resolve),
  );
};
