/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TEMPORAL CLIENT (SERVER-SIDE SINGLETON)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Connection pooling with "thundering herd" protection.
 * Multiple concurrent requests will share the same connection promise.
 *
 * @module temporal
 * @server-only
 */

import { Client, Connection } from '@temporalio/client';

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON CACHE
// ═══════════════════════════════════════════════════════════════════════════

let cachedTemporalClient: Client | null = null;
let connectionPromise: Promise<Client> | null = null;

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get or create Temporal client with connection pooling.
 *
 * **Thread Safety**: Prevents thundering herd by reusing in-flight connection promise.
 *
 * @returns Promise<Client> Temporal client instance
 * @throws Error if connection fails
 *
 * @example
 * ```typescript
 * const client = await getTemporalClient();
 * await client.workflow.start('MyWorkflow', {...});
 * ```
 */
export async function getTemporalClient(): Promise<Client> {
    // Return cached client if available
    if (cachedTemporalClient) {
        return cachedTemporalClient;
    }

    // If connection is in progress, return that promise (prevents thundering herd)
    if (connectionPromise) {
        return connectionPromise;
    }

    // Create new connection
    connectionPromise = (async () => {
        const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
        const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

        try {
            const connection = await Connection.connect({ address });
            const client = new Client({ connection, namespace });

            cachedTemporalClient = client;
            console.log(`[Temporal] Connected to ${address} (namespace: ${namespace})`);
            return client;
        } catch (error) {
            console.error('[Temporal] Connection failed:', error);
            throw new Error(`Failed to connect to Temporal at ${address}: ${error}`);
        } finally {
            connectionPromise = null; // Clear promise after success/failure
        }
    })();

    return connectionPromise;
}

/**
 * Reset the Temporal client singleton (for testing only).
 * @internal
 */
export function __resetTemporalClient(): void {
    cachedTemporalClient = null;
    connectionPromise = null;
}
