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

// Iterations normalization function
export function normalizeIterations(inputIterations?: number): number {
    // Default iterations
    const defaultIterations = 2500;
    
    // If no input provided, use default
    if (inputIterations === undefined || inputIterations === null) {
        return defaultIterations;
    }
    
    // Ensure it's a finite integer
    const iterations = Number(inputIterations);
    if (!Number.isFinite(iterations) || !Number.isInteger(iterations)) {
        return defaultIterations;
    }
    
    // Ensure within safe bounds (1 to 10000)
    const minIterations = 1;
    const maxIterations = 10000;
    
    if (iterations < minIterations) {
        return minIterations;
    }
    
    if (iterations > maxIterations) {
        return maxIterations;
    }
    
    return iterations;
}

// Validate battery IDs
export function validateBatteryIds(batteryIds?: string[]): string[] {
    if (!batteryIds || batteryIds.length === 0) {
        return ['B10', 'B11', 'B12', 'B13']; // Default: all batteries
    }
    
    // Remove duplicates
    const uniqueBatteries = Array.from(new Set(batteryIds));
    
    // Validate battery IDs
    const validPattern = /^B1[0-3]$/;
    const invalidBatteries = uniqueBatteries.filter(b => !validPattern.test(b));
    
    if (invalidBatteries.length > 0) {
        throw new Error(`Invalid battery IDs: ${invalidBatteries.join(', ')}. Allowed: B10, B11, B12, B13`);
    }
    
    return uniqueBatteries;
}