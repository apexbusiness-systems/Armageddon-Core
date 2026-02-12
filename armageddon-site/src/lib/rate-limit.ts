/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON LEVEL 7 — RATE LIMITER UTILITY
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface RateLimitConfig {
    intervalMs: number;
    limit: number;
}

/**
 * Simple in-memory rate limiter using a fixed-window/token-bucket hybrid approach.
 * Note: In a serverless environment (like Vercel), this will be local to the
 * warm lambda instance. For global rate limiting across all instances,
 * a persistent store like Redis would be required.
 */
export class RateLimiter {
    private cache: Map<string, number[]>;
    private intervalMs: number;
    private limit: number;

    constructor(config: RateLimitConfig) {
        this.cache = new Map();
        this.intervalMs = config.intervalMs;
        this.limit = config.limit;
    }

    /**
     * Check if a token (e.g., IP or Org ID) has exceeded the rate limit.
     * @param token The unique identifier for the request source.
     * @returns boolean - true if the request is allowed, false if rate limited.
     */
    check(token: string): boolean {
        const now = Date.now();
        const windowStart = now - this.intervalMs;

        // Get existing timestamps for this token
        let timestamps = this.cache.get(token) || [];

        // Remove timestamps outside the current window
        timestamps = timestamps.filter(t => t > windowStart);

        // Check if limit exceeded
        if (timestamps.length >= this.limit) {
            return false;
        }

        // Add current timestamp and update cache
        timestamps.push(now);
        this.cache.set(token, timestamps);

        return true;
    }

    /**
     * Optional: Clear the entire cache.
     */
    reset(): void {
        this.cache.clear();
    }

    /**
     * Prune old entries from the cache to prevent memory leaks.
     * Should be called periodically or when the cache grows too large.
     */
    prune(): void {
        const now = Date.now();
        const windowStart = now - this.intervalMs;

        for (const [token, timestamps] of this.cache.entries()) {
            const recent = timestamps.filter(t => t > windowStart);
            if (recent.length === 0) {
                this.cache.delete(token);
            } else {
                this.cache.set(token, recent);
            }
        }
    }
}
