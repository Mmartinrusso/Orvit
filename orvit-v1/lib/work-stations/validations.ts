/**
 * Validaciones Zod para Puestos de Trabajo
 */

import { z } from 'zod';

// ==================== ENUMS ====================

export const WorkStationStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE'
]);

// ==================== SCHEMAS ====================

export const createWorkStationSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional().nullable(),
  sectorId: z.number().int().positive('sectorId es obligatorio'),
  companyId: z.number().int().positive('companyId es obligatorio'),
  status: WorkStationStatusEnum.optional().default('ACTIVE')
});

export const updateWorkStationSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres').optional(),
  description: z.string().max(500, 'Máximo 500 caracteres').optional().nullable(),
  sectorId: z.number().int().positive('sectorId es obligatorio').optional(),
  status: WorkStationStatusEnum.optional()
});

export const listWorkStationsSchema = z.object({
  companyId: z.string().transform(val => parseInt(val)).pipe(z.number().int().positive()),
  sectorId: z.string().transform(val => parseInt(val)).pipe(z.number().int().positive()).optional(),
  status: WorkStationStatusEnum.optional(),
  search: z.string().optional(),
  hasInstructives: z.enum(['all', 'yes', 'no']).optional(),
  hasMachines: z.enum(['all', 'yes', 'no']).optional(),
  sortBy: z.enum(['name-asc', 'name-desc', 'instructives', 'machines', 'date']).optional()
});

// Schema para operaciones batch
export const batchUpdateSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Se requiere al menos un ID'),
  data: z.object({
    status: WorkStationStatusEnum.optional(),
    sectorId: z.number().int().positive().optional()
  })
});

export const batchDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Se requiere al menos un ID')
});

// Schema para instructivos
export const createInstructiveSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(200, 'Máximo 200 caracteres'),
  description: z.string().max(1000, 'Máximo 1000 caracteres').optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
  fileName: z.string().max(255).optional().nullable(),
  fileType: z.string().max(50).optional().nullable(),
  fileSize: z.number().int().min(0).optional().nullable(),
  scope: z.string().max(100).optional().nullable(),
  contentHtml: z.string().optional().nullable(),
  machineIds: z.array(z.number().int().positive()).optional().nullable(),
  componentIds: z.array(z.number().int().positive()).optional().nullable(),
  isActive: z.boolean().optional().default(true)
});

export const updateInstructiveSchema = createInstructiveSchema.partial();

// Schema para máquinas asignadas
export const assignMachineSchema = z.object({
  machineId: z.number().int().positive('machineId es obligatorio'),
  isRequired: z.boolean().optional().default(true),
  notes: z.string().max(500).optional().nullable()
});

// ==================== HELPER ====================

/**
 * Valida datos con un schema Zod y lanza error si falla
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
 * Valida datos con un schema Zod y retorna resultado sin lanzar error
 */
export function validateSafe<T>(schema: z.ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  return { success: true, data: result.data };
}

// ==================== TYPES ====================

export type CreateWorkStationInput = z.infer<typeof createWorkStationSchema>;
export type UpdateWorkStationInput = z.infer<typeof updateWorkStationSchema>;
export type ListWorkStationsParams = z.infer<typeof listWorkStationsSchema>;
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;
export type BatchDeleteInput = z.infer<typeof batchDeleteSchema>;
export type CreateInstructiveInput = z.infer<typeof createInstructiveSchema>;
export type UpdateInstructiveInput = z.infer<typeof updateInstructiveSchema>;
export type AssignMachineInput = z.infer<typeof assignMachineSchema>;
