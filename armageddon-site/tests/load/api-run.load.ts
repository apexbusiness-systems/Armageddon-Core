/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API ROUTE LOAD TEST
 * Measures real-world impact under concurrent load without third-party load
 * generators, keeping the production audit surface minimal.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const url = process.env.LOAD_TEST_URL ?? 'http://localhost:3000/api/run';
const connections = Number.parseInt(process.env.LOAD_TEST_CONNECTIONS ?? '10', 10);
const durationMs = Number.parseInt(process.env.LOAD_TEST_DURATION_MS ?? '30000', 10);

const payload = JSON.stringify({
    organizationId: 'test-org-id',
    level: 7,
    iterations: 1,
});

type Sample = {
    latencyMs: number;
    ok: boolean;
};

const samples: Sample[] = [];
let inFlight = 0;
let stopped = false;

async function issueRequest(): Promise<void> {
    inFlight += 1;
    const startedAt = performance.now();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
        });

        samples.push({ latencyMs: performance.now() - startedAt, ok: response.ok });
    } catch {
        samples.push({ latencyMs: performance.now() - startedAt, ok: false });
    } finally {
        inFlight -= 1;
        if (!stopped) {
            void issueRequest();
        }
    }
}

function percentile(values: number[], percentileRank: number): number {
    if (values.length === 0) {
        return 0;
    }

    const index = Math.ceil((percentileRank / 100) * values.length) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
}

console.log(`Starting load test against ${url}...`);

for (let i = 0; i < connections; i += 1) {
    void issueRequest();
}

await new Promise(resolve => setTimeout(resolve, durationMs));
stopped = true;

while (inFlight > 0) {
    await new Promise(resolve => setTimeout(resolve, 10));
}

const latencies = samples.map(sample => sample.latencyMs).sort((a, b) => a - b);
const errors = samples.filter(sample => !sample.ok).length;
const averageLatency = latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1);
const requestsPerSecond = samples.length / (durationMs / 1000);

console.log('Load Test Results:');
console.log('─────────────────────────────────────');
console.log(`Avg Latency: ${averageLatency.toFixed(2)}ms`);
console.log(`p95 Latency: ${percentile(latencies, 95).toFixed(2)}ms`);
console.log(`p99 Latency: ${percentile(latencies, 99).toFixed(2)}ms`);
console.log(`Requests/sec: ${requestsPerSecond.toFixed(2)}`);
console.log(`Errors: ${errors}`);

export {};
