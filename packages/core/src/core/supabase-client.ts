import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import { WebSocket } from 'undici';

type RealtimeTransport = NonNullable<NonNullable<SupabaseClientOptions<'public'>['realtime']>['transport']>;

const supabaseOptions: SupabaseClientOptions<'public'> = {
    auth: { persistSession: false },
    realtime: { transport: WebSocket as unknown as RealtimeTransport },
};

/**
 * HTTP header values cannot contain control characters. The recurring failure
 * mode in practice is a multi-line .env block pasted into a single dashboard
 * field, which silently appends the *next* line's `KEY=value` onto this one
 * (e.g. `SUPABASE_SERVICE_ROLE_KEY` ends up containing an embedded newline
 * followed by literal `SUPABASE_ANON_KEY=...` text). Left unchecked, that
 * throws an opaque `Headers.set: invalid header value` on every fetch call —
 * including inside a polling loop that repeats the failure (and re-logs both
 * raw keys) every few seconds. Fail once, loudly, and specifically instead,
 * without ever printing the value itself.
 */
function assertSingleLineHeaderValue(name: string, value: string): void {
    const badIndex = value.search(/[\r\n]/);
    if (badIndex !== -1) {
        throw new Error(
            `[supabase-client] ${name} contains an embedded newline at character ${badIndex} — this is almost ` +
            `always a multi-line .env paste landing in a single environment variable (e.g. the next line's ` +
            `"KEY=value" got appended to this one). Re-enter ${name} in the deployment dashboard as a single-line ` +
            `value. (Received length: ${value.length} chars.)`
        );
    }
}

/**
 * Build a Supabase client that is safe in both Node.js 20 and Node.js 22+.
 *
 * supabase-js initializes the Realtime client at construction time. Node.js 22
 * has a native WebSocket, but Node.js 20 does not. The core worker/api-server
 * only use PostgREST/Auth here, yet construction still needs a transport.
 */
export function createServerSupabaseClient(url: string, key: string): SupabaseClient {
    const trimmedUrl = url.trim();
    const trimmedKey = key.trim();
    assertSingleLineHeaderValue('SUPABASE_URL', trimmedUrl);
    assertSingleLineHeaderValue('the Supabase key (service-role or anon)', trimmedKey);
    return createClient(trimmedUrl, trimmedKey, supabaseOptions);
}
