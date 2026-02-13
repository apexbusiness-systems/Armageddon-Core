/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UNIT TESTS: Client Singletons
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    getSupabase,
    getSupabaseServiceRole,
    getSupabaseAnon,
    __resetSupabaseClients
} from '../../../src/lib/supabase';
import { getTemporalClient, __resetTemporalClient } from '../../../src/lib/temporal';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════

const mocks = vi.hoisted(() => {
    return {
        connect: vi.fn().mockResolvedValue({}),
        Client: vi.fn().mockImplementation(function() { return {}; }),
    };
});

vi.mock('@temporalio/client', () => ({
    Connection: {
        connect: mocks.connect,
    },
    Client: mocks.Client,
}));

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════

beforeEach(() => {
    __resetSupabaseClients();
    __resetTemporalClient();

    // Clear mocks
    mocks.connect.mockClear();
    mocks.Client.mockClear();

    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.TEMPORAL_ADDRESS = 'localhost:7233';
    process.env.TEMPORAL_NAMESPACE = 'test';
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Supabase Client Singletons', () => {
    describe('getSupabase (client-side)', () => {
        test('returns null when not in browser', () => {
            const client = getSupabase();
            expect(client).toBeNull();
        });

        test('returns singleton in browser environment', () => {
            // Mock browser environment
            (globalThis as any).window = {};

            const client1 = getSupabase();
            const client2 = getSupabase();

            expect(client1).toBe(client2);
            expect(client1).not.toBeNull();

            // Cleanup
            delete (globalThis as any).window;
        });
    });

    describe('getSupabaseServiceRole', () => {
        test('returns singleton instance', () => {
            const client1 = getSupabaseServiceRole();
            const client2 = getSupabaseServiceRole();

            expect(client1).toBe(client2);
            expect(client1).toBeTruthy();
        });

        test('throws when called in browser context', () => {
            // Mock browser environment
            (globalThis as any).window = {};

            expect(() => getSupabaseServiceRole()).toThrow(/browser context/i);

            // Cleanup
            delete (globalThis as any).window;
        });

        test('throws when credentials are missing', () => {
            delete process.env.SUPABASE_SERVICE_ROLE_KEY;
            __resetSupabaseClients();

            expect(() => getSupabaseServiceRole()).toThrow(/missing.*credentials/i);
        });
    });

    describe('getSupabaseAnon', () => {
        test('returns singleton instance', () => {
            const client1 = getSupabaseAnon();
            const client2 = getSupabaseAnon();

            expect(client1).toBe(client2);
            expect(client1).toBeTruthy();
        });

        test('throws when credentials are missing', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            __resetSupabaseClients();

            expect(() => getSupabaseAnon()).toThrow(/missing.*credentials/i);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEMPORAL TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Temporal Client Singleton', () => {
    test('returns singleton instance', async () => {
        const client1 = await getTemporalClient();
        const client2 = await getTemporalClient();

        expect(client1).toBe(client2);
        expect(mocks.Client).toHaveBeenCalledTimes(1);
    });

    test('prevents thundering herd with concurrent calls', async () => {
        // Make 10 concurrent calls
        const promises = Array(10).fill(null).map(() => getTemporalClient());
        const clients = await Promise.all(promises);

        // All should be the same instance
        expect(new Set(clients).size).toBe(1);

        // Connection should only be called once
        expect(mocks.connect).toHaveBeenCalledTimes(1);
    });
});
