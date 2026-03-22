import { Component, inject, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  private readonly theme = inject(ThemeService);

  constructor() {
    // afterNextRender es SSR-safe: solo se ejecuta en el browser tras el primer render
    afterNextRender(() => {
      this.theme.applyToDocument();
    });
  }
}
