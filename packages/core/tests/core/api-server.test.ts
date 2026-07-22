import { describe, it, expect, vi } from 'vitest';
import { IncomingMessage } from 'node:http';
import { EventEmitter } from 'node:events';
import {
  readBody,
  validateBatteries,
  sanitizeLogValue,
  buildRunPlan,
  checkRateLimit,
} from '../../src/api-server.js';
import { DEFAULT_BATTERIES } from '@armageddon/shared';

// Mock external dependencies before importing api-server helpers
vi.mock('../../src/core/supabase-client.js', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'u1', email: 'test@apex.com' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'owner', organization_id: 'org1' },
        error: null,
      }),
    })),
  })),
}));

function createMockReq(headers: Record<string, string> = {}, remoteAddress = '127.0.0.1'): IncomingMessage {
  const req = new EventEmitter() as unknown as IncomingMessage;
  req.headers = headers;
  req.socket = { remoteAddress } as any;
  req.destroy = vi.fn() as any;
  return req;
}

describe('readBody size limit', () => {
  it('rejects body over 64KB', async () => {
    const req = createMockReq();
    const promise = readBody(req);
    const oversizedChunk = Buffer.alloc(65 * 1024);
    req.emit('data', oversizedChunk);
    await expect(promise).rejects.toThrow('Request body too large');
  });

  it('accepts body under 64KB', async () => {
    const req = createMockReq();
    const promise = readBody(req);
    const validChunk = Buffer.from(JSON.stringify({ test: 'hello' }));
    req.emit('data', validChunk);
    req.emit('end');
    const body = await promise;
    expect(body).toBe('{"test":"hello"}');
  });
});

describe('validateBatteries', () => {
  it('accepts valid battery IDs', () => {
    const res = validateBatteries(['B10', 'B11']);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.batteries).toContain('B10');
      expect(res.batteries).toContain('B11');
    }
  });

  it('rejects invalid battery IDs', () => {
    const res = validateBatteries(['B99']);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.invalid).toContain('B99');
    }
  });

  it('returns DEFAULT_BATTERIES when empty', () => {
    const res = validateBatteries([]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.batteries).toEqual(DEFAULT_BATTERIES);
    }
  });
});

describe('sanitizeLogValue', () => {
  it('strips CRLF injection', () => {
    const result = sanitizeLogValue('line1\r\nline2');
    expect(result).not.toContain('\n');
    expect(result).not.toContain('\r');
  });

  it('strips DEL character', () => {
    const result = sanitizeLogValue('hello\x7Fworld');
    expect(result).not.toContain('\x7F');
  });
});

describe('buildRunPlan', () => {
  it('sets FREE tier in SIM_MODE', () => {
    const originalSimMode = process.env.SIM_MODE;
    process.env.SIM_MODE = 'true';
    const plan = buildRunPlan('org1', 'run1', 7, 'certified', undefined);
    expect(plan.tier).toBe('FREE');
    process.env.SIM_MODE = originalSimMode;
  });

  it('sets CERTIFIED tier for certified orgs outside SIM_MODE', () => {
    const originalSimMode = process.env.SIM_MODE;
    delete process.env.SIM_MODE;
    const plan = buildRunPlan('org1', 'run1', 7, 'certified', undefined);
    expect(plan.tier).toBe('CERTIFIED');
    process.env.SIM_MODE = originalSimMode;
  });

  it('defaults to 10000 iterations for L7 certified runs', () => {
    const originalSimMode = process.env.SIM_MODE;
    delete process.env.SIM_MODE;
    const plan = buildRunPlan('org1', 'run1', 7, 'certified', undefined);
    expect(plan.iterations).toBe(10000);
    process.env.SIM_MODE = originalSimMode;
  });
});

describe('checkRateLimit', () => {
  it('allows requests under limit', () => {
    const req = createMockReq({}, `192.168.1.${Math.floor(Math.random() * 200) + 10}`);
    expect(checkRateLimit(req)).toBe(true);
  });

  it('blocks requests over limit', () => {
    const ip = `10.99.99.${Math.floor(Math.random() * 200) + 10}`;
    const req = createMockReq({}, ip);
    for (let i = 0; i < 30; i++) {
      checkRateLimit(req);
    }
    expect(checkRateLimit(req)).toBe(false);
  });
});
