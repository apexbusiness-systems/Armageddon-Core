// armageddon-core/src/omniport/types.ts
// OmniPort Connector — APEX-OmniHub sovereign integration type layer
// All I/O boundaries are Zod-validated; inferred TypeScript types exported for use by activities & telemetry.

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

// ─── Remote run request (OmniHub → Armageddon) ─────────────────────────────

export const OmniPortExecuteRequestSchema = z.object({
    organizationId: z.string().min(1),
    level: z.number().int().min(1).max(7),
    iterations: z.number().int().positive(),
    batteries: z.array(z.string()).optional(),
    omniPortToken: z.string().min(1),
});
export type OmniPortExecuteRequest = z.infer<typeof OmniPortExecuteRequestSchema>;

// ─── Hot-edit control command (OmniHub → Armageddon via signal) ────────────

export const OmniPortControlCommandSchema = z.object({
    command: z.enum(['pause', 'resume', 'cancel', 'adjust_iterations', 'inject_battery']),
    runId: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
});
export type OmniPortControlCommand = z.infer<typeof OmniPortControlCommandSchema>;

// ─── Live-fire run request (OmniHub → Armageddon) ──────────────────────────

export const OmniPortLiveFireRequestSchema = z.object({
    organizationId: z.string().min(1),
    waiverToken: z.string().min(1),
    level: z.number().int().min(1).max(7),
    iterations: z.number().int().positive(),
    batteries: z.array(z.string()).optional(),
});
export type OmniPortLiveFireRequest = z.infer<typeof OmniPortLiveFireRequestSchema>;

// ─── Waiver JWT payload (decoded from OmniHub-issued token) ────────────────

export const WaiverTokenPayloadSchema = z.object({
    orgId: z.string().min(1),
    issuedAt: z.number().int(),
    expiresAt: z.number().int(),
    runLevel: z.number().int().min(1).max(7),
    acceptedByUserId: z.string().min(1),
    waiverVersion: z.literal('1.0'),
});
export type WaiverTokenPayload = z.infer<typeof WaiverTokenPayloadSchema>;

// ─── Structured error response (OmniHub-readable) ─────────────────────────

export interface OmniPortErrorResponse {
    success: false;
    error: string;
    code: string;
}
