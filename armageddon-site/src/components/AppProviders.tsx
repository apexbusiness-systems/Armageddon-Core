'use client';

import type { ReactNode } from 'react';
import { I18nProvider } from '@/i18n/I18nProvider';

/**
 * Composes app-wide client providers. Kept as a thin wrapper so the root
 * layout (a server component) can stay server-rendered while still
 * mounting client-only context providers around its children.
 */
export default function AppProviders({ children }: { children: ReactNode }) {
    return <I18nProvider>{children}</I18nProvider>;
}
