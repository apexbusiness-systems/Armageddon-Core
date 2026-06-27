'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import AuthIdentityBadge from './AuthIdentityBadge';
import AuthModal, { type AuthMode } from './AuthModal';
import { useT } from '@/i18n/useT';

interface AuthHeaderProps {
    readonly user: User | null;
    readonly onLogout: () => void;
}

/**
 * Reads an OAuth/auth error from the URL (query string or hash). Supabase appends
 * errors like `?error=server_error&error_description=Unable+to+exchange+external+code`
 * to the redirect target when the provider exchange fails. We surface it instead of
 * leaving the user on a silently-broken page.
 */
function readUrlAuthError(): string | null {
    if (globalThis.window === undefined) return null;
    const search = new URLSearchParams(globalThis.location.search);
    const hash = new URLSearchParams(globalThis.location.hash.replace(/^#/, ''));
    const description = search.get('error_description') ?? hash.get('error_description');
    const code = search.get('error') ?? hash.get('error');
    const detail = description ?? code;
    if (!detail) return null;
    return `Sign-in failed: ${detail}. Try email + password below.`;
}

/** Strip auth error/token params from the URL without a navigation. */
function cleanAuthParamsFromUrl(): void {
    if (globalThis.window === undefined) return;
    const url = new URL(globalThis.location.href);
    let changed = false;
    for (const key of ['error', 'error_code', 'error_description']) {
        if (url.searchParams.has(key)) {
            url.searchParams.delete(key);
            changed = true;
        }
    }
    if (url.hash.includes('error') || url.hash.includes('access_token')) {
        url.hash = '';
        changed = true;
    }
    if (changed) {
        globalThis.history.replaceState({}, '', url.toString());
    }
}

export default function AuthHeader({ user, onLogout }: AuthHeaderProps) {
    const { dictionary } = useT();
    const isLoggedIn = !!user;
    const [hovered, setHovered] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [mode, setMode] = useState<AuthMode>('signin');
    const [initialError, setInitialError] = useState<string | null>(null);

    // On mount: if Supabase bounced back with an OAuth error, open the modal and
    // explain it. Deferred to a microtask so the state change happens after
    // hydration (avoids an SSR/client mismatch) and is never a synchronous
    // setState in the effect body. Mirrors the pattern in onboarding/page.tsx.
    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled || isLoggedIn) return;
            const err = readUrlAuthError();
            if (!err) return;
            setInitialError(err);
            setMode('signin');
            setModalOpen(true);
            cleanAuthParamsFromUrl();
        });
        return () => {
            cancelled = true;
        };
    }, [isLoggedIn]);

    const openModal = useCallback((m: AuthMode) => {
        setInitialError(null);
        setMode(m);
        setModalOpen(true);
    }, []);

    return (
        <>
            <div
                className="fixed top-6 right-6 z-[9999] flex items-center gap-3"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                <Link
                    href="/pricing"
                    className="mono-small tracking-widest uppercase text-[var(--signal-dim)] hover:text-[var(--signal)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)] px-1"
                >
                    {dictionary.common.nav.pricing}
                </Link>
                {isLoggedIn ? (
                    <>
                        <AnimatePresence>
                            {hovered && <AuthIdentityBadge user={user} direction="right" align="right" />}
                        </AnimatePresence>
                        <motion.button
                            type="button"
                            aria-label={dictionary.common.nav.logoutAria}
                            onClick={onLogout}
                            className="relative px-7 py-2.5 border border-[var(--safe)] bg-[var(--safe)]/15 text-[var(--safe)] backdrop-blur-md shadow-[0_0_18px_rgba(0,255,136,0.35)] transition-all duration-300 text-sm tracking-[0.3em] uppercase"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[var(--safe)] animate-pulse" />
                                <span className="mono-small tracking-widest font-bold uppercase">{dictionary.common.nav.logout}</span>
                            </div>
                        </motion.button>
                    </>
                ) : (
                    <>
                        {/* SIGN UP: primary conversion CTA (aerospace fill) */}
                        <motion.button
                            type="button"
                            aria-label={dictionary.common.nav.signupAria}
                            onClick={() => openModal('signup')}
                            className="relative px-6 py-2.5 bg-[var(--aerospace)] text-black font-bold backdrop-blur-md shadow-[0_0_24px_rgba(255,51,0,0.5)] transition-all duration-300 text-sm tracking-[0.3em] uppercase hover:bg-white"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <span className="mono-small tracking-widest font-bold uppercase">{dictionary.common.nav.signup}</span>
                        </motion.button>

                        {/* LOGIN: ghost/outline (safe green, consistent with prior design) */}
                        <motion.button
                            type="button"
                            aria-label={dictionary.common.nav.loginAria}
                            onClick={() => openModal('signin')}
                            className="relative px-6 py-2.5 border border-[var(--safe)] bg-[var(--safe)]/15 text-[var(--safe)] backdrop-blur-md shadow-[0_0_18px_rgba(0,255,136,0.35)] transition-all duration-300 text-sm tracking-[0.3em] uppercase"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
                                <div className="w-full h-[2px] bg-current absolute top-0 animate-[scanline_3s_linear_infinite]" />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[var(--aerospace)] animate-pulse" />
                                <span className="mono-small tracking-widest font-bold uppercase">{dictionary.common.nav.login}</span>
                            </div>
                        </motion.button>
                    </>
                )}
            </div>

            <AuthModal
                open={modalOpen}
                mode={mode}
                initialError={initialError}
                onClose={() => setModalOpen(false)}
                onModeChange={setMode}
            />
        </>
    );
}
