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

describe('OnboardingPage target endpoint flow', () => {
    it('shows practical target and authorization helper copy', async () => {
        renderOnboardingPage();
        const targetNameHelp = await screen.findByText(/Give this target a name you will recognize later/);
        expect(targetNameHelp).toBeTruthy();
        expect(screen.getByText(/Only run tests against systems you own/)).toBeInTheDocument();
    });

    it('blocks an empty target endpoint URL with clear validation copy', async () => {
        renderOnboardingPage();
        await completeCommonFields();
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        expect(await screen.findByText('Target endpoint URL is required.')).toBeInTheDocument();
        expect(push).not.toHaveBeenCalled();
    });

    it('blocks a non-http(s) target endpoint URL with an inline format error', async () => {
        renderOnboardingPage();
        await completeCommonFields();
        fireEvent.change(screen.getByLabelText(/Target endpoint URL/i), { target: { value: 'ftp://files.example.com' } });
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        expect(await screen.findByText('Enter an http(s) target endpoint or deployed app URL.')).toBeInTheDocument();
        expect(push).not.toHaveBeenCalled();
        // The rejected URL must not be persisted as a locked target.
        expect(localStorage.getItem(CODEBASE_TARGET_KEY)).toBeNull();
    });

    it('replaces a previously saved target when the user edits the URL, instead of silently reverting', async () => {
        const staleTarget: CodebaseTarget = {
            id: 'endpoint-stale',
            kind: 'endpoint',
            status: 'local-only',
            label: 'Checkout API',
            endpointUrl: 'https://old.example.com',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            orgName: 'ACME Corp',
            contactEmail: 'security@acme.test',
            tier: 'self-serve',
            targetSystemName: 'Checkout API',
            targetUrl: 'https://old.example.com',
            environment: 'staging',
            authorizationConfirmed: true,
            acceptableUseAck: true,
            codebaseTarget: staleTarget,
        }));

        renderOnboardingPage();
        await waitFor(() => expect(screen.getByLabelText(/Target endpoint URL/i)).toHaveValue('https://old.example.com'));
        fireEvent.change(screen.getByLabelText(/Target endpoint URL/i), { target: { value: 'https://new.example.com' } });
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

        expect(await screen.findByText(/Live runs aren't connected/)).toBeInTheDocument();
        expect(localStorage.getItem(CODEBASE_TARGET_KEY)).toContain('https://new.example.com');
        expect(localStorage.getItem(CODEBASE_TARGET_KEY)).not.toContain('https://old.example.com');
        expect(localStorage.getItem(DRAFT_KEY)).toContain('https://new.example.com');
    });

    it('reuses the saved target when the URL is unchanged (no identity churn)', async () => {
        const savedTarget: CodebaseTarget = {
            id: 'endpoint-keep-me',
            kind: 'endpoint',
            status: 'local-only',
            label: 'Checkout API',
            endpointUrl: 'https://app.example.com',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            orgName: 'ACME Corp',
            contactEmail: 'security@acme.test',
            tier: 'self-serve',
            targetSystemName: 'Checkout API',
            targetUrl: 'https://app.example.com',
            environment: 'staging',
            authorizationConfirmed: true,
            acceptableUseAck: true,
            codebaseTarget: savedTarget,
        }));

        renderOnboardingPage();
        await waitFor(() => expect(screen.getByLabelText(/Target endpoint URL/i)).toHaveValue('https://app.example.com'));
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

        await screen.findByText(/Live runs aren't connected/);
        const persisted = JSON.parse(localStorage.getItem(CODEBASE_TARGET_KEY) ?? 'null') as CodebaseTarget;
        expect(persisted?.id).toBe('endpoint-keep-me');
        expect(persisted?.endpointUrl).toBe('https://app.example.com');
    });

    it('saves a target endpoint and honestly reports local-only state without a backend', async () => {
        renderOnboardingPage();
        await completeCommonFields();
        fireEvent.change(screen.getByLabelText(/Target endpoint URL/i), { target: { value: 'https://app.example.com' } });
        await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

        expect(await screen.findByText(/Live runs aren't connected/)).toBeInTheDocument();
        expect(localStorage.getItem(DRAFT_KEY)).toContain('https://app.example.com');
        expect(localStorage.getItem(CODEBASE_TARGET_KEY)).toContain('https://app.example.com');
    });
});
