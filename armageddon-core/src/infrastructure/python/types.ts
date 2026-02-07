// src/infrastructure/python/types.ts
// ARMAGEDDON Level 7 - Kinetic Engine Type Definitions
// APEX Business Systems Ltd.
// DATE: 2026-02-06

/**
 * Configuration for Python script execution
 */
export interface PythonExecutionConfig {
    /** Path to script (e.g., './scripts/stress.py') */
    scriptPath?: string;
    /** Python module name (e.g., 'garak') */
    module?: string;
    /** Command line arguments */
    args: string[];
    /** Environment overrides. SENSITIVE: Do not log this object. */
    env?: Record<string, string>;
    /** Working directory */
    cwd?: string;
    /** Hard timeout in ms. Triggers PGID kill. */
    timeoutMs?: number;
    /** Path to python binary. DEFAULT: '/opt/venv/bin/python3' */
    pythonPath?: string;
}

/**
 * Result of Python execution
 */
export interface ExecutionResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    /** Structured metrics parsed from the final output lines */
    jsonResult?: KineticMetrics;
    durationMs: number;
}

/**
 * Kinetic performance metrics from stress/adversarial tests
 */
export interface KineticMetrics {
    /** Time to First Token (ms) */
    ttft_mean_ms: number;
    /** Tokens Per Second */
    tps_mean: number;
    /** Total requests made */
    total_requests: number;
    /** Error rate (0.0 - 1.0) */
    error_rate: number;
}

/**
 * Garak adversarial test configuration
 */
export interface GarakConfig {
    /** Target model identifier */
    model: string;
    /** Probe/attack type (e.g., 'dan', 'encoding', 'gcg') */
    probe: string;
    /** Number of attack iterations */
    generations?: number;
    /** API key for target model */
    apiKey?: string;
    /** API base URL */
    apiBase?: string;
}

/**
 * Log line emitted by PythonExecutor
 */
export interface LogLine {
    timestamp: Date;
    stream: 'stdout' | 'stderr';
    content: string;
    /** Whether content was redacted */
    redacted: boolean;
}

/**
 * Execution events
 */
export interface ExecutorEvents {
    log: (line: LogLine) => void;
    progress: (percent: number, message: string) => void;
    error: (error: Error) => void;
    exit: (result: ExecutionResult) => void;
}
