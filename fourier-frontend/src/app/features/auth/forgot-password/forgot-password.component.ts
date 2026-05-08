import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../core/services/api/api.service';
import { NavComponent } from '../../../shared/components/nav/nav.component';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  imports: [ReactiveFormsModule, RouterLink, NavComponent, TranslocoPipe],
})
export class ForgotPasswordComponent {
  private readonly api      = inject(ApiService);
  private readonly fb       = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly loading  = signal(false);
  readonly sent     = signal(false);
  readonly apiError = signal<string | null>(null);

  get email() { return this.form.controls.email; }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;

    this.apiError.set(null);
    this.loading.set(true);

    this.api.forgotPassword(this.email.value, this.transloco.getActiveLang()).subscribe({
      next: () => this.sent.set(true),
      error: () => {
        // Always show success to avoid user enumeration
        this.sent.set(true);
      },
    });
  }
}
