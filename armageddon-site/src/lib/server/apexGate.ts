import { NextRequest } from 'next/server';
import { OrganizationTier } from '@armageddon/shared';

export interface CallerContext {
    orgId: string;
    tier: OrganizationTier;
    userId?: string;
}

export interface AuthResult {
    success: boolean;
    context: CallerContext;
    error?: string;
    status?: number;
}

export async function resolveCallerContext(req: NextRequest): Promise<AuthResult> {
    // Mock implementation for build success
    // TODO: Implement actual JWT/Supabase auth verification
    
    const authHeader = req.headers.get('Authorization');
    
    // For build/test purposes, if we have a special flag or just generally:
    // We'll mimic a successful resolution if we see *any* auth header or if we are in dev/sim mode
    
    if (process.env.NODE_ENV === 'development' || process.env.SIM_MODE === 'true') {
        return {
            success: true,
            context: {
                orgId: 'sim-org-001',
                tier: 'certified', 
            }
        };
    }

    if (!authHeader) {
        return {
            success: false,
            error: 'Missing Authorization header',
            status: 401,
            context: {} as any
        };
    }

    // Default mock success for non-empty auth
    return {
        success: true,
        context: {
            orgId: 'org-001',
            tier: 'verified',
        }
    };
}
