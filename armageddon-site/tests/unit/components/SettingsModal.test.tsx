// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import SettingsModal from '@/components/SettingsModal';
import { I18nProvider } from '@/i18n/I18nProvider';
import { getSupabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

vi.mock('framer-motion', () => ({
    motion: new Proxy({}, { get: (_target, tag: string) => {
        const Tag = tag as keyof JSX.IntrinsicElements;
        return ({ children, animate: _animate, initial: _initial, exit: _exit, transition: _transition, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Tag {...props}>{children}</Tag>;
    } }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/supabase', () => ({
    getSupabase: vi.fn(),
}));

vi.mock('@/lib/codebase-target', () => ({
    readSavedCodebaseTarget: () => ({
        id: 'test-id',
        kind: 'endpoint',
        status: 'ready',
        label: 'My Test Endpoint',
        endpointUrl: 'https://test-endpoint.example.com',
        createdAt: '2026-07-06T00:00:00Z',
        updatedAt: '2026-07-06T00:00:00Z',
    }),
}));

const mockUser: User = {
    id: 'user-id-12345',
    email: 'operator@apexbusiness.systems',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-06T00:00:00Z',
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
    process.env.NEXT_PUBLIC_ARMAGEDDON_API_BASE = 'https://api.test.local';
    vi.mocked(getSupabase).mockReturnValue({
        auth: {
            getSession: vi.fn().mockResolvedValue({
                data: { session: { access_token: 'settings-access-token' } },
            }),
        },
    } as any);
    globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({ tier: 'certified' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }) as any;
});

afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_ARMAGEDDON_API_BASE;
    vi.restoreAllMocks();
});

function renderModal(open = true) {
    const onClose = vi.fn();
    return {
        onClose,
        ...render(
            <I18nProvider>
                <SettingsModal open={open} user={mockUser} onClose={onClose} />
            </I18nProvider>
        ),
    };
}

describe('SettingsModal Panel', () => {
    it('renders profile tab content by default', async () => {
        renderModal();
        expect(await screen.findByText('LEVEL 7 / CERTIFIED RUNS')).toBeInTheDocument();
        expect(screen.getByText(/CONTROL CENTER/i)).toBeInTheDocument();
        expect(screen.getByText('operator@apexbusiness.systems')).toBeInTheDocument();
        expect(screen.getByText('My Test Endpoint')).toBeInTheDocument();
    });

    it('forwards the Supabase bearer token to gatekeeper', async () => {
        renderModal();

        await screen.findByText('LEVEL 7 / CERTIFIED RUNS');

        expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test.local/api/gatekeeper', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer settings-access-token',
            },
        });
    });

    it('switches to billing tab on click', async () => {
        renderModal();
        expect(await screen.findByText('LEVEL 7 / CERTIFIED RUNS')).toBeInTheDocument();
        
        const billingBtn = screen.getByRole('button', { name: /BILLING/i });
        fireEvent.click(billingBtn);

        expect(await screen.findByText('Subscription Tiers')).toBeInTheDocument();
        expect(screen.getByText('Self-Serve Dry Run')).toBeInTheDocument();
    });

    it('switches to faq tab on click', async () => {
        renderModal();
        expect(await screen.findByText('LEVEL 7 / CERTIFIED RUNS')).toBeInTheDocument();
        
        const faqBtn = screen.getByRole('button', { name: /QUICKSTART/i });
        fireEvent.click(faqBtn);

        expect(await screen.findByText('Quickstart Onboarding Guide')).toBeInTheDocument();
        expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
        expect(screen.getByText('What is the difference between simulation and live-fire?')).toBeInTheDocument();
    });
});
