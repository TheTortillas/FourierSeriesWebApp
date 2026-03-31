import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { ApiService } from '../api/api.service';
import { UserStore } from './user.store';
import {
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  GoogleLoginRequest,
} from '../../../domain';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api      = inject(ApiService);
  private readonly store    = inject(UserStore);
  private readonly router   = inject(Router);
  private readonly transloco = inject(TranslocoService);

  /** Access token lives only in memory — lost on page refresh, recovered via cookie. */
  private readonly _accessToken = signal<string | null>(null);

  // ─── Token management ────────────────────────────────────────────────────

  getAccessToken(): string | null {
    return this._accessToken();
  }

  private saveTokens(response: AuthResponse): void {
    this._accessToken.set(response.accessToken);
    this.store.setUser(response.user);
    this.store.refreshQuota();
  }

  private clearTokens(): void {
    this._accessToken.set(null);
    this.store.clearUser();
    this.store.refreshQuota(); // Obtiene cuota anónima tras cerrar sesión
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

  /** Refresh via httpOnly cookie — no token in body needed. */
  refresh(): Observable<AuthResponse> {
    return this.api.refreshToken().pipe(tap((res) => this.saveTokens(res)));
  }

  logout(): void {
    // Fire-and-forget: el servidor revoca la familia de tokens via cookie.
    this.api.logout().subscribe({ error: () => {} });
    this.clearTokens();
    const lang = this.transloco.getActiveLang();
    this.router.navigate([`/${lang}/home`]);
  }

  /** Recarga los datos del usuario desde la DB y actualiza el store. */
  refreshUser(): void {
    if (!this.store.isAuthenticated()) return;
    this.api.getMe().subscribe({
      next: (res) => this.store.setUser(res.user),
      error: () => {},
    });
  }

  /**
   * Intenta un silent refresh al iniciar la app.
   * Si hay una cookie httpOnly válida, recupera el access token en memoria.
   * Si no hay sesión activa, simplemente deja al usuario anónimo.
   */
  initFromStorage(): void {
    this.store.setLoading(true);
    this.refresh().subscribe({
      next: () => {
        this.store.setLoading(false);
        this.store.setInitialized();
        // refreshQuota ya fue llamado por saveTokens vía refresh()
      },
      error: () => {
        this.clearTokens();          // llama refreshQuota → cuota anónima
        this.store.setLoading(false);
        this.store.setInitialized();
      },
    });
  }
}
