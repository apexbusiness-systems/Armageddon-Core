// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import AuthHeader from '@/components/AuthHeader';
import { I18nProvider } from '@/i18n/I18nProvider';
import { getSupabase } from '@/lib/supabase';

vi.mock('framer-motion', () => ({
    motion: new Proxy({}, { get: (_target, tag: string) => {
        const Tag = tag as keyof JSX.IntrinsicElements;
        return ({ children, animate: _animate, initial: _initial, exit: _exit, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Tag {...props}>{children}</Tag>;
    } }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/supabase', () => ({
    getSupabase: vi.fn(),
}));

const mockUser: User = {
    id: 'user-id-12345',
    email: 'jrmendozaceo@apexbusiness-systems.icu',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-06T00:00:00Z',
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
    vi.mocked(getSupabase).mockReturnValue({
        auth: {
            getSession: vi.fn().mockResolvedValue({
                data: { session: { access_token: 'header-access-token' } },
            }),
        },
    } as any);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tier: 'certified' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })) as any;
});

afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
});

function renderHeader() {
    return render(
        <I18nProvider>
            <AuthHeader user={mockUser} onLogout={vi.fn()} />
        </I18nProvider>
    );
}

describe('AuthHeader', () => {
    it('forwards the Supabase bearer token to gatekeeper', async () => {
        renderHeader();

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/gatekeeper', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer header-access-token',
            },
        }));
    });
});
