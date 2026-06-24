'use client';

// armageddon-site/src/components/OmniPortWaiverModal.tsx
// Rendered when OmniHub deep-links a live-fire authorization request.
// window.__OMNIPORT_LIVE_FIRE_PENDING must be true (set by ?omniport_live_fire=1&waiver_token=<tok>).
// User must scroll to the bottom before the accept button becomes active.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { apiFetch, isApiConfigured } from '@/lib/runtime-api';

// Extend Window to acknowledge the OmniHub deep-link flag
declare global {
    interface Window {
        __OMNIPORT_LIVE_FIRE_PENDING?: boolean;
        __OMNIPORT_WAIVER_TOKEN?: string;
    }
}

// Hardcoded waiver excerpt from /ACCEPTABLE_USE.md
const WAIVER_TEXT = `ARMAGEDDON LIVE-FIRE ACCEPTABLE USE — LEGAL WAIVER

Version 1.0 · APEX Business Systems Ltd.

By accepting this waiver you confirm that:

1. AUTHORIZED SYSTEMS ONLY
   You are the owner of, or hold explicit written authorization to test, every
   system or endpoint targeted by this live-fire Armageddon run. Unauthorized
   testing of third-party systems is prohibited and may violate applicable law.

2. NO SIMULATION SAFEGUARDS
   A live-fire run sets SIM_MODE=false. Real adversarial attack vectors will be
   directed at real infrastructure. Rate limits, circuit breakers, and safety
   controls within the target system may be triggered. APEX Business Systems Ltd.
   accepts no liability for service disruption, data loss, or downstream effects
   caused by an authorized live-fire run.

3. PROHIBITED USE ACKNOWLEDGEMENT
   You confirm this run will NOT attempt to bypass production safety controls
   outside your authorization boundary, capture or share secrets outside approved
   secure channels, or trigger destructive workflows on systems you do not own.

4. WAIVER WINDOW
   This authorization is time-limited (15 minutes from issuance). The waiver
   record is cryptographically logged in the APEX-OmniHub platform. Misuse is
   traceable and actionable.

5. NO LIABILITY
   APEX Business Systems Ltd. accepts no liability for unauthorized use.
   Certification reflects results of the tested build/configuration at time of
   run. Live-fire runs are not a substitute for SOC 2, ISO 27001, or professional
   penetration testing engagements with appropriate legal agreements.

──────────────────────────────────────────────────────────────────────────────
   SCROLL TO BOTTOM AND CLICK "I ACCEPT" TO AUTHORIZE THE LIVE-FIRE RUN.
──────────────────────────────────────────────────────────────────────────────`;

interface LiveFireResult {
    authorized: boolean;
    runId?: string;
    workflowId?: string;
    waiverRecordId?: string;
    reason?: string;
}

interface OmniPortWaiverModalProps {
    onAuthorized?: (result: LiveFireResult) => void;
    onDecline?: () => void;
}

