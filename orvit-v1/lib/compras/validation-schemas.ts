/**
 * Zod Validation Schemas para APIs de Compras
 *
 * Centraliza la validación de inputs para todas las operaciones P2P.
 * Evita type assertions sin validación y mejora la seguridad.
 */

import { z } from 'zod';

// ============================================
// ENUMS Y TIPOS BASE
// ============================================

export const DocTypeSchema = z.enum(['T1', 'T2']).default('T1');

export const AccionAprobacionSchema = z.enum(['aprobar', 'rechazar']);

export const PrioridadSchema = z.enum(['BAJA', 'MEDIA', 'ALTA', 'URGENTE']).default('MEDIA');

// ============================================
// ORDEN DE PAGO
// ============================================

const FacturaPagoSchema = z.object({
  receiptId: z.coerce.number().positive('ID de factura debe ser positivo'),
  montoAplicado: z.coerce.number().nonnegative('Monto aplicado no puede ser negativo'),
});

export const CreatePaymentOrderSchema = z.object({
  proveedorId: z.coerce.number().positive('ID de proveedor requerido'),
  fechaPago: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  facturas: z.array(FacturaPagoSchema).optional().default([]),
  efectivo: z.coerce.number().nonnegative().optional().default(0),
  dolares: z.coerce.number().nonnegative().optional().default(0),
  transferencia: z.coerce.number().nonnegative().optional().default(0),
  chequesTerceros: z.coerce.number().nonnegative().optional().default(0),
  chequesPropios: z.coerce.number().nonnegative().optional().default(0),
  retIVA: z.coerce.number().nonnegative().optional().default(0),
  retGanancias: z.coerce.number().nonnegative().optional().default(0),
  retIngBrutos: z.coerce.number().nonnegative().optional().default(0),
  anticiposIds: z.array(z.coerce.number().positive()).optional().default([]),
  notas: z.string().max(1000).optional(),
  docType: DocTypeSchema,
}).refine(
  (data) => {
    // Verificar que hay al menos un medio de pago o anticipos
    const totalMedios =
      data.efectivo +
      data.dolares +
      data.transferencia +
      data.chequesTerceros +
      data.chequesPropios +
      data.retIVA +
      data.retGanancias +
      data.retIngBrutos;
    return totalMedios > 0 || data.anticiposIds.length > 0;
  },
  { message: 'Debe especificar al menos un medio de pago o anticipo' }
);

export const ApprovePaymentOrderSchema = z.object({
  accion: AccionAprobacionSchema,
  motivo: z.string().max(500).optional(),
}).refine(
  (data) => {
    // Si rechaza, motivo es obligatorio
    if (data.accion === 'rechazar' && !data.motivo) {
      return false;
    }
    return true;
  },
  { message: 'Debe proporcionar un motivo de rechazo', path: ['motivo'] }
);

// ============================================
// CAMBIO BANCARIO PROVEEDOR
// ============================================

export const ApproveSupplierChangeSchema = z.object({
  accion: AccionAprobacionSchema,
  motivo: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.accion === 'rechazar' && !data.motivo) {
      return false;
    }
    return true;
  },
  { message: 'Debe proporcionar un motivo de rechazo', path: ['motivo'] }
);

export const UpdateSupplierBankSchema = z.object({
  cbu: z.string().length(22, 'CBU debe tener 22 dígitos').regex(/^\d+$/, 'CBU solo debe contener números').optional().nullable(),
  alias_cbu: z.string().max(50).optional().nullable(),
  banco: z.string().max(100).optional().nullable(),
  tipo_cuenta: z.enum(['CAJA_AHORRO', 'CUENTA_CORRIENTE', 'CUENTA_UNICA']).optional().nullable(),
  numero_cuenta: z.string().max(30).optional().nullable(),
});

// ============================================
// PEDIDO DE COMPRA
// ============================================

const ItemPedidoSchema = z.object({
  supplierItemId: z.coerce.number().positive().optional(),
  descripcion: z.string().min(1, 'Descripción requerida').max(500),
  cantidad: z.coerce.number().positive('Cantidad debe ser mayor a 0'),
  unidadMedida: z.string().max(20).optional().default('UNIDAD'),
  precioEstimado: z.coerce.number().nonnegative().optional(),
  notas: z.string().max(500).optional(),
});

export const CreatePurchaseRequestSchema = z.object({
  titulo: z.string().min(3, 'Título muy corto').max(200),
  descripcion: z.string().max(2000).optional(),
  proveedorId: z.coerce.number().positive().optional(),
  prioridad: PrioridadSchema,
  fechaRequerida: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  items: z.array(ItemPedidoSchema).min(1, 'Debe incluir al menos un item'),
  presupuestoEstimado: z.coerce.number().nonnegative().optional(),
  centroCosto: z.string().max(50).optional(),
  proyecto: z.string().max(100).optional(),
  notas: z.string().max(1000).optional(),
});

export const ApprovePurchaseRequestSchema = z.object({
  accion: AccionAprobacionSchema,
  motivo: z.string().max(500).optional(),
  ajustes: z.object({
    presupuestoAprobado: z.coerce.number().nonnegative().optional(),
    fechaAprobada: z.string().datetime().optional(),
    notasAprobador: z.string().max(500).optional(),
  }).optional(),
}).refine(
  (data) => {
    if (data.accion === 'rechazar' && !data.motivo) {
      return false;
    }
    return true;
  },
  { message: 'Debe proporcionar un motivo de rechazo', path: ['motivo'] }
);

// ============================================
// ORDEN DE COMPRA
// ============================================

export const ApprovePurchaseOrderSchema = z.object({
  accion: z.enum(['enviar_aprobacion', 'aprobar', 'rechazar', 'enviar_proveedor', 'confirmar', 'reabrir', 'completar']),
  motivo: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.accion === 'rechazar' && !data.motivo) {
      return false;
    }
    return true;
  },
  { message: 'Debe proporcionar un motivo de rechazo', path: ['motivo'] }
);

// ============================================
// HELPERS DE VALIDACIÓN
// ============================================

/**
 * Valida y parsea un body de request con el schema dado
 * Retorna { success: true, data } o { success: false, error }
 */
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string; details: z.ZodIssue[] } {
  const result = schema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Formatear errores para respuesta
  const errorMessages = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`
  ).join('; ');

  return {
    success: false,
    error: `Datos inválidos: ${errorMessages}`,
    details: result.error.issues,
  };
}

/**
 * Tipo helper para inferir el tipo de un schema
 */
export type CreatePaymentOrderInput = z.infer<typeof CreatePaymentOrderSchema>;
export type ApprovePaymentOrderInput = z.infer<typeof ApprovePaymentOrderSchema>;
export type CreatePurchaseRequestInput = z.infer<typeof CreatePurchaseRequestSchema>;
export type ApprovePurchaseRequestInput = z.infer<typeof ApprovePurchaseRequestSchema>;
export type ApprovePurchaseOrderInput = z.infer<typeof ApprovePurchaseOrderSchema>;
export type ApproveSupplierChangeInput = z.infer<typeof ApproveSupplierChangeSchema>;
