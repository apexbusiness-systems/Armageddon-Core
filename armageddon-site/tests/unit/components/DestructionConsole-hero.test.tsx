// @vitest-environment jsdom
/**
 * Homepage value proposition (marketingHero): exactly one H1, visible (not
 * sr-only), carrying the release-readiness headline, plus the two conversion
 * CTAs. Without the prop (/console) the accessible-only H1 is unchanged.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import DestructionConsole from '@/components/DestructionConsole';
import { I18nProvider } from '@/i18n/I18nProvider';
import en from '../../../src/i18n/dictionaries/en';

// Components are cached per tag: like the real `motion.div`, the type must be
// stable across renders, or every re-render would remount (and detach) the DOM.
vi.mock('framer-motion', () => {
    const cache = new Map<string, React.ElementType>();
    return {
        motion: new Proxy({}, { get: (_target, tag: string) => {
            const cached = cache.get(tag);
            if (cached) return cached;
            const Tag = tag as keyof JSX.IntrinsicElements;
            const Component = ({ children, whileHover: _whileHover, whileTap: _whileTap, animate: _animate, initial: _initial, exit: _exit, transition: _transition, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Tag {...props}>{children}</Tag>;
            cache.set(tag, Component);
            return Component;
        } }),
        AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    };
});
vi.mock('@/lib/supabase', () => ({
    getSupabase: () => ({
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
        channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis(), unsubscribe: vi.fn() })),
        removeChannel: vi.fn(),
    }),
}));
vi.mock('@/lib/browser-supabase', () => ({ getRequiredSupabase: () => null }));
vi.mock('@/lib/client-auth-actions', () => ({ endSupabaseSession: vi.fn() }));
vi.mock('@/lib/useAuth', () => ({ useAuth: () => null }));
vi.mock('@/components/AuthHeader', () => ({ default: () => null }));
vi.mock('@/components/AttestationBadge', () => ({ default: () => <span>Attestation</span>, useAttestationPubKey: () => null }));
vi.mock('@/components/social/LeaderboardWidget', () => ({ default: () => <div>Leaderboard</div> }));
vi.mock('@/components/RunTelemetryDeck', () => ({ default: () => <div>Telemetry</div> }));
vi.mock('@/components/paywall/LockdownModal', () => ({ default: () => <div>Lockdown</div> }));

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe('DestructionConsole marketing hero', () => {
    it('renders exactly one visible H1 with the release-readiness headline', () => {
        render(<I18nProvider><DestructionConsole standalone marketingHero /></I18nProvider>);
        const headings = screen.getAllByRole('heading', { level: 1 });
        expect(headings).toHaveLength(1);
        expect(headings[0]).toHaveTextContent(en.pricing.headline);
        expect(headings[0]).not.toHaveClass('sr-only');
        expect(screen.getByText(en.home.console.heroSubline)).toBeInTheDocument();
    });

    it('offers both CTAs: start a free dry run (step 1) and see pricing', () => {
        render(<I18nProvider><DestructionConsole standalone marketingHero /></I18nProvider>);
        const start = screen.getByRole('link', { name: en.home.console.heroStartFreeCta });
        expect(start).toHaveAttribute('href', '#console-step-1');
        expect(document.getElementById('console-step-1')).not.toBeNull();
        expect(screen.getByRole('link', { name: en.home.console.heroSeePricingCta })).toHaveAttribute('href', '/pricing');
    });

    it('keeps the accessible-only H1 and no hero on the workspace console', () => {
        render(<I18nProvider><DestructionConsole standalone /></I18nProvider>);
        const headings = screen.getAllByRole('heading', { level: 1 });
        expect(headings).toHaveLength(1);
        expect(headings[0]).toHaveClass('sr-only');
        expect(screen.queryByRole('link', { name: en.home.console.heroStartFreeCta })).toBeNull();
    });
});
