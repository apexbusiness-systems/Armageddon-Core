'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AttestationBadge — Tamper-Evident Receipt Indicator
 *
 * Surfaces the cryptographic attestation status of the current
 * certification engine. Fetches the publishing public key from
 * `/api/attestation/pubkey` once on mount and displays:
 *
 *   • `OFFLINE_VERIFY` — a seed is configured and the engine emits signed
 *     receipts that any third party can verify with the shipped verify.mjs.
 *   • `EPHEMERAL`      — no seed is configured; signing keys are per-process
 *     and verification only works inside this session.
 *
 * Designed to be informational and non-blocking: a failed fetch is reported
 * but never breaks the destruction console.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PubKeyResponse {
    spec: string;
    algorithm: string;
    keyId: string;
    publicKey: string;
    issuedAt: string;
}

type Status = 'loading' | 'configured' | 'ephemeral' | 'error';

interface State {
    status: Status;
    keyId?: string;
    publicKey?: string;
    spec?: string;
    detail?: string;
}

export default function AttestationBadge() {
    const [state, setState] = useState<State>({ status: 'loading' });

    useEffect(() => {
        const abort = new AbortController();
        fetch('/api/attestation/pubkey', { signal: abort.signal })
            .then(async (res) => {
                if (res.status === 503) {
                    const body = await res.json().catch(() => ({}));
                    setState({
                        status: 'ephemeral',
                        spec: body.spec,
                        detail: 'No signing seed configured — per-process key only.',
                    });
                    return;
                }
                if (!res.ok) {
                    setState({
                        status: 'error',
                        detail: `Endpoint returned ${res.status}`,
                    });
                    return;
                }
                const body = (await res.json()) as PubKeyResponse;
                setState({
                    status: 'configured',
                    keyId: body.keyId,
                    publicKey: body.publicKey,
                    spec: body.spec,
                });
            })
            .catch((err) => {
                if (abort.signal.aborted) return;
                setState({
                    status: 'error',
                    detail: err instanceof Error ? err.message : String(err),
                });
            });
        return () => abort.abort();
    }, []);

    let icon;
    let label;
    let toneClass;
    let detail: string;

    switch (state.status) {
        case 'loading':
            icon = <Loader2 className="w-3.5 h-3.5 animate-spin" />;
            label = 'CHECKING_KEY';
            toneClass = 'border-white/10 text-white/50';
            detail = '';
            break;
        case 'configured':
            icon = <ShieldCheck className="w-3.5 h-3.5" />;
            label = 'OFFLINE_VERIFY';
            toneClass = 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5';
            detail = state.keyId ? `kid: ${state.keyId}` : '';
            break;
        case 'ephemeral':
            icon = <ShieldAlert className="w-3.5 h-3.5" />;
            label = 'EPHEMERAL_KEY';
            toneClass = 'border-amber-500/40 text-amber-400 bg-amber-500/5';
            detail = state.detail ?? '';
            break;
        case 'error':
            icon = <ShieldAlert className="w-3.5 h-3.5" />;
            label = 'KEY_UNAVAILABLE';
            toneClass = 'border-red-500/40 text-red-400 bg-red-500/5';
            detail = state.detail ?? '';
            break;
    }

    return (
        <div
            className={cn(
                'mono-small flex items-center gap-2 px-3 py-1.5 border tracking-widest text-[10px] rounded-sm',
                toneClass
            )}
            title={detail || 'Cryptographic attestation status'}
            data-attestation-status={state.status}
            data-attestation-keyid={state.keyId ?? ''}
        >
            {icon}
            <span>{label}</span>
            {state.status === 'configured' && state.keyId && (
                <span className="text-white/40">[{state.keyId.slice(0, 8)}…]</span>
            )}
        </div>
    );
}

/**
 * Hook variant for components that need to fetch attestation metadata
 * directly (e.g. to embed in evidence exports). Returns the public-key
 * descriptor (or null while loading / on error).
 */
export function useAttestationPubKey(): PubKeyResponse | null {
    const [data, setData] = useState<PubKeyResponse | null>(null);
    useEffect(() => {
        const abort = new AbortController();
        fetch('/api/attestation/pubkey', { signal: abort.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => {
                if (body && typeof body === 'object' && 'publicKey' in body) {
                    setData(body as PubKeyResponse);
                }
            })
            .catch(() => undefined);
        return () => abort.abort();
    }, []);
    return data;
}
