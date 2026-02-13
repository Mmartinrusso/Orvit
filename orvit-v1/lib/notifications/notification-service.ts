/**
 * Notification Service - Centralized notification creation and delivery
 *
 * Handles in-app notifications via DB + SSE, with extensible channel support.
 * Used by cron jobs and API routes to create notifications for users.
 */

import { prisma } from '@/lib/prisma';
import { NotificationType, Priority } from '@prisma/client';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';
import { loggers } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateNotificationInput {
  userId: number;
  companyId: number;
  type: NotificationType;
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  link?: string;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: number;
  skipped?: boolean;
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a notification and deliver it via enabled channels (in-app + SSE).
 * Checks user preferences before creating.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationResult> {
  try {
    // Check user notification preferences
    const prefs = await getUserNotificationPreferences(input.userId, input.companyId);

    if (prefs && !prefs.inAppEnabled) {
      return { success: true, skipped: true, reason: 'in-app disabled by user' };
    }

    // Check if this notification type is enabled for the user
    if (prefs && !isTypeEnabledForUser(input.type, prefs)) {
      return { success: true, skipped: true, reason: `type ${input.type} disabled by user` };
    }

    // Use existing instant notification system (DB + SSE)
    const result = await createAndSendInstantNotification(
      input.type,
      input.userId,
      input.companyId,
      null, // taskId
      null, // reminderId
      input.title,
      input.message,
      input.priority || 'medium',
      {
        ...input.metadata,
        link: input.link,
      }
    );

    return {
      success: result.success,
      notificationId: result.notificationId ?? undefined,
    };
  } catch (error) {
    loggers.notifications.error({ err: error }, 'Error creating notification');
    return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send notifications to multiple users (e.g., all admins of a company).
 */
export async function createBulkNotifications(
  userIds: number[],
  companyId: number,
  type: NotificationType,
  title: string,
  message: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  metadata?: Record<string, any>,
  link?: string
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const userId of userIds) {
    const result = await createNotification({
      userId,
      companyId,
      type,
      title,
      message,
      priority,
      metadata,
      link,
    });

    if (result.success && !result.skipped) sent++;
    else if (result.skipped) skipped++;
    else failed++;
  }

  return { sent, skipped, failed };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get user notification preferences, or null if none configured (defaults apply).
 */
async function getUserNotificationPreferences(userId: number, companyId: number) {
  try {
    return await prisma.notificationPreferences.findUnique({
      where: {
        userId_companyId: { userId, companyId },
      },
    });
  } catch {
    // Table may not exist yet - return null (use defaults)
    return null;
  }
}

/**
 * Check if a specific notification type is enabled for the user.
 */
function isTypeEnabledForUser(
  type: NotificationType,
  prefs: {
    invoiceDueSoon: boolean;
    invoiceOverdue: boolean;
    chequeDueSoon: boolean;
    chequeOverdue: boolean;
    quoteExpiring: boolean;
    paymentReceived: boolean;
    stockAlerts: boolean;
    taskAlerts: boolean;
    maintenanceAlerts: boolean;
  }
): boolean {
  const typeToPreference: Record<string, keyof typeof prefs> = {
    invoice_due_soon: 'invoiceDueSoon',
    invoice_overdue: 'invoiceOverdue',
    cheque_due_soon: 'chequeDueSoon',
    cheque_overdue: 'chequeOverdue',
    quote_expiring: 'quoteExpiring',
    payment_received: 'paymentReceived',
    stock_low: 'stockAlerts',
    stock_out: 'stockAlerts',
    task_assigned: 'taskAlerts',
    task_overdue: 'taskAlerts',
    task_due_soon: 'taskAlerts',
    task_completed: 'taskAlerts',
    task_updated: 'taskAlerts',
    task_deleted: 'taskAlerts',
    task_auto_reset: 'taskAlerts',
    task_commented: 'taskAlerts',
    maintenance_due: 'maintenanceAlerts',
    work_order_assigned: 'maintenanceAlerts',
    work_order_overdue: 'maintenanceAlerts',
    work_order_due_soon: 'maintenanceAlerts',
  };

  const prefKey = typeToPreference[type];
  if (!prefKey) return true; // Unknown types are always enabled

  return prefs[prefKey];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all active user IDs for a company (for broadcasting notifications).
 */
export async function getCompanyUserIds(companyId: number): Promise<number[]> {
  const users = await prisma.userOnCompany.findMany({
    where: { companyId },
    select: {
      user: {
        select: { id: true, isActive: true },
      },
    },
  });

  // Also include the company owner
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  });

  const activeUserIds = users
    .filter((u) => u.user.isActive)
    .map((u) => u.user.id);

  if (company?.ownerId && !activeUserIds.includes(company.ownerId)) {
    activeUserIds.push(company.ownerId);
  }

  return activeUserIds;
}

/**
 * Get admin user IDs for a company (owner + users with admin role).
 */
export async function getCompanyAdminIds(companyId: number): Promise<number[]> {
  const users = await prisma.userOnCompany.findMany({
    where: {
      companyId,
      user: { isActive: true, role: { in: ['ADMIN', 'OWNER'] } },
    },
    select: { userId: true },
  });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  });

  const adminIds = users.map((u) => u.userId);

  if (company?.ownerId && !adminIds.includes(company.ownerId)) {
    adminIds.push(company.ownerId);
  }

  return adminIds;
}

/**
 * Check for duplicate notification (avoid spamming same alert).
 * Returns true if a similar notification was sent in the last `hoursWindow` hours.
 */
export async function isDuplicateNotification(
  userId: number,
  companyId: number,
  type: NotificationType,
  metadataKey: string,
  metadataValue: string | number,
  hoursWindow: number = 24
): Promise<boolean> {
  const since = new Date();
  since.setHours(since.getHours() - hoursWindow);

  try {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        companyId,
        type,
        createdAt: { gte: since },
      },
      select: { id: true, metadata: true },
    });

    if (!existing) return false;

    // Check if the metadata key matches
    const meta = existing.metadata as Record<string, any> | null;
    if (meta && meta[metadataKey] === metadataValue) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
