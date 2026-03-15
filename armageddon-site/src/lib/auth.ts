import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRole } from '@/lib/supabase';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API SECURITY MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface AuthenticatedContext {
    user: { id: string; email?: string };
    supabase: SupabaseClient;
}

/**
 * Authenticates a request and returns the user and supabase client.
 * Returns a NextResponse if authentication fails.
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedContext | NextResponse> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const supabase = getSupabaseServiceRole();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        console.warn(`[Security] Invalid token: ${authError?.message}`);
        return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    return { user, supabase };
}

/**
 * Verifies if a user is a member of an organization.
 */
export async function verifyOrganizationMembership(
    supabase: SupabaseClient,
    userId: string,
    organizationId: string
): Promise<boolean> {
    const { data: membership, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single();

    return !error && !!membership;
}

/**
 * Helper to return a standard Forbidden response.
 */
export function forbiddenResponse(message = 'Forbidden: You do not have access to this resource'): NextResponse {
    return NextResponse.json({ success: false, error: message }, { status: 403 });
}
