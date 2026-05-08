import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStore } from '../services/auth/user.store';

/** Redirige a /home si el usuario ya está autenticado (ej: login, register). */
export const guestGuard: CanActivateFn = () => {
  const store  = inject(UserStore);
  const router = inject(Router);

  if (!store.isAuthenticated()) return true;

  return router.createUrlTree(['/home']);
};
