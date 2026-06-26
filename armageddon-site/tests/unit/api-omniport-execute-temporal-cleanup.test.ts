import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/omniport', () => ({
    guardOmniPort: vi.fn(() => null),
    parseOmniPortBody: vi.fn(async () => ({ organizationId: 'org-1', level: 7, iterations: 100, batteries: ['B10'], targetUrl: 'https://example.com' })),
    deriveRunSeed: vi.fn(() => 123),
    isOmniPortEnabled: vi.fn(() => true),
    persistTelemetryEvent: vi.fn(),
    OmniPortExecuteRequestSchema: {},
}));
vi.mock('@/lib/temporal', () => ({ getTemporalClient: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSupabaseServiceRole: vi.fn() }));

import { getSupabaseServiceRole } from '@/lib/supabase';
import { getTemporalClient } from '@/lib/temporal';
import { POST } from '@/app/api/omniport/execute/route';

const updates: unknown[] = [];
function makeSupabase() {
    return {
        from: vi.fn(() => ({
            insert: vi.fn(async () => ({ error: null })),
            update: vi.fn((payload: unknown) => { updates.push(payload); return { eq: vi.fn(async () => ({ error: null })) }; }),
        })),
    };
}
const req = () => new NextRequest('http://localhost:3000/api/omniport/execute', { method: 'POST' });

beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
    (getSupabaseServiceRole as any).mockReturnValue(makeSupabase());
});

describe('POST /api/omniport/execute temporal cleanup', () => {
    it('marks inserted run failed when getTemporalClient throws', async () => {
        (getTemporalClient as any).mockRejectedValueOnce(new Error('down'));

        const res = await POST(req());
        const data = await res.json();

        expect(res.status).toBe(503);
        expect(data.code).toBe('TEMPORAL_UNAVAILABLE');
        expect(updates).toContainEqual({ status: 'failed' });
    });
});
