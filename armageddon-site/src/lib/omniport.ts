// armageddon-site/src/lib/omniport.ts
// OmniPort server-side auth utilities: Next.js route adapter over the shared
// crypto/auth primitives in @armageddon/shared/omniport (SSRF validation,
// bearer token check, waiver JWT verification, task-queue resolution).
// All comparisons use timing-safe equality. No secrets ever leave this module.

import { z } from 'zod';
import { type NextRequest, NextResponse } from 'next/server';
import { type SupabaseClient } from '@supabase/supabase-js';
import {
    validateSSRF,
    isOmniPortEnabled,
    verifyOmniPortBearerToken,
    verifyWebhookSignature,
    signTelemetryPayload,
    verifyWaiverToken,
    deriveRunSeed,
    resolveOmniPortTaskQueue,
    type WaiverTokenPayload,
} from '@armageddon/shared/omniport';

export {
    validateSSRF,
    isOmniPortEnabled,
    verifyWebhookSignature,
    signTelemetryPayload,
    verifyWaiverToken,
    deriveRunSeed,
    resolveOmniPortTaskQueue,
    type WaiverTokenPayload,
};

// ─── Zod schemas for route I/O boundaries ─────────────────────────────────
// Request/response shapes are Next.js-route-specific validation and stay
// local to this workspace; the underlying crypto/auth checks they call into
// live in @armageddon/shared/omniport so armageddon-core's standalone API
// server can share the exact same logic.

export const OmniPortExecuteRequestSchema = z.object({
    organizationId: z.string().min(1),
    level: z.number().int().min(1).max(7),
    iterations: z.number().int().positive(),
    batteries: z.array(z.string()).optional(),
    omniPortToken: z.string().min(1),
    targetUrl: z.string().url().refine(async value => validateSSRF(value), { message: 'SSRF_BLOCKED' }),
});
export type OmniPortExecuteRequest = z.infer<typeof OmniPortExecuteRequestSchema>;

export const OmniPortControlCommandSchema = z.object({
    command: z.enum(['pause', 'resume', 'cancel', 'adjust_iterations', 'inject_battery']),
    runId: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
});
export type OmniPortControlCommand = z.infer<typeof OmniPortControlCommandSchema>;

export const OmniPortLiveFireRequestSchema = z.object({
    organizationId: z.string().min(1),
    waiverToken: z.string().min(1),
    level: z.number().int().min(1).max(7),
    iterations: z.number().int().positive(),
    batteries: z.array(z.string()).optional(),
    targetUrl: z.string().url().refine(async value => validateSSRF(value), { message: 'SSRF_BLOCKED' }),
});
export type OmniPortLiveFireRequest = z.infer<typeof OmniPortLiveFireRequestSchema>;

export const WaiverRecordRequestSchema = z.object({
    waiverToken: z.string().min(1),
    acceptedByUserId: z.string().min(1),
    organizationId: z.string().min(1),
});
export type WaiverRecordRequest = z.infer<typeof WaiverRecordRequestSchema>;

/**
 * Combined auth guard for all OmniPort routes.
 * Returns a NextResponse (503 or 401) if the request should be rejected,
 * or null if both checks pass and the route may proceed.
 */
export function guardOmniPort(request: NextRequest): NextResponse | null {
    if (!isOmniPortEnabled()) {
        return NextResponse.json(
            { success: false, error: 'OmniPort connector is disabled on this instance', code: 'OMNIPORT_DISABLED' },
            { status: 503 }
        );
    }
    if (!verifyOmniPortBearerToken(request.headers.get('Authorization'))) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
            { status: 401 }
        );
    }
    return null;
}

// ─── Body parsing + Zod validation helper ─────────────────────────────────

/**
 * Parses the JSON request body and validates it against a Zod schema.
 * Returns the validated data, or a NextResponse with the appropriate error.
 */
export async function parseOmniPortBody<T>(
    request: NextRequest,
    schema: z.ZodType<T>
): Promise<T | NextResponse> {
    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body', code: 'INVALID_BODY' },
            { status: 400 }
        );
    }
    const result = await schema.safeParseAsync(rawBody);
    if (!result.success) {
        return NextResponse.json(
            { success: false, error: result.error.issues[0]?.message ?? 'Validation failed', code: 'VALIDATION_ERROR' },
            { status: 400 }
        );
    }
    return result.data;
}

// ─── Telemetry persistence helper ─────────────────────────────────────────

/**
 * Writes a telemetry event to the omniport_telemetry_events Supabase table.
 *
 * Default is fail-silent (logs on error, never throws) for non-critical telemetry.
 * Pass { required: true } for proof-critical events (e.g. live_fire.authorized):
 * the insert failure then throws so the caller must not report success without
 * durable proof in the database.
 */
export async function persistTelemetryEvent(
    supabase: SupabaseClient,
    runId: string,
    orgId: string,
    eventType: string,
    payload: Record<string, unknown>,
    opts: { required?: boolean } = {}
): Promise<void> {
    try {
        const timestamp = Date.now();
        const { error } = await supabase.from('omniport_telemetry_events').insert({
            run_id: runId,
            org_id: orgId,
            event_type: eventType,
            payload,
            timestamp,
        });
        if (error) {
            if (opts.required) {
                throw new Error(`Required telemetry '${eventType}' failed to persist: ${error.message}`);
            }
            console.warn('[OmniPort] Telemetry DB write failed (non-fatal):', error.message);
        }
    } catch (err) {
        if (opts.required) throw err;
        console.error('[OmniPort] Telemetry error (non-fatal):', (err as Error).message);
    }
}
