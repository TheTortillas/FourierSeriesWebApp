import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';

import { AnalyticsService } from '../../../core/services/analytics/analytics.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { NavComponent } from '../../../shared/components/nav/nav.component';
import { GoogleSignInComponent } from '../../../shared/components/google-sign-in/google-sign-in.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [ReactiveFormsModule, RouterLink, NavComponent, GoogleSignInComponent, TranslocoPipe],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.setNoIndex();
  }

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly loading = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly showPass = signal(false);

  get email() {
    return this.form.controls.email;
  }
  get password() {
    return this.form.controls.password;
  }

  onGoogleCredential(idToken: string): void {
    this.apiError.set(null);
    this.loading.set(true);
    this.auth.loginWithGoogle({ idToken }).subscribe({
      next: () => this.router.navigate(['/' + this.transloco.getActiveLang() + '/home']),
      error: (err) => {
        this.apiError.set(err?.error?.error ?? 'Error al iniciar sesión con Google');
        this.loading.set(false);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;

    this.apiError.set(null);
    this.loading.set(true);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.analytics.trackEvent('login', { method: 'email' });
        this.router.navigate(['/' + this.transloco.getActiveLang() + '/home']);
      },
      error: (err) => {
        this.apiError.set(err?.error?.error ?? 'Error al iniciar sesión');
        this.loading.set(false);
      },
    });
  }
}
