/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON — CERTIFICATION LEVELS — SINGLE SOURCE OF TRUTH
 * ───────────────────────────────────────────────────────────────────────────
 * This module is the ONE authoritative definition of what each certification
 * level is and what capability it requires. Every "Level N" claim and every
 * level/tier gate in the build MUST derive from here so the claim can never
 * drift from the capability.
 *
 * DESIGN CONTRACT
 *   • PURE: zero runtime dependencies (no `node:*`, no Supabase, no DOM). Safe
 *     to import from Node services, Next.js routes, the Temporal worker, AND
 *     (via a build-time mirror — see scripts/check-level-integrity.mjs) the
 *     Cloudflare edge Worker.
 *   • FROZEN: every exported structure is deep-frozen → immutable at runtime,
 *     making consumers atomically idempotent (no accidental mutation/drift).
 *   • DERIVED: tier→level access and required-tier lookups are COMPUTED from the
 *     manifest, not hand-maintained, so adding/raising a level is a one-line
 *     change here and propagates everywhere.
 *
 * LEVEL 8 — LOCKED DEFINITION (canonical)
 *   Level 8 = the certification batteries executed inside the air-gapped
 *   "Kinetic Moat" (Dockerised Temporal + worker + Python bridge), in LIVE-FIRE
 *   mode (real LLM attacker/target/judge — PAIR), and sealed with a
 *   tamper-evident Ed25519 + RFC-6962 Merkle attestation receipt that any third
 *   party can verify offline. It is Level 7 ("God Mode") executed air-gapped,
 *   live, and notarised.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Bounds ───────────────────────────────────────────────────────────────────

/** Lowest selectable certification level. */
export const MIN_CERTIFICATION_LEVEL = 1 as const;

/**
 * Highest certification level the build can execute and is therefore allowed to
 * claim. Raising this is the ONLY edit needed to introduce a new top level;
 * gates, copy-checks, and tier access all derive from it.
 */
export const MAX_CERTIFICATION_LEVEL = 8 as const;

/** Inclusive integer range [1..8]. */
export type CertificationLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Billing tiers, ordered weakest → strongest. Canonical literal set. */
export type BillingTier = 'free_dry' | 'verified' | 'certified';

/** Where a level's batteries are executed. */
export type ExecutionEnvironment = 'CLOUD' | 'MOAT';

/** How the adversary is driven for a level. */
export type AdversaryMode = 'SIMULATION' | 'LIVE_FIRE';

/** Capability contract for a single certification level. */
export interface LevelCapability {
    readonly level: CertificationLevel;
    readonly codename: string;
    /** Minimum billing tier that may request this level. */
    readonly minTier: BillingTier;
    /** Required execution environment. */
    readonly environment: ExecutionEnvironment;
    /** Required adversary driver. */
    readonly adversary: AdversaryMode;
    /** True when the level's certificate is a tamper-evident signed receipt. */
    readonly attested: boolean;
    /** One-line human description (used in upsell/marketing copy). */
    readonly summary: string;
}

// ── Tier ranking (single source for "is tier ≥ X") ──────────────────────────

const TIER_RANK: Readonly<Record<BillingTier, number>> = Object.freeze({
    free_dry: 0,
    verified: 1,
    certified: 2,
});

/** All billing tiers, weakest → strongest. */
export const BILLING_TIERS: readonly BillingTier[] = Object.freeze([
    'free_dry',
    'verified',
    'certified',
]);

// ── The manifest (the locked definition) ────────────────────────────────────

function freezeLevel(c: LevelCapability): LevelCapability {
    return Object.freeze(c);
}

/**
 * Authoritative capability map, keyed by level. Ordered 1..8.
 * Levels 1–6 are cloud/simulation tiers of increasing battery breadth.
 * Level 7 is "God Mode" (certified, cloud, live-fire capable, attested).
 * Level 8 is the air-gapped Moat + live-fire + attested apex (see header).
 */
