// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DestructionConsole from '@/components/DestructionConsole';
import { I18nProvider } from '@/i18n/I18nProvider';


vi.mock('framer-motion', () => ({
    motion: new Proxy({}, { get: (_target, tag: string) => {
        const Tag = tag as keyof JSX.IntrinsicElements;
        return ({ children, whileHover: _whileHover, whileTap: _whileTap, animate: _animate, initial: _initial, exit: _exit, transition: _transition, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Tag {...props}>{children}</Tag>;
    } }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => null }));
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
    delete process.env.NEXT_PUBLIC_ARMAGEDDON_API_BASE;
});

function renderConsole() {
    return render(<I18nProvider><DestructionConsole /></I18nProvider>);
}

describe('DestructionConsole target readiness', () => {
    it('shows target configuration and readiness before battery controls', async () => {
        renderConsole();
        expect(await screen.findByText('No target configured')).toBeInTheDocument();
        expect(screen.getByText('Run Readiness Checklist')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Set Target' })).toHaveAttribute('href', '/onboarding#target-config');
    });

    it('blocks execution with exact remaining readiness items', async () => {
        renderConsole();
        await screen.findByText('No target configured');

        await userEvent.click(screen.getByRole('button', { name: /initiate sequence/i }));

        await waitFor(() => {
            expect(screen.getByText(/RUN BLOCKED: Configure the deployed app URL/)).toBeInTheDocument();
        });
        expect(screen.getAllByText(/Target configured/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Organization membership active/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Backend connected/).length).toBeGreaterThan(0);
        expect(screen.getByText(/No run, analysis, verdict, or certificate has been started/)).toBeInTheDocument();
    });
});
