import { z } from 'zod';
import { coercePositiveInt, coerceOptionalPositiveInt, optionalTrimmedString } from './helpers';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const DocTypeSchema = z.enum(['T1', 'T2'], {
  errorMap: () => ({ message: 'Tipo de documento inválido. Valores: T1, T2' }),
});

export const QuickPurchaseReasonSchema = z.enum(
  ['URGENCIA', 'MONTO_MENOR', 'PROVEEDOR_UNICO', 'REPOSICION', 'OTRO'],
  { errorMap: () => ({ message: 'Motivo de compra rápida inválido' }) }
);

// ─── Recepcion Item ─────────────────────────────────────────────────────────

export const RecepcionItemSchema = z.object({
  supplierItemId: coercePositiveInt('ID de item del proveedor'),
  purchaseOrderItemId: coerceOptionalPositiveInt,
  codigoPropio: optionalTrimmedString.or(z.null()),
  codigoProveedor: optionalTrimmedString.or(z.null()),
  descripcion: z.string().trim().max(1000, 'Descripción del item muy larga').optional().default(''),
  cantidadEsperada: z.coerce.number().min(0).optional().nullable(),
  cantidadRecibida: z.coerce.number().positive('Cantidad recibida debe ser mayor a 0'),
  cantidadAceptada: z.coerce.number().min(0, 'Cantidad aceptada no puede ser negativa').optional(),
  cantidadRechazada: z.coerce.number().min(0, 'Cantidad rechazada no puede ser negativa').optional().default(0),
  unidad: z.string().trim().max(20).default('UN'),
  precioUnitario: z.coerce.number().min(0, 'Precio unitario no puede ser negativo').optional(),
  motivoRechazo: z.string().trim().max(500).optional().or(z.null()),
  lote: z.string().trim().max(100).optional().or(z.null()),
  fechaVencimiento: z.string().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    'Fecha de vencimiento inválida'
  ).optional().or(z.null()),
  notas: z.string().trim().max(1000).optional().or(z.null()),
});

// ─── Create Recepcion ───────────────────────────────────────────────────────

export const CreateRecepcionSchema = z.object({
  proveedorId: coercePositiveInt('ID de proveedor'),
  purchaseOrderId: coerceOptionalPositiveInt,
  warehouseId: coercePositiveInt('ID de depósito'),
  fechaRecepcion: z.string().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    'Fecha de recepción inválida'
  ).optional(),
  numeroRemito: z.string().trim().max(100, 'Número de remito muy largo').optional().or(z.literal('')).or(z.null()),
  esEmergencia: z.boolean().default(false),
  notas: z.string().trim().max(5000, 'Notas muy largas').optional().or(z.null()),
  items: z.array(RecepcionItemSchema).min(1, 'Debe agregar al menos un item'),

  // Evidencia
  adjuntos: z.array(z.unknown()).optional().default([]),
  firma: z.string().optional().or(z.null()),
  observacionesRecepcion: z.string().trim().max(5000, 'Observaciones muy largas').optional().or(z.null()),
  docType: DocTypeSchema.default('T1'),

  // Factura
  facturaId: coerceOptionalPositiveInt,

  // Compra rápida
  isQuickPurchase: z.boolean().optional(),
  quickPurchaseReason: QuickPurchaseReasonSchema.optional(),
  quickPurchaseJustification: z.string().trim().max(2000).optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type RecepcionItemInput = z.infer<typeof RecepcionItemSchema>;
export type CreateRecepcionInput = z.infer<typeof CreateRecepcionSchema>;
