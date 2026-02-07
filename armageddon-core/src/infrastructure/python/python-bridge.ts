// src/infrastructure/python/python-bridge.ts
// ARMAGEDDON Level 7 - Kinetic Python Execution Bridge
// APEX Business Systems Ltd.
// DATE: 2026-02-06
//
// ARCHITECTURAL INVARIANTS:
// 1. spawn with { shell: false, detached: true } - NEVER exec()
// 2. readline for zero-latency log streaming
// 3. PGID kill with process.kill(-pid) for zombie annihilation
// 4. Regex redaction for secrets before any logging

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import { EventEmitter } from 'node:events';
import type {
    PythonExecutionConfig,
    ExecutionResult,
    LogLine,
    KineticMetrics,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// SECRET REDACTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * High-entropy secret patterns to redact from logs
 * Matches: sk-*, ghp_*, and any 32+ char alphanumeric strings
 */
const SECRET_REGEX = /(sk-[a-zA-Z0-9]{20,})|(ghp_[a-zA-Z0-9]{20,})|([a-zA-Z0-9]{32,})/g;
const REDACTION_MARKER = '***REDACTED***';

/**
 * Redact secrets from a string
 */
function redactSecrets(input: string): { output: string; redacted: boolean } {
    let redacted = false;
    const output = input.replaceAll(SECRET_REGEX, () => {
        redacted = true;
        return REDACTION_MARKER;
    });
    return { output, redacted };
}

// ═══════════════════════════════════════════════════════════════════════════
// PYTHON EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default Python path in Docker container
 */
const DEFAULT_PYTHON_PATH = '/opt/venv/bin/python3';
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * PythonExecutor - Kinetic execution bridge for Python processes
 *
 * Features:
 * - Process Group isolation for clean kills
 * - Real-time log streaming via readline
 * - Secret redaction middleware
 * - Temporal heartbeat integration
 */
export class PythonExecutor extends EventEmitter {
    private process: ChildProcess | null = null;
    private stdoutReader: Interface | null = null;
    private stderrReader: Interface | null = null;
    private readonly stdoutBuffer: string[] = [];
    private readonly stderrBuffer: string[] = [];
    private startTime: number = 0;
    private timeoutHandle: NodeJS.Timeout | null = null;
    private killed: boolean = false;

    constructor() {
        super();
    }

    /**
     * Execute a Python script or module
     *
     * @param config Execution configuration
     * @param onHeartbeat Optional callback for Temporal heartbeats
     */
    async execute(
        config: PythonExecutionConfig,
        onHeartbeat?: () => void
    ): Promise<ExecutionResult> {
        return new Promise((resolve, reject) => {
            const pythonPath = config.pythonPath || DEFAULT_PYTHON_PATH;
            const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;

            // Build command args
            const args = this.buildArgs(config);

            // Build environment with PYTHONUNBUFFERED
            const env: Record<string, string> = {
                ...process.env as Record<string, string>,
                PYTHONUNBUFFERED: '1',
                PYTHONDONTWRITEBYTECODE: '1',
                ...config.env,
            };

            this.startTime = Date.now();
            this.killed = false;

            // CRITICAL: spawn with detached:true for PGID kill capability
            this.process = spawn(pythonPath, args, {
                shell: false,  // INVARIANT: Never use shell
                detached: true, // INVARIANT: Required for PGID kill
                cwd: config.cwd || process.cwd(),
                env,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            const pid = this.process.pid;
            if (!pid) {
                reject(new Error('[PythonExecutor] Failed to spawn process'));
                return;
            }

            if (!this.process.stdout || !this.process.stderr) {
                reject(new Error('[PythonExecutor] Failed to initialize stdio'));
                return;
            }

            // Setup readline for zero-latency streaming
            this.setupStreamReader(
                this.process.stdout,
                'stdout',
                onHeartbeat
            );
            this.setupStreamReader(
                this.process.stderr,
                'stderr',
                onHeartbeat
            );

            // Setup timeout with PGID kill
            this.timeoutHandle = setTimeout(() => {
                console.warn(`[PythonExecutor] Timeout after ${timeoutMs}ms, killing PGID`);
                this.killProcessTree();
            }, timeoutMs);

            // Handle process exit
            this.process.on('exit', (code, signal) => {
                this.cleanup();

                const durationMs = Date.now() - this.startTime;
                const exitCode = code ?? (signal ? 128 : 1);

                const result: ExecutionResult = {
                    exitCode,
                    stdout: this.stdoutBuffer.join('\n'),
                    stderr: this.stderrBuffer.join('\n'),
                    jsonResult: this.parseJsonResult(),
                    durationMs,
                };

                this.emit('exit', result);
                resolve(result);
            });

            // Handle spawn errors
            this.process.on('error', (error) => {
                this.cleanup();
                this.emit('error', error);
                reject(error);
            });
        });
    }

    /**
     * Build command line arguments for Python
     */
    private buildArgs(config: PythonExecutionConfig): string[] {
        const args: string[] = [];

        if (config.module) {
            // Run as module: python -m garak ...
            args.push('-m', config.module);
        } else if (config.scriptPath) {
            // Run script: python script.py ...
            args.push(config.scriptPath);
        }

        args.push(...config.args);
        return args;
    }

    /**
     * Setup readline for streaming stdout/stderr
     */
    private setupStreamReader(
        stream: NodeJS.ReadableStream,
        type: 'stdout' | 'stderr',
        onHeartbeat?: () => void
    ): void {
        const reader = createInterface({
            input: stream,
            crlfDelay: Infinity,
        });

        reader.on('line', (line) => {
            // Redact secrets BEFORE any logging or storage
            const { output, redacted } = redactSecrets(line);

            const logLine: LogLine = {
                timestamp: new Date(),
                stream: type,
                content: output,
                redacted,
            };

            // Buffer for final result
            if (type === 'stdout') {
                this.stdoutBuffer.push(output);
            } else {
                this.stderrBuffer.push(output);
            }

            // Emit for real-time streaming to Supabase
            this.emit('log', logLine);

            // Heartbeat to prevent Temporal timeout
            if (onHeartbeat) {
                onHeartbeat();
            }
        });

        if (type === 'stdout') {
            this.stdoutReader = reader;
        } else {
            this.stderrReader = reader;
        }
    }

    /**
     * ZOMBIE ANNIHILATION: Kill entire Process Group (PGID)
     *
     * Uses process.kill(-pid) to send SIGKILL to the entire
     * process group, not just the parent. Requires detached: true.
     */
    killProcessTree(): void {
        if (this.killed || !this.process?.pid) {
            return;
        }

        this.killed = true;
        const pid = this.process.pid;

        try {
            // Kill the entire process group (negative PID)
            // This sends signal to all processes in the group
            process.kill(-pid, 'SIGKILL');
            console.log(`[PythonExecutor] Killed PGID ${pid}`);
        } catch (error) {
            // Process may have already exited
            console.warn(`[PythonExecutor] PGID kill failed for ${pid}:`, error);

            // Fallback: try killing just the process
            try {
                this.process.kill('SIGKILL');
            } catch {
                // Already dead
            }
        }
    }

    /**
     * Parse JSON result from final stdout lines
     * Looks for valid JSON in the last 5 lines
     */
    private parseJsonResult(): KineticMetrics | undefined {
        const lastLines = this.stdoutBuffer.slice(-5);

        for (let i = lastLines.length - 1; i >= 0; i--) {
            const line = lastLines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
                try {
                    return JSON.parse(line);
                } catch {
                    // Not valid JSON, continue
                }
            }
        }

        return undefined;
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }

        this.stdoutReader?.close();
        this.stderrReader?.close();
        this.stdoutReader = null;
        this.stderrReader = null;
    }

    /**
     * Check if process is running
     */
    isRunning(): boolean {
        return this.process !== null && !this.killed;
    }

    /**
     * Get current execution duration
     */
    getDuration(): number {
        if (!this.startTime) return 0;
        return Date.now() - this.startTime;
    }
}

/**
 * Factory function
 */
export function createPythonExecutor(): PythonExecutor {
    return new PythonExecutor();
}
