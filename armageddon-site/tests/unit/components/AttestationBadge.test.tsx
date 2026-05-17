// @vitest-environment jsdom
/**
 * UI tests for the AttestationBadge component.
 *
 * Verifies:
 *   • Loading state renders while fetch is in-flight.
 *   • Configured key fetched from /api/attestation/pubkey is surfaced
 *     with the OFFLINE_VERIFY tone and key id slice.
 *   • 503 responses render the EPHEMERAL_KEY warning tone.
 *   • Network errors render the KEY_UNAVAILABLE tone without throwing.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import AttestationBadge from '@/components/AttestationBadge';

type FetchFn = typeof fetch;

function setFetch(impl: FetchFn): void {
    globalThis.fetch = impl;
}

describe('AttestationBadge', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('shows CHECKING_KEY while the fetch is in flight', () => {
        setFetch(vi.fn(() => new Promise<Response>(() => undefined)));
        render(<AttestationBadge />);
        expect(screen.getByText('CHECKING_KEY')).toBeInTheDocument();
        const badge = screen.getByText('CHECKING_KEY').closest('[data-attestation-status]');
        expect(badge).toHaveAttribute('data-attestation-status', 'loading');
    });

    it('shows OFFLINE_VERIFY tone when /api/attestation/pubkey returns a key', async () => {
        setFetch(vi.fn(async () => new Response(JSON.stringify({
            spec: 'armageddon-attestation/1.0',
            algorithm: 'ed25519',
            keyId: 'deadbeefcafebabe',
            publicKey: 'A'.repeat(44),
            issuedAt: '2026-05-17T08:00:00.000Z',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

        render(<AttestationBadge />);

        await waitFor(() => {
            expect(screen.getByText('OFFLINE_VERIFY')).toBeInTheDocument();
        });
        const badge = screen.getByText('OFFLINE_VERIFY').closest('[data-attestation-status]');
        expect(badge).toHaveAttribute('data-attestation-status', 'configured');
        expect(badge).toHaveAttribute('data-attestation-keyid', 'deadbeefcafebabe');
        // shortened display
        expect(screen.getByText('[deadbeef…]')).toBeInTheDocument();
    });

    it('shows EPHEMERAL_KEY tone when endpoint returns 503', async () => {
        setFetch(vi.fn(async () => new Response(JSON.stringify({
            error: 'ATTESTATION_KEY_NOT_CONFIGURED',
            message: 'Set ARMAGEDDON_ATTESTATION_SEED.',
            spec: 'armageddon-attestation/1.0',
            algorithm: 'ed25519',
        }), { status: 503, headers: { 'Content-Type': 'application/json' } })));

        render(<AttestationBadge />);
        await waitFor(() => {
            expect(screen.getByText('EPHEMERAL_KEY')).toBeInTheDocument();
        });
    });

    it('shows KEY_UNAVAILABLE tone on network error', async () => {
        setFetch(vi.fn(async () => { throw new Error('network down'); }));

        render(<AttestationBadge />);
        await waitFor(() => {
            expect(screen.getByText('KEY_UNAVAILABLE')).toBeInTheDocument();
        });
    });
});
