import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthOrigin } from './auth-origin';

const AUTH_PROVIDER = 'github' as const;

/**
 * Discriminated result for every credential action so the UI can render precise,
 * honest copy instead of a generic failure. `notice` carries a non-error message
 * (e.g. "check your email") that should be shown as an info state, not an error.
 */
export type AuthResult =
    | { readonly ok: true; readonly notice?: string }
    | { readonly ok: false; readonly message: string };

/** The canonical post-auth landing target. getAuthOrigin() is localhost-proof. */
function callbackUrl(): string {
    return `${getAuthOrigin()}/auth/callback`;
}

/**
 * Email + password sign-in. This is the primary production path: it asks for
 * real credentials and returns a session immediately (no email round-trip, no
 * dependency on the GitHub OAuth provider exchange).
 */
export async function signInWithEmail(
    sb: SupabaseClient,
    email: string,
    password: string,
): Promise<AuthResult> {
    try {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, message: error.message };
        return { ok: true };
    } catch (err) {
        return { ok: false, message: (err as Error).message ?? 'Sign-in failed. Please try again.' };
    }
}

/**
 * Email + password sign-up. Supabase sends a confirmation email whose link
 * points at emailRedirectTo — pinned to the canonical /auth/callback so the
 * verification link can never resolve to localhost.
 */
export async function signUpWithEmail(
    sb: SupabaseClient,
    email: string,
    password: string,
): Promise<AuthResult> {
    try {
        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: callbackUrl() },
        });
        if (error) return { ok: false, message: error.message };
        // When email confirmation is required, there is no session yet.
        if (!data.session) {
            return { ok: true, notice: 'Account created. Check your email to confirm, then sign in.' };
        }
        return { ok: true };
    } catch (err) {
        return { ok: false, message: (err as Error).message ?? 'Sign-up failed. Please try again.' };
    }
}

/**
 * Passwordless magic-link sign-in. The link points at the canonical
 * /auth/callback. Used as a recovery / no-password option.
 */
export async function signInWithMagicLink(sb: SupabaseClient, email: string): Promise<AuthResult> {
    try {
        const { error } = await sb.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: callbackUrl() },
        });
        if (error) return { ok: false, message: error.message };
        return { ok: true, notice: 'Magic link sent. Check your email to finish signing in.' };
    } catch (err) {
        return { ok: false, message: (err as Error).message ?? 'Could not send magic link. Please try again.' };
    }
}

export async function startGithubOAuth(sb: SupabaseClient, logPrefix: string): Promise<AuthResult> {
    try {
        const { error } = await sb.auth.signInWithOAuth({
            provider: AUTH_PROVIDER,
            options: {
                // Redirect to /auth/callback so the callback page handles token exchange.
                // getAuthOrigin() always returns https://armageddontest.icu in production,
                // blocking any localhost value from propagating into OAuth redirect URLs.
                redirectTo: callbackUrl(),
            },
        });

        if (error) {
            console.error(`${logPrefix} error:`, error);
            return { ok: false, message: error.message };
        }
        return { ok: true };
    } catch (error) {
        console.error(`Failed to initiate ${logPrefix.toLowerCase()}:`, error);
        return { ok: false, message: (error as Error).message ?? 'Could not start GitHub sign-in.' };
    }
}

export async function endSupabaseSession(sb: SupabaseClient): Promise<void> {
    try {
        const { error } = await sb.auth.signOut();
        if (error) {
            console.error('Logout error:', error);
        }
    } catch (error) {
        console.error('Failed to logout:', error);
    }
}
