import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStore } from '../services/auth/user.store';

/** Protege rutas exclusivas del administrador. */
export const adminGuard: CanActivateFn = () => {
  const store  = inject(UserStore);
  const router = inject(Router);

  if (store.isAdmin()) return true;

  return router.createUrlTree(['/home']);
};
