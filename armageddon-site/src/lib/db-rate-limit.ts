import { createClient } from '@supabase/supabase-js';

// Requires service role to call the RPC securely
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Missing Supabase credentials for rate limiting');
}

const supabase = createClient(supabaseUrl || 'https://mock.supabase.co', supabaseServiceKey || 'mock-key', {
    auth: { persistSession: false },
});

export interface RateLimitOptions {
    scope: 'ip' | 'org';
    key: string;
    limit: number;
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: string;
}

export async function dbRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
    const now = Date.now();
    // Truncate to the start of the window
    const bucketStartMs = now - (now % options.windowMs);
    const bucketStart = new Date(bucketStartMs).toISOString();
    const expiresAt = new Date(bucketStartMs + options.windowMs).toISOString();

    try {
        const { data, error } = await supabase.rpc('increment_rate_limit', {
            p_scope: options.scope,
            p_key: options.key,
            p_bucket_start: bucketStart,
            p_limit_count: options.limit,
            p_expires_at: expiresAt,
        });

        if (error) {
            throw error;
        }

        if (data && data.length > 0) {
            return {
                allowed: data[0].allowed,
                remaining: data[0].remaining,
                resetAt: data[0].reset_at,
            };
        }

        throw new Error('No data returned from rate limiter RPC');
    } catch (error) {
        console.error(`[Rate Limiter] Failed to check quota for ${options.scope}:${options.key}`, error);
        
        // Fail closed by default, unless RATE_LIMIT_FAIL_OPEN=true and it's IP scope
        if (options.scope === 'ip' && process.env.RATE_LIMIT_FAIL_OPEN === 'true') {
            console.warn(`[Rate Limiter] Failing OPEN for IP ${options.key} due to RATE_LIMIT_FAIL_OPEN=true`);
            return { allowed: true, remaining: 1, resetAt: expiresAt };
        }
        
        // Fail closed
        return { allowed: false, remaining: 0, resetAt: expiresAt };
    }
}
