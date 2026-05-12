import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

// Maximum accepted request body size: 1 KB. Requests larger than this are
// rejected before any parsing occurs to prevent DoS via body exhaustion.
const MAX_BODY_BYTES = 1024;

export async function POST(request: NextRequest) {
    // Validate Content-Type to prevent CSRF via form submissions and
    // unexpected media-type confusion attacks.
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        return NextResponse.json(
            { error: 'Content-Type must be application/json' },
            { status: 415 }
        );
    }

    // Reject oversized bodies before parsing.
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (contentLength > MAX_BODY_BYTES) {
        return NextResponse.json(
            { error: 'Request body too large' },
            { status: 413 }
        );
    }

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
