// armageddon-site/src/app/api/omniport/health/route.ts
// GET /api/omniport/health — OmniHub platform probe. Read-only diagnostic; never throws.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTemporalClient } from '@/lib/temporal';
import { getSupabaseServiceRole } from '@/lib/supabase';
import { verifyOmniPortToken, isOmniPortEnabled } from '@/lib/omniport';

export async function GET(request: NextRequest): Promise<NextResponse> {
    if (!isOmniPortEnabled()) {
        return NextResponse.json(
            { success: false, error: 'OmniPort connector is disabled on this instance', code: 'OMNIPORT_DISABLED' },
            { status: 503 }
        );
    }

    if (!verifyOmniPortToken(request)) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
            { status: 401 }
        );
    }

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

    let version = '1.0.0';
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require('../../../../../package.json') as { version: string };
        version = pkg.version;
    } catch {
        // version stays as fallback
    }

    return NextResponse.json({
        status: 'operational',
        version,
        simMode: process.env.SIM_MODE === 'true',
        temporalConnected,
        ...(temporalError ? { temporalError } : {}),
        supabaseConnected,
        ...(supabaseError ? { supabaseError } : {}),
        omniPortEnabled: true,
        timestamp: Date.now(),
    });
}
