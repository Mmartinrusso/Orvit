import { EventEmitter } from 'events';
import { createChildLogger } from '../utils/logger.js';
import type { PipelineStage, PipelineMode, RepoInfo } from '../types/index.js';

const logger = createChildLogger('task-tracker');

// Event emitter for real-time task updates (used by SSE endpoints)
export const taskEvents = new EventEmitter();
taskEvents.setMaxListeners(50); // Allow up to 50 concurrent SSE connections

export interface TaskLogEntry {
  timestamp: Date;
  stage: PipelineStage;
  type: 'stage_start' | 'stage_end' | 'info' | 'error' | 'output';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Configuration options for task registration
 */
export interface TaskRegistrationOptions {
  taskId: string;
  prompt: string;
  model: string;
  pipelineMode: PipelineMode;
  repoUrl?: string;
  repos?: RepoInfo[];
  branch?: string;
  autoCommit?: boolean;
  createPr?: boolean;
  createBranch?: boolean;
  conversationId?: string;  // DEPRECATED
  continueTaskId?: string;  // Task ID to continue from
}

export interface ActiveTask {
  taskId: string;
  prompt: string;
  model: string;
  currentStage: PipelineStage;
  stagesCompleted: PipelineStage[];
  startedAt: Date;
  abortController: AbortController;
  workspacePath?: string;
  repoUrl?: string;
  repos?: RepoInfo[];
  logs: TaskLogEntry[];
}

// In-memory store for active tasks
const activeTasks = new Map<string, ActiveTask>();

// Keep recent completed task logs for a short time (for viewing just-finished tasks)
const recentTaskLogs = new Map<string, { logs: TaskLogEntry[]; completedAt: Date }>();
const RECENT_LOGS_RETENTION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Register a new active task with full configuration
 */
export function registerTask(options: TaskRegistrationOptions): AbortController {
  const abortController = new AbortController();

  const task: ActiveTask = {
    taskId: options.taskId,
    prompt: options.prompt,
    model: options.model,
    currentStage: 'analyzer',
    stagesCompleted: [],
    startedAt: new Date(),
    abortController,
    repoUrl: options.repoUrl,
    repos: options.repos,
    logs: [],
  };

  // Build detailed initial log entry
  const pipelineModeLabels: Record<PipelineMode, string> = {
    auto: 'Automatico (decide segun complejidad)',
    fast: 'Rapido (menos etapas)',
    full: 'Completo (todas las etapas)',
  };

  // Build repos info string
  let reposInfo = 'Ninguno (local)';
  if (options.repos && options.repos.length > 0) {
    reposInfo = options.repos.map(r => `${r.url} (${r.description})`).join(', ');
  } else if (options.repoUrl) {
    reposInfo = options.repoUrl;
  }

  task.logs.push({
    timestamp: new Date(),
    stage: 'analyzer',
    type: 'info',
    message: 'Task iniciada',
    data: {
      prompt: options.prompt.substring(0, 300),
      modelo: options.model,
      pipeline_mode: pipelineModeLabels[options.pipelineMode],
      repositorios: reposInfo,
      branch: options.branch || 'main',
      crear_branch: options.createBranch !== false ? 'Si' : 'No',
      auto_commit: options.autoCommit !== false ? 'Si' : 'No',
      crear_pr: options.createPr ? 'Si' : 'No',
      continuar_task: options.continueTaskId || 'No (nueva task)',
    },
  });

  activeTasks.set(options.taskId, task);
  logger.info({ taskId: options.taskId, prompt: options.prompt.substring(0, 100) }, 'Task registered');

  return abortController;
}

/**
 * Update the current stage of a task
 */
export function updateTaskStage(taskId: string, stage: PipelineStage): void {
  const task = activeTasks.get(taskId);
  if (task) {
    // Mark previous stage as completed
    if (task.currentStage && task.currentStage !== stage) {
      if (!task.stagesCompleted.includes(task.currentStage)) {
        task.stagesCompleted.push(task.currentStage);
      }
      task.logs.push({
        timestamp: new Date(),
        stage: task.currentStage,
        type: 'stage_end',
        message: `Etapa ${task.currentStage} completada`,
      });
    }

    task.currentStage = stage;
    task.logs.push({
      timestamp: new Date(),
      stage,
      type: 'stage_start',
      message: `Iniciando etapa: ${stage}`,
    });
    logger.debug({ taskId, stage }, 'Task stage updated');

    // Emit event for real-time SSE updates
    taskEvents.emit('task-update', {
      taskId,
      type: 'stage-change',
      data: {
        currentStage: stage,
        stagesCompleted: task.stagesCompleted,
      },
    });
  }
}

/**
 * Add a log entry to a task
 */
export function addTaskLog(
  taskId: string,
  type: TaskLogEntry['type'],
  message: string,
  data?: Record<string, unknown>
): void {
  const task = activeTasks.get(taskId);
  if (task) {
    task.logs.push({
      timestamp: new Date(),
      stage: task.currentStage,
      type,
      message,
      data,
    });

    // Emit event for real-time SSE updates
    taskEvents.emit('task-update', {
      taskId,
      type: 'log',
      data: {
        stage: task.currentStage,
        logType: type,
        message,
        data,
      },
    });
  }
}

/**
 * Add output/result from an agent to the logs
 */
export function addTaskOutput(
  taskId: string,
  stage: PipelineStage,
  output: string,
  data?: Record<string, unknown>
): void {
  const task = activeTasks.get(taskId);
  if (task) {
    task.logs.push({
      timestamp: new Date(),
      stage,
      type: 'output',
      message: output.substring(0, 1000), // Limit output size in logs
      data,
    });

    // Emit event for real-time SSE updates
    taskEvents.emit('task-update', {
      taskId,
      type: 'output',
      data: {
        stage,
        message: output.substring(0, 1000),
        data,
      },
    });
  }
}

/**
 * Update the workspace path of a task
 */
export function updateTaskWorkspace(taskId: string, workspacePath: string): void {
  const task = activeTasks.get(taskId);
  if (task) {
    task.workspacePath = workspacePath;
    logger.debug({ taskId, workspacePath }, 'Task workspace updated');
  }
}

/**
 * Remove a task from active tracking (completed or cancelled)
 */
export function unregisterTask(taskId: string, success?: boolean): void {
  const task = activeTasks.get(taskId);
  if (task) {
    // Add final log entry
    task.logs.push({
      timestamp: new Date(),
      stage: task.currentStage,
      type: success ? 'info' : 'error',
      message: success ? 'Task completada exitosamente' : 'Task finalizada con errores',
    });

    // Store logs in recent cache for viewing just-completed tasks
    recentTaskLogs.set(taskId, {
      logs: [...task.logs],
      completedAt: new Date(),
    });

    // Cleanup old recent logs
    cleanupRecentLogs();

    activeTasks.delete(taskId);
    logger.info({ taskId }, 'Task unregistered');

    // Emit event for real-time SSE updates
    taskEvents.emit('task-update', {
      taskId,
      type: 'completed',
      data: {
        success: !!success,
      },
    });
  }
}

/**
 * Cleanup old recent task logs
 */
function cleanupRecentLogs(): void {
  const now = Date.now();
  for (const [taskId, data] of recentTaskLogs.entries()) {
    if (now - data.completedAt.getTime() > RECENT_LOGS_RETENTION_MS) {
      recentTaskLogs.delete(taskId);
    }
  }
}

/**
 * Get logs for a task (active or recently completed)
 */
export function getTaskLogs(taskId: string): TaskLogEntry[] | null {
  const activeTask = activeTasks.get(taskId);
  if (activeTask) {
    return activeTask.logs;
  }

  const recentLogs = recentTaskLogs.get(taskId);
  if (recentLogs) {
    return recentLogs.logs;
  }

  return null;
}

/**
 * Get all active tasks
 */
export function getActiveTasks(): ActiveTask[] {
  return Array.from(activeTasks.values());
}

/**
 * Get active task count
 */
export function getActiveTaskCount(): number {
  return activeTasks.size;
}

/**
 * Get a specific active task
 */
export function getActiveTask(taskId: string): ActiveTask | undefined {
  return activeTasks.get(taskId);
}

/**
 * Cancel a task by ID
 * Returns true if task was found and cancelled, false otherwise
 */
export function cancelTask(taskId: string): boolean {
  const task = activeTasks.get(taskId);
  if (task) {
    task.abortController.abort();
    logger.info({ taskId }, 'Task cancellation requested');
    return true;
  }
  return false;
}

/**
 * Check if a task has been cancelled
 */
export function isTaskCancelled(taskId: string): boolean {
  const task = activeTasks.get(taskId);
  return task?.abortController.signal.aborted ?? false;
}

/**
 * Get the abort signal for a task (for passing to async operations)
 */
export function getTaskAbortSignal(taskId: string): AbortSignal | undefined {
  return activeTasks.get(taskId)?.abortController.signal;
}
