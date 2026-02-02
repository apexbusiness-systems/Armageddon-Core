import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        
        const { data: { user } } = await supabase.auth.getUser(token);
        
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
