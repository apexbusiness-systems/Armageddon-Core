// armageddon-site/src/app/api/me/organizations/route.ts
// GET /api/me/organizations — resolve the authenticated user's real organization memberships.
// Uses the same Bearer-token auth contract as /api/run (authenticateRequest), so the browser
// must send `Authorization: Bearer <supabase access_token>`. There is NO demo/fallback org.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

interface Membership {
    organization_id: string;
    role: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    // Service-role client is already scoped to this authenticated user by the filter below.
    const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id);

    if (error) {
        console.error('[me/organizations] query failed:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const memberships = (data ?? []) as Membership[];
    if (memberships.length === 0) {
        return NextResponse.json(
            { success: false, error: 'No organization membership', organizations: [] },
            { status: 404 }
        );
    }

    // Prefer an owner/admin membership; otherwise fall back to the first membership.
    const active = memberships.find(m => m.role === 'owner' || m.role === 'admin') ?? memberships[0];

    return NextResponse.json({ success: true, organizations: memberships, active });
}
