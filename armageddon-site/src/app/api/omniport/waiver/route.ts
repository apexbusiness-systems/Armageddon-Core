// armageddon-site/src/app/api/omniport/waiver/route.ts
// POST /api/omniport/waiver — Legal record: persists the live-fire waiver acceptance to Supabase.
// The INSERT must succeed and the returned waiverRecordId must match the DB row — this is the
// cryptographic and legal proof of acceptance.
//
// DATABASE MIGRATION (run once against Supabase):
// CREATE TABLE IF NOT EXISTS omniport_waiver_records (
//   id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   org_id            TEXT NOT NULL,
//   user_id           TEXT NOT NULL,
//   waiver_version    TEXT NOT NULL DEFAULT '1.0',
//   waiver_token_hash TEXT NOT NULL,
//   run_level         INTEGER NOT NULL,
//   accepted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
//   expires_at        TIMESTAMPTZ NOT NULL,
//   created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_omniport_waiver_org ON omniport_waiver_records(org_id, run_level, expires_at);

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getSupabaseServiceRole } from '@/lib/supabase';
import { guardOmniPort, verifyWaiverToken, WaiverRecordRequestSchema, parseOmniPortBody, type WaiverRecordRequest } from '@/lib/omniport';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = guardOmniPort(request);
    if (guard) return guard;

    const body = await parseOmniPortBody<WaiverRecordRequest>(request, WaiverRecordRequestSchema);
    if (body instanceof NextResponse) return body;
    const { waiverToken, acceptedByUserId, organizationId } = body;

    // Validate OmniHub-issued JWT
    const waiverPayload = verifyWaiverToken(waiverToken);
    if (!waiverPayload) {
        return NextResponse.json(
            { accepted: false, reason: 'WAIVER_TOKEN_INVALID_OR_EXPIRED' },
            { status: 401 }
        );
    }

    if (waiverPayload.orgId !== organizationId) {
        return NextResponse.json(
            { accepted: false, reason: 'WAIVER_ORG_MISMATCH' },
            { status: 400 }
        );
    }

    if (waiverPayload.acceptedByUserId !== acceptedByUserId) {
        return NextResponse.json(
            { accepted: false, reason: 'WAIVER_USER_MISMATCH' },
            { status: 400 }
        );
    }

    // Hash the token for the legal record (never store the raw token)
    const waiverTokenHash = createHash('sha256').update(waiverToken).digest('hex');

    const supabase = getSupabaseServiceRole();

    // GATE G3: INSERT must succeed; returned id is the legal proof of acceptance
    const { data: inserted, error: insertError } = await supabase
        .from('omniport_waiver_records')
        .insert({
            org_id: organizationId,
            user_id: acceptedByUserId,
            waiver_version: '1.0',
            waiver_token_hash: waiverTokenHash,
            run_level: waiverPayload.runLevel,
            expires_at: new Date(waiverPayload.expiresAt).toISOString(),
        })
        .select('id')
        .single();

    if (insertError || !inserted) {
        console.error('[OmniPort] Waiver record insert failed:', insertError?.message);
        // GATE G4: non-200 on DB failure — never return success: true with no downstream state
        return NextResponse.json(
            { accepted: false, reason: 'WAIVER_RECORD_INSERT_FAILED', code: 'DB_INSERT_FAILED' },
            { status: 500 }
        );
    }

    return NextResponse.json({
        accepted: true,
        waiverRecordId: inserted.id,
        authorizedUntil: waiverPayload.expiresAt,
    });
}
