/**
 * ═══════════════════════════════════════════════════════════════════════════
 * useAuth HOOK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Custom React hook for managing Supabase authentication state.
 * Handles user session, login state, and auth state changes.
 */

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

/**
 * Hook to manage authentication state
 * Returns the current user or null if not authenticated
 */
export function useAuth(): User | null {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const sb = getSupabase();
        if (!sb) return;

        // Get initial user
        sb.auth.getUser().then(({ data }) => setUser(data.user));

        // Subscribe to auth state changes
        const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        // Cleanup subscription on unmount
        return () => subscription.unsubscribe();
    }, []);

    return user;
}
