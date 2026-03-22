import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStore } from '../services/auth/user.store';

/** Protege rutas que requieren autenticación. */
export const authGuard: CanActivateFn = () => {
  const store  = inject(UserStore);
  const router = inject(Router);

  if (store.isAuthenticated()) return true;

  return router.createUrlTree(['/auth/login']);
};
