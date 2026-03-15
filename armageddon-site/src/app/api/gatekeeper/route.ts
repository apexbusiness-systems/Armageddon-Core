import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request);

    if (!(auth instanceof NextResponse)) {
        const { user } = auth;
        
        // Secure Admin Verification via Environment Variable
        if (user && user.email && process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
             return NextResponse.json({
                eligible: true,
                tier: 'verified',
                reason: 'ADMIN_OVERRIDE'
            });
        }
    }

    // Default Fallback
    return NextResponse.json({
        eligible: false,
        tier: 'free',
        reason: 'LEVEL_7_ACCESS_REQUIRED'
    });
}
