export interface LangOption {
  /** ISO code used in the URL and Transloco: 'es', 'en', … */
  code: string;
  /** Native name shown in the language switcher. */
  label: string;
}

/** Single source of truth for every supported language.
 *  To add a new language:
 *    1. Add an entry here.
 *    2. Create  src/assets/i18n/<code>.json  with all translation strings.
 *    That's it — routing, guards, hreflang and the nav dropdown update automatically.
 */
export const LANGUAGES: LangOption[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
];

export const SUPPORTED_LANG_CODES = LANGUAGES.map((l) => l.code);

export const DEFAULT_LANG = 'es';

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
