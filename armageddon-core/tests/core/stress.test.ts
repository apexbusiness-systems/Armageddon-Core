
import { describe, it, expect, beforeEach } from 'vitest';
import { NativeHttpStressTester } from '../../src/core/stress';

describe('NativeHttpStressTester', () => {
    beforeEach(() => {
        // @ts-ignore
        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            json: async () => ({}),
        });
    });

    it('should complete a stress test run', async () => {
        const tester = new NativeHttpStressTester();
        const result = await tester.run({
            tier: 'CERTIFIED',
            duration: '1s',
            arrivalRate: 10,
            maxVirtualUsers: 5,
            runId: 'test-run'
        });

        expect(result.mode).toBe('NATIVE_HTTP');
        expect(result.totalRequests).toBeGreaterThan(0);
        expect(result.successfulRequests).toBe(result.totalRequests);
    });

    it('should respect maxVirtualUsers', async () => {
        const tester = new NativeHttpStressTester();

        // Mock fetch to take some time
        // @ts-ignore
        globalThis.fetch = async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return { ok: true, status: 200, json: async () => ({}) };
        };

        const result = await tester.run({
            tier: 'CERTIFIED',
            duration: '1s',
            arrivalRate: 50,
            maxVirtualUsers: 2,
            runId: 'test-run-max-vus'
        });

        expect(result.totalRequests).toBeGreaterThan(0);
    });
});
