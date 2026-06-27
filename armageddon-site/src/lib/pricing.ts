/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRICING — single source of truth
 * ═══════════════════════════════════════════════════════════════════════════
 * Centralizes plan ids, names, prices, copy, CTA labels. Payment hrefs are
 * resolved separately in `payment-links.ts` so checkout wiring stays isolated.
 */

export type PlanId = 'self-serve' | 'pro' | 'team' | 'verified' | 'certified' | 'enterprise';

export type BillingCadence = 'free' | 'monthly' | 'one-time' | 'annual';

export interface Plan {
    readonly id: PlanId;
    readonly name: string;
    /** Display price, e.g. "CAD $29" or "Free". */
    readonly price: string;
    readonly cadence: BillingCadence;
    /** Short cadence suffix for display, e.g. "/month", "one-time", "/year". */
    readonly cadenceLabel: string;
    readonly tagline: string;
    readonly features: readonly string[];
    readonly ctaLabel: string;
    readonly highlight?: boolean;
}

export const PLAN_ORDER: readonly PlanId[] = [
    'self-serve',
    'pro',
    'team',
    'verified',
    'certified',
    'enterprise',
];

export const PLANS: Readonly<Record<PlanId, Plan>> = {
    'self-serve': {
        id: 'self-serve',
        name: 'Self-Serve Dry Run',
        price: 'Free',
        cadence: 'free',
        cadenceLabel: '',
        tagline: 'Run a failure-focused dry run and download the evidence.',
        features: [
            'Sandboxed adversarial dry run',
            'Core battery coverage',
            'JSON evidence export',
            'No card required',
        ],
        ctaLabel: 'Start Free',
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 'CAD $29',
        cadence: 'monthly',
        cadenceLabel: '/month',
        tagline: 'Recurring evidence runs for an individual builder.',
        features: [
            'Everything in Self-Serve',
            'Expanded battery selection',
            'Run history & evidence retention',
            'Priority queue',
        ],
        ctaLabel: 'Choose Pro',
    },
    team: {
        id: 'team',
        name: 'Team',
        price: 'CAD $79',
        cadence: 'monthly',
        cadenceLabel: '/month',
        tagline: 'Shared evidence workflow for a release team.',
        features: [
            'Everything in Pro',
            'Shared organization workspace',
            'Custom battery configuration',
            'Team evidence dashboard',
        ],
        ctaLabel: 'Choose Team',
    },
    verified: {
        id: 'verified',
        name: 'Verified Evidence Review',
        price: 'CAD $499',
        cadence: 'one-time',
        cadenceLabel: 'one-time',
        tagline: 'Human review of your run evidence with a written summary.',
        features: [
            'Analyst review of submitted evidence',
            'Written release-readiness summary',
            'Findings & remediation notes',
            'One target system',
        ],
        ctaLabel: 'Request Verified Review',
    },
    certified: {
        id: 'certified',
        name: 'Certified Release Gate',
        price: 'CAD $1,499',
        cadence: 'one-time',
        cadenceLabel: 'one-time',
        tagline: 'Structured release-readiness gate with a signed evidence certificate.',
        features: [
            'Everything in Verified Review',
            'Release-gate checklist & sign-off',
            'Signed evidence certificate on completion',
            'Re-test window included',
        ],
        ctaLabel: 'Request Certified Gate',
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise Assurance',
        price: 'from CAD $4,999',
        cadence: 'annual',
        cadenceLabel: '/year',
        tagline: 'Scoped, ongoing assurance program for organizations.',
        features: [
            'Custom scope & battery program',
            'Multiple systems & environments',
            'Scheduled assurance cycles',
            'Dedicated point of contact',
        ],
        ctaLabel: 'Request Access',
    },
};

export const PRICING_COPY = {
    headline: 'Know if your release can survive before customers do.',
    subheadline:
        'Armageddon Test Suite runs failure-focused checks, captures evidence, and gives teams a clear release-readiness path: from free dry runs to verified certification gates.',
    safety:
        'Armageddon evidence is release-readiness evidence, not a substitute for SOC 2, ISO certification, or a formal penetration test.',
} as const;

/** Public, human-readable tier price list used to keep intake/onboarding aligned. */
export const PUBLIC_PRICE_LADDER: readonly string[] = [
    'Free',
    'CAD $29/month',
    'CAD $79/month',
    'CAD $499 one-time',
    'CAD $1,499 one-time',
    'Enterprise from CAD $4,999/year',
];
