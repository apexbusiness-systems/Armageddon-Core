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
export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedContext | NextResponse<any>> {
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
export function forbiddenResponse(message = 'Forbidden: You do not have access to this resource'): NextResponse<any> {
    return NextResponse.json({ success: false, error: message }, { status: 403 });
}

/**
 * Combines authentication and organization membership check.
 */
export async function checkMembershipResponse(
    request: NextRequest,
    organizationId: string
): Promise<AuthenticatedContext | NextResponse<any>> {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    const isMember = await verifyOrganizationMembership(auth.supabase, auth.user.id, organizationId);
    if (!isMember) {
        console.warn(`[Security] User ${auth.user.id} attempted unauthorized access to org ${organizationId}`);
        return forbiddenResponse('Forbidden: You are not a member of this organization');
    }

    return auth;
}

/**
 * Enhanced helper for GET requests: Fetches a run and verifies access in one step.
 * This further reduces duplication between API handlers.
 */
export async function getRunAndVerifyAccess(
    request: NextRequest,
    runId: string
): Promise<{ run: any; auth: AuthenticatedContext } | NextResponse<any>> {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    const { data: run, error } = await auth.supabase
        .from('armageddon_runs')
        .select('*')
        .eq('id', runId)
        .single();

    if (error || !run) {
        return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 });
    }

    const isMember = await verifyOrganizationMembership(auth.supabase, auth.user.id, run.organization_id);
    if (!isMember) {
        console.warn(`[Security] User ${auth.user.id} attempted unauthorized access to run ${runId}`);
        return forbiddenResponse('Forbidden: You are not a member of the organization that owns this run');
    }

    return { run, auth };
}
