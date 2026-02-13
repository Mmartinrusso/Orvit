import { z } from 'zod';
import { boundedString, coercePositiveInt, coerceOptionalPositiveInt, optionalTrimmedString } from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const FailureTypeSchema = z.enum(
  ['MECANICA', 'ELECTRICA', 'NEUMATICA', 'HIDRAULICA', 'SOFTWARE', 'OTRO'],
  { errorMap: () => ({ message: 'Tipo de falla inválido. Valores: MECANICA, ELECTRICA, NEUMATICA, HIDRAULICA, SOFTWARE, OTRO' }) }
);

export const FailurePrioritySchema = z.enum(
  ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  { errorMap: () => ({ message: 'Prioridad inválida. Valores: LOW, MEDIUM, HIGH, URGENT' }) }
);

export const FailureStatusSchema = z.enum(
  ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  { errorMap: () => ({ message: 'Estado inválido. Valores: PENDING, IN_PROGRESS, COMPLETED, CANCELLED' }) }
);

const TimeUnitSchema = z.enum(['hours', 'minutes', 'days'], {
  errorMap: () => ({ message: 'Unidad de tiempo inválida. Valores: hours, minutes, days' }),
});

// ─── Attachment Schema ──────────────────────────────────────────────────────

const AttachmentSchema = z.object({
  name: z.string().optional(),
  url: z.string().url('URL de adjunto inválida'),
  type: z.string().optional(),
  size: z.number().optional(),
}).passthrough();

const UpdateAttachmentSchema = z.object({
  name: z.string().min(1, 'Nombre del archivo es requerido'),
  url: z.string().url('URL de adjunto inválida'),
  type: z.string().optional(),
  size: z.number().optional(),
}).passthrough();

// ─── Create Failure ─────────────────────────────────────────────────────────

export const CreateFailureSchema = z.object({
  title: boundedString('Título', 255),
  description: z.string().trim().max(5000, 'Descripción muy larga').optional().or(z.literal('')),
  machineId: coercePositiveInt('ID de máquina'),
  companyId: coerceOptionalPositiveInt,
  createdBy: coerceOptionalPositiveInt,
  createdById: coerceOptionalPositiveInt,
  createdByName: optionalTrimmedString,
  failureType: FailureTypeSchema.default('MECANICA'),
  failureTypeId: coerceOptionalPositiveInt,
  priority: FailurePrioritySchema.default('MEDIUM'),
  estimatedHours: z.coerce.number().min(0, 'Horas estimadas no pueden ser negativas').optional(),
  timeUnit: TimeUnitSchema.default('hours'),
  selectedComponents: z.array(
    z.coerce.number().int().positive()
  ).optional().default([]),
  reportedDate: z.string().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    'Fecha reportada inválida'
  ).optional(),
  failureAttachments: z.array(AttachmentSchema).optional().default([]),
  addToCatalog: z.boolean().optional(),
});

// ─── Update Failure ─────────────────────────────────────────────────────────

export const UpdateFailureSchema = z.object({
  title: boundedString('Título', 255).optional(),
  description: z.string().trim().max(5000, 'Descripción muy larga').optional(),
  selectedComponents: z.array(z.coerce.number().int().positive()).optional(),
  selectedSubcomponents: z.array(z.coerce.number().int().positive()).optional(),
  failureType: FailureTypeSchema.optional(),
  priority: FailurePrioritySchema.optional(),
  status: FailureStatusSchema.optional(),
  estimatedHours: z.coerce.number().min(0, 'Horas estimadas no pueden ser negativas').optional(),
  actualHours: z.coerce.number().min(0, 'Horas reales no pueden ser negativas').optional(),
  solution: z.string().trim().max(10000, 'Solución muy larga').optional(),
  toolsUsed: z.array(z.unknown()).optional(),
  sparePartsUsed: z.array(z.unknown()).optional(),
  failureFiles: z.array(UpdateAttachmentSchema).optional(),
  solutionAttachments: z.array(UpdateAttachmentSchema).optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateFailureInput = z.infer<typeof CreateFailureSchema>;
export type UpdateFailureInput = z.infer<typeof UpdateFailureSchema>;