export default function OmniPortWaiverModal({ onAuthorized, onDecline }: OmniPortWaiverModalProps) {
    const user = useAuth();
    const [visible, setVisible] = useState(false);
    const [waiverToken, setWaiverToken] = useState('');
    const [orgId, setOrgId] = useState('');
    const [runLevel, setRunLevel] = useState(7);
    const [runIterations, setRunIterations] = useState(10000);
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Detect OmniHub deep-link on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const liveFire = params.get('omniport_live_fire');
        const token = params.get('waiver_token');
        const org = params.get('org_id') ?? '';
        const level = parseInt(params.get('level') ?? '7', 10);
        const iterations = parseInt(params.get('iterations') ?? '10000', 10);

        if (liveFire === '1' && token) {
            window.__OMNIPORT_LIVE_FIRE_PENDING = true;
            window.__OMNIPORT_WAIVER_TOKEN = token;
        }

        if (window.__OMNIPORT_LIVE_FIRE_PENDING && window.__OMNIPORT_WAIVER_TOKEN) {
            // This effect intentionally hydrates modal state once from OmniHub URL/window handoff data.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setWaiverToken(window.__OMNIPORT_WAIVER_TOKEN);
            setOrgId(org);
            setRunLevel(isFinite(level) ? level : 7);
            setRunIterations(isFinite(iterations) ? iterations : 10000);
            setVisible(true);
        }
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 8;
        if (atBottom) setScrolledToBottom(true);
    }, []);

    const handleDecline = () => {
        window.__OMNIPORT_LIVE_FIRE_PENDING = false;
        window.__OMNIPORT_WAIVER_TOKEN = undefined;
        setVisible(false);
        onDecline?.();
    };

    const handleAccept = async () => {
        if (!scrolledToBottom || !user || !waiverToken) return;

        // Honest degradation: live-fire authorization requires the backend.
        if (!isApiConfigured()) {
            setStatus('error');
            setErrorMsg('Live-fire backend not connected on this deployment.');
            return;
        }

        setStatus('submitting');
        setErrorMsg('');

        try {
            // Step 1: Record waiver acceptance
            const waiverRes = await apiFetch('/api/omniport/waiver', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    waiverToken,
                    acceptedByUserId: user.id,
                    organizationId: orgId,
                }),
            });

            const waiverData: { accepted?: boolean; waiverRecordId?: string; reason?: string } = await waiverRes.json();

            if (!waiverRes.ok || !waiverData.accepted) {
                setStatus('error');
                setErrorMsg(waiverData.reason ?? 'Waiver acceptance failed');
                return;
            }

            // Step 2: Authorize live-fire run
            const liveFireRes = await apiFetch('/api/omniport/live-fire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organizationId: orgId,
                    waiverToken,
                    level: runLevel,
                    iterations: runIterations,
                }),
            });

            const liveFireData: LiveFireResult = await liveFireRes.json();

            if (!liveFireRes.ok || !liveFireData.authorized) {
                setStatus('error');
                setErrorMsg(liveFireData.reason ?? 'Live-fire authorization failed');
                return;
            }

            window.__OMNIPORT_LIVE_FIRE_PENDING = false;
            window.__OMNIPORT_WAIVER_TOKEN = undefined;
            setVisible(false);
            onAuthorized?.(liveFireData);
        } catch (err) {
            setStatus('error');
            setErrorMsg((err as Error).message ?? 'Network error');
        }
    };

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
        >
            <div
                className="relative w-full max-w-2xl flex flex-col"
                style={{
                    background: 'var(--void)',
                    border: '1px solid rgba(255,60,60,0.6)',
                    boxShadow: '0 0 48px rgba(255,60,60,0.15)',
                    maxHeight: '90vh',
                }}
            >
                {/* Warning badge */}
                <div
                    className="flex items-center gap-3 px-6 py-3"
                    style={{ background: 'rgba(255,40,40,0.12)', borderBottom: '1px solid rgba(255,60,60,0.3)' }}
                >
                    <span style={{ color: '#ff4040', fontSize: '1.1rem' }}>⚠</span>
                    <span className="mono-small" style={{ color: '#ff4040', letterSpacing: '0.08em' }}>
                        LIVE-FIRE MODE — SIM_MODE=FALSE — REAL SYSTEMS TARGETED
                    </span>
                </div>

                {/* Title */}
                <div className="px-6 pt-5 pb-3">
                    <p className="display-medium text-signal" style={{ fontSize: '1rem' }}>
                        LIVE-FIRE AUTHORIZATION REQUIRED
                    </p>
                    <p className="mono-small text-signal/40 mt-1">
                        Read the waiver in full, scroll to the bottom, then accept.
                    </p>
                </div>

                {/* Waiver scroll area */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto mx-6 mb-4 p-4"
                    style={{
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.02)',
                        maxHeight: '40vh',
                        minHeight: '180px',
                    }}
                >
                    <pre className="mono-small text-signal/60 whitespace-pre-wrap leading-relaxed" style={{ fontSize: '0.72rem' }}>
                        {WAIVER_TEXT}
                    </pre>
                </div>

                {/* Scroll hint */}
                {!scrolledToBottom && (
                    <p className="text-center mono-small pb-2" style={{ color: 'rgba(255,60,60,0.7)', fontSize: '0.7rem' }}>
                        ↓ SCROLL TO BOTTOM TO ENABLE ACCEPT
                    </p>
                )}

                {/* Error */}
                {status === 'error' && (
                    <p className="mx-6 mb-3 mono-small text-center" style={{ color: '#ff4040', fontSize: '0.72rem' }}>
                        ERROR: {errorMsg}
                    </p>
                )}

                {/* Actions */}
                <div className="flex gap-3 px-6 pb-6">
                    <button
                        onClick={handleDecline}
                        disabled={status === 'submitting'}
                        className="flex-1 mono-small py-3"
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: 'var(--signal, #e8e8e8)',
                            cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                            letterSpacing: '0.08em',
                        }}
                    >
                        DECLINE — CANCEL
                    </button>

                    <button
                        onClick={handleAccept}
                        disabled={!scrolledToBottom || status === 'submitting' || !user}
                        className="flex-1 mono-small py-3"
                        style={{
                            background: scrolledToBottom && status !== 'submitting'
                                ? 'rgba(255,40,40,0.18)'
                                : 'rgba(255,40,40,0.05)',
                            border: '1px solid rgba(255,60,60,0.6)',
                            color: scrolledToBottom ? '#ff4040' : 'rgba(255,60,60,0.3)',
                            cursor: scrolledToBottom && status !== 'submitting' ? 'pointer' : 'not-allowed',
                            letterSpacing: '0.08em',
                            transition: 'all 0.2s',
                        }}
                    >
                        {status === 'submitting'
                            ? 'AUTHORIZING...'
                            : 'I ACCEPT — AUTHORIZE LIVE-FIRE RUN'}
                    </button>
                </div>
            </div>
        </div>
    );
}
