// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DestructionConsole from '@/components/DestructionConsole';
import { I18nProvider } from '@/i18n/I18nProvider';
import { CODEBASE_TARGET_KEY, createRepositoryTarget, createZipArchiveTarget } from '@/lib/codebase-target';

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

describe('DestructionConsole codebase target readiness', () => {
    it('shows a saved repository target summary', async () => {
        localStorage.setItem(CODEBASE_TARGET_KEY, JSON.stringify(createRepositoryTarget('https://github.com/acme/app.git', 'Checkout API')));
        renderConsole();
        expect(await screen.findByText(/Checkout API: https:\/\/github.com\/acme\/app.git/)).toBeInTheDocument();
        expect(screen.getByText(/Repository target saved/)).toBeInTheDocument();
    });

    it('shows a saved zip target summary and blocks execution without ingestion', async () => {
        localStorage.setItem(CODEBASE_TARGET_KEY, JSON.stringify(createZipArchiveTarget({ name: 'app.zip', size: 4096, type: 'application/zip' }, 'Zip app')));
        renderConsole();
        expect(await screen.findByText(/Zip app: app.zip \(4 KB, local metadata only\)/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /initiate sequence/i }));

        await waitFor(() => {
            expect(screen.getByText(/TARGET BLOCKED: Zip archive analysis is blocked/)).toBeInTheDocument();
        });
        expect(screen.getByText(/No run, analysis, verdict, or certificate has been started/)).toBeInTheDocument();
    });
});
