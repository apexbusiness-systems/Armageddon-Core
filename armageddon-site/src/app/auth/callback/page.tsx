'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

type CallbackState =
    | { readonly kind: 'working' }
    | { readonly kind: 'error'; readonly message: string }
    | { readonly kind: 'success' };

function readOAuthError(): string | null {
    if (globalThis.window === undefined) return null;
    const search = new URLSearchParams(globalThis.location.search);
    const hash = new URLSearchParams(globalThis.location.hash.replace(/^#/, ''));
    const description = search.get('error_description') ?? hash.get('error_description');
    const code = search.get('error') ?? hash.get('error');
    return description ?? code ?? null;
}

/**
 * PKCE flow: Supabase appends `?code=<code>` to the redirect. Exchange it for a
 * session. Returns an error message, or null when there was no code / it succeeded.
 */
async function exchangePkceCodeIfPresent(sb: SupabaseClient): Promise<string | null> {
    const code = new URLSearchParams(globalThis.location.search).get('code');
    if (!code) return null;
    const { error } = await sb.auth.exchangeCodeForSession(code);
    return error ? error.message : null;
}

/**
 * Pure resolver for the terminal callback state. Kept free of React so the effect
 * stays trivial and the branching cost stays low. Handles both Supabase flows:
 * PKCE (`?code=`) and implicit/email (`#access_token=`, picked up by getSession()).
 *
 * GUARDRAIL: getAuthOrigin() always returns https://armageddontest.icu in production,
 * so neither flow can redirect to localhost regardless of Supabase Site URL config.
 */
async function resolveCallbackState(): Promise<CallbackState> {
    const oauthError = readOAuthError();
    if (oauthError) return { kind: 'error', message: oauthError };

    const sb = getSupabase();
    if (!sb) return { kind: 'error', message: 'Authentication is not configured on this deployment.' };

    try {
        const exchangeError = await exchangePkceCodeIfPresent(sb);
        if (exchangeError) return { kind: 'error', message: exchangeError };

        const { data } = await sb.auth.getSession();
        if (data.session) return { kind: 'success' };
        return { kind: 'error', message: 'No active session was returned. Please sign in again.' };
    } catch {
        return { kind: 'error', message: 'Could not complete sign-in. Please try again.' };
    }
}

/**
 * Static-export-compatible auth callback. There is no server route handler in a
 * static export, so session detection happens client-side.
 */
export default function AuthCallbackPage() {
    const router = useRouter();
    const [state, setState] = useState<CallbackState>({ kind: 'working' });

    useEffect(() => {
        let cancelled = false;
        void resolveCallbackState().then((next) => {
            if (cancelled) return;
            setState(next);
            if (next.kind === 'success') router.replace('/console');
        });
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
