import { z } from 'zod';
import { boundedString } from './helpers';

// ─── NotificationType (compatible con Prisma enum + legacy uppercase) ────────

const VALID_NOTIFICATION_TYPES = [
  // Lowercase (Prisma enum)
  'work_order_assigned', 'work_order_overdue', 'work_order_due_soon',
  'stock_low', 'stock_out',
  'maintenance_due',
  'task_assigned', 'task_overdue', 'task_updated', 'task_deleted',
  'task_completed', 'task_due_soon', 'task_auto_reset', 'task_commented',
  'reminder_overdue', 'reminder_due_today', 'reminder_due_soon',
  'tool_request_new', 'tool_request_approved', 'tool_request_rejected',
  'system_alert',
  // Discord/Mantenimiento
  'SLA_WARNING', 'SLA_BREACH', 'UNASSIGNED_FAILURE', 'RECURRENCE_ALERT',
  'DOWNTIME_START', 'DOWNTIME_END', 'PRIORITY_ESCALATED',
  // Producción
  'routine_photo_timer',
  // Ventas
  'invoice_due_soon', 'invoice_overdue', 'cheque_due_soon', 'cheque_overdue',
  'quote_expiring', 'payment_received',
  // Legacy uppercase
  'TASK_OVERDUE', 'DEADLINE_APPROACHING', 'TASK_ASSIGNED', 'TASK_COMPLETED',
  'TASK_UPDATED', 'TASK_DELETED', 'TASK_AUTO_RESET',
  'WORK_ORDER_OVERDUE', 'WORK_ORDER_ASSIGNED', 'WORK_ORDER_DUE_SOON',
  'STOCK_LOW', 'STOCK_OUT', 'SYSTEM_ALERT',
] as const;

export const NotificationTypeSchema = z.enum(VALID_NOTIFICATION_TYPES, {
  errorMap: () => ({ message: 'Tipo de notificación inválido' }),
});

// ─── Create Notification ────────────────────────────────────────────────────

export const CreateNotificationSchema = z.object({
  type: NotificationTypeSchema,
  title: boundedString('Título', 300),
  message: boundedString('Mensaje', 5000),
  metadata: z.record(z.unknown()).optional(),
});

// ─── Mark as Read ───────────────────────────────────────────────────────────

export const MarkNotificationReadSchema = z.object({
  notificationId: z.coerce
    .number({ invalid_type_error: 'notificationId debe ser un número' })
    .int('notificationId debe ser un entero')
    .positive('notificationId debe ser positivo')
    .optional(),
  markAll: z.boolean().optional(),
}).refine(
  (data) => data.notificationId !== undefined || data.markAll === true,
  { message: 'Debe proporcionar notificationId o markAll' }
);

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadSchema>;
