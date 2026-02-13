import { z } from 'zod';

// Schema Zod como source of truth
export const WarehouseDTOSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  isTransit: z.boolean().optional(),
});

export type WarehouseDTO = z.infer<typeof WarehouseDTOSchema>;

/**
 * Adapter para normalizar cualquier fuente de datos de warehouse
 * Acepta tanto campos en español (nombre) como inglés (name) del Prisma model
 */
export function normalizeWarehouse(raw: any): WarehouseDTO {
  return {
    id: raw.id,
    codigo: raw.codigo || raw.code || '',
    nombre: raw.nombre || raw.name || '', // Acepta ambos
    descripcion: raw.descripcion || raw.description || null,
    direccion: raw.direccion || raw.address || null,
    isDefault: raw.isDefault ?? false,
    isActive: raw.isActive ?? true,
    isTransit: raw.isTransit ?? false,
  };
}

/**
 * Normaliza un array de warehouses
 */
export function normalizeWarehouses(raw: any[]): WarehouseDTO[] {
  return (raw || []).map(normalizeWarehouse);
}

/**
 * Schema para crear/actualizar warehouse
 */
export const WarehouseCreateSchema = z.object({
  codigo: z.string().min(1, 'Código es requerido'),
  nombre: z.string().min(1, 'Nombre es requerido'),
  descripcion: z.string().optional(),
  direccion: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isTransit: z.boolean().default(false),
  companyId: z.number(),
});

export type WarehouseCreateInput = z.infer<typeof WarehouseCreateSchema>;

export const WarehouseUpdateSchema = WarehouseCreateSchema.partial().extend({
  id: z.number(),
});

export type WarehouseUpdateInput = z.infer<typeof WarehouseUpdateSchema>;
