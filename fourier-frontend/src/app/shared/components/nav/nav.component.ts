import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { UserStore } from '../../../core/services/auth/user.store';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ApiService } from '../../../core/services/api/api.service';

@Component({
  selector: 'app-nav',
  imports: [RouterLink],
  templateUrl: './nav.component.html',
})
export class NavComponent {
  readonly theme     = inject(ThemeService);
  readonly userStore = inject(UserStore);
  readonly auth      = inject(AuthService);
  private readonly api = inject(ApiService);

  constructor() {
    this.api.getQuota().subscribe({
      next: (quota) => this.userStore.setQuota(quota),
      error: () => {},
    });
  }
}
