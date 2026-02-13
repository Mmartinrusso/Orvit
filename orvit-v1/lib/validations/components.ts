import { z } from 'zod';
import {
  boundedString,
  optionalTrimmedString,
  coercePositiveInt,
  coerceOptionalPositiveInt,
  coerceOptionalNonNegative,
  optionalUrl,
} from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const SpareActionSchema = z.enum(['none', 'link', 'create'], {
  errorMap: () => ({ message: 'Acción de repuesto inválida. Valores: none, link, create' }),
});

// ─── Create Component ───────────────────────────────────────────────────────

export const CreateComponentSchema = z.object({
  name: boundedString('Nombre', 300),
  type: optionalTrimmedString,
  system: optionalTrimmedString,
  technicalInfo: z.string().trim().max(5000, 'Info técnica muy larga').optional(),
  parentId: z.union([
    z.coerce.number().int().positive(),
    z.null(),
  ]).optional(),
  machineId: coercePositiveInt('ID de máquina'),
  logo: optionalUrl.or(z.null()),
  photo: optionalUrl.or(z.null()),

  // Spare parts
  spareAction: SpareActionSchema.default('none'),
  existingSpareId: coerceOptionalPositiveInt,
  initialStock: coerceOptionalNonNegative.default(0),
  spareMinStock: coerceOptionalNonNegative.default(5),
  spareCategory: z.string().trim().max(100).default('Repuestos'),
  spareName: z.string().trim().min(2, 'Nombre del repuesto debe tener al menos 2 caracteres').max(300).optional(),
  spareDescription: z.string().trim().max(2000).optional(),
  spareImage: optionalUrl,
  companyId: coerceOptionalPositiveInt,
}).superRefine((data, ctx) => {
  // Require companyId when spareAction is 'create' or 'link'
  if ((data.spareAction === 'create' || data.spareAction === 'link') && !data.companyId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ID de empresa es requerido para gestionar repuestos',
      path: ['companyId'],
    });
  }
  // Require existingSpareId when spareAction is 'link'
  if (data.spareAction === 'link' && !data.existingSpareId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ID de repuesto existente es requerido para vincular',
      path: ['existingSpareId'],
    });
  }
});

// ─── Update Component ───────────────────────────────────────────────────────

export const UpdateComponentSchema = z.object({
  name: boundedString('Nombre', 300).optional(),
  type: optionalTrimmedString,
  system: optionalTrimmedString,
  technicalInfo: z.string().trim().max(5000, 'Info técnica muy larga').optional(),
  description: z.string().trim().max(5000).optional(),
  parentId: z.union([
    z.coerce.number().int().positive(),
    z.null(),
    z.literal(''),
  ]).optional(),
  machineId: coerceOptionalPositiveInt,
  logo: optionalUrl.or(z.null()),
  photo: optionalUrl.or(z.null()),
  status: optionalTrimmedString,
  code: optionalTrimmedString,
  model3dUrl: optionalUrl.or(z.null()),

  // Spare parts
  spareAction: SpareActionSchema.optional(),
  existingSpareId: coerceOptionalPositiveInt,
  initialStock: coerceOptionalNonNegative,
  spareMinStock: coerceOptionalNonNegative,
  spareCategory: z.string().trim().max(100).optional(),
  companyId: coerceOptionalPositiveInt,
}).passthrough(); // Allow extra fields the PATCH route ignores

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateComponentInput = z.infer<typeof CreateComponentSchema>;
export type UpdateComponentInput = z.infer<typeof UpdateComponentSchema>;
