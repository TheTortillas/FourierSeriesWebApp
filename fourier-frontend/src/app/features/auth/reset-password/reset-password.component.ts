import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../core/services/api/api.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { NavComponent } from '../../../shared/components/nav/nav.component';

function passwordsMatch(ctrl: AbstractControl): ValidationErrors | null {
  const pw  = ctrl.get('password')?.value;
  const cpw = ctrl.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  imports: [ReactiveFormsModule, RouterLink, NavComponent, TranslocoPipe],
})
export class ResetPasswordComponent implements OnInit {
  private readonly api    = inject(ApiService);
  private readonly fb     = inject(FormBuilder);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo    = inject(SeoService);

  private token = '';

  readonly form = this.fb.nonNullable.group(
    {
      password:        ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  readonly loading  = signal(false);
  readonly success  = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly showPass = signal(false);

  get password()        { return this.form.controls.password; }
  get confirmPassword() { return this.form.controls.confirmPassword; }
  get mismatch()        { return this.form.hasError('passwordsMismatch') && this.confirmPassword.touched; }

  ngOnInit(): void {
    this.seo.setNoIndex();
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.router.navigate(['/auth/forgot-password']);
      return;
    }
    this.token = token;
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;

    this.apiError.set(null);
    this.loading.set(true);

    this.api.resetPassword(this.token, this.password.value).subscribe({
      next: () => this.success.set(true),
      error: (err) => {
        this.apiError.set(err?.error?.error ?? 'El enlace es inválido o ha expirado');
        this.loading.set(false);
      },
    });
  }
}
