'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

type CallbackState =
    | { readonly kind: 'working' }
    | { readonly kind: 'error'; readonly message: string }
    | { readonly kind: 'success' };

function readOAuthError(): string | null {
    if (typeof window === 'undefined') return null;
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const description = search.get('error_description') ?? hash.get('error_description');
    const code = search.get('error') ?? hash.get('error');
    if (description) return description;
    if (code) return code;
    return null;
}

/**
 * Static-export-compatible auth callback. Handles two Supabase flows:
 *
 * 1. PKCE flow (recommended): Supabase appends `?code=<code>` to the redirect URL.
 *    We call exchangeCodeForSession() to trade it for a session. This is the secure
 *    path — no tokens in the URL hash.
 *
 * 2. Implicit flow (legacy / email verification): Supabase appends
 *    `#access_token=<token>&...` to the redirect URL. getSession() picks this up
 *    automatically from the hash.
 *
 * GUARDRAIL: getAuthOrigin() always returns https://armageddontest.icu in production,
 * so neither flow can redirect to localhost regardless of Supabase Site URL config.
 */
export default function AuthCallbackPage() {
    const router = useRouter();
    const [state, setState] = useState<CallbackState>({ kind: 'working' });

    useEffect(() => {
        let cancelled = false;
        const resolveCallback = async () => {
            const oauthError = readOAuthError();
            if (oauthError) {
                if (!cancelled) setState({ kind: 'error', message: oauthError });
                return;
            }

            const sb = getSupabase();
            if (!sb) {
                if (!cancelled) {
                    setState({ kind: 'error', message: 'Authentication is not configured on this deployment.' });
                }
                return;
            }
            try {
                // PKCE flow: exchange the one-time code for a session.
                // This must run before getSession() so the session is established.
                const pkceCode = new URLSearchParams(window.location.search).get('code');
                if (pkceCode) {
                    const { error: exchangeError } = await sb.auth.exchangeCodeForSession(pkceCode);
                    if (exchangeError) {
                        if (!cancelled) setState({ kind: 'error', message: exchangeError.message });
                        return;
                    }
                }

                if (cancelled) return;

                // Implicit flow / post-exchange: confirm session exists.
                const { data } = await sb.auth.getSession();
                if (cancelled) return;
                if (data.session) {
                    setState({ kind: 'success' });
                    router.replace('/console');
                } else {
                    setState({ kind: 'error', message: 'No active session was returned. Please sign in again.' });
                }
            } catch {
                if (!cancelled) {
                    setState({ kind: 'error', message: 'Could not complete sign-in. Please try again.' });
                }
            }
        };

        void resolveCallback();
        return () => {
            cancelled = true;
        };
    }, [router]);

    return (
        <main className="min-h-screen bg-[var(--void)] text-[var(--signal)] flex items-center justify-center p-6">
            <div className="max-w-md w-full border border-white/10 bg-black/70 rounded-sm p-8 text-center">
                <p className="mono-small text-[var(--aerospace)] tracking-[0.3em] mb-4">ARMAGEDDON // AUTH</p>

                {state.kind === 'working' && (
                    <p className="text-signal/80 mono-data">Completing sign-in…</p>
                )}

                {state.kind === 'success' && (
                    <p className="text-[var(--safe)] mono-data">Signed in. Redirecting to your console…</p>
                )}

                {state.kind === 'error' && (
                    <>
                        <h1 className="text-xl text-signal mb-3 mono-data tracking-wider">Sign-in could not complete</h1>
                        <p className="text-signal/70 text-sm mb-6 break-words">{state.message}</p>
                        <div className="flex flex-col gap-3">
                            <Link
                                href="/"
                                className="btn-primary w-full text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                            >
                                Return to sign in
                            </Link>
                            <Link
                                href="/pricing"
                                className="mono-small text-[var(--aerospace)] hover:text-white underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                            >
                                View pricing
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
