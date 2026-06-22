// armageddon-site/src/app/api/omniport/telemetry/route.ts
// GET /api/omniport/telemetry?runId=<uuid> — On-demand pull of cached telemetry events (pull model).
// runId is a query param (not a path segment) so this route is static-export-compatible.
//
// DATABASE MIGRATION (run once against Supabase):
// -- omniport_telemetry_events
// CREATE TABLE IF NOT EXISTS omniport_telemetry_events (
//   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   run_id      TEXT NOT NULL,
//   org_id      TEXT NOT NULL,
//   event_type  TEXT NOT NULL,
//   payload     JSONB NOT NULL,
//   timestamp   BIGINT NOT NULL,
//   created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_omniport_telemetry_run ON omniport_telemetry_events(run_id, timestamp DESC);

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase';
import { guardOmniPort } from '@/lib/omniport';

export async function GET(request: NextRequest): Promise<NextResponse> {
    const guard = guardOmniPort(request);
    if (guard) return guard;

    const runId = request.nextUrl.searchParams.get('runId');
    if (!runId) {
        return NextResponse.json(
            { success: false, error: 'runId query parameter is required', code: 'MISSING_RUN_ID' },
            { status: 400 }
        );
    }

    const supabase = getSupabaseServiceRole();

    // GATE G4: If table doesn't exist, return graceful degradation — never crash.
    const { data: events, error } = await supabase
        .from('omniport_telemetry_events')
        .select('id, run_id, org_id, event_type, payload, timestamp, created_at')
        .eq('run_id', runId)
        .order('timestamp', { ascending: false })
        .limit(50);

    if (error) {
        return NextResponse.json({
            success: true,
            runId,
            events: [],
            warning: 'telemetry_table_not_initialized',
        });
    }

    return NextResponse.json({
        success: true,
        runId,
        events: events ?? [],
        count: (events ?? []).length,
    });
}
