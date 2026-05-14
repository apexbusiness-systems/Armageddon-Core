import type { SupabaseClient } from '@supabase/supabase-js';

const AUTH_PROVIDER = 'github' as const;

export async function startGithubOAuth(sb: SupabaseClient, logPrefix: string): Promise<void> {
    try {
        const { error } = await sb.auth.signInWithOAuth({
            provider: AUTH_PROVIDER,
            options: {
                // Runtime origin keeps preview, local, and production callbacks aligned.
                redirectTo: `${globalThis.location.origin}/`,
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
