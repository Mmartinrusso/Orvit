/**
 * Jobs Module Exports
 */

export {
  QUEUE_NAMES,
  getQueue,
  getQueueEvents,
  addJob,
  createWorker,
  getJob,
  getJobStatus,
  getQueueStats,
  pauseQueue,
  resumeQueue,
  retryFailedJobs,
  cleanQueue,
  closeAll,
} from './queue-manager';
export type { QueueName } from './queue-manager';

// Workers
export {
  startInvoiceProcessorWorker,
} from './workers/invoice-processor.worker';
export type {
  InvoiceProcessingJobData,
  InvoiceProcessingResult,
} from './workers/invoice-processor.worker';

export {
  startNotificationSenderWorker,
  queueNotification,
} from './workers/notification-sender.worker';
export type {
  NotificationType,
  NotificationJobData,
  NotificationResult,
} from './workers/notification-sender.worker';

export {
  startReportGeneratorWorker,
  queueReport,
} from './workers/report-generator.worker';
export type {
  ReportType,
  ReportJobData,
  ReportResult,
} from './workers/report-generator.worker';

/**
 * Start all workers
 * Call this from server startup
 */
export function startAllWorkers() {
  // Only start workers in non-edge environments
  if (typeof process !== 'undefined' && process.env.ENABLE_WORKERS === 'true') {
    const { startInvoiceProcessorWorker } = require('./workers/invoice-processor.worker');
    const { startNotificationSenderWorker } = require('./workers/notification-sender.worker');
    const { startReportGeneratorWorker } = require('./workers/report-generator.worker');

    startInvoiceProcessorWorker();
    startNotificationSenderWorker();
    startReportGeneratorWorker();

    console.log('[Jobs] All workers started');
  }
}
