// armageddon-site/src/lib/omniport.ts
// OmniPort server-side auth utilities: token verification, HMAC signing, JWT waiver validation.
// All comparisons use timing-safe equality. No secrets ever leave this module.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { NextRequest } from 'next/server';

// ─── WaiverTokenPayload (mirrored from armageddon-core/src/omniport/types.ts) ─
// armageddon-core is not a workspace dep of armageddon-site; types are defined here locally.

export const WaiverTokenPayloadSchema = z.object({
    orgId: z.string().min(1),
    issuedAt: z.number().int(),
    expiresAt: z.number().int(),
    runLevel: z.number().int().min(1).max(7),
    acceptedByUserId: z.string().min(1),
    waiverVersion: z.literal('1.0'),
});
export type WaiverTokenPayload = z.infer<typeof WaiverTokenPayloadSchema>;

// ─── Zod schemas for route I/O boundaries ─────────────────────────────────

export const OmniPortExecuteRequestSchema = z.object({
    organizationId: z.string().min(1),
    level: z.number().int().min(1).max(7),
    iterations: z.number().int().positive(),
    batteries: z.array(z.string()).optional(),
    omniPortToken: z.string().min(1),
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
});
export type OmniPortLiveFireRequest = z.infer<typeof OmniPortLiveFireRequestSchema>;

export const WaiverRecordRequestSchema = z.object({
    waiverToken: z.string().min(1),
    acceptedByUserId: z.string().min(1),
    organizationId: z.string().min(1),
});
export type WaiverRecordRequest = z.infer<typeof WaiverRecordRequestSchema>;

// ─── OMNIPORT_ENABLED guard ────────────────────────────────────────────────

export function isOmniPortEnabled(): boolean {
    return process.env.OMNIPORT_ENABLED === 'true';
}

// ─── Bearer token verification ─────────────────────────────────────────────

export function verifyOmniPortToken(request: NextRequest): boolean {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return false;
    const token = authHeader.slice(7);
    const apiKey = process.env.OMNIPORT_API_KEY;
    if (!apiKey || !token) return false;
    // Pad to equal length before timing-safe compare to avoid length oracle
    const keyBuf = Buffer.from(apiKey, 'utf8');
    const tokBuf = Buffer.from(token, 'utf8');
    if (keyBuf.length !== tokBuf.length) return false;
    return timingSafeEqual(keyBuf, tokBuf);
}

// ─── Webhook signature verification ───────────────────────────────────────

export function verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = process.env.OMNIPORT_WEBHOOK_SECRET;
    if (!secret) return false;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
}

// ─── Telemetry payload signing ─────────────────────────────────────────────

export function signTelemetryPayload(payload: string): string {
    const secret = process.env.OMNIPORT_WEBHOOK_SECRET;
    if (!secret) throw new Error('OMNIPORT_WEBHOOK_SECRET not configured');
    return createHmac('sha256', secret).update(payload).digest('hex');
}

// ─── Waiver JWT verification (HS256, built-in crypto only) ────────────────

function base64urlToBuffer(str: string): Buffer {
    // Convert base64url → base64 → Buffer
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((str.length + 3) % 4 || 4);
    return Buffer.from(padded, 'base64');
}

export function verifyWaiverToken(token: string): WaiverTokenPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [headerB64, payloadB64, signatureB64] = parts;

        const secret = process.env.OMNIPORT_LIVE_FIRE_SECRET;
        if (!secret) return null;

        // Recompute expected HMAC-SHA256 over header.payload
        const signingInput = `${headerB64}.${payloadB64}`;
        const expectedSigBytes = createHmac('sha256', secret).update(signingInput).digest();
        const actualSigBytes = base64urlToBuffer(signatureB64);

        if (expectedSigBytes.length !== actualSigBytes.length) return null;
        if (!timingSafeEqual(expectedSigBytes, actualSigBytes)) return null;

        // Decode and parse claims
        const payloadJson = base64urlToBuffer(payloadB64).toString('utf8');
        const claims: unknown = JSON.parse(payloadJson);

        const parsed = WaiverTokenPayloadSchema.safeParse(claims);
        if (!parsed.success) return null;

        // Enforce 15-minute window
        const now = Date.now();
        if (parsed.data.issuedAt > now) return null;               // issued in the future
        if (parsed.data.expiresAt < now) return null;               // expired
        if (now - parsed.data.issuedAt > 15 * 60 * 1000) return null; // older than 15 min

        return parsed.data;
    } catch {
        return null;
    }
}
