/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API ROUTE LOAD TEST
 * Measures real-world impact under concurrent load
 * ═══════════════════════════════════════════════════════════════════════════
 */

import autocannon from 'autocannon';

console.log('Starting load test against http://localhost:3000/api/run...');

const result = await autocannon({
    url: 'http://localhost:3000/api/run',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}` // Uncomment if auth is enabled
    },
    body: JSON.stringify({
        organizationId: 'test-org-id', // Ensure this org exists or mock it
        level: 7,
        iterations: 1
    }),
    connections: 10, // Concurrent connections
    duration: 30,    // 30 seconds
});

console.log('Load Test Results:');
console.log('─────────────────────────────────────');
console.log(`Avg Latency: ${result.latency.mean}ms`);
// @ts-ignore - p95 might be missing in types
console.log(`p95 Latency: ${result.latency.p95}ms`);
console.log(`p99 Latency: ${result.latency.p99}ms`);
console.log(`Requests/sec: ${result.requests.average}`);
console.log(`Errors: ${result.errors}`);
