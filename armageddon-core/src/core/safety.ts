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

  // Confirmed Production Patterns (Phase 1)
  private readonly productionPatterns: (RegExp | string)[] = [
    /\.prod\./i,
    /\.live\./i,
    /production\./i,
    /\.com$/i,      // Customer .com domains
    /\.io$/i,       // Customer .io domains
    /api\./i,       // API subdomains
    'stripe.com',   // Payment processors
    'aws.amazon.com',
    'firebaseio.com'
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
    this.assertNoProductionMatch(this.sandboxTenant, `SANDBOX_TENANT '${this.sandboxTenant}'`, ctx);
  }

  /**
   * Asserts that a value does not match any production patterns.
   * @throws SystemLockdownError if match found
   */
  private assertNoProductionMatch(value: string, label: string, contextSuffix: string = ''): void {
    for (const pattern of this.productionPatterns) {
      let matched = false;
      if (pattern instanceof RegExp) {
        matched = pattern.test(value);
      } else if (typeof pattern === 'string') {
        matched = value.includes(pattern);
      }

      if (matched) {
        throw new SystemLockdownError(
          `${label} matches production pattern '${pattern}'.${contextSuffix} Aborting.`
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
   * @throws SystemLockdownError if URL appears to be production or invalid
   */
  public validateTarget(url: string): void {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new SystemLockdownError(`Invalid URL format: ${url}`);
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new SystemLockdownError(
        `Target URL '${url}' uses forbidden protocol '${parsedUrl.protocol}'. Only http and https are allowed.`
      );
    }

    this.assertNoProductionMatch(parsedUrl.hostname, `Target URL hostname '${parsedUrl.hostname}'`);
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
