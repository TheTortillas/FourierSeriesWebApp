import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api/api.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserStore } from '../../../core/services/auth/user.store';

@Component({
  selector: 'app-api-auth-panel',
  imports: [FormsModule],
  templateUrl: './api-auth-panel.component.html',
})
export class ApiAuthPanelComponent {
  private readonly api  = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly store        = inject(UserStore);

  // Register
  regFirstName = '';
  regLastName  = '';
  regEmail     = '';
  regPassword  = '';

  // Login
  loginEmail    = '';
  loginPassword = '';

  response = signal<unknown>(null);
  error    = signal<string | null>(null);
  loading  = signal(false);

  private call<T>(obs: () => import('rxjs').Observable<T>): void {
    this.loading.set(true);
    this.response.set(null);
    this.error.set(null);
    obs().subscribe({
      next: (res) => { this.response.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(err?.error?.error ?? err.message); this.loading.set(false); },
    });
  }

  doRegister(): void {
    this.call(() => this.api.register({
      firstName: this.regFirstName,
      lastName: this.regLastName,
      email: this.regEmail,
      password: this.regPassword,
    }));
  }

  doLogin(): void {
    this.call(() => this.auth.login({ email: this.loginEmail, password: this.loginPassword }));
  }

  doGetMe(): void {
    this.call(() => this.api.getMe());
  }

  doLogout(): void {
    this.auth.logout();
    this.response.set({ message: 'Sesión cerrada' });
  }

  doRefresh(): void {
    this.call(() => this.auth.refresh());
  }

  json(val: unknown): string {
    return JSON.stringify(val, null, 2);
  }
}
