import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { UserStore } from '../../../core/services/auth/user.store';
import { ApiService } from '../../../core/services/api/api.service';

@Component({
  selector: 'app-nav',
  imports: [RouterLink],
  templateUrl: './nav.component.html',
})
export class NavComponent {
  readonly theme     = inject(ThemeService);
  readonly userStore = inject(UserStore);
  private readonly api = inject(ApiService);

  constructor() {
    this.api.getQuota().subscribe({
      next: (quota) => this.userStore.setQuota(quota),
      error: () => {},
    });
  }
}
