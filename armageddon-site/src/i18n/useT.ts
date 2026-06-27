'use client';

import { useContext } from 'react';
import { I18nContext, type I18nContextValue } from './I18nProvider';

/**
 * Returns the active locale, the resolved typed dictionary, and a setter.
 * Must be used within `I18nProvider` (mounted via `AppProviders` in the root layout).
 */
export function useT(): I18nContextValue {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        throw new Error('useT must be used within an I18nProvider');
    }
    return ctx;
}
