import { Injectable, Inject, LOCALE_ID } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  baseHref: string;
}

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private readonly supportedLanguages: readonly Language[] = [
    {
      code: 'es',
      name: 'Spanish',
      nativeName: 'Español',
      flag: '🇲🇽',
      baseHref: '/es',
    },
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: '🇺🇸',
      baseHref: '/en',
    },
    {
      code: 'pt',
      name: 'Portuguese',
      nativeName: 'Português',
      flag: '🇵🇹',
      baseHref: '/pt',
    },
  ];

  private readonly currentLanguageSubject = new BehaviorSubject<Language>(
    this.getInitialLanguage()
  );
  public readonly currentLanguage$ = this.currentLanguageSubject.asObservable();

  constructor(
    @Inject(LOCALE_ID) private readonly currentLocale: string,
    private readonly router: Router,
    private readonly location: Location
  ) {}

  private getInitialLanguage(): Language {
    // Detectar idioma actual basado en LOCALE_ID
    return (
      this.supportedLanguages.find(
        (lang) => lang.code === this.currentLocale
      ) ?? this.supportedLanguages[0]
    );
  }

  getCurrentLanguage(): Language {
    return this.currentLanguageSubject.value;
  }

  getSupportedLanguages(): readonly Language[] {
    return this.supportedLanguages;
  }

  switchLanguage(languageCode: string): void {
    const targetLanguage = this.supportedLanguages.find(
      (lang) => lang.code === languageCode
    );
    if (targetLanguage) {
      this.currentLanguageSubject.next(targetLanguage);

      // Obtener la ruta actual sin el prefijo de idioma
      const currentPath = this.getCurrentPathWithoutLanguagePrefix();

      // Construir la nueva URL
      const newUrl = this.buildLanguageUrl(targetLanguage, currentPath);

      console.log(`Switching to ${targetLanguage.nativeName}: ${newUrl}`);

      // Navegar a la nueva URL (esto recargará la página con el nuevo idioma)
      window.location.href = newUrl;
    }
  }

  private getCurrentPathWithoutLanguagePrefix(): string {
    let currentPath = this.location.path();

    // Remover el prefijo de idioma actual si existe
    const currentLang = this.getCurrentLanguage();
    if (currentLang.baseHref && currentPath.startsWith(currentLang.baseHref)) {
      currentPath = currentPath.substring(currentLang.baseHref.length);
    }

    // Asegurar que comience con /
    return currentPath.startsWith('/') ? currentPath : `/${currentPath}`;
  }

  private buildLanguageUrl(language: Language, path: string): string {
    // Para desarrollo local
    const baseUrl = window.location.origin;
    return `${baseUrl}${language.baseHref}${path}`;
  }

  /**
   * Obtiene todos los idiomas alternativos (diferentes al actual)
   */
  getAlternateLanguages(): readonly Language[] {
    const currentCode = this.getCurrentLanguage().code;
    return this.supportedLanguages.filter((lang) => lang.code !== currentCode);
  }

  /**
   * Detecta el idioma del navegador
   */
  detectBrowserLanguage(): string {
    if (typeof navigator === 'undefined') return 'es';

    const browserLang =
      navigator.language?.split('-')[0]?.toLowerCase() || 'es';

    return this.supportedLanguages.some((lang) => lang.code === browserLang)
      ? browserLang
      : 'es';
  }

  /**
   * Obtiene la URL para un idioma específico manteniendo la ruta actual
   */
  getLanguageUrl(languageCode: string): string {
    const targetLanguage = this.supportedLanguages.find(
      (lang) => lang.code === languageCode
    );
    if (!targetLanguage) return window.location.href;

    const currentPath = this.getCurrentPathWithoutLanguagePrefix();
    return this.buildLanguageUrl(targetLanguage, currentPath);
  }
}
