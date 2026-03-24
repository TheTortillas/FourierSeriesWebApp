import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../../../core/services/api/api.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { NavComponent } from '../../../shared/components/nav/nav.component';

type State = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  imports: [RouterLink, NavComponent],
})
export class VerifyEmailComponent implements OnInit {
  private readonly api    = inject(ApiService);
  private readonly auth   = inject(AuthService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly state    = signal<State>('loading');
  readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.router.navigate(['/home']);
      return;
    }

    this.api.verifyEmail(token).subscribe({
      next: () => { this.state.set('success'); this.auth.refreshUser(); },
      error: (err) => {
        this.errorMsg.set(err?.error?.error ?? 'El enlace es inválido o ha expirado');
        this.state.set('error');
      },
    });
  }
}
