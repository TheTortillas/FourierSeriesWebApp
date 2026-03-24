import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

import { ApiService } from '../../core/services/api/api.service';
import { UserStore } from '../../core/services/auth/user.store';
import { NavComponent } from '../../shared/components/nav/nav.component';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const pw  = control.get('newPassword')?.value;
  const cpw = control.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { mismatch: true } : null;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  imports: [ReactiveFormsModule, NavComponent, RouterLink],
})
export class ProfileComponent {
  readonly store = inject(UserStore);
  private readonly api = inject(ApiService);
  private readonly fb  = inject(FormBuilder);

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword:  ['', [Validators.required]],
      newPassword:      ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword:  ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  readonly pwLoading = signal(false);
  readonly pwSuccess = signal(false);
  readonly pwError   = signal<string | null>(null);

  readonly resendLoading = signal(false);
  readonly resendSent    = signal(false);

  get currentPassword() { return this.passwordForm.controls.currentPassword; }
  get newPassword()     { return this.passwordForm.controls.newPassword; }
  get confirmPassword() { return this.passwordForm.controls.confirmPassword; }

  onChangePassword(): void {
    if (this.passwordForm.invalid || this.pwLoading()) return;

    this.pwError.set(null);
    this.pwSuccess.set(false);
    this.pwLoading.set(true);

    this.api.changePassword(
      this.currentPassword.value,
      this.newPassword.value,
    ).subscribe({
      next: () => {
        this.pwSuccess.set(true);
        this.pwLoading.set(false);
        this.passwordForm.reset();
      },
      error: (err) => {
        this.pwError.set(err?.error?.error ?? 'Error al cambiar contraseña');
        this.pwLoading.set(false);
      },
    });
  }

  onResendVerification(): void {
    const email = this.store.user()?.email;
    if (!email || this.resendLoading()) return;

    this.resendLoading.set(true);
    this.api.resendVerification(email).subscribe({
      next: () => { this.resendSent.set(true); this.resendLoading.set(false); },
      error: () => { this.resendSent.set(true); this.resendLoading.set(false); },
    });
  }
}
