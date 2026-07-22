/**
 * Regression shield for Active-Run Self-Sustain (execution-plane warmth).
 *
 * A free-tier web service's idle timer watches inbound HTTP, not CPU, so a
 * long multi-battery run with no inbound traffic gets its host killed mid-run
 * (observed on production run 6d608387: B10-B13 each retried ~10 min apart).
 * While work is in flight the service self-pings its own public URL to reset
 * that timer; when idle it goes quiet so the free tier can still sleep and
 * conserve monthly hours. `shouldSelfSustain` is the pure gate for that.
 */
import { describe, expect, it } from 'vitest';
import { shouldSelfSustain } from '../../src/api-server';

describe('shouldSelfSustain — active-run self-sustain gate', () => {
    const URL = 'https://armageddon-exec-api.onrender.com';

    it('pings only when there is active work AND a valid external URL', () => {
        expect(shouldSelfSustain(URL, true)).toBe(true);
    });

    it('never pings when no work is in flight (lets the free service sleep)', () => {
        expect(shouldSelfSustain(URL, false)).toBe(false);
    });

    it('never pings without a configured external URL (local/dev / non-Render host)', () => {
        expect(shouldSelfSustain(undefined, true)).toBe(false);
        expect(shouldSelfSustain('', true)).toBe(false);
        expect(shouldSelfSustain('   ', true)).toBe(false);
    });

    it('never pings a non-http(s) URL', () => {
        expect(shouldSelfSustain('file:///x', true)).toBe(false);
        expect(shouldSelfSustain('ftp://host', true)).toBe(false);
    });
});
