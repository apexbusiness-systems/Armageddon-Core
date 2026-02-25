// ARMAGEDDON LEVEL 8 - KINETIC HEALTH MONITOR
// Zero-dependency health checks using node:http only
// APEX Business Systems Ltd. - Proprietary IP

import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { safetyGuard } from '../core/safety';

type WorkerState = 'STARTING' | 'RUNNING' | 'STOPPED' | 'DRAINING';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    worker: { state: WorkerState };
    safety: { simMode: boolean; enforced: boolean; sandboxTenant: string | null };
    memory: { heapUsed: number; heapTotal: number; rss: number };
    temporal: { connected: boolean };
  };
}

/**
 * HealthServer - Docker Compose health checks + Moat monitoring
 *
 * Endpoints:
 * - GET /health    → Docker healthcheck + dashboard status (JSON)
 * - GET /metrics   → Prometheus-compatible for future Grafana (text)
 * - GET /ready     → Simple UP/DOWN check for scripts (200/503)
 */
export class HealthServer {
  private server: Server | null = null;
  private workerState: WorkerState = 'STARTING';
  private readonly startTime = Date.now();
  private temporalConnected = false;

  constructor(private readonly port = 8081) {}

  /**
   * Start health server on specified port
   */
  start(): void {
    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[Health] Kinetic Health Monitor active on port ${this.port}`);
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  /**
   * Route incoming requests
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url || '/';
    const method = req.method || 'GET';

    if (url === '/health' && method === 'GET') {
      this.handleHealth(res);
    } else if (url === '/ready' && method === 'GET') {
      this.handleReadiness(res);
    } else if (url === '/metrics' && method === 'GET') {
      this.handleMetrics(res);
    } else {
      this.send404(res);
    }
  }

  /**
   * GET /health - Detailed health check for monitoring
   */
  private handleHealth(res: ServerResponse): void {
    const health = this.collectHealthData();
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }

  /**
   * GET /ready - Simple readiness probe for Docker Compose
   */
  private handleReadiness(res: ServerResponse): void {
    const isReady = this.workerState === 'RUNNING' && this.temporalConnected;
    const statusCode = isReady ? 200 : 503;

    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end(isReady ? 'READY' : 'NOT READY');
  }

  /**
   * GET /metrics - Prometheus-compatible metrics
   */
  private handleMetrics(res: ServerResponse): void {
    const memory = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    const safetyStatus = safetyGuard.getStatus();

    const stateValue = this.getWorkerStateValue(this.workerState);

    const metrics = `# HELP armageddon_worker_state Worker state (0=STARTING,1=RUNNING,2=STOPPED,3=DRAINING)
# TYPE armageddon_worker_state gauge
armageddon_worker_state ${stateValue}

# HELP armageddon_temporal_connected Temporal connection status
# TYPE armageddon_temporal_connected gauge
armageddon_temporal_connected ${this.temporalConnected ? 1 : 0}

# HELP armageddon_safety_enforced Safety guard enforcement status
# TYPE armageddon_safety_enforced gauge
armageddon_safety_enforced ${safetyStatus.enforced ? 1 : 0}

# HELP process_heap_bytes Node.js heap memory usage
# TYPE process_heap_bytes gauge
process_heap_bytes{type="used"} ${memory.heapUsed}
process_heap_bytes{type="total"} ${memory.heapTotal}

# HELP process_rss_bytes Resident set size
# TYPE process_rss_bytes gauge
process_rss_bytes ${memory.rss}

# HELP armageddon_uptime_seconds Uptime in seconds
# TYPE armageddon_uptime_seconds counter
armageddon_uptime_seconds ${Math.floor(uptime / 1000)}
`;

    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    res.end(metrics.trim());
  }

  /**
   * Convert worker state to numeric value for Prometheus
   */
  private getWorkerStateValue(state: WorkerState): number {
    switch (state) {
      case 'STARTING': return 0;
      case 'RUNNING': return 1;
      case 'STOPPED': return 2;
      case 'DRAINING': return 3;
    }
  }

  /**
   * 404 handler
   */
  private send404(res: ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }

  /**
   * Collect comprehensive health data
   */
  private collectHealthData(): HealthCheckResult {
    const safetyStatus = safetyGuard.getStatus();
    const memory = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Determine health status
    if (this.workerState === 'STOPPED' || !this.temporalConnected) {
      status = 'unhealthy';
    } else if (this.workerState === 'DRAINING' || !safetyStatus.enforced) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime,
      checks: {
        worker: { state: this.workerState },
        safety: {
          simMode: safetyStatus.simMode,
          enforced: safetyStatus.enforced,
          sandboxTenant: safetyStatus.sandboxTenant
        },
        memory: {
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          rss: memory.rss
        },
        temporal: { connected: this.temporalConnected }
      }
    };
  }

  /**
   * Update worker state (called by worker lifecycle)
   */
  setWorkerState(state: WorkerState): void {
    this.workerState = state;
    console.log(`[Health] Worker state: ${state}`);
  }

  /**
   * Update Temporal connection status
   */
  setTemporalConnected(connected: boolean): void {
    this.temporalConnected = connected;
    console.log(`[Health] Temporal connection: ${connected ? 'ACTIVE' : 'LOST'}`);
  }

  /**
   * Stop health server
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('[Health] Kinetic Health Monitor shutdown complete');
    }
  }
}
