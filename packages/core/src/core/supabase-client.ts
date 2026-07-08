import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import { WebSocket } from 'undici';

type RealtimeTransport = NonNullable<NonNullable<SupabaseClientOptions<'public'>['realtime']>['transport']>;

const supabaseOptions: SupabaseClientOptions<'public'> = {
    auth: { persistSession: false },
    realtime: { transport: WebSocket as unknown as RealtimeTransport },
};

/**
 * Build a Supabase client that is safe in both Node.js 20 and Node.js 22+.
 *
 * supabase-js initializes the Realtime client at construction time. Node.js 22
 * has a native WebSocket, but Node.js 20 does not. The core worker/api-server
 * only use PostgREST/Auth here, yet construction still needs a transport.
 */
export function createServerSupabaseClient(url: string, key: string): SupabaseClient {
    return createClient(url, key, supabaseOptions);
}
