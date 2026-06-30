// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import Home from '@/app/page';
import { I18nProvider } from '@/i18n/I18nProvider';

const replace = vi.fn();
let mockUser: unknown = null;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/supabase', () => ({
    getSupabase: () => ({
        auth: {
            getUser: vi.fn(async () => ({ data: { user: mockUser } })),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
    }),
}));
vi.mock('@/components/DestructionConsole', () => ({ default: () => <section>Destruction Console</section> }));
vi.mock('@/components/BatteryGrid', () => ({ default: () => <section>The 13 Batteries</section> }));
vi.mock('@/components/CertificationSeal', () => ({ default: () => <section>Certification Artifact</section> }));
vi.mock('@/components/Footer', () => ({ default: () => <footer>Compliance is a checklist.</footer> }));

afterEach(() => { cleanup(); replace.mockClear(); mockUser = null; });

function renderHome() { return render(<I18nProvider><Home /></I18nProvider>); }

describe('root auth routing', () => {
    it('renders public marketing sections for logged-out visitors', async () => {
        renderHome();
        expect(await screen.findByText('The 13 Batteries')).toBeInTheDocument();
        expect(screen.getByText('Certification Artifact')).toBeInTheDocument();
        expect(replace).not.toHaveBeenCalled();
    });

    it('redirects logged-in users to /console without rendering marketing sections', async () => {
        mockUser = { id: 'user-1', email: 'operator@example.com' };
        renderHome();
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/console'));
        expect(screen.queryByText('The 13 Batteries')).not.toBeInTheDocument();
        expect(screen.queryByText('Compliance is a checklist.')).not.toBeInTheDocument();
    });
});
