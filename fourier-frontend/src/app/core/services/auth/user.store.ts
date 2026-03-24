import { computed, Injectable, signal } from '@angular/core';
import { User, QuotaResponse } from '../../../domain';

/**
 * Estado global reactivo del usuario autenticado.
 * Usa Angular Signals — sin NgRx, sin BehaviorSubject.
 */
@Injectable({ providedIn: 'root' })
export class UserStore {
  private readonly _user = signal<User | null>(null);
  private readonly _loading = signal(false);
  private readonly _quota = signal<QuotaResponse | null>(null);

  // Señales públicas de solo lectura
  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly quota = this._quota.asReadonly();

  // Señales derivadas
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');
  readonly isPremium = computed(() => this._user()?.tier === 'premium');
  readonly isEmailVerified = computed(() => this._user()?.emailVerified ?? false);
  readonly displayName = computed(() => {
    const u = this._user();
    return u ? `${u.firstName} ${u.lastName}` : null;
  });

  setUser(user: User): void {
    this._user.set(user);
  }

  clearUser(): void {
    this._user.set(null);
  }

  setLoading(value: boolean): void {
    this._loading.set(value);
  }

  setQuota(quota: QuotaResponse): void {
    this._quota.set(quota);
  }
}
