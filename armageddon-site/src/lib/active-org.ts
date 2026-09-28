import { getSupabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/runtime-api';

export type OrgResolution =
    | { ok: true; organizationId: string; accessToken: string; email?: string }
    | { ok: false; reason: 'unauthenticated' | 'no-org' | 'org-error' };

// Resolve the authenticated user's real organization via the edge Worker's
// /api/me/organizations. Never falls back to a demo or user id — those are not
// valid organizationId values for a real run or a checkout reference.
export async function resolveActiveOrg(): Promise<OrgResolution> {
    const sb = getSupabase();
    const session = (await sb?.auth.getSession())?.data.session;
    if (!session?.access_token) {
        return { ok: false, reason: 'unauthenticated' };
    }
    const res = await apiFetch('/api/me/organizations', {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
        return { ok: false, reason: res.status === 404 ? 'no-org' : 'org-error' };
    }
    const data = (await res.json()) as { active?: { organization_id?: string } };
    const organizationId = data.active?.organization_id;
    if (!organizationId) {
        return { ok: false, reason: 'no-org' };
    }
    return { ok: true, organizationId, accessToken: session.access_token, email: session.user?.email };
}
