/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUPABASE CLIENT (CLIENT-SIDE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Shared Supabase client for client-side authentication and data access.
 * Uses lazy initialization pattern with singleton to avoid multiple instances.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

    // Check for required environment variables
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        console.warn('Supabase environment variables not configured');
        return null;
    }

    // Initialize and cache the client
    supabaseClient = createClient(url, anonKey);

    return supabaseClient;
}
