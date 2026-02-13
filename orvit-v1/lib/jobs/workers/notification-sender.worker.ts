/**
 * Notification Sender Worker
 * Handles sending push notifications, emails, and in-app notifications
 */

import { Job } from 'bullmq';
import { createWorker, QUEUE_NAMES } from '../queue-manager';

// Notification types
export type NotificationType =
  | 'oc_pending_approval'
  | 'oc_approved'
  | 'oc_rejected'
  | 'invoice_expiring_soon'
  | 'invoice_overdue'
  | 'stock_low'
  | 'stock_critical'
  | 'payment_request_pending'
  | 'goods_received'
  | 'match_blocked';

export interface NotificationJobData {
  type: NotificationType;
  companyId: number;
  recipients: number[]; // User IDs
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels: ('push' | 'email' | 'inapp')[];
  priority?: 'low' | 'normal' | 'high';
}

export interface NotificationResult {
  success: boolean;
  sentTo: number;
  failed: number;
  errors?: string[];
}

/**
 * Process notification job
 */
async function sendNotification(
  job: Job<NotificationJobData>
): Promise<NotificationResult> {
  const { type, companyId, recipients, title, message, data, channels, priority } = job.data;

  const results = {
    sentTo: 0,
    failed: 0,
    errors: [] as string[],
  };

  await job.updateProgress(10);

  for (let i = 0; i < recipients.length; i++) {
    const userId = recipients[i];

    try {
      // Send to each channel
      for (const channel of channels) {
        switch (channel) {
          case 'inapp':
            // Save to database notifications table
            // await prisma.notification.create({ ... });
            break;

          case 'push':
            // Send push notification via service (Firebase, etc.)
            // await sendPushNotification(userId, title, message);
            break;

          case 'email':
            // Queue email
            // await sendEmail(userId, title, message);
            break;
        }
      }

      results.sentTo++;
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(`User ${userId}: ${errorMessage}`);
    }

    // Update progress
    const progress = 10 + Math.round((i / recipients.length) * 90);
    await job.updateProgress(progress);
  }

  await job.log(`Sent to ${results.sentTo}, failed ${results.failed}`);

  return {
    success: results.failed === 0,
    sentTo: results.sentTo,
    failed: results.failed,
    errors: results.errors.length > 0 ? results.errors : undefined,
  };
}

/**
 * Start the notification sender worker
 */
export function startNotificationSenderWorker() {
  return createWorker<NotificationJobData, NotificationResult>(
    QUEUE_NAMES.NOTIFICATIONS,
    sendNotification,
    {
      concurrency: 5, // Process 5 notifications at a time
      limiter: {
        max: 100,
        duration: 60000, // 100 notifications per minute max
      },
    }
  );
}

/**
 * Helper to queue a notification
 */
export async function queueNotification(data: NotificationJobData): Promise<string> {
  const { addJob } = await import('../queue-manager');
  const job = await addJob(QUEUE_NAMES.NOTIFICATIONS, 'send', data, {
    priority: data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5,
  });
  return job.id || '';
}
