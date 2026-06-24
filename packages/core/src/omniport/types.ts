// armageddon-core/src/omniport/types.ts
// OmniPort Connector — telemetry event types used by Temporal activities.
// Request/response schemas live in armageddon-site/src/lib/omniport.ts (Next.js route layer only).

import { z } from 'zod';

// ─── Telemetry event (Armageddon → OmniHub push) ───────────────────────────

export const OmniPortTelemetryEventSchema = z.object({
    eventType: z.enum([
        'run.started',
        'battery.started',
        'battery.completed',
        'run.completed',
        'run.error',
        'live_fire.authorized',
    ]),
    runId: z.string(),
    orgId: z.string(),
    timestamp: z.number().int(),           // Unix ms
    payload: z.record(z.string(), z.unknown()),
    signature: z.string(),                 // HMAC-SHA256(runId+timestamp+payload, OMNIPORT_WEBHOOK_SECRET)
});
export type OmniPortTelemetryEvent = z.infer<typeof OmniPortTelemetryEventSchema>;

// ─── Structured error response (OmniHub-readable) ─────────────────────────

export interface OmniPortErrorResponse {
    success: false;
    error: string;
    code: string;
}
