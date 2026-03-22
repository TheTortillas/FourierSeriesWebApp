import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { ApiService } from '../api/api.service';
import { PlatformService } from '../platform/platform.service';
import { UserStore } from './user.store';
import {
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  GoogleLoginRequest,
} from '../../../domain';

const ACCESS_TOKEN_KEY  = 'fourier-access-token';
const REFRESH_TOKEN_KEY = 'fourier-refresh-token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api      = inject(ApiService);
  private readonly platform = inject(PlatformService);
  private readonly store    = inject(UserStore);
  private readonly router   = inject(Router);

  // ─── Token management ────────────────────────────────────────────────────

  getAccessToken(): string | null {
    return this.platform.getLocalStorageItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return this.platform.getLocalStorageItem(REFRESH_TOKEN_KEY);
  }

  private saveTokens(response: AuthResponse): void {
    this.platform.setLocalStorageItem(ACCESS_TOKEN_KEY, response.accessToken);
    this.platform.setLocalStorageItem(REFRESH_TOKEN_KEY, response.refreshToken);
    this.store.setUser(response.user);
  }

  private clearTokens(): void {
    this.platform.removeLocalStorageItem(ACCESS_TOKEN_KEY);
    this.platform.removeLocalStorageItem(REFRESH_TOKEN_KEY);
    this.store.clearUser();
  }

  // ─── Auth operations ─────────────────────────────────────────────────────

  register(body: RegisterRequest): Observable<AuthResponse> {
    return this.api.register(body).pipe(tap((res) => this.saveTokens(res)));
  }

  login(body: LoginRequest): Observable<AuthResponse> {
    return this.api.login(body).pipe(tap((res) => this.saveTokens(res)));
  }

  loginWithGoogle(body: GoogleLoginRequest): Observable<AuthResponse> {
    return this.api.loginWithGoogle(body).pipe(tap((res) => this.saveTokens(res)));
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken() ?? '';
    return this.api.refreshToken({ refreshToken }).pipe(tap((res) => this.saveTokens(res)));
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // Fire-and-forget: el servidor invalida el refresh token
      this.api.logout(refreshToken).subscribe({ error: () => {} });
    }
    this.clearTokens();
    this.router.navigate(['/home']);
  }

  /** Inicializa el estado del usuario desde el token almacenado.
   *  Debe llamarse al inicio de la app si hay un token. */
  initFromStorage(): void {
    const token = this.getAccessToken();
    if (!token) return;

    this.store.setLoading(true);
    this.api.getMe().subscribe({
      next: ({ user }) => {
        this.store.setUser(user);
        this.store.setLoading(false);
      },
      error: () => {
        // Token expirado o inválido — intentar refresh
        this.refresh().subscribe({
          next: () => this.store.setLoading(false),
          error: () => {
            this.clearTokens();
            this.store.setLoading(false);
          },
        });
      },
    });
  }
}
