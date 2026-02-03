// src/core/safety.ts
// ARMAGEDDON LEVEL 7 - SAFETY LOCKS
// APEX Business Systems Ltd. - Zero-Trust Security

/**
 * SystemLockdownError - Non-retryable error thrown when safety checks fail.
 * This error MUST NOT be caught and retried by Temporal.
 */
export class SystemLockdownError extends Error {
  public readonly nonRetryable = true;
  public readonly type = 'SYSTEM_LOCKDOWN';

  constructor(message: string) {
    super(`[LOCKDOWN] ${message}`);
    this.name = 'SystemLockdownError';
    Object.setPrototypeOf(this, SystemLockdownError.prototype);
  }
}

/**
 * SafetyGuard - Enforces sandbox-only execution.
 * INVARIANT: If SIM_MODE !== 'true' OR SANDBOX_TENANT is missing, PANIC.
 */
export class SafetyGuard {
  private static instance: SafetyGuard | null = null;

  private readonly simMode: boolean;
  private readonly sandboxTenant: string | undefined;
  private readonly productionPatterns = [
    /prod/i,
    /production/i,
    /live/i,
    /\.com$/,
    /\.io$/,
  ];

  private constructor() {
    this.simMode = process.env.SIM_MODE === 'true';
    this.sandboxTenant = process.env.SANDBOX_TENANT;
  }

  public static getInstance(): SafetyGuard {
    SafetyGuard.instance ??= new SafetyGuard();
    return SafetyGuard.instance;
  }

  /**
   * Resets the singleton instance. FOR TESTING ONLY.
   */
  public static resetForTesting(): void {
    SafetyGuard.instance = null;
  }

  /**
   * Enforces all safety checks. Call at the start of EVERY activity.
   * @throws SystemLockdownError if any check fails
   */
  public enforce(context?: string): void {
    const ctx = context ? ` [${context}]` : '';

    // CHECK 1: SIM_MODE must be explicitly 'true'
    if (!this.simMode) {
      throw new SystemLockdownError(
        `SIM_MODE not set or not 'true'.${ctx} Refusing to execute adversarial operations against potential production system.`
      );
    }

    // CHECK 2: SANDBOX_TENANT must be defined
    if (!this.sandboxTenant || this.sandboxTenant.trim() === '') {
      throw new SystemLockdownError(
        `SANDBOX_TENANT not defined.${ctx} Cannot execute without explicit tenant isolation.`
      );
    }

    // CHECK 3: SANDBOX_TENANT must not match production patterns
    for (const pattern of this.productionPatterns) {
      if (pattern.test(this.sandboxTenant)) {
        throw new SystemLockdownError(
          `SANDBOX_TENANT '${this.sandboxTenant}' matches production pattern.${ctx} Aborting.`
        );
      }
    }
  }

  /**
   * Returns current safety status for telemetry.
   */
  public getStatus(): SafetyStatus {
    return {
      simMode: this.simMode,
      sandboxTenant: this.sandboxTenant ?? null,
      enforced: this.simMode && !!this.sandboxTenant,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validates a target URL is not production.
   * @throws SystemLockdownError if URL appears to be production
   */
  public validateTarget(url: string): void {
    const prodIndicators = ['prod', 'production', 'live', 'main'];
    const lowerUrl = url.toLowerCase();

    for (const indicator of prodIndicators) {
      if (lowerUrl.includes(indicator)) {
        throw new SystemLockdownError(
          `Target URL '${url}' contains production indicator '${indicator}'. Refusing.`
        );
      }
    }
  }
}

export interface SafetyStatus {
  simMode: boolean;
  sandboxTenant: string | null;
  enforced: boolean;
  timestamp: string;
}

// Singleton export for convenience
export const safetyGuard = SafetyGuard.getInstance();
