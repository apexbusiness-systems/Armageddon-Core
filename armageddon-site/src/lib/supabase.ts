/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUPABASE CLIENT (CLIENT-SIDE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Shared Supabase client for client-side authentication and data access.
 * Uses lazy initialization pattern with singleton to avoid multiple instances.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cleanEnvValue } from '@armageddon/shared';

// Singleton instance
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client instance
 * Returns null if not in browser environment or if environment variables are missing
 */
export function getSupabase(): SupabaseClient | null {
    // Only initialize in browser environment
    if (globalThis.window === undefined) return null;

    // Return existing instance if already initialized
    if (supabaseClient) return supabaseClient;

    // Check for required environment variables (literal access keeps the
    // NEXT_PUBLIC_* values inlinable in the client bundle; cleanEnvValue
    // strips stray quotes/whitespace from dashboard-pasted values)
    const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const anonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (!url || !anonKey) {
        console.warn('Supabase environment variables not configured');
        return null;
    }

    // Guardrail: a localhost Supabase URL in a non-localhost browser means the
    // project's NEXT_PUBLIC_SUPABASE_URL env var was never set for production.
    // Verification emails will redirect to localhost — fail loudly so it's caught.
    try {
        const parsed = new URL(url);
        const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        const browserIsProduction = globalThis.window !== undefined &&
            globalThis.window.location.hostname !== 'localhost' &&
            globalThis.window.location.hostname !== '127.0.0.1';
        if (isLocalhost && browserIsProduction) {
            console.error(
                '[Supabase] CONFIGURATION ERROR: NEXT_PUBLIC_SUPABASE_URL points to localhost ' +
                'but the browser is on a production domain. ' +
                'Set NEXT_PUBLIC_SUPABASE_URL to your Supabase project URL and update ' +
                'the Supabase dashboard Site URL to https://armageddontest.icu.'
            );
            return null;
        }
    } catch {
        console.warn('[Supabase] Could not parse NEXT_PUBLIC_SUPABASE_URL');
    }

    // Initialize and cache the client
    supabaseClient = createClient(url, anonKey);

    return supabaseClient;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUPABASE SERVICE ROLE CLIENT (SERVER-SIDE ONLY)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ SECURITY WARNING: Service role key bypasses RLS policies.
 * Use ONLY in server-side API routes. Never expose to client.
 */

let cachedSupabaseServiceRole: SupabaseClient | null = null;

/**
 * Get Supabase client with service role privileges.
 *
 * **Security**: Throws error if called in browser context.
 * **Use Cases**: Admin operations, bypassing RLS, service-to-service calls.
 *
 * @throws Error if called in browser or missing credentials
 * @returns SupabaseClient with service role access
 *
 * @example
 * ```typescript
 * const supabase = getSupabaseServiceRole();
 * await supabase.from('armageddon_runs').insert({...});
 * ```
 */
export function getSupabaseServiceRole(): SupabaseClient {
    // Security: Prevent browser usage
    if (typeof window !== 'undefined') {
        throw new Error(
            '[SECURITY] getSupabaseServiceRole() cannot be called in browser context. ' +
            'This would expose the service role key to clients.'
        );
    }

    // Return cached instance
    if (cachedSupabaseServiceRole) {
        return cachedSupabaseServiceRole;
    }

    // Get credentials
    const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? cleanEnvValue(process.env.SUPABASE_URL);
    const key = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!url || !key) {
        throw new Error(
            'Missing Supabase service role credentials. ' +
            'Required: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
        );
    }

    // Initialize and cache
    cachedSupabaseServiceRole = createClient(url, key, {
        auth: { persistSession: false },
    });

    console.log('[Supabase] Service role client initialized');
    return cachedSupabaseServiceRole;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUPABASE ANON CLIENT (SERVER-SIDE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * For token verification and operations that should respect RLS.
 */

let cachedSupabaseAnon: SupabaseClient | null = null;

/**
 * Get Supabase client with anon key (for server-side token verification).
 *
 * **Use Cases**: JWT verification, user authentication checks, RLS-compliant queries.
 *
 * @throws Error if missing credentials
 * @returns SupabaseClient with anon key
 *
 * @example
 * ```typescript
 * const supabase = getSupabaseAnon();
 * const { data: { user } } = await supabase.auth.getUser(token);
 * ```
 */
export function getSupabaseAnon(): SupabaseClient {
    // Return cached instance
    if (cachedSupabaseAnon) {
        return cachedSupabaseAnon;
    }

    // Get credentials
    const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const key = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (!url || !key) {
        throw new Error(
            'Missing Supabase anon credentials. ' +
            'Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
        );
    }

    // Initialize and cache
    cachedSupabaseAnon = createClient(url, key, {
        auth: { persistSession: false },
    });

    console.log('[Supabase] Anon client initialized (server-side)');
    return cachedSupabaseAnon;
}

/**
 * Reset all Supabase client singletons (for testing only).
 * @internal
 */
export function __resetSupabaseClients(): void {
    supabaseClient = null;
    cachedSupabaseServiceRole = null;
    cachedSupabaseAnon = null;
}
