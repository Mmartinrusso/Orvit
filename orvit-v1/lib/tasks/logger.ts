/**
 * Logger for the tasks module
 *
 * Wraps the central Pino logger with a task-specific API.
 * Maintains backward compatibility: logger.debug(message, data)
 */

import { loggers } from '@/lib/logger';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  module?: string;
  forceLog?: boolean;
}

class TaskLogger {
  private module: string;
  private pino: typeof loggers.tasks;

  constructor(module: string = 'Tasks') {
    this.module = module;
    this.pino = loggers.tasks;
  }

  debug(message: string, data?: unknown, _options?: LogOptions): void {
    if (data !== undefined) {
      this.pino.debug({ module: this.module, data }, message);
    } else {
      this.pino.debug({ module: this.module }, message);
    }
  }

  info(message: string, data?: unknown, _options?: LogOptions): void {
    if (data !== undefined) {
      this.pino.info({ module: this.module, data }, message);
    } else {
      this.pino.info({ module: this.module }, message);
    }
  }

  warn(message: string, data?: unknown): void {
    if (data !== undefined) {
      this.pino.warn({ module: this.module, data }, message);
    } else {
      this.pino.warn({ module: this.module }, message);
    }
  }

  error(message: string, error?: unknown): void {
    if (error !== undefined) {
      this.pino.error({ module: this.module, err: error }, message);
    } else {
      this.pino.error({ module: this.module }, message);
    }
  }

  child(submodule: string): TaskLogger {
    return new TaskLogger(`${this.module}:${submodule}`);
  }
}

// Pre-created instances for different modules
export const taskLogger = new TaskLogger('Tasks');
export const fixedTaskLogger = new TaskLogger('FixedTasks');
export const taskHistoryLogger = new TaskLogger('TaskHistory');
export const taskApiLogger = new TaskLogger('TaskAPI');

// Factory function for custom loggers
export function createLogger(module: string): TaskLogger {
  return new TaskLogger(module);
}

// Helper for conditional simple logging
export function devLog(message: string, data?: unknown): void {
  loggers.tasks.debug({ data }, message);
}

// Helper for performance logging
export function perfLog(label: string, startTime: number): void {
  const duration = Date.now() - startTime;
  loggers.tasks.debug({ label, duration }, `Performance: ${label}`);
}
