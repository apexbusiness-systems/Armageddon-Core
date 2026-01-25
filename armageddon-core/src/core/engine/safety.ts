/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON LEVEL 7 — SAFETY GUARD
 * SystemLockdownError if SIM_MODE !== 'true' or SANDBOX_TENANT missing
 * ═══════════════════════════════════════════════════════════════════════════
 */

export class SystemLockdownError extends Error {
    public readonly code = 'SYSTEM_LOCKDOWN';
    public readonly httpStatus = 403;

    constructor(message: string) {
        super(message);
        this.name = 'SystemLockdownError';
        Object.setPrototypeOf(this, SystemLockdownError.prototype);
    }
}

export interface SafetyConfig {
    simMode: boolean;
    sandboxTenant: string | undefined;
}

/**
 * Reads safety configuration from environment
 */
export function getSafetyConfig(): SafetyConfig {
    return {
        simMode: process.env.SIM_MODE === 'true',
        sandboxTenant: process.env.SANDBOX_TENANT,
    };
}

/**
 * Guard function that enforces simulation mode and sandbox tenant.
 * MUST be called at the start of every workflow and activity.
 * 
 * @throws SystemLockdownError if safety requirements not met
 */
export function enforceSafetyGuard(): void {
    const config = getSafetyConfig();

    // INVARIANT: SIM_MODE must be explicitly set to 'true'
    if (!config.simMode) {
        throw new SystemLockdownError(
            'LOCKDOWN: SIM_MODE is not set to "true". ' +
            'Armageddon Level 7 cannot execute in production mode. ' +
            'Set SIM_MODE=true to enable sandboxed testing.'
        );
    }

    // INVARIANT: SANDBOX_TENANT must be defined
    if (!config.sandboxTenant || config.sandboxTenant.trim() === '') {
        throw new SystemLockdownError(
            'LOCKDOWN: SANDBOX_TENANT is not defined. ' +
            'Armageddon Level 7 requires an isolated sandbox environment. ' +
            'Set SANDBOX_TENANT=<your-test-tenant> to proceed.'
        );
    }
}

/**
 * SafetyGuard class for stateful safety enforcement
 */
export class SafetyGuard {
    private readonly config: SafetyConfig;
    private enforced: boolean = false;

    constructor() {
        this.config = getSafetyConfig();
    }

    /**
     * Enforce safety requirements
     * @throws SystemLockdownError if requirements not met
     */
    enforce(): this {
        enforceSafetyGuard();
        this.enforced = true;
        return this;
    }

    /**
     * Check if safety has been enforced
     */
    isEnforced(): boolean {
        return this.enforced;
    }

    /**
     * Get current configuration
     */
    getConfig(): SafetyConfig {
        return { ...this.config };
    }

    /**
     * Get sandbox tenant (throws if not enforced)
     */
    getSandboxTenant(): string {
        if (!this.enforced) {
            throw new Error('SafetyGuard.enforce() must be called first');
        }
        return this.config.sandboxTenant!;
    }
}

/**
 * Create and enforce a new SafetyGuard
 */
export function createSafetyGuard(): SafetyGuard {
    return new SafetyGuard().enforce();
}
