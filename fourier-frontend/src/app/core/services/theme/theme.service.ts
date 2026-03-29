import { inject, Injectable, signal } from '@angular/core';
import { PlatformService } from '../platform/platform.service';

type Theme = 'light' | 'dark';
type Palette = 'coffee' | 'neutral';

const THEME_STORAGE_KEY = 'fourier-theme';
const PALETTE_STORAGE_KEY = 'fourier-palette';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platform = inject(PlatformService);

  readonly theme = signal<Theme>(this.resolveInitialTheme());
  readonly palette = signal<Palette>(this.resolveInitialPalette());

  private resolveInitialTheme(): Theme {
    const stored = this.platform.getLocalStorageItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    // Predeterminado: light. El tema se cambia SOLO con el botón de la UI.
    return 'light';
  }

  private resolveInitialPalette(): Palette {
    const stored = this.platform.getLocalStorageItem(PALETTE_STORAGE_KEY);
    if (stored === 'neutral' || stored === 'coffee') return stored;
    // Predeterminado: coffee para mantener la identidad visual actual.
    return 'coffee';
  }

  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  togglePalette(): void {
    this.setPalette(this.palette() === 'neutral' ? 'coffee' : 'neutral');
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    this.platform.setLocalStorageItem(THEME_STORAGE_KEY, theme);
    this.applyToDocument(theme, this.palette());
  }

  setPalette(palette: Palette): void {
    this.palette.set(palette);
    this.platform.setLocalStorageItem(PALETTE_STORAGE_KEY, palette);
    this.applyToDocument(this.theme(), palette);
  }

  /** Aplica la clase 'dark' al elemento <html>. Debe llamarse tras el bootstrap. */
  applyToDocument(theme: Theme = this.theme(), palette: Palette = this.palette()): void {
    const html = this.platform.document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }

    html.setAttribute('data-palette', palette);
  }

  get isDark(): boolean {
    return this.theme() === 'dark';
  }

  get isNeutral(): boolean {
    return this.palette() === 'neutral';
  }
}
