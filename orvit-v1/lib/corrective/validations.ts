/**
 * Validaciones con Zod para sistema de Mantenimiento Correctivo
 * Usado por todos los helpers para validar parámetros de entrada
 */

import { z } from 'zod';

// ==================== DUPLICATE DETECTOR ====================

export const duplicateDetectionParamsSchema = z.object({
  machineId: z.number().int().positive('machineId debe ser un número positivo'),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),
  title: z.string().min(3, 'title debe tener al menos 3 caracteres').max(255),
  symptomIds: z.array(z.number().int().positive()).optional().default([]),
  companyId: z.number().int().positive('companyId es obligatorio')
});

export const linkDuplicateParamsSchema = z.object({
  mainOccurrenceId: z.number().int().positive('mainOccurrenceId debe ser un número positivo'),
  reportedBy: z.number().int().positive('reportedBy es obligatorio'),
  linkedReason: z.string().max(255).optional(),
  symptoms: z.array(z.number().int().positive()).optional(),
  attachments: z.array(z.any()).optional(),
  notes: z.string().optional(),
  companyId: z.number().int().positive('companyId es obligatorio'),
  machineId: z.number().int().positive('machineId es obligatorio'),
  subcomponentId: z.number().int().positive().optional()
});

// ==================== PRIORITY CALCULATOR ====================

export const priorityCalculationParamsSchema = z.object({
  assetCriticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().nullable(),
  causedDowntime: z.boolean().optional().default(false),
  isSafetyRelated: z.boolean().optional().default(false),
  isIntermittent: z.boolean().optional().default(false),
  isObservation: z.boolean().optional().default(false)
});

// ==================== QA RULES ====================

export const qaRequirementParamsSchema = z.object({
  isSafetyRelated: z.boolean(),
  priority: z.union([
    z.enum(['P1', 'P2', 'P3', 'P4']),
    z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW'])
  ]),
  assetCriticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().nullable(),
  causedDowntime: z.boolean(),
  downtimeMinutes: z.number().int().min(0).optional(),
  isRecurrence: z.boolean(),
  recurrenceDays: z.number().int().min(0).optional(),
  companyId: z.number().int().positive('companyId es obligatorio')
});

export const validateQACompletionParamsSchema = z.object({
  workOrderId: z.number().int().positive('workOrderId debe ser un número positivo')
});

export const createOrUpdateQAParamsSchema = z.object({
  workOrderId: z.number().int().positive('workOrderId es obligatorio'),
  companyId: z.number().int().positive('companyId es obligatorio'),
  qaRequirement: z.object({
    required: z.boolean(),
    reason: z.enum(['SAFETY', 'HIGH_PRIORITY', 'HIGH_CRITICALITY', 'HIGH_DOWNTIME', 'RECURRENCE']).optional(),
    evidenceLevel: z.enum(['OPTIONAL', 'BASIC', 'STANDARD', 'COMPLETE'])
  })
});

// ==================== DOWNTIME MANAGER ====================

export const handleDowntimeParamsSchema = z.object({
  failureOccurrenceId: z.number().int().positive('failureOccurrenceId es obligatorio'),
  workOrderId: z.number().int().positive().optional(),
  machineId: z.number().int().positive('machineId es obligatorio'),
  causedDowntime: z.boolean(),
  companyId: z.number().int().positive('companyId es obligatorio'),
  category: z.enum(['UNPLANNED', 'PLANNED', 'EXTERNAL']).optional().default('UNPLANNED'),
  reason: z.string().max(500).optional(),
  productionImpact: z.string().max(500).optional()
});

export const confirmReturnParamsSchema = z.object({
  downtimeLogId: z.number().int().positive('downtimeLogId es obligatorio'),
  workOrderId: z.number().int().positive().optional(),
  returnedById: z.number().int().positive('returnedById es obligatorio'),
  companyId: z.number().int().positive('companyId es obligatorio'),
  notes: z.string().optional()
});

export const validateCanCloseParamsSchema = z.object({
  workOrderId: z.number().int().positive('workOrderId es obligatorio'),
  companyId: z.number().int().positive('companyId es obligatorio')
});

// ==================== SOLUTION HISTORY ====================

export const topSolutionsParamsSchema = z.object({
  companyId: z.number().int().positive('companyId es obligatorio'),
  machineId: z.number().int().positive().optional(),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(50).optional().default(5),
  minEffectiveness: z.number().int().min(1).max(5).optional().default(3),
  /** Días para que la efectividad decaiga a la mitad (default: 180 = 6 meses) */
  decayHalfLifeDays: z.number().int().min(30).max(730).optional().default(180)
});

export const solutionHistoryParamsSchema = z.object({
  companyId: z.number().int().positive('companyId es obligatorio'),
  machineId: z.number().int().positive().optional(),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),
  failureOccurrenceId: z.number().int().positive().optional(),
  performedById: z.number().int().positive().optional(),
  outcome: z.enum(['FUNCIONÓ', 'PARCIAL', 'NO_FUNCIONÓ']).optional(),
  minEffectiveness: z.number().int().min(1).max(5).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0)
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'startDate debe ser anterior o igual a endDate' }
);

export const getSolutionByIdParamsSchema = z.object({
  solutionId: z.number().int().positive('solutionId es obligatorio')
});

export const findSimilarSolutionsParamsSchema = z.object({
  companyId: z.number().int().positive('companyId es obligatorio'),
  machineId: z.number().int().positive('machineId es obligatorio'),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),
  title: z.string().min(3, 'title debe tener al menos 3 caracteres').max(255),
  description: z.string().optional(),
  limit: z.number().int().min(1).max(20).optional().default(3)
});

// ✅ Schema para getSolutionStats
export const solutionStatsParamsSchema = z.object({
  companyId: z.number().int().positive('companyId es obligatorio'),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional()
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'startDate debe ser anterior o igual a endDate' }
);

// ✅ Schema para getMTTR
export const mttrParamsSchema = z.object({
  companyId: z.number().int().positive('companyId es obligatorio'),
  machineId: z.number().int().positive().optional(),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),
  performedById: z.number().int().positive().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional()
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'startDate debe ser anterior o igual a endDate' }
);

// ✅ Schema para getFrequentToolsAndParts
export const frequentToolsParamsSchema = z.object({
  companyId: z.number().int().positive('companyId es obligatorio'),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(50).optional().default(10)
});

// ==================== HELPER PARA VALIDAR ====================

/**
 * Valida un objeto con un schema Zod y lanza error si falla
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validación falló: ${errors}`);
  }

  return result.data;
}

/**
 * Valida y retorna resultado sin lanzar error
 */
export function validateSafe<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  return { success: true, data: result.data };
}
