import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserStore } from '../../../core/services/auth/user.store';
import { ApiService } from '../../../core/services/api/api.service';

@Component({
  selector: 'app-verify-email-banner',
  templateUrl: './verify-email-banner.component.html',
  imports: [TranslocoPipe],
})
export class VerifyEmailBannerComponent {
  readonly store = inject(UserStore);
  private readonly api = inject(ApiService);

  readonly sending = signal(false);
  readonly sent    = signal(false);

  resend(): void {
    const email = this.store.user()?.email;
    if (!email || this.sending() || this.sent()) return;

    this.sending.set(true);
    this.api.resendVerification(email).subscribe({
      next: () => { this.sent.set(true); this.sending.set(false); },
      error: () => { this.sending.set(false); },
    });
  }
}
