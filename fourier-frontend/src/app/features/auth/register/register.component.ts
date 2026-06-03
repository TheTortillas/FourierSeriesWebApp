import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';

import { Router } from '@angular/router';
import { AnalyticsService } from '../../../core/services/analytics/analytics.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { NavComponent } from '../../../shared/components/nav/nav.component';
import { GoogleSignInComponent } from '../../../shared/components/google-sign-in/google-sign-in.component';

function passwordsMatch(ctrl: AbstractControl): ValidationErrors | null {
  const pw = ctrl.get('password')?.value;
  const cpw = ctrl.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  imports: [ReactiveFormsModule, RouterLink, NavComponent, GoogleSignInComponent, TranslocoPipe],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly seo = inject(SeoService);

  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  constructor() {
    this.seo.setNoIndex();
  }

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  readonly loading = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly success = signal(false);
  readonly showPass = signal(false);

  get firstName() {
    return this.form.controls.firstName;
  }
  get lastName() {
    return this.form.controls.lastName;
  }
  get email() {
    return this.form.controls.email;
  }
  get password() {
    return this.form.controls.password;
  }
  get confirmPassword() {
    return this.form.controls.confirmPassword;
  }
  get mismatch() {
    return this.form.hasError('passwordsMismatch') && this.confirmPassword.touched;
  }

  onGoogleCredential(idToken: string): void {
    this.apiError.set(null);
    this.loading.set(true);
    this.auth.loginWithGoogle({ idToken }).subscribe({
      next: () => this.router.navigate(['/' + this.transloco.getActiveLang() + '/home']),
      error: (err) => {
        this.apiError.set(this.mapError(err?.error?.error));
        this.loading.set(false);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;

    this.apiError.set(null);
    this.loading.set(true);

    const { confirmPassword: _, ...body } = this.form.getRawValue();

    this.auth.register({ ...body, lang: this.transloco.getActiveLang() }).subscribe({
      next: () => {
        this.analytics.trackEvent('sign_up', { method: 'email' });
        this.success.set(true);
      },
      error: (err) => {
        this.apiError.set(this.mapError(err?.error?.error));
        this.loading.set(false);
      },
    });
  }

  private mapError(code: string | undefined): string {
    if (code === 'EMAIL_RECENTLY_DELETED') {
      return this.transloco.translate('errors.emailRecentlyDeleted');
    }
    return code ?? this.transloco.translate('errors.generic');
  }
}
