import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private darkModeKey = 'darkMode';
  private darkModeSubject = new BehaviorSubject<boolean>(false); // Valor por defecto
  public darkMode$ = this.darkModeSubject.asObservable();
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Inicializamos el tema solo si estamos en el navegador
    if (this.isBrowser) {
      // Establecer el valor inicial
      this.darkModeSubject.next(this.getInitialMode());

      // Aplicar el tema inicial
      this.applyTheme(this.darkModeSubject.value);

      // Escuchar cambios del sistema operativo
      if (window.matchMedia) {
        window
          .matchMedia('(prefers-color-scheme: dark)')
          .addEventListener('change', (e) => {
            if (!this.getLocalStorageItem(this.darkModeKey)) {
              const isDark = e.matches;
              this.darkModeSubject.next(isDark);
              this.applyTheme(isDark);
            }
          });
      }
    }
  }

  private getInitialMode(): boolean {
    if (!this.isBrowser) return false; // Predeterminado para SSR

    // Verificar si hay una preferencia guardada
    const savedPreference = this.getLocalStorageItem(this.darkModeKey);
    if (savedPreference !== null) {
      // console.log('Preferencia guardada:', savedPreference);
      return savedPreference === 'true';
    }

    // Si no hay preferencia guardada, usar la del sistema
    if (window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    }

    // Predeterminado: modo oscuro
    return false;
  }

  toggleTheme(): void {
    if (!this.isBrowser) return;

    const newValue = !this.darkModeSubject.value;
    this.darkModeSubject.next(newValue);
    this.setLocalStorageItem(this.darkModeKey, String(newValue));
    this.applyTheme(newValue);
  }

  private applyTheme(isDark: boolean): void {
    if (!this.isBrowser) return;

    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }

  get isDarkMode(): boolean {
    return this.darkModeSubject.value;
  }

  // Métodos seguros para localStorage
  private getLocalStorageItem(key: string): string | null {
    if (this.isBrowser) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn('Error accessing localStorage:', e);
        return null;
      }
    }
    return null;
  }

  private setLocalStorageItem(key: string, value: string): void {
    if (this.isBrowser) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn('Error writing to localStorage:', e);
      }
    }
  }
}
