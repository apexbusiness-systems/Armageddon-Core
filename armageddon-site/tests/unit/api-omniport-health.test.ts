import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/omniport', () => ({ guardOmniPort: vi.fn(() => null) }));
vi.mock('@/lib/temporal', () => ({ getTemporalClient: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSupabaseServiceRole: vi.fn() }));

import { getTemporalClient } from '@/lib/temporal';
import { getSupabaseServiceRole } from '@/lib/supabase';
import { GET } from '@/app/api/omniport/health/route';

function supabase(error: unknown) {
    return { from: () => ({ select: () => ({ limit: () => Promise.resolve({ error }) }) }) };
}
const req = () => new NextRequest('http://localhost:3000/api/omniport/health');

describe('GET /api/omniport/health', () => {
    beforeEach(() => vi.clearAllMocks());

    // T9
    it('reports operational + 200 only when both Temporal and Supabase are connected', async () => {
        (getTemporalClient as any).mockResolvedValue({});
        (getSupabaseServiceRole as any).mockReturnValue(supabase(null));

        const res = await GET(req());
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.status).toBe('operational');
        expect(data.temporalConnected).toBe(true);
        expect(data.supabaseConnected).toBe(true);
    });

    // T10
    it('reports unavailable + 503 when both dependencies are down', async () => {
        (getTemporalClient as any).mockRejectedValue(new Error('temporal down'));
        (getSupabaseServiceRole as any).mockReturnValue(supabase({ message: 'db down' }));

        const res = await GET(req());
        const data = await res.json();
        expect(res.status).toBe(503);
        expect(data.status).toBe('unavailable');
    });

    it('reports degraded + 207 when exactly one dependency is down', async () => {
        (getTemporalClient as any).mockResolvedValue({});
        (getSupabaseServiceRole as any).mockReturnValue(supabase({ message: 'db down' }));

        const res = await GET(req());
        const data = await res.json();
        expect(res.status).toBe(207);
        expect(data.status).toBe('degraded');
    });
});
