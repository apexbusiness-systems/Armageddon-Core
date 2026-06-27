// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingPage from '@/app/onboarding/page';
import { I18nProvider } from '@/i18n/I18nProvider';
import { CODEBASE_TARGET_KEY, DRAFT_KEY, type CodebaseTarget } from '@/lib/codebase-target';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('framer-motion', () => ({
    motion: new Proxy({}, { get: (_target, tag: string) => {
        const Tag = tag as keyof JSX.IntrinsicElements;
        return ({ children, animate: _animate, initial: _initial, transition: _transition, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <Tag {...props}>{children}</Tag>;
    } }),
}));

afterEach(() => {
    cleanup();
    localStorage.clear();
    push.mockClear();
    delete process.env.NEXT_PUBLIC_ARMAGEDDON_API_BASE;
    window.history.replaceState(null, '', '/onboarding');
});

async function completeCommonFields() {
    await waitFor(() => expect(screen.getByLabelText(/Organization Name/i)).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.change(screen.getByLabelText(/Organization Name/i), { target: { value: 'ACME Corp' } });
    fireEvent.change(screen.getByLabelText(/Contact Email/i), { target: { value: 'security@acme.test' } });
    fireEvent.change(screen.getByLabelText(/Target System Name/i), { target: { value: 'Checkout API' } });
    fireEvent.click(screen.getByLabelText(/authorized/i));
    fireEvent.click(screen.getByLabelText(/acceptable use/i));
}

function renderOnboardingPage() {
    return render(<I18nProvider><OnboardingPage /></I18nProvider>);
}

describe('OnboardingPage codebase target flow', () => {
    it('blocks an empty repository URL with clear validation copy', async () => {
        renderOnboardingPage();
        await completeCommonFields();
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        expect(await screen.findByText('Repository URL is required.')).toBeInTheDocument();
        expect(push).not.toHaveBeenCalled();
    });

    it('saves a repository target and honestly reports local-only state without a backend', async () => {
        renderOnboardingPage();
        await completeCommonFields();
        fireEvent.change(screen.getByLabelText(/Repository URL/i), { target: { value: 'https://github.com/acme/app.git' } });
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

        expect(await screen.findByText(/Live analysis is not connected/)).toBeInTheDocument();
        const target = JSON.parse(localStorage.getItem(CODEBASE_TARGET_KEY) ?? '{}') as CodebaseTarget;
        expect(target.kind).toBe('repository');
        expect(target.status).toBe('local-only');
        expect(localStorage.getItem(DRAFT_KEY)).toContain('https://github.com/acme/app.git');
    });

    it('saves zip metadata locally without claiming upload or analysis', async () => {
        renderOnboardingPage();
        await completeCommonFields();
        await userEvent.click(screen.getByRole('button', { name: /Zip archive/i }));
        const file = new File(['zip-bytes'], 'app.zip', { type: 'application/zip' });
        await userEvent.upload(screen.getByLabelText(/Zip archive metadata/i), file);
        await waitFor(() => expect(screen.getByText(/Saved locally: app.zip/)).toBeInTheDocument());
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

        expect(await screen.findByText(/no upload, analysis, queue, run, or certificate has been started/i)).toBeInTheDocument();
        const target = JSON.parse(localStorage.getItem(CODEBASE_TARGET_KEY) ?? '{}') as CodebaseTarget;
        expect(target.kind).toBe('zip-archive');
        expect(target.status).toBe('backend-required');
    });
});
