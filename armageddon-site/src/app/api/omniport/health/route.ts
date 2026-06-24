// armageddon-site/src/app/api/omniport/health/route.ts
// GET /api/omniport/health — OmniHub platform probe. Read-only diagnostic; never throws.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTemporalClient } from '@/lib/temporal';
import { getSupabaseServiceRole } from '@/lib/supabase';
import { guardOmniPort } from '@/lib/omniport';
import packageJson from '../../../../../package.json';

export async function GET(request: NextRequest): Promise<NextResponse> {
    const guard = guardOmniPort(request);
    if (guard) return guard;

    let temporalConnected = false;
    let temporalError: string | undefined;
    try {
        await getTemporalClient();
        temporalConnected = true;
    } catch (err) {
        temporalError = (err as Error).message;
    }

    let supabaseConnected = false;
    let supabaseError: string | undefined;
    try {
        const supabase = getSupabaseServiceRole();
        const { error } = await supabase.from('armageddon_runs').select('id').limit(1);
        if (error) {
            supabaseError = error.message;
        } else {
            supabaseConnected = true;
        }
    } catch (err) {
        supabaseError = (err as Error).message;
    }

    const version: string = packageJson.version ?? '1.0.0';

    // Honest status: only 'operational' when BOTH dependencies are reachable.
    const healthy = temporalConnected && supabaseConnected;
    const degraded = temporalConnected !== supabaseConnected; // exactly one is down
    const status = healthy ? 'operational' : degraded ? 'degraded' : 'unavailable';
    const httpStatus = healthy ? 200 : degraded ? 207 : 503;

    return NextResponse.json({
        status,
        version,
        simMode: process.env.SIM_MODE === 'true',
        temporalConnected,
        ...(temporalError ? { temporalError } : {}),
        supabaseConnected,
        ...(supabaseError ? { supabaseError } : {}),
        omniPortEnabled: true,
        timestamp: Date.now(),
    }, { status: httpStatus });
}
