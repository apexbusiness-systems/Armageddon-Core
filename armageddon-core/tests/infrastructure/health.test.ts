import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthServer } from '../../src/infrastructure/health';

// Mock safety guard to ensure healthy status
vi.mock('../../src/core/safety', () => ({
  safetyGuard: {
    getStatus: () => ({ simMode: true, enforced: true, sandboxTenant: 'test-tenant' })
  }
}));

describe('HealthServer', () => {
  let server: HealthServer;

  beforeEach(() => {
    // Bind to a dynamically assigned ephemeral port (0) to eliminate EADDRINUSE conflicts
    server = new HealthServer(0);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should start HTTP server on specified port', async () => {
    await server.start();
    expect(server.isRunning()).toBe(true);
    expect(server.getPort()).toBeGreaterThan(0);
  });

  it('should return health status with worker state', async () => {
    await server.start();
    server.setWorkerState('RUNNING');
    server.setTemporalConnected(true); // REQUIRED for healthy status

    const port = server.getPort();
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.checks.worker.state).toBe('RUNNING');
    expect(data.checks.safety.simMode).toBe(true);
  });

  it('should return 503 when worker not running', async () => {
    await server.start();
    server.setWorkerState('STOPPED');
    // Even if temporal connected, STOPPED makes it unhealthy
    server.setTemporalConnected(true);

    const port = server.getPort();
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(503);
  });

  it('should expose metrics endpoint', async () => {
    await server.start();

    const port = server.getPort();
    const response = await fetch(`http://127.0.0.1:${port}/metrics`);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('armageddon_worker_state');
    expect(text).toContain('process_heap_bytes');
  });

  it('should return 200 on /ready when worker running', async () => {
    await server.start();
    server.setWorkerState('RUNNING');
    server.setTemporalConnected(true);

    const port = server.getPort();
    const response = await fetch(`http://127.0.0.1:${port}/ready`);
    expect(response.status).toBe(200);
  });
});
