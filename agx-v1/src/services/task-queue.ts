import { createChildLogger } from '../utils/logger.js';
import type { TaskRequest, TaskResponse } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createChildLogger('task-queue');

export interface QueuedTask {
  taskId: string;
  request: TaskRequest;
  queuedAt: Date;
  resolve: (response: TaskResponse) => void;
  reject: (error: Error) => void;
}

// Queue of tasks waiting to be executed
const taskQueue: QueuedTask[] = [];

// Flag to prevent multiple queue processors
let isProcessing = false;

// Reference to the pipeline runner (set during initialization)
let pipelineRunner: ((request: TaskRequest, taskId: string) => Promise<TaskResponse>) | null = null;

/**
 * Initialize the queue with a reference to the pipeline runner
 */
export function initializeQueue(
  runner: (request: TaskRequest, taskId: string) => Promise<TaskResponse>
): void {
  pipelineRunner = runner;
  logger.info('Task queue initialized');
}

/**
 * Add a task to the queue
 * Returns a promise that resolves when the task is eventually executed
 */
export function enqueueTask(request: TaskRequest): Promise<{ taskId: string; promise: Promise<TaskResponse> }> {
  const taskId = uuidv4();

  const promise = new Promise<TaskResponse>((resolve, reject) => {
    const queuedTask: QueuedTask = {
      taskId,
      request,
      queuedAt: new Date(),
      resolve,
      reject,
    };

    taskQueue.push(queuedTask);

    logger.info(
      { taskId, queuePosition: taskQueue.length, prompt: request.prompt.substring(0, 100) },
      'Task added to queue'
    );
  });

  return Promise.resolve({ taskId, promise });
}

/**
 * Process the next task in the queue
 * Called when a task slot becomes available
 * @deprecated Use processAvailableTasksInQueue instead
 */
export async function processNextInQueue(): Promise<void> {
  await processAvailableTasksInQueue();
}

/**
 * Process multiple tasks from the queue up to the concurrent task limit
 * Called when task slots become available
 */
export async function processAvailableTasksInQueue(): Promise<void> {
  if (isProcessing || taskQueue.length === 0 || !pipelineRunner) {
    return;
  }

  isProcessing = true;

  try {
    // Import getActiveTaskCount dynamically to avoid circular dependency
    const { getActiveTaskCount } = await import('./task-tracker.js');
    const { config } = await import('../config.js');

    // Process tasks until we hit the concurrent limit or queue is empty
    while (taskQueue.length > 0) {
      const currentActiveCount = getActiveTaskCount();

      if (currentActiveCount >= config.maxConcurrentTasks) {
        logger.info(
          { activeCount: currentActiveCount, maxConcurrent: config.maxConcurrentTasks },
          'Concurrent task limit reached, stopping queue processing'
        );
        break;
      }

      const queuedTask = taskQueue.shift();

      if (!queuedTask) {
        break;
      }

      const waitTime = Date.now() - queuedTask.queuedAt.getTime();

      logger.info(
        {
          taskId: queuedTask.taskId,
          waitTimeMs: waitTime,
          remainingInQueue: taskQueue.length,
          activeCount: currentActiveCount
        },
        'Processing queued task'
      );

      // Start the task without awaiting (fire and forget)
      // This allows multiple tasks to run concurrently
      pipelineRunner(queuedTask.request, queuedTask.taskId)
        .then(response => queuedTask.resolve(response))
        .catch(error => queuedTask.reject(error instanceof Error ? error : new Error(String(error))));
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Get all queued tasks
 */
export function getQueuedTasks(): Array<{
  taskId: string;
  prompt: string;
  model?: string;
  repoUrl?: string;
  branch?: string;
  queuedAt: Date;
  queuePosition: number;
  waitTimeMs: number;
}> {
  const now = Date.now();

  return taskQueue.map((task, index) => ({
    taskId: task.taskId,
    prompt: task.request.prompt,
    model: task.request.model,
    repoUrl: task.request.repo_url,
    branch: task.request.branch,
    queuedAt: task.queuedAt,
    queuePosition: index + 1,
    waitTimeMs: now - task.queuedAt.getTime(),
  }));
}

/**
 * Get queue length
 */
export function getQueueLength(): number {
  return taskQueue.length;
}

/**
 * Remove a task from the queue (cancel before execution)
 * Returns true if task was found and removed
 */
export function removeFromQueue(taskId: string): boolean {
  const index = taskQueue.findIndex(t => t.taskId === taskId);

  if (index === -1) {
    return false;
  }

  const [removedTask] = taskQueue.splice(index, 1);

  // Reject the promise with a cancellation error
  removedTask.reject(new Error('Task was cancelled while in queue'));

  logger.info({ taskId }, 'Task removed from queue');

  return true;
}

/**
 * Check if a task is in the queue
 */
export function isTaskQueued(taskId: string): boolean {
  return taskQueue.some(t => t.taskId === taskId);
}

/**
 * Get a specific queued task
 */
export function getQueuedTask(taskId: string): QueuedTask | undefined {
  return taskQueue.find(t => t.taskId === taskId);
}
