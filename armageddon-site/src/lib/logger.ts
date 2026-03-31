/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON LEVEL 7 — STRUCTURED LOGGER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Centralized logging utility that provides structured JSON output.
 * Designed to be compatible with log aggregators (ELK, Datadog, CloudWatch).
 *
 * Implementation Note:
 * This uses a lightweight internal implementation to avoid dependency issues
 * in the current environment while maintaining a Pino-compatible API.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

const CURRENT_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info';
const MIN_LEVEL_VAL = LOG_LEVELS[CURRENT_LEVEL] || 20;

/**
 * Formats and outputs a log entry.
 */
function formatLog(level: LogLevel, objOrMsg: any, msg?: string) {
    if (LOG_LEVELS[level] < MIN_LEVEL_VAL) return;

    let payload: any = {
        level,
        time: new Date().toISOString(),
    };

    if (typeof objOrMsg === 'string') {
        payload.msg = objOrMsg;
    } else {
        // Special handling for Error objects
        if (objOrMsg instanceof Error) {
            payload.error = {
                message: objOrMsg.message,
                stack: objOrMsg.stack,
            };
        } else if (objOrMsg.error instanceof Error) {
            const { error, ...rest } = objOrMsg;
            payload = {
                ...payload,
                ...rest,
                error: {
                    message: error.message,
                    stack: error.stack,
                }
            };
        } else {
            payload = { ...payload, ...objOrMsg };
        }

        if (msg) payload.msg = msg;
    }

    const output = JSON.stringify(payload);

    // Use appropriate console method for better stream redirection
    if (level === 'error') {
        console.error(output);
    } else if (level === 'warn') {
        console.warn(output);
    } else {
        console.log(output);
    }
}

export const logger = {
    debug: (obj: any, msg?: string) => formatLog('debug', obj, msg),
    info: (obj: any, msg?: string) => formatLog('info', obj, msg),
    warn: (obj: any, msg?: string) => formatLog('warn', obj, msg),
    error: (obj: any, msg?: string) => formatLog('error', obj, msg),
};

export default logger;
