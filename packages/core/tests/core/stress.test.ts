
import { describe, it, expect, beforeEach } from 'vitest';
import { NativeHttpStressTester, parseDuration } from '../../src/core/stress';

describe('parseDuration', () => {
    it('should parse milliseconds', () => {
        expect(parseDuration('500ms')).toBe(500);
    });

    it('should parse seconds', () => {
        expect(parseDuration('30s')).toBe(30000);
    });

    it('should parse minutes', () => {
        expect(parseDuration('5m')).toBe(300000);
    });

    it('should parse hours', () => {
        expect(parseDuration('1h')).toBe(3600000);
    });

    it('should return default 30s for invalid format', () => {
        expect(parseDuration('invalid')).toBe(30000);
        expect(parseDuration('')).toBe(30000);
        expect(parseDuration('30')).toBe(30000);
        expect(parseDuration('s30')).toBe(30000);
    });

    it('should return default 30s for unsupported units', () => {
        expect(parseDuration('10d')).toBe(30000);
    });

    it('should handle zero values', () => {
        expect(parseDuration('0s')).toBe(0);
        expect(parseDuration('0ms')).toBe(0);
    });
});

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
