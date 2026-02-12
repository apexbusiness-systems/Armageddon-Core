import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthServer } from '../../src/infrastructure/health';

// Mock safetyGuard to return healthy status
vi.mock('../../src/core/safety', () => {
  return {
    safetyGuard: {
      getStatus: () => ({
        simMode: true,
        enforced: true,
        sandboxTenant: 'test-tenant',
        timestamp: new Date().toISOString()
      })
    }
  };
});

describe('HealthServer', () => {
  let server: HealthServer;

  beforeEach(() => {
    server = new HealthServer(8081);
  });

  afterEach(() => {
    server.stop();
  });

  it('should start HTTP server on specified port', async () => {
    server.start();
    // Wait for server to start listening
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(server.isRunning()).toBe(true);
  });

  it('should return health status with worker state', async () => {
    server.start();
    server.setWorkerState('RUNNING');
    server.setTemporalConnected(true);

    const response = await fetch('http://localhost:8081/health');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.checks.worker.state).toBe('RUNNING');
    expect(data.checks.safety.simMode).toBe(true);
  });

  it('should return 503 when worker not running', async () => {
    server.start();
    server.setWorkerState('STOPPED');

    const response = await fetch('http://localhost:8081/health');
    expect(response.status).toBe(503);
  });

  it('should expose metrics endpoint', async () => {
    server.start();

    const response = await fetch('http://localhost:8081/metrics');
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('armageddon_worker_state');
    expect(text).toContain('process_heap_bytes');
  });

  it('should return 200 on /ready when worker running', async () => {
    server.start();
    server.setWorkerState('RUNNING');
    server.setTemporalConnected(true);

    const response = await fetch('http://localhost:8081/ready');
    expect(response.status).toBe(200);
  });
});
