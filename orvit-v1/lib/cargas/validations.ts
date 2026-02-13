/**
 * Validaciones con Zod para el módulo de cargas
 */

import { z } from 'zod';

// Schema para item de carga
export const loadItemSchema = z.object({
  id: z.number().int().optional(),
  productId: z.string().min(1, 'El ID del producto es requerido'),
  productName: z.string().min(1, 'El nombre del producto es requerido'),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
  length: z.number().positive().nullable().optional(),
  weight: z.number().positive().nullable().optional(),
  position: z.number().int().min(0),
  notes: z.string().nullable().optional(),
});

// Schema para crear carga
export const createLoadSchema = z.object({
  truckId: z.number().int().positive('Debe seleccionar un camión'),
  date: z.string().refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Fecha inválida'),
  description: z.string().nullable().optional(),
  deliveryClient: z.string().nullable().optional(),
  deliveryAddress: z.string().nullable().optional(),
  isCorralon: z.boolean().default(false),
  items: z.array(loadItemSchema).min(1, 'La carga debe tener al menos un item'),
  // Campos opcionales para validación de peso en EQUIPO
  chasisWeight: z.number().positive().optional(),
  acopladoWeight: z.number().positive().optional(),
});

// Schema para actualizar carga
export const updateLoadSchema = createLoadSchema.partial().extend({
  id: z.number().int().positive(),
});

// Schema para crear camión
export const createTruckSchema = z.object({
  name: z.string().min(1, 'El nombre/patente es requerido').max(50),
  type: z.enum(['CHASIS', 'EQUIPO', 'SEMI']),
  length: z.number().positive('El largo debe ser mayor a 0'),
  chasisLength: z.number().positive().nullable().optional(),
  acopladoLength: z.number().positive().nullable().optional(),
  chasisWeight: z.number().positive().nullable().optional(),
  acopladoWeight: z.number().positive().nullable().optional(),
  maxWeight: z.number().positive().nullable().optional(),
  isOwn: z.boolean().default(true),
  client: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

// Schema para actualizar camión
export const updateTruckSchema = createTruckSchema.partial().extend({
  id: z.number().int().positive(),
});

// Schema para crear template
export const createTemplateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  truckId: z.number().int().positive().nullable().optional(),
  items: z.array(loadItemSchema).min(1, 'El template debe tener al menos un item'),
});

// Schema para filtros de búsqueda
export const loadFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  truckType: z.enum(['CHASIS', 'EQUIPO', 'SEMI']).optional(),
  truckId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  client: z.string().optional(),
  search: z.string().optional(),
});

// Tipos inferidos de los schemas
export type CreateLoadInput = z.infer<typeof createLoadSchema>;
export type UpdateLoadInput = z.infer<typeof updateLoadSchema>;
export type CreateTruckInput = z.infer<typeof createTruckSchema>;
export type UpdateTruckInput = z.infer<typeof updateTruckSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type LoadFiltersInput = z.infer<typeof loadFiltersSchema>;

// Función helper para validar y parsear
export function validateAndParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

// Mensajes de error personalizados
export const errorMessages = {
  invalidTruck: 'El camión seleccionado no es válido',
  noItems: 'Debe agregar al menos un item a la carga',
  weightExceeded: 'El peso excede la capacidad máxima del camión',
  lengthExceeded: 'El largo excede la capacidad del camión',
  duplicateTruckName: 'Ya existe un camión con ese nombre',
  truckNotFound: 'Camión no encontrado',
  loadNotFound: 'Carga no encontrada',
  unauthorized: 'No tienes permisos para realizar esta acción',
  serverError: 'Error interno del servidor',
} as const;
