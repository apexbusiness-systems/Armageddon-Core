import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SafetyGuard, SystemLockdownError } from '../../src/core/safety';

describe('SafetyGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    SafetyGuard.resetForTesting();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should enforce SIM_MODE=true', () => {
    process.env.SIM_MODE = 'false';
    process.env.SANDBOX_TENANT = 'test-tenant';
    const guard = SafetyGuard.getInstance();

    expect(() => guard.enforce('test')).toThrow(SystemLockdownError);
    expect(() => guard.enforce('test')).toThrow(/SIM_MODE/);
  });

  it('should pass when SIM_MODE=true and valid SANDBOX_TENANT', () => {
    process.env.SIM_MODE = 'true';
    process.env.SANDBOX_TENANT = 'test-tenant-123';
    const guard = SafetyGuard.getInstance();

    expect(() => guard.enforce('test')).not.toThrow();
  });

  it('should fail if SANDBOX_TENANT is missing', () => {
    process.env.SIM_MODE = 'true';
    delete process.env.SANDBOX_TENANT;
    const guard = SafetyGuard.getInstance();

    expect(() => guard.enforce('test')).toThrow(SystemLockdownError);
    expect(() => guard.enforce('test')).toThrow(/SANDBOX_TENANT not defined/);
  });

  it('should fail if SANDBOX_TENANT matches production patterns', () => {
    process.env.SIM_MODE = 'true';
    process.env.SANDBOX_TENANT = 'my-app.com';
    const guard = SafetyGuard.getInstance();

    expect(() => guard.enforce('test')).toThrow(SystemLockdownError);
    expect(() => guard.enforce('test')).toThrow(/matches production pattern/);
  });

  it('should validate target URLs', () => {
    const guard = SafetyGuard.getInstance();
    expect(() => guard.validateTarget('https://api.prod.com')).toThrow(SystemLockdownError);
    expect(() => guard.validateTarget('https://live-api.com')).toThrow(SystemLockdownError);
    expect(() => guard.validateTarget('https://test-server.dev')).not.toThrow();
  });

  it('should return correct status', () => {
    process.env.SIM_MODE = 'true';
    process.env.SANDBOX_TENANT = 'test-tenant';
    const guard = SafetyGuard.getInstance();

    const status = guard.getStatus();
    expect(status.simMode).toBe(true);
    expect(status.sandboxTenant).toBe('test-tenant');
    expect(status.enforced).toBe(true);
  });
});
