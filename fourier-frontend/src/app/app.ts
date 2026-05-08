import { Component, inject, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme/theme.service';
import { AuthService } from './core/services/auth/auth.service';
import { HreflangService } from './core/services/seo/hreflang.service';
import { NavigationScrollService } from './core/services/navigation/navigation-scroll.service';
import { VerifyEmailBannerComponent } from './shared/components/verify-email-banner/verify-email-banner.component';
import { FeedbackModalComponent } from './shared/components/feedback-modal/feedback-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VerifyEmailBannerComponent, FeedbackModalComponent],
  template: `
    <app-verify-email-banner />
    <router-outlet />
    <app-feedback-modal />
  `,
})
export class App {
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly hreflang = inject(HreflangService);
  private readonly navScroll = inject(NavigationScrollService);

  constructor() {
    this.hreflang.setup();
    this.navScroll.setup();

    afterNextRender(() => {
      this.theme.applyToDocument();
      // Intenta recuperar sesión via cookie httpOnly al iniciar la app
      this.auth.initFromStorage();
    });
  }
}
