'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mirrors the persisted onboarding draft contract in app/onboarding/page.tsx.
// Read-only here: this panel never writes the draft, it only surfaces it.
const DRAFT_KEY = 'armageddon:onboarding-draft';

interface TargetSummary {
    targetSystemName: string;
    targetUrl: string;
    environment: string;
}

function readTarget(): TargetSummary | null {
    if (globalThis.window === undefined) return null;
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const draft = JSON.parse(raw) as Partial<TargetSummary>;
        const targetUrl = (draft.targetUrl ?? '').trim();
        if (targetUrl === '') return null;
        return {
            targetSystemName: (draft.targetSystemName ?? '').trim() || 'Unnamed target',
            targetUrl,
            environment: (draft.environment ?? 'staging').trim(),
        };
    } catch {
        return null;
    }
}

/**
 * Surfaces the configured run target (URL or repository) on the console, plus a
 * direct path to /onboarding. Resolves the "nowhere to link a repo / no
 * onboarding nudge" gap without touching the run engine. Static-export safe:
 * all browser-state reads are deferred to a microtask after hydration.
 */
export default function TargetConfigPanel() {
    const [target, setTarget] = useState<TargetSummary | null>(null);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const sync = () => {
            if (cancelled) return;
            setTarget(readTarget());
            setHydrated(true);
        };
        queueMicrotask(sync);
        // Reflect edits made in another tab (e.g. user reconfigures in /onboarding).
        globalThis.addEventListener('storage', sync);
        return () => {
            cancelled = true;
            globalThis.removeEventListener('storage', sync);
        };
    }, []);

    // Avoid a hydration flash: render nothing until the client read completes.
    if (!hydrated) return null;

    const configured = target !== null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto w-full max-w-2xl mb-8 text-left"
        >
            <h3 className="mono-data text-signal/70 text-sm mb-3 tracking-wider text-center">
                STEP 1 — TARGET CONFIGURATION
            </h3>

            {configured ? (
                <div className="border border-[var(--safe)]/40 bg-[var(--safe)]/5 rounded-sm p-4 shadow-[0_0_18px_rgba(0,255,136,0.1)]">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-[var(--safe)] animate-pulse shrink-0" />
                            <span className="mono-small tracking-widest text-[var(--safe)] shrink-0">
                                TARGET LOCKED
                            </span>
                            <span className="mono-small text-signal/50 uppercase shrink-0">
                                · {target.environment}
                            </span>
                        </div>
                        <Link
                            href="/onboarding"
                            className="mono-small tracking-widest text-[var(--aerospace)] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                        >
                            EDIT →
                        </Link>
                    </div>
                    <p className="mono-data text-signal text-sm mt-3 truncate">{target.targetSystemName}</p>
                    <p className="mono-small text-signal/60 mt-1 break-all">{target.targetUrl}</p>
                </div>
            ) : (
                <div className="border border-[var(--aerospace)]/50 bg-black/60 rounded-sm p-5 text-center shadow-[0_0_24px_rgba(255,51,0,0.12)]">
                    <p className="mono-small tracking-[0.3em] text-[var(--aerospace)] mb-2">
                        NO TARGET CONFIGURED
                    </p>
                    <p className="mono-data text-signal text-sm">
                        Link the system or repository you are authorized to test.
                    </p>
                    <p className="mono-small text-signal/60 mt-1">
                        A run cannot start until a target URL or repository is set.
                    </p>
                    <Link
                        href="/onboarding"
                        className="btn-primary inline-block mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    >
                        Configure target
                    </Link>
                </div>
            )}
        </motion.div>
    );
}
