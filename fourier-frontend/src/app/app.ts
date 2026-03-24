import { Component, inject, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme/theme.service';
import { AuthService } from './core/services/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  private readonly theme = inject(ThemeService);
  private readonly auth  = inject(AuthService);

  constructor() {
    afterNextRender(() => {
      this.theme.applyToDocument();
      // Intenta recuperar sesión via cookie httpOnly al iniciar la app
      this.auth.initFromStorage();
    });
  }
}
