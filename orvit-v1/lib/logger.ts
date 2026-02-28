/**
 * Structured Logger with Pino
 *
 * Centralized logging system with:
 * - Pino for structured JSON logging
 * - Sensitive data redaction (passwords, tokens, JWT)
 * - Domain-specific child loggers
 * - Development-only debug logging
 */

import pino from 'pino';

// Sensitive field paths to redact
const REDACT_PATHS = [
  // Credenciales de usuario
  'password',
  'newPassword',
  'oldPassword',
  'passwordHash',
  // Tokens y sesiones
  'token',
  'accessToken',
  'refreshToken',
  'legacyToken',
  'jwt',
  'sessionToken',
  'inviteToken',
  'tokenHash',
  // Secretos y API keys
  'secret',
  'apiKey',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'DISCORD_BOT_TOKEN',
  'DISCORD_WEBHOOK_URL',
  'SMTP_PASSWORD',
  'WHATSAPP_API_KEY',
  // AWS
  'AWS_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SESSION_TOKEN',
  // Headers sensibles
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  // Datos personales sensibles
  'creditCard',
  'ssn',
  // Database connection strings
  'DATABASE_URL',
  'DIRECT_URL',
];

// Determine if running on server or client
const isServer = typeof window === 'undefined';
const isDev = process.env.NODE_ENV !== 'production';

// Create base Pino logger
// NOTE: pino-pretty uses thread-stream (worker threads) which crash on Next.js HMR.
// Never use transport in dev — plain JSON logs avoid the worker thread lifecycle issue.
const baseLogger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
});

// Export the main logger
export const logger = baseLogger as pino.Logger;

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
