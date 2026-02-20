import { NextRequest, NextResponse } from 'next/server';
<<<<<<< fix/pr-33-cleanup-v2
import { createClient } from '@supabase/supabase-js';
import { resolveCallerContext } from '@/lib/server/apexGate';
=======
import { getSupabaseAnon } from '@/lib/supabase';
>>>>>>> main

export async function POST(request: NextRequest) {
    const authResult = await resolveCallerContext(request);

    if (!authResult.success) {
        return NextResponse.json({
            eligible: false,
            tier: 'free_dry',
            reason: 'AUTH_REQUIRED',
            upgradeUrl: '/pricing?upgrade=verified',
        }, { status: 401 });
    }

    const { context } = authResult;
    
<<<<<<< fix/pr-33-cleanup-v2
    // Admin override check
    if (context.tier === 'certified' && process.env.ADMIN_EMAIL) {
        const anonClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        );
=======
    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const supabase = getSupabaseAnon();
>>>>>>> main
        
        const { data: { user } } = await anonClient.auth.getUser(request.headers.get('Authorization')?.replace('Bearer ', ''));
        
        if (user?.email === process.env.ADMIN_EMAIL) {
            return NextResponse.json({
                eligible: true,
                tier: 'certified',
                reason: 'ADMIN_OVERRIDE'
            });
        }
    }

    return NextResponse.json({
        eligible: true,
        tier: context.tier,
        orgId: context.orgId,
        reason: 'AUTHENTICATED'
    });
}
