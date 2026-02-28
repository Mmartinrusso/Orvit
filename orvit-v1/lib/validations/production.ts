import { z } from 'zod';
import { boundedString, coercePositiveInt, coerceOptionalPositiveInt, coerceOptionalNonNegative, optionalIsoDateString } from './helpers';

// ─── Daily Entries ──────────────────────────────────────────────────────────

export const CreateDailyEntrySchema = z.object({
  sessionId: coercePositiveInt('ID de sesión'),
  productId: z.string({ required_error: 'ID de producto es requerido' })
    .min(1, 'ID de producto es requerido'),
  quantity: z.coerce.number({ required_error: 'Cantidad es requerida' })
    .positive('Cantidad debe ser mayor a 0'),
  scrapQuantity: z.coerce.number().min(0, 'Cantidad de scrap no puede ser negativa').optional(),
  uom: z.string().trim().max(50, 'Unidad de medida muy larga').optional(),
  workCenterId: coerceOptionalPositiveInt,
  batchNumber: z.string().trim().max(100, 'Número de lote muy largo').optional(),
  notes: z.string().trim().max(2000, 'Notas muy largas').optional(),
});

export const UpdateDailyEntrySchema = z.object({
  productId: z.string().min(1).optional(),
  quantity: z.coerce.number().positive('Cantidad debe ser mayor a 0').optional(),
  scrapQuantity: z.coerce.number().min(0).optional(),
  uom: z.string().trim().max(50).optional(),
  workCenterId: z.number().int().positive().nullable().optional(),
  batchNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
});

// ─── Routine Execution ─────────────────────────────────────────────────────

export const CreateRoutineExecutionSchema = z.object({
  draftId: z.coerce.number().int().positive().optional(),
  templateId: coercePositiveInt('ID de plantilla'),
  workCenterId: coerceOptionalPositiveInt,
  shiftId: coerceOptionalPositiveInt,
  date: optionalIsoDateString,
  responses: z.array(z.any()).optional(),
  hasIssues: z.boolean().optional(),
  issueDescription: z.string().trim().max(5000, 'Descripción del problema muy larga').optional(),
  linkedDowntimeId: coerceOptionalPositiveInt,
  linkedWorkOrderId: coerceOptionalPositiveInt,
});

// ─── Routine Draft ──────────────────────────────────────────────────────────

export const CreateRoutineDraftSchema = z.object({
  templateId: coercePositiveInt('ID de plantilla'),
  workCenterId: coerceOptionalPositiveInt,
  shiftId: coerceOptionalPositiveInt,
  date: optionalIsoDateString,
  responses: z.array(z.any()).optional(),
  hasIssues: z.boolean().optional(),
  issueDescription: z.string().trim().max(5000).optional(),
});

export const UpdateRoutineDraftSchema = z.object({
  id: coercePositiveInt('ID del borrador'),
  responses: z.array(z.any()).optional(),
  hasIssues: z.boolean().optional(),
  issueDescription: z.string().trim().max(5000).optional(),
});

// ─── Routine Template ───────────────────────────────────────────────────────

export const CreateRoutineTemplateSchema = z.object({
  name: boundedString('Nombre', 200),
  code: boundedString('Código', 50),
  description: z.string().trim().max(2000, 'Descripción muy larga').optional(),
  type: z.string().trim().max(50, 'Tipo muy largo').optional(),
  frequency: z.string().trim().max(50, 'Frecuencia muy larga').optional(),
  workCenterId: coerceOptionalPositiveInt,
  sectorId: coerceOptionalPositiveInt,
  isActive: z.boolean().default(true),
  items: z.any().optional(),
  groups: z.any().optional(),
  sections: z.any().optional(),
  itemsStructure: z.enum(['flat', 'grouped', 'sectioned']).default('flat'),
  preExecutionInputs: z.any().optional(),
  scheduleConfig: z.any().optional(),
  estimatedMinutes: z.coerce.number().int().min(0, 'Tiempo estimado no puede ser negativo').optional(),
  maxCompletionTimeMinutes: z.coerce.number().int().min(1, 'Tiempo máximo debe ser al menos 1 minuto').default(60),
  enableCompletionReminders: z.boolean().default(true),
});

export const UpdateRoutineTemplateSchema = CreateRoutineTemplateSchema.partial();

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateDailyEntryInput = z.infer<typeof CreateDailyEntrySchema>;
export type UpdateDailyEntryInput = z.infer<typeof UpdateDailyEntrySchema>;
export type CreateRoutineExecutionInput = z.infer<typeof CreateRoutineExecutionSchema>;
export type CreateRoutineDraftInput = z.infer<typeof CreateRoutineDraftSchema>;
export type UpdateRoutineDraftInput = z.infer<typeof UpdateRoutineDraftSchema>;
export type CreateRoutineTemplateInput = z.infer<typeof CreateRoutineTemplateSchema>;
export type UpdateRoutineTemplateInput = z.infer<typeof UpdateRoutineTemplateSchema>;
