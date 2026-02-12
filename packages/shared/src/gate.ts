/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON LEVEL 7 — MONETIZATION GATE
 * Tier-based access control for certification levels
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type OrganizationTier = 'free_dry' | 'verified' | 'certified';

export interface EligibilityResult {
    eligible: boolean;
    tier: OrganizationTier;
    requestedLevel: number;
    reason?: string;
    upsellMessage?: string;
    upgradeUrl?: string;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    current_tier: OrganizationTier;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const TIER_LEVEL_ACCESS: Record<OrganizationTier, number[]> = {
    free_dry: [1, 2, 3],
    verified: [1, 2, 3, 4, 5, 6],
    certified: [1, 2, 3, 4, 5, 6, 7],
};

const TIER_NAMES: Record<OrganizationTier, string> = {
    free_dry: 'Free (Dry Run)',
    verified: 'Verified',
    certified: 'Certified',
};

const UPGRADE_URLS: Record<OrganizationTier, string> = {
    free_dry: '/pricing?upgrade=verified',
    verified: '/pricing?upgrade=certified',
    certified: '', // Already at max
};

const TIER_FEATURES: Record<OrganizationTier, {
    canCustomizeBatteries: boolean;
    allowedBatteries: string[];
}> = {
    free_dry: {
        canCustomizeBatteries: false,
        allowedBatteries: ['B10', 'B11', 'B12', 'B13'], // Must run all
    },
    verified: {
        canCustomizeBatteries: true,
        allowedBatteries: ['B10', 'B11', 'B12', 'B13'], // Can select subset
    },
    certified: {
        canCustomizeBatteries: true,
        allowedBatteries: ['B10', 'B11', 'B12', 'B13'], // Can select subset
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════════

function getSupabaseClient(): SupabaseClient {
    // Attempt standard env var then Next.js public env var
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error(
            'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        );
    }

    return createClient(url, serviceKey, {
        auth: { persistSession: false },
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// ELIGIBILITY CHECK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if an organization is eligible to run a specific certification level.
 */
export async function checkRunEligibility(
    orgId: string,
    requestedLevel: number,
    batteries?: string[]
): Promise<EligibilityResult> {
    const supabase = getSupabaseClient();
    const DEFAULT_FAIL: EligibilityResult = {
        eligible: false,
        tier: 'free_dry',
        requestedLevel,
    };

    // Validate level
    if (requestedLevel < 1 || requestedLevel > 7) {
        return {
            ...DEFAULT_FAIL,
            reason: 'INVALID_LEVEL',
            upsellMessage: 'Invalid certification level. Valid levels are 1-7.',
        };
    }

    // Fetch organization
    const { data: org, error } = await supabase
        .from('organizations')
        .select('id, name, slug, current_tier')
        .eq('id', orgId)
        .single();

    if (error || !org) {
        return {
            ...DEFAULT_FAIL,
            reason: 'ORG_NOT_FOUND',
            upsellMessage: 'Organization not found. Please ensure you have a valid account.',
        };
    }

    const tier = org.current_tier as OrganizationTier;
    const allowedLevels = TIER_LEVEL_ACCESS[tier];
    const tierFeatures = TIER_FEATURES[tier];

    // Check battery customization
    if (batteries && batteries.length > 0) {
        const defaultBatteries = ['B10', 'B11', 'B12', 'B13'];
        const isCustomized = batteries.length !== defaultBatteries.length ||
            !batteries.every(b => defaultBatteries.includes(b));

        if (isCustomized && !tierFeatures.canCustomizeBatteries) {
             return {
                eligible: false,
                tier,
                requestedLevel,
                reason: 'FEATURE_LOCKED',
                upsellMessage:
                    '🔒 Custom Battery Selection requires VERIFIED tier. ' +
                    'Upgrade to choose specific attack vectors (Goal Hijack, Tool Misuse, Memory Poison, Supply Chain).',
                upgradeUrl: UPGRADE_URLS[tier],
            };
        }

        // Validate battery IDs
        const invalidBatteries = batteries.filter(
            b => !tierFeatures.allowedBatteries.includes(b)
        );
        if (invalidBatteries.length > 0) {
            return {
                eligible: false,
                tier,
                requestedLevel,
                reason: 'INVALID_BATTERIES',
                upsellMessage: `Invalid battery IDs: ${invalidBatteries.join(', ')}. Allowed: ${tierFeatures.allowedBatteries.join(', ')}`,
            };
        }
    }

    // Check level access
    if (allowedLevels.includes(requestedLevel)) {
        return {
            eligible: true,
            tier,
            requestedLevel,
        };
    }

    // Access denied - generate upsell message
    const requiredTier = getRequiredTier(requestedLevel);

    return {
        eligible: false,
        tier,
        requestedLevel,
        reason: 'ACCESS_DENIED',
        upsellMessage: generateUpsellMessage(requestedLevel, tier, requiredTier),
        upgradeUrl: UPGRADE_URLS[tier],
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getRequiredTier(level: number): OrganizationTier {
    if (level === 7) return 'certified';
    if (level >= 4) return 'verified';
    return 'free_dry';
}

function generateUpsellMessage(
    level: number,
    currentTier: OrganizationTier,
    requiredTier: OrganizationTier
): string {
    if (level === 7) {
        return `🔒 Level 7 "God Mode" requires CERTIFIED tier. ` +
            `You are currently on ${TIER_NAMES[currentTier]}. ` +
            `Upgrade to unlock 10,000+ iteration adversarial testing with ` +
            `Batteries 10-13 (Goal Hijack, Tool Misuse, Memory Poison, Supply Chain).`;
    }

    if (level >= 4 && currentTier === 'free_dry') {
        return `🔒 Levels 4-6 require VERIFIED tier. ` +
            `You are currently on ${TIER_NAMES[currentTier]}. ` +
            `Upgrade to unlock extended battery testing including E2E, Integration, and Security audits.`;
    }

    return `🔒 Level ${level} requires ${TIER_NAMES[requiredTier]} tier. ` +
        `You are currently on ${TIER_NAMES[currentTier]}.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUOTA CHECK
// ═══════════════════════════════════════════════════════════════════════════

export interface QuotaResult {
    allowed: boolean;
    runsThisPeriod: number;
    maxRuns: number;
    periodEndsAt: string;
    reason?: string;
}

const TIER_QUOTAS: Record<OrganizationTier, number> = {
    free_dry: 3,      // 3 runs per month
    verified: 50,     // 50 runs per month
    certified: -1,    // Unlimited
};

/**
 * Check if organization has remaining quota for this billing period.
 */
export async function checkQuota(orgId: string): Promise<QuotaResult> {
    const supabase = getSupabaseClient();

    // Get organization tier
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('current_tier')
        .eq('id', orgId)
        .single();

    if (orgError || !org) {
        return {
            allowed: false,
            runsThisPeriod: 0,
            maxRuns: 0,
            periodEndsAt: '',
            reason: 'ORG_NOT_FOUND',
        };
    }

    const tier = org.current_tier as OrganizationTier;
    const maxRuns = TIER_QUOTAS[tier];

    // Unlimited for certified tier
    if (maxRuns === -1) {
        return {
            allowed: true,
            runsThisPeriod: 0,
            maxRuns: -1,
            periodEndsAt: '',
        };
    }

    // Count runs this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
        .from('armageddon_runs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('created_at', startOfMonth.toISOString());

    if (countError) {
        return {
            allowed: false,
            runsThisPeriod: 0,
            maxRuns: maxRuns,
            periodEndsAt: '',
            reason: 'QUOTA_CHECK_FAILED',
        };
    }

    const runsThisPeriod = count ?? 0;
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    return {
        allowed: runsThisPeriod < maxRuns,
        runsThisPeriod,
        maxRuns,
        periodEndsAt: endOfMonth.toISOString(),
        reason: runsThisPeriod >= maxRuns ? 'QUOTA_EXCEEDED' : undefined,
    };
}
