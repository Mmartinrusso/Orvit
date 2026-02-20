/**
 * BullMQ Queue Manager
 * Centralized job queue management for background processing
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getRedisClient } from '../cache/redis-client';

// Queue names
export const QUEUE_NAMES = {
  INVOICE_PROCESSING: 'invoice-processing',
  REPORT_GENERATION: 'report-generation',
  NOTIFICATIONS: 'notifications',
  EMAIL: 'email',
  ERP_SYNC: 'erp-sync',
  DATA_IMPORT: 'data-import',
  ROUTINE_DEADLINES: 'routine-deadlines',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// Queue instances cache
const queues = new Map<QueueName, Queue>();
const workers = new Map<QueueName, Worker>();
const queueEvents = new Map<QueueName, QueueEvents>();

// Redis connection config for BullMQ
const getConnection = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

/**
 * Get or create a queue
 */
export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 3600, // 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // 24 hours
        },
      },
    });
    queues.set(name, queue);
  }
  return queues.get(name)!;
}

/**
 * Get queue events for monitoring
 */
export function getQueueEvents(name: QueueName): QueueEvents {
  if (!queueEvents.has(name)) {
    const events = new QueueEvents(name, {
      connection: getConnection(),
    });
    queueEvents.set(name, events);
  }
  return queueEvents.get(name)!;
}

/**
 * Add a job to a queue
 */
export async function addJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
    jobId?: string;
  }
): Promise<Job<T>> {
  const queue = getQueue(queueName);
  return queue.add(jobName, data, {
    priority: options?.priority,
    delay: options?.delay,
    attempts: options?.attempts,
    jobId: options?.jobId,
  });
}

/**
 * Create a worker for a queue
 */
export function createWorker<T, R>(
  queueName: QueueName,
  processor: (job: Job<T>) => Promise<R>,
  options?: {
    concurrency?: number;
    limiter?: {
      max: number;
      duration: number;
    };
  }
): Worker<T, R> {
  if (workers.has(queueName)) {
    // Close existing worker
    workers.get(queueName)?.close();
  }

  const worker = new Worker<T, R>(queueName, processor, {
    connection: getConnection(),
    concurrency: options?.concurrency || 1,
    limiter: options?.limiter,
  });

  // Basic event handlers
  worker.on('completed', (job: Job<T>) => {
    // Silent completion
  });

  worker.on('failed', (job: Job<T> | undefined, err: Error) => {
    console.error(`[${queueName}] Job ${job?.id} failed:`, err.message);
  });

  workers.set(queueName, worker as Worker);
  return worker;
}

/**
 * Get job by ID
 */
export async function getJob<T>(
  queueName: QueueName,
  jobId: string
): Promise<Job<T> | undefined> {
  const queue = getQueue(queueName);
  return queue.getJob(jobId);
}

/**
 * Get job status
 */
export async function getJobStatus(
  queueName: QueueName,
  jobId: string
): Promise<{
  id: string;
  status: string;
  progress: number;
  returnvalue?: unknown;
  failedReason?: string;
} | null> {
  const job = await getJob(queueName, jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    id: job.id || '',
    status: state,
    progress: job.progress as number || 0,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
}

/**
 * Get queue stats
 */
export async function getQueueStats(queueName: QueueName): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getQueue(queueName);
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Pause a queue
 */
export async function pauseQueue(queueName: QueueName): Promise<void> {
  const queue = getQueue(queueName);
  await queue.pause();
}

/**
 * Resume a queue
 */
export async function resumeQueue(queueName: QueueName): Promise<void> {
  const queue = getQueue(queueName);
  await queue.resume();
}

/**
 * Retry failed jobs
 */
export async function retryFailedJobs(queueName: QueueName): Promise<number> {
  const queue = getQueue(queueName);
  const failed = await queue.getFailed();
  let count = 0;

  for (const job of failed) {
    await job.retry();
    count++;
  }

  return count;
}

/**
 * Clean old jobs
 */
export async function cleanQueue(
  queueName: QueueName,
  grace: number = 3600000 // 1 hour in ms
): Promise<void> {
  const queue = getQueue(queueName);
  await queue.clean(grace, 1000, 'completed');
  await queue.clean(grace * 24, 1000, 'failed'); // 24 hours for failed
}

/**
 * Close all queues and workers
 */
export async function closeAll(): Promise<void> {
  for (const worker of workers.values()) {
    await worker.close();
  }
  workers.clear();

  for (const events of queueEvents.values()) {
    await events.close();
  }
  queueEvents.clear();

  for (const queue of queues.values()) {
    await queue.close();
  }
  queues.clear();
}