export const CERTIFICATION_LEVELS: Readonly<Record<CertificationLevel, LevelCapability>> = Object.freeze({
    1: freezeLevel({ level: 1, codename: 'RECON', minTier: 'free_dry', environment: 'CLOUD', adversary: 'SIMULATION', attested: false, summary: 'Sandboxed dry run — core battery smoke pass.' }),
    2: freezeLevel({ level: 2, codename: 'PROBE', minTier: 'free_dry', environment: 'CLOUD', adversary: 'SIMULATION', attested: false, summary: 'Sandboxed dry run — expanded deterministic probes.' }),
    3: freezeLevel({ level: 3, codename: 'STRESS', minTier: 'free_dry', environment: 'CLOUD', adversary: 'SIMULATION', attested: false, summary: 'Sandboxed dry run — chaos/stress simulation.' }),
    4: freezeLevel({ level: 4, codename: 'AUDIT', minTier: 'verified', environment: 'CLOUD', adversary: 'SIMULATION', attested: false, summary: 'Verified tier — security & integration audit batteries.' }),
    5: freezeLevel({ level: 5, codename: 'E2E', minTier: 'verified', environment: 'CLOUD', adversary: 'SIMULATION', attested: false, summary: 'Verified tier — end-to-end workflow batteries.' }),
    6: freezeLevel({ level: 6, codename: 'HARDEN', minTier: 'verified', environment: 'CLOUD', adversary: 'SIMULATION', attested: false, summary: 'Verified tier — full hardening sweep.' }),
    7: freezeLevel({ level: 7, codename: 'GOD_MODE', minTier: 'certified', environment: 'CLOUD', adversary: 'LIVE_FIRE', attested: true, summary: 'Certified — God Mode adversarial batteries with signed receipt.' }),
    8: freezeLevel({ level: 8, codename: 'KINETIC_MOAT', minTier: 'certified', environment: 'MOAT', adversary: 'LIVE_FIRE', attested: true, summary: 'Certified — air-gapped Moat, live-fire PAIR, tamper-evident attestation.' }),
});

// ── Derived access tables (computed once, frozen) ────────────────────────────

function computeTierLevelAccess(): Readonly<Record<BillingTier, readonly CertificationLevel[]>> {
    const out = {} as Record<BillingTier, CertificationLevel[]>;
    for (const tier of BILLING_TIERS) out[tier] = [];
    for (let lvl = MIN_CERTIFICATION_LEVEL; lvl <= MAX_CERTIFICATION_LEVEL; lvl++) {
        const cap = CERTIFICATION_LEVELS[lvl as CertificationLevel];
        for (const tier of BILLING_TIERS) {
            if (TIER_RANK[tier] >= TIER_RANK[cap.minTier]) out[tier].push(cap.level);
        }
    }
    return Object.freeze({
        free_dry: Object.freeze(out.free_dry),
        verified: Object.freeze(out.verified),
        certified: Object.freeze(out.certified),
    });
}

/**
 * Tier → allowed certification levels, DERIVED from the manifest.
 * Replaces every hand-maintained copy of this table across the build.
 */
export const TIER_LEVEL_ACCESS: Readonly<Record<BillingTier, readonly CertificationLevel[]>> = computeTierLevelAccess();

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Type guard: is `n` an executable certification level (integer in [1..MAX])? */
export function isCertificationLevel(n: unknown): n is CertificationLevel {
    return typeof n === 'number'
        && Number.isInteger(n)
        && n >= MIN_CERTIFICATION_LEVEL
        && n <= MAX_CERTIFICATION_LEVEL;
}

/** Capability for a level, or undefined if out of range. */
export function getLevelCapability(level: number): LevelCapability | undefined {
    return isCertificationLevel(level) ? CERTIFICATION_LEVELS[level] : undefined;
}

/** Levels a tier may run (empty array for unknown tier). */
export function allowedLevelsForTier(tier: string): readonly CertificationLevel[] {
    return TIER_LEVEL_ACCESS[tier as BillingTier] ?? [];
}

/** Does `tier` have access to `level`? */
export function tierCanRunLevel(tier: string, level: number): boolean {
    return isCertificationLevel(level) && allowedLevelsForTier(tier).includes(level);
}

/** Minimum billing tier required to run `level` (undefined if invalid). */
export function requiredTierForLevel(level: number): BillingTier | undefined {
    return getLevelCapability(level)?.minTier;
}

/** True when the level must run inside the air-gapped Moat (Level 8). */
export function levelRequiresMoat(level: number): boolean {
    return getLevelCapability(level)?.environment === 'MOAT';
}

/** True when the level must use a real LLM adversary (Levels 7–8). */
export function levelRequiresLiveFire(level: number): boolean {
    return getLevelCapability(level)?.adversary === 'LIVE_FIRE';
}

/** True when the level produces a tamper-evident signed receipt (Levels 7–8). */
export function levelIsAttested(level: number): boolean {
    return getLevelCapability(level)?.attested === true;
}
