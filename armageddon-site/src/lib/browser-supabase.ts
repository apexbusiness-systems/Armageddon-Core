import { getSupabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export function getRequiredSupabase(errorMessage: string): SupabaseClient | null {
    const sb = getSupabase();
    if (!sb) {
        console.error(errorMessage);
        return null;
    }

    return sb;
}
