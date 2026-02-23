/**
 * Validaciones Zod para Unidades Móviles
 */

import { z } from 'zod';

// ==================== ENUMS ====================

export const UnidadMovilEstadoEnum = z.enum([
  'ACTIVO',
  'MANTENIMIENTO',
  'FUERA_SERVICIO',
  'DESHABILITADO'
]);

export const TipoUnidadEnum = z.enum([
  'Camión',
  'Camioneta',
  'Auto',
  'Moto',
  'Tractor',
  'Grúa',
  'Excavadora',
  'Bulldozer',
  'Montacargas',
  'Autoelevador',
  'Otro'
]);

// ==================== SCHEMAS ====================

export const createUnidadMovilSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  tipo: z.string().min(1, 'El tipo es requerido').max(50),
  marca: z.string().max(50).optional().default(''),
  modelo: z.string().max(50).optional().default(''),
  año: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
  patente: z.string().max(20).transform(val => val?.toUpperCase() || '').optional().default(''),
  numeroChasis: z.string().max(50).optional().default(''),
  numeroMotor: z.string().max(50).optional().default(''),
  kilometraje: z.number().int().min(0).optional().default(0),
  estado: UnidadMovilEstadoEnum.optional().default('ACTIVO'),
  sectorId: z.number().int().positive().optional().nullable(),
  companyId: z.number().int().positive('companyId es obligatorio'),
  descripcion: z.string().max(500).optional().default(''),
  fechaAdquisicion: z.string().datetime().optional().nullable()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  valorAdquisicion: z.number().min(0).optional().nullable(),
  proveedor: z.string().max(100).optional().default(''),
  garantiaHasta: z.string().datetime().optional().nullable()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  combustible: z.string().max(30).optional().default(''),
  capacidadCombustible: z.number().int().min(0).optional().nullable(),
  consumoPromedio: z.number().min(0).optional().nullable(),
  kmUpdateFrequencyDays: z.number().int().min(1).max(365).optional().nullable() // Cada cuántos días registrar km
});

export const updateUnidadMovilSchema = createUnidadMovilSchema.partial().extend({
  companyId: z.number().int().positive('companyId es obligatorio')
});

export const listUnidadesMovilesSchema = z.object({
  companyId: z.string().transform(val => parseInt(val)).pipe(z.number().int().positive()),
  sectorId: z.string().transform(val => parseInt(val)).pipe(z.number().int().positive()).optional(),
  estado: UnidadMovilEstadoEnum.optional(),
  tipo: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().int().min(1).max(200)).optional(),
  offset: z.string().transform(val => parseInt(val)).pipe(z.number().int().min(0)).optional()
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

export type CreateUnidadMovilInput = z.infer<typeof createUnidadMovilSchema>;
export type UpdateUnidadMovilInput = z.infer<typeof updateUnidadMovilSchema>;
export type ListUnidadesMovilesParams = z.infer<typeof listUnidadesMovilesSchema>;
