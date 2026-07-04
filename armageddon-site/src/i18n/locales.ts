/**
 * Supported locales for the local, adaptive translation system.
 *
 * No runtime translation API calls are made. All copy is sourced from the
 * typed dictionaries in `./dictionaries/*`. English is the schema source;
 * every other locale must have exact key parity (enforced by
 * `tests/unit/i18n-dictionaries.test.ts`).
 */

export const SUPPORTED_LOCALES = ['en', 'fr', 'de', 'it', 'es', 'zh-CN', 'pt'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
    en: 'English',
    fr: 'Francais',
    de: 'Deutsch',
    it: 'Italiano',
    es: 'Espanol',
    'zh-CN': 'Chinese Simplified',
    pt: 'Portugues',
};

/** All supported locales render left-to-right. */
export function getLocaleDir(_locale: Locale): 'ltr' {
    return 'ltr';
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
    return value != null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

const LOCALE_KEY = 'armageddon:locale';

export function readStoredLocale(): Locale | null {
    try {
        const stored = localStorage.getItem(LOCALE_KEY);
        return isSupportedLocale(stored) ? stored : null;
    } catch {
        return null;
    }
}

export function writeStoredLocale(locale: Locale): void {
    try {
        localStorage.setItem(LOCALE_KEY, locale);
    } catch {
        /* localStorage unavailable (private mode / quota) — locale just won't persist */
    }
}

/**
 * Resolution order: `?lang=` query param, then saved localStorage value,
 * then `navigator.languages`, then the English fallback.
 */
export function resolveInitialLocale(): Locale {
    try {
        const params = new URLSearchParams(globalThis.location.search);
        const fromQuery = params.get('lang');
        if (isSupportedLocale(fromQuery)) return fromQuery;
    } catch {
        /* no URL available (non-browser context) */
    }

    const stored = readStoredLocale();
    if (stored) return stored;

    try {
        for (const lang of navigator.languages ?? [navigator.language]) {
            if (isSupportedLocale(lang)) return lang;
            const base = lang.split('-')[0];
            if (isSupportedLocale(base)) return base;
        }
    } catch {
        /* navigator unavailable (non-browser context) */
    }

    return DEFAULT_LOCALE;
}
