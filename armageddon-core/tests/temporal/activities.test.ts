import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { runBattery5_FullUnit } from '../../src/temporal/activities';
import { execFile } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    })),
  })),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn((file, args, options, callback) => {
    if (callback) {
      callback(null, JSON.stringify({ numPassedTests: 5 }), '');
    }
  }),
}));

vi.mock('../../src/core/safety', () => ({
  safetyGuard: {
    enforce: vi.fn(),
  },
  SafetyGuard: {
    getInstance: vi.fn(),
    resetForTesting: vi.fn(),
  },
  SystemLockdownError: class extends Error {},
}));

describe('runBattery5_FullUnit', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
        ...originalEnv,
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should call execFile with absolute npm path (or cmd.exe on Windows) when tier is FREE', async () => {
    const config = {
      runId: 'test-run',
      iterations: 1,
      tier: 'FREE' as const,
    };

    await runBattery5_FullUnit(config);

    expect(execFile).toHaveBeenCalled();
    const firstCall = (execFile as Mock).mock.calls[0];
    const isWin = os.platform() === 'win32';

    if (isWin) {
        expect(firstCall[0]).toBe('C:\\Windows\\System32\\cmd.exe');
        expect(firstCall[1]).toContain('/c');
        expect(firstCall[1][1]).toContain('npm.cmd');
    } else {
        const expectedNpm = path.join(path.dirname(process.execPath), 'npm');
        expect(firstCall[0]).toBe(expectedNpm);
        expect(firstCall[1]).toEqual(['run', 'test', '--', '--reporter=json']);
    }
    expect(firstCall[2].shell).toBe(false);
  });

  it('should call execFile with absolute docker path when tier is CERTIFIED', async () => {
    const config = {
      runId: 'test-run',
      iterations: 1,
      tier: 'CERTIFIED' as const,
    };

    await runBattery5_FullUnit(config);

    expect(execFile).toHaveBeenCalled();
    const firstCall = (execFile as Mock).mock.calls[0];
    const isWin = os.platform() === 'win32';
    const expectedDocker = isWin ? 'docker.exe' : '/usr/bin/docker';

    expect(firstCall[0]).toBe(expectedDocker);
    expect(firstCall[1]).toContain('run');
    expect(firstCall[1]).toContain('--rm');
    expect(firstCall[2].shell).toBe(false);
  });
});
