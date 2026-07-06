// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const getSessionMock = vi.fn();
const supabaseClientMock = {
    auth: { getSession: getSessionMock },
    channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({ getSupabase: () => supabaseClientMock }));
vi.mock('@/lib/browser-supabase', () => ({ getRequiredSupabase: () => null }));
vi.mock('@/lib/client-auth-actions', () => ({ endSupabaseSession: vi.fn() }));
let mockUser: { email: string } | null = null;
vi.mock('@/lib/useAuth', () => ({ useAuth: () => mockUser }));
vi.mock('@/components/AuthHeader', () => ({ default: () => null }));
let mockAttestationPubKey: unknown = null;
vi.mock('@/components/AttestationBadge', () => ({ default: () => <span>Attestation</span>, useAttestationPubKey: () => mockAttestationPubKey }));
vi.mock('@/components/social/LeaderboardWidget', () => ({ default: () => <div>Leaderboard</div> }));
vi.mock('@/components/RunTelemetryDeck', () => ({ default: () => <div>Telemetry</div> }));
vi.mock('@/components/paywall/LockdownModal', () => ({ default: () => <div>Lockdown</div> }));

const originalFetch = globalThis.fetch;

beforeEach(() => {
    mockUser = null;
    mockAttestationPubKey = null;
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'console-access-token' } } });
    supabaseClientMock.channel.mockClear();
    supabaseClientMock.removeChannel.mockClear();
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    globalThis.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_ARMAGEDDON_API_BASE;
    vi.clearAllMocks();
});

function renderConsole() {
    return render(<I18nProvider><DestructionConsole /></I18nProvider>);
}

describe('DestructionConsole target readiness', () => {
    it('shows target configuration and readiness before battery controls', async () => {
        renderConsole();
        expect(await screen.findByText(/No target configured/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Configure target' })).toHaveAttribute('href', '/onboarding');
    });



    it('submits certified runs at execution level 7 and never level 8', async () => {
        process.env.NEXT_PUBLIC_ARMAGEDDON_API_BASE = 'https://api.test.local';
        mockUser = { email: 'jrmendozaceo@apexbusiness-systems.icu' };
        mockAttestationPubKey = {
            spec: 'armageddon-attestation-v1',
            algorithm: 'Ed25519',
            keyId: 'test-key',
            publicKey: 'test-public-key',
        };
        localStorage.setItem('armageddon:codebase-target', JSON.stringify({
            id: 'target-id',
            kind: 'endpoint',
            status: 'ready',
            label: 'Certified target',
            endpointUrl: 'https://target.example.com',
            createdAt: '2026-07-06T00:00:00Z',
            updatedAt: '2026-07-06T00:00:00Z',
        }));
        localStorage.setItem('armageddon:onboarding-draft', JSON.stringify({
            orgName: 'Apex',
            contactEmail: 'jrmendozaceo@apexbusiness-systems.icu',
            tier: 'certified',
            targetSystemName: 'Certified target',
            targetUrl: 'https://target.example.com',
            environment: 'staging',
            authorizationConfirmed: true,
            acceptableUseAck: true,
            codebaseTarget: null,
        }));

        globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.endsWith('/api/gatekeeper')) {
                return new Response(JSON.stringify({ eligible: true, tier: 'certified', reason: 'ADMIN_OVERRIDE' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (url.endsWith('/api/me/organizations')) {
                return new Response(JSON.stringify({ active: { organization_id: 'apex-corporate-org-id' } }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (url.endsWith('/api/run')) {
                return new Response(JSON.stringify({ success: true, runId: 'run-123', workflowId: 'wf-123' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error(`Unexpected fetch: ${url} ${JSON.stringify(init)}`);
        }) as any;

        renderConsole();

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test.local/api/gatekeeper', expect.any(Object)));
        await userEvent.click(await screen.findByRole('button', { name: /initiate sequence/i }));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test.local/api/run', expect.objectContaining({ method: 'POST' })));
        const runCall = vi.mocked(globalThis.fetch).mock.calls.find(([url]) => String(url).endsWith('/api/run'));
        expect(runCall).toBeDefined();
        const body = JSON.parse(String(runCall?.[1]?.body));
        expect(body).toMatchObject({ organizationId: 'apex-corporate-org-id', level: 7 });
        expect(body).not.toMatchObject({ level: 8 });
    });

    it('blocks execution with exact remaining readiness items', async () => {
        renderConsole();
        await screen.findByText(/No target configured/i);

        await userEvent.click(screen.getByRole('button', { name: /initiate sequence/i }));

        await waitFor(() => {
            expect(screen.getByText(/RUN BLOCKED: Configure the deployed app URL/)).toBeInTheDocument();
        });
        expect(screen.getByText(/No run, analysis, verdict, or certificate has been started/)).toBeInTheDocument();
    });
});
