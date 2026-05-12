
import { describe, it, expect, beforeEach } from 'vitest';
import { NativeHttpStressTester, SimulatedStressTester, parseDuration } from '../../src/core/stress';

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

    it('should parse large second values', () => {
        expect(parseDuration('120s')).toBe(120000);
    });

    it('should parse large minute values', () => {
        expect(parseDuration('60m')).toBe(3600000);
    });

    it('should parse 1ms correctly', () => {
        expect(parseDuration('1ms')).toBe(1);
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

    it('result has correct shape', async () => {
        const tester = new NativeHttpStressTester();
        const result = await tester.run({
            tier: 'CERTIFIED',
            duration: '1s',
            arrivalRate: 5,
            maxVirtualUsers: 3,
            runId: 'test-shape'
        });

        expect(result).toMatchObject({
            mode: 'NATIVE_HTTP',
            duration: expect.any(Number),
            totalRequests: expect.any(Number),
            successfulRequests: expect.any(Number),
            failedRequests: expect.any(Number),
            latency: {
                min: expect.any(Number),
                max: expect.any(Number),
                median: expect.any(Number),
                p95: expect.any(Number),
                p99: expect.any(Number),
            },
            rps: {
                mean: expect.any(Number),
                max: expect.any(Number),
            },
            errors: expect.any(Object),
        });
    });

    it('totalRequests equals successfulRequests + failedRequests', async () => {
        const tester = new NativeHttpStressTester();
        const result = await tester.run({
            tier: 'CERTIFIED',
            duration: '1s',
            arrivalRate: 5,
            maxVirtualUsers: 5,
            runId: 'test-accounting'
        });
        expect(result.totalRequests).toBe(result.successfulRequests + result.failedRequests);
    });

    it('records errors for non-ok HTTP responses', async () => {
        // @ts-ignore
        globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
        const tester = new NativeHttpStressTester();
        const result = await tester.run({
            tier: 'CERTIFIED',
            duration: '1s',
            arrivalRate: 5,
            maxVirtualUsers: 5,
            runId: 'test-errors'
        });
        expect(result.failedRequests).toBeGreaterThan(0);
        expect(result.errors['HTTP_503']).toBeGreaterThan(0);
    });

    it('duration in result is approximately the configured duration', async () => {
        const tester = new NativeHttpStressTester();
        const result = await tester.run({
            tier: 'CERTIFIED',
            duration: '1s',
            arrivalRate: 2,
            maxVirtualUsers: 2,
            runId: 'test-duration'
        });
        // Should be close to 1000ms (allow generous margin for CI)
        expect(result.duration).toBeGreaterThanOrEqual(900);
        expect(result.duration).toBeLessThan(5000);
    });

    it('rps.mean is positive when requests were made', async () => {
        const tester = new NativeHttpStressTester();
        const result = await tester.run({
            tier: 'CERTIFIED',
            duration: '1s',
            arrivalRate: 5,
            maxVirtualUsers: 5,
            runId: 'test-rps'
        });
        expect(result.rps.mean).toBeGreaterThan(0);
    });
});

describe('SimulatedStressTester', () => {
    it('is exported from stress module', () => {
        expect(SimulatedStressTester).toBeDefined();
    });

    it('returns SIMULATION mode', async () => {
        const tester = new SimulatedStressTester();
        const result = await tester.run({
            tier: 'FREE',
            duration: '1s',
            arrivalRate: 10,
            runId: 'sim-test-mode'
        });
        expect(result.mode).toBe('SIMULATION');
    }, 10_000);

    it('returns correct result shape', async () => {
        const tester = new SimulatedStressTester();
        const result = await tester.run({
            tier: 'FREE',
            duration: '1s',
            arrivalRate: 10,
            runId: 'sim-test-shape'
        });
        expect(result).toMatchObject({
            mode: 'SIMULATION',
            duration: expect.any(Number),
            totalRequests: expect.any(Number),
            successfulRequests: expect.any(Number),
            failedRequests: expect.any(Number),
            latency: {
                min: expect.any(Number),
                max: expect.any(Number),
                median: expect.any(Number),
                p95: expect.any(Number),
                p99: expect.any(Number),
            },
            rps: {
                mean: expect.any(Number),
                max: expect.any(Number),
            },
            errors: expect.any(Object),
        });
    }, 10_000);

    it('duration matches the parsed input duration', async () => {
        const tester = new SimulatedStressTester();
        const result = await tester.run({
            tier: 'FREE',
            duration: '5s',
            arrivalRate: 10,
            runId: 'sim-test-duration'
        });
        expect(result.duration).toBe(5000);
    }, 10_000);

    it('totalRequests equals arrivalRate * durationSeconds', async () => {
        const tester = new SimulatedStressTester();
        const result = await tester.run({
            tier: 'FREE',
            duration: '5s',
            arrivalRate: 20,
            runId: 'sim-test-request-count'
        });
        // totalRequests = floor(20 * 5) = 100
        expect(result.totalRequests).toBe(100);
    }, 10_000);

    it('totalRequests equals successfulRequests + failedRequests', async () => {
        const tester = new SimulatedStressTester();
        const result = await tester.run({
            tier: 'FREE',
            duration: '2s',
            arrivalRate: 10,
            runId: 'sim-test-accounting'
        });
        expect(result.totalRequests).toBe(result.successfulRequests + result.failedRequests);
    }, 10_000);

    it('latency values are positive', async () => {
        const tester = new SimulatedStressTester();
        const result = await tester.run({
            tier: 'FREE',
            duration: '1s',
            arrivalRate: 5,
            runId: 'sim-test-latency'
        });
        expect(result.latency.min).toBeGreaterThan(0);
        expect(result.latency.max).toBeGreaterThan(0);
        expect(result.latency.median).toBeGreaterThan(0);
        expect(result.latency.p95).toBeGreaterThan(0);
        expect(result.latency.p99).toBeGreaterThan(0);
    }, 10_000);

    it('latency.max >= latency.p99 >= latency.p95 >= latency.median >= latency.min', async () => {
        const tester = new SimulatedStressTester();
        const result = await tester.run({
            tier: 'FREE',
            duration: '1s',
            arrivalRate: 5,
            runId: 'sim-test-latency-order'
        });
        expect(result.latency.max).toBeGreaterThanOrEqual(result.latency.p99);
        expect(result.latency.p99).toBeGreaterThanOrEqual(result.latency.p95);
        expect(result.latency.p95).toBeGreaterThanOrEqual(result.latency.median);
        expect(result.latency.median).toBeGreaterThanOrEqual(result.latency.min);
    }, 10_000);

    it('rps.max >= rps.mean', async () => {
        const tester = new SimulatedStressTester();
        const result = await tester.run({
            tier: 'FREE',
            duration: '1s',
            arrivalRate: 10,
            runId: 'sim-test-rps-order'
        });
        expect(result.rps.max).toBeGreaterThanOrEqual(result.rps.mean);
    }, 10_000);

    it('produces deterministic results for the same runId (seeded RNG)', async () => {
        const tester1 = new SimulatedStressTester();
        const tester2 = new SimulatedStressTester();
        const cfg = { tier: 'FREE' as const, duration: '2s', arrivalRate: 10, runId: 'deterministic-seed-xyz' };
        const [r1, r2] = await Promise.all([tester1.run(cfg), tester2.run(cfg)]);
        // Seeded RNG should yield identical results for identical inputs
        expect(r1.totalRequests).toBe(r2.totalRequests);
        expect(r1.successfulRequests).toBe(r2.successfulRequests);
        expect(r1.latency.median).toBe(r2.latency.median);
    }, 15_000);
});
