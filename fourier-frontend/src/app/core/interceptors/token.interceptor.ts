import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth/auth.service';

const PROACTIVE_REFRESH_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes before expiry

/** Decode the expiry from a JWT without verifying the signature. */
function jwtExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isExpiringSoon(token: string): boolean {
  const exp = jwtExpiresAt(token);
  return exp !== null && exp - Date.now() < PROACTIVE_REFRESH_THRESHOLD_MS;
}

function addBearer(req: Parameters<HttpInterceptorFn>[0], token: string) {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isPublicAuthEndpoint(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/google') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password') ||
    url.includes('/auth/verify-email') ||
    url.includes('/auth/resend-verification')
  );
}

/**
 * Interceptor funcional (Angular 17+).
 * 1. Agrega el Bearer token a cada petición si existe.
 * 2. Refresh proactivo: si el token expira en menos de 2 minutos, renueva
 *    antes de enviar para que el request llegue al backend con credenciales válidas.
 * 3. Refresh reactivo: si de todas formas llega un 401, renueva y reintenta.
 * 4. Si el refresh falla, cierra la sesión.
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // These endpoints must never trigger a reactive refresh — doing so creates an
  // infinite loop: refresh fails → logout → logout gets 401 → refresh again → …
  if (req.url.includes('/auth/refresh') || req.url.includes('/auth/logout')) {
    return next(req);
  }

  if (isPublicAuthEndpoint(req.url)) {
    return next(req);
  }

  const token = auth.getAccessToken();

  // ── Proactive refresh ────────────────────────────────────────────────────
  if (token && isExpiringSoon(token)) {
    return from(auth.refresh()).pipe(
      switchMap(() => {
        const fresh = auth.getAccessToken();
        return next(fresh ? addBearer(req, fresh) : req);
      }),
      catchError((refreshError) => {
        auth.logout();
        router.navigate(['/auth/login']);
        return throwError(() => refreshError);
      }),
    );
  }

  // ── Normal request ───────────────────────────────────────────────────────
  const authReq = token ? addBearer(req, token) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) return throwError(() => error);

      // ── Reactive refresh (safety net) ──────────────────────────────────
      return auth.refresh().pipe(
        switchMap(() => {
          const newToken = auth.getAccessToken();
          return next(newToken ? addBearer(req, newToken) : req);
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
