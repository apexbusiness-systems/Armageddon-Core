'use client';

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Dictionary } from './types';
import { type Locale, DEFAULT_LOCALE, resolveInitialLocale, writeStoredLocale } from './locales';
import en from './dictionaries/en';
import fr from './dictionaries/fr';
import de from './dictionaries/de';
import it from './dictionaries/it';
import es from './dictionaries/es';
import zhCN from './dictionaries/zh-CN';
import pt from './dictionaries/pt';

const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = {
    en,
    fr,
    de,
    it,
    es,
    'zh-CN': zhCN,
    pt,
};

export interface I18nContextValue {
    readonly locale: Locale;
    readonly dictionary: Dictionary;
    readonly setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

    // Resolve after mount (async to satisfy react-hooks/set-state-in-effect) so the
    // server-rendered `<html lang="en">` fallback never mismatches hydration.
    useEffect(() => {
        void (async () => {
            setLocaleState(resolveInitialLocale());
        })();
    }, []);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    const setLocale = useCallback((next: Locale) => {
        setLocaleState(next);
        writeStoredLocale(next);
    }, []);

    const value = useMemo<I18nContextValue>(
        () => ({ locale, dictionary: DICTIONARIES[locale], setLocale }),
        [locale, setLocale],
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
