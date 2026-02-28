import { z } from 'zod';
import { boundedString, optionalTrimmedString, optionalIsoDateString, coercePositiveInt, coerceOptionalPositiveInt, coerceOptionalNonNegative } from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const WorkOrderStatusSchema = z.enum(
  ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  { errorMap: () => ({ message: 'Estado inválido. Valores permitidos: PENDING, IN_PROGRESS, COMPLETED, CANCELLED' }) }
);

export const WorkOrderPrioritySchema = z.enum(
  ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  { errorMap: () => ({ message: 'Prioridad inválida. Valores permitidos: LOW, MEDIUM, HIGH, URGENT' }) }
);

export const MaintenanceTypeSchema = z.enum(
  ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY'],
  { errorMap: () => ({ message: 'Tipo de mantenimiento inválido. Valores permitidos: PREVENTIVE, CORRECTIVE, PREDICTIVE, EMERGENCY' }) }
);

// ─── Create ─────────────────────────────────────────────────────────────────

export const CreateWorkOrderSchema = z.object({
  title: boundedString('Título', 300),
  description: z.string().trim().max(5000, 'Descripción muy larga').optional(),
  priority: WorkOrderPrioritySchema.default('MEDIUM'),
  type: boundedString('Tipo', 50),
  machineId: coerceOptionalPositiveInt,
  componentId: coerceOptionalPositiveInt,
  assignedToId: coerceOptionalPositiveInt,
  assignedWorkerId: coerceOptionalPositiveInt,
  createdById: coercePositiveInt('ID de creador'),
  scheduledDate: optionalIsoDateString,
  estimatedHours: coerceOptionalNonNegative,
  cost: coerceOptionalNonNegative,
  notes: z.string().max(10000, 'Notas muy largas').nullable().optional(),
  companyId: coercePositiveInt('ID de empresa'),
  sectorId: coerceOptionalPositiveInt,
  status: WorkOrderStatusSchema.default('PENDING'),
  completedDate: optionalIsoDateString,
  actualHours: coerceOptionalNonNegative,
});

// ─── Update ─────────────────────────────────────────────────────────────────

export const UpdateWorkOrderSchema = z.object({
  title: boundedString('Título', 300).optional(),
  description: z.string().trim().max(5000, 'Descripción muy larga').optional(),
  status: WorkOrderStatusSchema.optional(),
  priority: WorkOrderPrioritySchema.optional(),
  type: z.string().trim().max(50, 'Tipo muy largo').optional(),
  machineId: z.number().int().positive().nullable().optional(),
  componentId: z.number().int().positive().nullable().optional(),
  assignedToId: z.number().int().positive().nullable().optional(),
  scheduledDate: optionalIsoDateString,
  startedDate: optionalIsoDateString,
  completedDate: optionalIsoDateString,
  estimatedHours: z.number().min(0).nullable().optional(),
  actualHours: z.number().min(0).nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  notes: z.string().max(10000, 'Notas muy largas').nullable().optional(),
  sectorId: z.number().int().positive().nullable().optional(),
});

// ─── Comment ────────────────────────────────────────────────────────────────

export const CreateWorkOrderCommentSchema = z.object({
  content: boundedString('Contenido del comentario', 5000),
  authorId: coercePositiveInt('ID del autor'),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateWorkOrderInput = z.infer<typeof CreateWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof UpdateWorkOrderSchema>;
export type CreateWorkOrderCommentInput = z.infer<typeof CreateWorkOrderCommentSchema>;
