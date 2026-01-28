/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON LEVEL 7 — SHARED TYPES (LOCAL COPY)
 * Unified input types for consistent iterations handling
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Canonical input type for runBattery activities
export interface RunBatteryInput {
    runId: string;
    iterations: number;
    heartbeatInterval?: number;
}

// Canonical workflow input type
export interface WorkflowInput {
    runId: string;
    organizationId: string;
    iterations: number;
    batteries?: string[];
}

// Battery result interface (unified)
export interface BatteryResult {
    batteryId: string;
    status: 'PASSED' | 'FAILED' | 'BLOCKED';
    iterations: number;
    blockedCount: number;
    breachCount: number;
    driftScore: number;
    duration: number;
    details: Record<string, unknown>;
}

// Iterations normalization (site-specific implementation)
export const normalizeIterations = (val?: number | null): number => {
    const DEFAULT = 2500;
    if (val == null) return DEFAULT;

    const n = Number(val);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return DEFAULT;

    return Math.min(Math.max(n, 1), 10000);
};

// Battery ID validation (site-specific implementation)
export const validateBatteryIds = (ids?: string[]): string[] => {
    if (!ids?.length) return ['B10', 'B11', 'B12', 'B13'];

    const unique = Array.from(new Set(ids));
    const pattern = /^B1[0-3]$/;
    
    // Fail fast if any invalid
    const invalid = unique.filter(id => !pattern.test(id));
    if (invalid.length > 0) {
        throw new Error(`Invalid battery IDs found: ${invalid.join(', ')}`);
    }

    return unique;
};