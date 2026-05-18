import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../core/services/api/api.service';
import { UserStore } from '../../core/services/auth/user.store';
import { AuthService } from '../../core/services/auth/auth.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { NavComponent } from '../../shared/components/nav/nav.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const pw  = control.get('newPassword')?.value;
  const cpw = control.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { mismatch: true } : null;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  imports: [ReactiveFormsModule, NavComponent, FooterComponent, RouterLink, TranslocoPipe],
})
export class ProfileComponent {
  readonly store    = inject(UserStore);
  private readonly api      = inject(ApiService);
  private readonly auth     = inject(AuthService);
  private readonly seo      = inject(SeoService);
  private readonly fb       = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);

  constructor() {
    this.auth.refreshUser();
    this.seo.setNoIndex();
  }

  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  // ── Quota bar ──────────────────────────────────────────────────────────────
  readonly quotaPct = computed(() => {
    const q = this.store.quota();
    if (!q || q.remaining === null) return null;
    return Math.min(100, Math.round((q.used / q.limit) * 100));
  });

  // ── Edit name ──────────────────────────────────────────────────────────────
  readonly editingName  = signal(false);
  readonly nameLoading  = signal(false);
  readonly nameError    = signal<string | null>(null);

  readonly nameForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName:  ['', [Validators.required, Validators.maxLength(100)]],
  });

  startEditName(): void {
    const user = this.store.user();
    if (!user) return;
    this.nameForm.setValue({ firstName: user.firstName, lastName: user.lastName });
    this.nameError.set(null);
    this.editingName.set(true);
  }

  cancelEditName(): void {
    this.editingName.set(false);
    this.nameError.set(null);
  }

  onSaveName(): void {
    if (this.nameForm.invalid || this.nameLoading()) return;
    this.nameError.set(null);
    this.nameLoading.set(true);

    const { firstName, lastName } = this.nameForm.getRawValue();
    this.api.updateProfile(firstName, lastName).subscribe({
      next: ({ user }) => {
        this.store.setUser(user);
        this.nameLoading.set(false);
        this.editingName.set(false);
      },
      error: (err) => {
        this.nameError.set(err?.error?.error ?? 'Error al guardar');
        this.nameLoading.set(false);
      },
    });
  }

  // ── Change password ────────────────────────────────────────────────────────
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

  get currentPassword() { return this.passwordForm.controls.currentPassword; }
  get newPassword()     { return this.passwordForm.controls.newPassword; }
  get confirmPassword() { return this.passwordForm.controls.confirmPassword; }

  onChangePassword(): void {
    if (this.passwordForm.invalid || this.pwLoading()) return;
    this.pwError.set(null);
    this.pwSuccess.set(false);
    this.pwLoading.set(true);

    this.api.changePassword(this.currentPassword.value, this.newPassword.value).subscribe({
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

  // ── Resend verification ────────────────────────────────────────────────────
  readonly resendLoading = signal(false);
  readonly resendSent    = signal(false);

  onResendVerification(): void {
    const email = this.store.user()?.email;
    if (!email || this.resendLoading()) return;
    this.resendLoading.set(true);
    this.api.resendVerification(email, this.transloco.getActiveLang()).subscribe({
      next:  () => { this.resendSent.set(true); this.resendLoading.set(false); },
      error: () => { this.resendSent.set(true); this.resendLoading.set(false); },
    });
  }

  // ── Delete account ─────────────────────────────────────────────────────────
  readonly deleteConfirm   = signal(false);
  readonly deleteLoading   = signal(false);
  readonly deleteError     = signal<string | null>(null);

  openDeleteConfirm(): void {
    this.deleteConfirm.set(true);
    this.deleteError.set(null);
  }

  cancelDelete(): void {
    this.deleteConfirm.set(false);
  }

  onDeleteAccount(): void {
    if (this.deleteLoading()) return;
    this.deleteLoading.set(true);
    this.deleteError.set(null);

    this.api.deleteAccount().subscribe({
      next: () => {
        this.store.clearUser();
        window.location.href = `/${this.lang()}/home`;
      },
      error: (err) => {
        this.deleteError.set(err?.error?.error ?? 'Error al eliminar la cuenta');
        this.deleteLoading.set(false);
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(
      this.lang() === 'es' ? 'es-MX' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' },
    );
  }
}
