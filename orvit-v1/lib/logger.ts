/**
 * Structured Logger with Pino
 *
 * Centralized logging system with:
 * - Pino for structured JSON logging
 * - Sentry integration for error/warn in production
 * - Sensitive data redaction (passwords, tokens, JWT)
 * - Domain-specific child loggers
 * - Development-only debug logging
 */

import pino from 'pino';
import * as Sentry from '@sentry/nextjs';

// Sensitive field paths to redact
const REDACT_PATHS = [
  'password',
  'newPassword',
  'oldPassword',
  'token',
  'accessToken',
  'refreshToken',
  'legacyToken',
  'jwt',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'creditCard',
  'ssn',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'req.headers.authorization',
  'req.headers.cookie',
];

// Determine if running on server or client
const isServer = typeof window === 'undefined';
const isDev = process.env.NODE_ENV !== 'production';

// Create base Pino logger
const baseLogger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  ...(isDev && isServer
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

// Sentry-integrated logger wrapper
function createSentryAwareLogger(pinoLogger: pino.Logger) {
  const original = {
    error: pinoLogger.error.bind(pinoLogger),
    warn: pinoLogger.warn.bind(pinoLogger),
  };

  // Override error to also capture in Sentry
  const wrappedError = (...args: Parameters<pino.LogFn>) => {
    original.error(...args);

    // Send to Sentry in production
    if (!isDev) {
      try {
        const [first, ...rest] = args;
        if (first instanceof Error) {
          Sentry.captureException(first, {
            extra: rest.length > 0 ? { message: rest[0] } : undefined,
          });
        } else if (typeof first === 'object' && first !== null) {
          const meta = first as Record<string, unknown>;
          const err = meta.err || meta.error;
          if (err instanceof Error) {
            Sentry.captureException(err, { extra: meta });
          } else {
            Sentry.captureMessage(
              typeof rest[0] === 'string' ? rest[0] : 'Error logged',
              { level: 'error', extra: meta }
            );
          }
        } else if (typeof first === 'string') {
          Sentry.captureMessage(first, { level: 'error' });
        }
      } catch {
        // Don't let Sentry errors break logging
      }
    }
  };

  // Override warn to also send breadcrumb to Sentry
  const wrappedWarn = (...args: Parameters<pino.LogFn>) => {
    original.warn(...args);

    if (!isDev) {
      try {
        const [first, ...rest] = args;
        const message = typeof first === 'string' ? first : typeof rest[0] === 'string' ? rest[0] : 'Warning';
        Sentry.addBreadcrumb({
          category: 'warning',
          message,
          level: 'warning',
          data: typeof first === 'object' && first !== null ? (first as Record<string, unknown>) : undefined,
        });
      } catch {
        // Don't let Sentry errors break logging
      }
    }
  };

  return { wrappedError, wrappedWarn };
}

const { wrappedError, wrappedWarn } = createSentryAwareLogger(baseLogger);

// Export the main logger with Sentry-aware error/warn
export const logger = Object.assign(Object.create(baseLogger), baseLogger, {
  error: wrappedError,
  warn: wrappedWarn,
}) as pino.Logger;

// ============================================================================
// Domain-specific child loggers
// ============================================================================

export const loggers = {
  auth: baseLogger.child({ domain: 'auth' }),
  permissions: baseLogger.child({ domain: 'permissions' }),
  database: baseLogger.child({ domain: 'database' }),
  cache: baseLogger.child({ domain: 'cache' }),
  s3: baseLogger.child({ domain: 's3' }),
  costs: baseLogger.child({ domain: 'costs' }),
  tasks: baseLogger.child({ domain: 'tasks' }),
  cron: baseLogger.child({ domain: 'cron' }),
  notifications: baseLogger.child({ domain: 'notifications' }),
  utils: baseLogger.child({ domain: 'utils' }),
  afip: baseLogger.child({ domain: 'afip' }),
  ocr: baseLogger.child({ domain: 'ocr' }),
  chatbot: baseLogger.child({ domain: 'chatbot' }),
  forecast: baseLogger.child({ domain: 'forecast' }),
  api: baseLogger.child({ domain: 'api' }),
  discord: baseLogger.child({ domain: 'discord' }),
};

// Legacy named exports for backward compatibility
export const afipLogger = loggers.afip;
export const ocrLogger = loggers.ocr;
export const chatbotLogger = loggers.chatbot;
export const forecastLogger = loggers.forecast;

// ============================================================================
// Backward-compatible exports (used by existing code)
// ============================================================================

/**
 * Development-only conditional logger (replaces lib/debug-logger.ts)
 */
export const debugLog = (...args: unknown[]) => {
  if (isDev) {
    baseLogger.debug({ args: args.length === 1 ? args[0] : args }, typeof args[0] === 'string' ? args[0] : 'debug');
  }
};

// Overloaded debugLog with named methods for backward compat with MachineDetailDialog
debugLog.log = debugLog;
debugLog.warn = (...args: unknown[]) => {
  if (isDev) baseLogger.warn({ args }, typeof args[0] === 'string' ? args[0] : 'warning');
};
debugLog.error = (...args: unknown[]) => {
  baseLogger.error({ args }, typeof args[0] === 'string' ? args[0] : 'error');
};
debugLog.info = debugLog;
debugLog.verbose = (...args: unknown[]) => {
  if (isDev && typeof window !== 'undefined' && (window as any).__VERBOSE_LOGS__) {
    baseLogger.debug({ args }, typeof args[0] === 'string' ? args[0] : 'verbose');
  }
};

/**
 * Log API performance (used by bootstrap/machines routes)
 */
export function logApiPerformance(endpoint: string, context: Record<string, unknown> = {}) {
  const start = Date.now();
  loggers.api.debug({ endpoint, ...context }, `API ${endpoint} started`);

  return {
    end(extra: Record<string, unknown> = {}) {
      const duration = Date.now() - start;
      loggers.api.info({ endpoint, duration, ...context, ...extra }, `API ${endpoint} completed`);
      return duration;
    },
  };
}

/**
 * Log API errors (used by bootstrap/machines routes)
 */
export function logApiError(endpoint: string, error: unknown, context: Record<string, unknown> = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  loggers.api.error({ endpoint, err, ...context }, `API ${endpoint} error`);
}

// ============================================================================
// Utilities
// ============================================================================

export function logAPICall(method: string, endpoint: string, duration: number, statusCode: number) {
  loggers.api.info({ method, endpoint, duration, statusCode }, 'API Call');
}

export class PerformanceTracker {
  private start: number;
  private context: Record<string, unknown>;

  constructor(operation: string, context: Record<string, unknown> = {}) {
    this.start = Date.now();
    this.context = { operation, ...context };
  }

  end() {
    const duration = Date.now() - this.start;
    logger.info({ ...this.context, duration }, 'Operation completed');
    return duration;
  }
}
