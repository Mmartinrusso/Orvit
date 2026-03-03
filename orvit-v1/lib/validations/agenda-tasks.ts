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
  dueDate: z.preprocess(
    (val) => {
      if (!val || typeof val !== 'string') return val;
      // date-only: '2026-03-02' → '2026-03-02T00:00:00.000Z'
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return `${val}T00:00:00.000Z`;
      // datetime without timezone: '2026-03-02T14:30:00' → '2026-03-02T14:30:00.000Z'
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val)) return `${val}.000Z`;
      return val;
    },
    z.string().datetime('Fecha de vencimiento debe ser formato ISO válido').optional().nullable()
  ),
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

// ─── Subtasks ───────────────────────────────────────────────────────────────

export const CreateAgendaSubtaskSchema = z.object({
  title: boundedString('Título', 200),
  note: z.string().trim().max(1000, 'Nota muy larga').optional(),
  assigneeId: z.number().int().positive('ID de asignado inválido').optional().nullable(),
  done: z.boolean().optional().default(false),
});

export const UpdateAgendaSubtaskSchema = z.object({
  title: z.string().trim().min(1, 'Título requerido').max(200, 'Título muy largo').optional(),
  done: z.boolean().optional(),
  note: z.string().trim().max(1000, 'Nota muy larga').optional().nullable(),
  assigneeId: z.number().int().positive('ID de asignado inválido').optional().nullable(),
});

export const ReorderAgendaSubtasksSchema = z.object({
  order: z.array(z.number().int().positive()).min(1, 'Se requiere al menos un ID'),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateAgendaTaskInput = z.infer<typeof CreateAgendaTaskSchema>;
export type CreateAgendaSubtaskInput = z.infer<typeof CreateAgendaSubtaskSchema>;
export type UpdateAgendaSubtaskInput = z.infer<typeof UpdateAgendaSubtaskSchema>;
export type ReorderAgendaSubtasksInput = z.infer<typeof ReorderAgendaSubtasksSchema>;
