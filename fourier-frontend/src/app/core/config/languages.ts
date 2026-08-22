export interface LangOption {
  /** ISO code used in the URL and Transloco: 'es', 'en', … */
  code: string;
  /** Native name shown in the language switcher. */
  label: string;
  /** BCP 47 / Open Graph locale, e.g. 'es_ES', 'en_US'. */
  ogLocale: string;
  /** Locale code accepted by Google Identity Services' button widget, e.g. 'es', 'pt-BR'. */
  gsiLocale: string;
}

/** Single source of truth for every supported language.
 *  To add a new language:
 *    1. Add an entry here (including its ogLocale and gsiLocale).
 *    2. Create  src/assets/i18n/<code>.json  with all translation strings.
 *    That's it — routing, guards, hreflang, SEO tags, the Google sign-in button and the
 *    nav dropdown update automatically.
 */
export const LANGUAGES: LangOption[] = [
  { code: 'es', label: 'Español', ogLocale: 'es_ES', gsiLocale: 'es' },
  { code: 'en', label: 'English', ogLocale: 'en_US', gsiLocale: 'en' },
  { code: 'pt', label: 'Português', ogLocale: 'pt_BR', gsiLocale: 'pt-BR' },
  { code: 'de', label: 'Deutsch', ogLocale: 'de_DE', gsiLocale: 'de' },
];

export const SUPPORTED_LANG_CODES = LANGUAGES.map((l) => l.code);

export const DEFAULT_LANG = 'es';

/** Looks up the Open Graph locale for a given language code, falling back to the default language's. */
export function getOgLocale(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.ogLocale
    ?? LANGUAGES.find((l) => l.code === DEFAULT_LANG)!.ogLocale;
}

/** Looks up the Google Identity Services locale for a given language code, falling back to the default language's. */
export function getGsiLocale(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.gsiLocale
    ?? LANGUAGES.find((l) => l.code === DEFAULT_LANG)!.gsiLocale;
}

/** localStorage key used to persist the user's language preference. */
export const LANG_STORAGE_KEY = 'fourier-lang';

/** Reads the persisted language from localStorage (browser only). */
export function getSavedLang(): string {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && SUPPORTED_LANG_CODES.includes(saved)) return saved;
  } catch {
    // localStorage unavailable during SSR
  }
  return DEFAULT_LANG;
}

/** Saves the user's language preference to localStorage (browser only). */
export function saveLang(code: string): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, code);
  } catch {
    // localStorage unavailable during SSR
  }
}
