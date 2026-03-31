import pino from 'pino';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON LEVEL 7 — STRUCTURED LOGGER
 * ═══════════════════════════════════════════════════════════════════════════
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Centralized logger using Pino for structured, high-performance logging.
 *
 * Features:
 * - Pretty-printing in development.
 * - JSON output in production for observability.
 * - Consistent log levels (info, warn, error, debug).
 */
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    browser: {
        asObject: true
    },
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                ignore: 'pid,hostname',
                translateTime: 'SYS:standard',
            },
          }
        : undefined,
});

export default logger;
