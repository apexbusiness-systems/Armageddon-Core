'use client';

import { useId } from 'react';
import { useT } from '@/i18n/useT';
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/locales';

/**
 * Global language switcher. A native `<select>` is used over a custom
 * listbox for built-in keyboard/screen-reader support and to avoid
 * reimplementing combobox semantics for a control that changes on every page.
 */
export default function LanguageSelector() {
    const { locale, dictionary, setLocale } = useT();
    const selectId = useId();

    return (
        <div className="fixed top-20 left-5 z-[10000] flex items-center gap-2 bg-[var(--void)]/95 border border-[var(--tungsten)] px-3 py-2 backdrop-blur-sm">
            <label htmlFor={selectId} className="sr-only">
                {dictionary.common.languageSelector.label}
            </label>
            <select
                id={selectId}
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                aria-label={dictionary.common.languageSelector.label}
                className="mono-small bg-transparent text-[var(--signal)]/80 tracking-widest uppercase border-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)] cursor-pointer"
            >
                {SUPPORTED_LOCALES.map((loc) => (
                    <option key={loc} value={loc} className="bg-[var(--void)] text-[var(--signal)]">
                        {LOCALE_LABELS[loc]}
                    </option>
                ))}
            </select>
        </div>
    );
}
