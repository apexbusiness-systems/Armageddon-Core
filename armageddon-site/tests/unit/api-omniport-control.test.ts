import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const signalMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/omniport', () => ({
    guardOmniPort: vi.fn(() => null),
    OmniPortControlCommandSchema: {},
    parseOmniPortBody: vi.fn(async (request: any) => request.__body),
}));
vi.mock('@/lib/temporal', () => ({
    getTemporalClient: vi.fn(async () => ({
        workflow: { getHandle: () => ({ signal: signalMock }) },
    })),
}));

import { POST } from '@/app/api/omniport/control/route';

function reqWith(body: Record<string, unknown>) {
    const r = new NextRequest('http://localhost:3000/api/omniport/control', { method: 'POST' });
    (r as any).__body = body;
    return r;
}

describe('POST /api/omniport/control', () => {
    beforeEach(() => vi.clearAllMocks());

    // T11
    it('cancel is actionable: delivers the real cancel signal and returns 200', async () => {
        const res = await POST(reqWith({ command: 'cancel', runId: 'run-1' }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.acknowledged).toBe(true);
        expect(data.actionable).toBe(true);
        expect(signalMock).toHaveBeenCalledWith('cancel');
    });

    // T12
    it('unimplemented command is honest: actionable:false with 202', async () => {
        const res = await POST(reqWith({ command: 'pause', runId: 'run-1' }));
        const data = await res.json();
        expect(res.status).toBe(202);
        expect(data.acknowledged).toBe(true);
        expect(data.actionable).toBe(false);
        expect(data.note).toMatch(/not yet implemented/);
    });
});
