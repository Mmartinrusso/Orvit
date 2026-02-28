import { z } from 'zod';
import { boundedString, coercePositiveInt, coerceOptionalPositiveInt } from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const TaskPrioritySchema = z.enum(
  ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  { errorMap: () => ({ message: 'Prioridad inválida. Valores permitidos: LOW, MEDIUM, HIGH, URGENT' }) }
);

export const NotifyViaSchema = z.enum(
  ['DISCORD', 'EMAIL', 'WEB_PUSH', 'SSE'],
  { errorMap: () => ({ message: 'Canal de notificación inválido. Valores permitidos: DISCORD, EMAIL, WEB_PUSH, SSE' }) }
);

// ─── Reminder ───────────────────────────────────────────────────────────────

export const TaskReminderSchema = z.object({
  title: z.string().trim().max(200, 'Título del recordatorio muy largo').optional(),
  message: z.string().trim().max(1000, 'Mensaje del recordatorio muy largo').optional(),
  remindAt: z.string({ required_error: 'Fecha de recordatorio es requerida' })
    .datetime('Fecha de recordatorio debe ser formato ISO válido'),
  notifyVia: z.array(NotifyViaSchema).optional().default(['DISCORD']),
});

// ─── Create ─────────────────────────────────────────────────────────────────

export const CreateAgendaTaskSchema = z.object({
  title: boundedString('Título', 200),
  description: z.string().trim().max(5000, 'Descripción muy larga').optional(),
  dueDate: z.string().datetime('Fecha de vencimiento debe ser formato ISO válido').optional().nullable(),
  priority: TaskPrioritySchema.default('MEDIUM'),
  category: z.string().trim().max(100, 'Categoría muy larga').optional(),
  groupId: z.number().int().positive('ID de grupo inválido').optional().nullable(),
  assignedToUserId: z.number().int().positive('ID de usuario asignado inválido').optional().nullable(),
  assignedToContactId: z.number().int().positive('ID de contacto asignado inválido').optional().nullable(),
  assignedToName: z.string().trim().max(200, 'Nombre del asignado muy largo').optional(),
  isCompanyVisible: z.boolean().optional().default(false),
  companyId: coercePositiveInt('ID de empresa'),
  reminders: z.array(TaskReminderSchema).max(10, 'Máximo 10 recordatorios').optional(),
});

// ─── Comment ─────────────────────────────────────────────────────────────────

export const CreateAgendaTaskCommentSchema = z.object({
  content: z.string().trim().min(1, 'El comentario no puede estar vacío').max(5000, 'Comentario muy largo'),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateAgendaTaskInput = z.infer<typeof CreateAgendaTaskSchema>;
