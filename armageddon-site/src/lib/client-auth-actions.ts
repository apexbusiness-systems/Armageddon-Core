import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthOrigin } from './auth-origin';

const AUTH_PROVIDER = 'github' as const;

export async function startGithubOAuth(sb: SupabaseClient, logPrefix: string): Promise<void> {
    try {
        const { error } = await sb.auth.signInWithOAuth({
            provider: AUTH_PROVIDER,
            options: {
                // Redirect to /auth/callback so the callback page handles token exchange.
                // getAuthOrigin() always returns https://armageddontest.icu in production,
                // blocking any localhost value from propagating into email/OAuth redirect URLs.
                redirectTo: `${getAuthOrigin()}/auth/callback`,
            },
        });

        if (error) {
            console.error(`${logPrefix} error:`, error);
        }
    } catch (error) {
        console.error(`Failed to initiate ${logPrefix.toLowerCase()}:`, error);
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
