import { inject, Injectable, signal } from '@angular/core';
import { PlatformService } from '../platform/platform.service';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'fourier-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platform = inject(PlatformService);

  readonly theme = signal<Theme>(this.resolveInitialTheme());

  private resolveInitialTheme(): Theme {
    const stored = this.platform.getLocalStorageItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    // Predeterminado: light. El tema se cambia SOLO con el botón de la UI.
    return 'light';
  }

  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    this.platform.setLocalStorageItem(STORAGE_KEY, theme);
    this.applyToDocument(theme);
  }

  /** Aplica la clase 'dark' al elemento <html>. Debe llamarse tras el bootstrap. */
  applyToDocument(theme: Theme = this.theme()): void {
    const html = this.platform.document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }

  get isDark(): boolean {
    return this.theme() === 'dark';
  }
}
