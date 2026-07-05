import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request);

    if (!(auth instanceof NextResponse)) {
        const { user, supabase } = auth;
        
        // Secure Admin Verification via Environment Variable or Test Accounts
        if (user && user.email && process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
             return NextResponse.json({
                eligible: true,
                tier: 'certified',
                reason: 'ADMIN_OVERRIDE'
            });
        }

        // DB Subscription Verification
        const { data: memberships } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id);

        const orgId = memberships?.[0]?.organization_id;
        if (orgId) {
            const { data: orgs } = await supabase
                .from('organizations')
                .select('current_tier')
                .eq('id', orgId);

            const tier = orgs?.[0]?.current_tier ?? 'free_dry';
            if (tier === 'verified' || tier === 'certified') {
                return NextResponse.json({
                    eligible: true,
                    tier,
                    reason: 'ACTIVE_SUBSCRIPTION'
                });
            }
        }
    }

    // Default Fallback
    return NextResponse.json({
        eligible: false,
        tier: 'free',
        reason: 'LEVEL_7_ACCESS_REQUIRED'
    });
}
