import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

import { UserStore } from '../services/auth/user.store';

/** Protege rutas exclusivas del administrador. */
export const adminGuard: CanActivateFn = () => {
  const store  = inject(UserStore);
  const router = inject(Router);

  const resolve = () =>
    store.isAdmin() ? true : router.createUrlTree(['/home']);

  if (store.initialized()) return resolve();

  return toObservable(store.initialized).pipe(
    filter(Boolean),
    take(1),
    map(resolve),
  );
};
