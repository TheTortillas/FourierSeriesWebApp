import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth/auth.service';

/**
 * Interceptor funcional (Angular 17+).
 * 1. Agrega el Bearer token a cada petición si existe.
 * 2. Si recibe 401, intenta un refresh y reintenta la petición original.
 * 3. Si el refresh falla, desloguea al usuario.
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // No interceptar la ruta de refresh para evitar bucles
  if (req.url.includes('/auth/refresh')) {
    return next(req);
  }

  const token = auth.getAccessToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) return throwError(() => error);

      // Intentar refresh
      return auth.refresh().pipe(
        switchMap(() => {
          const newToken = auth.getAccessToken();
          const retryReq = newToken
            ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
            : req;
          return next(retryReq);
        }),
        catchError((refreshError) => {
          auth.logout();
          router.navigate(['/auth/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
