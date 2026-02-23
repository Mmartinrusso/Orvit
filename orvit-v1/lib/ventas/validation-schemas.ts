import { z } from 'zod';

// =============================================================================
// Common / Shared Schemas
// =============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const dateRangeSchema = z.object({
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
});

export const viewModeSchema = z.enum(['S', 'E']).default('S');

export const docTypeSchema = z.enum(['T1', 'T2']).default('T1');

// =============================================================================
// Client Schemas
// =============================================================================

export const taxConditionSchema = z.enum([
  'responsable_inscripto',
  'monotributo',
  'exento',
  'consumidor_final',
  'no_responsable',
]).default('consumidor_final');

export const tipoCondicionVentaSchema = z.enum([
  'FORMAL',
  'SEMIFORMAL',
  'INFORMAL',
]).default('FORMAL');

export const createClientSchema = z.object({
  // Required fields
  legalName: z.string().min(1, 'Razón social requerida').max(255),
  email: z.string().email('Email inválido'),
  postalCode: z.string().min(1, 'Código postal requerido').max(20),

  // Optional basic fields
  name: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  alternatePhone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  province: z.string().max(100).optional().nullable(),
  cuit: z.string().max(13).optional().nullable(),
  taxCondition: taxConditionSchema,
  observations: z.string().max(2000).optional().nullable(),
  contactPerson: z.string().max(255).optional().nullable(),

  // Credit and payment
  creditLimit: z.coerce.number().nonnegative().optional().nullable(),
  paymentTerms: z.coerce.number().int().nonnegative().optional().default(0),
  checkTerms: z.coerce.number().int().nonnegative().optional().nullable(),
  invoiceDueDays: z.coerce.number().int().nonnegative().optional().default(15),

  // Classification IDs
  clientTypeId: z.string().optional().nullable(),
  deliveryZoneId: z.string().optional().nullable(),
  sellerId: z.coerce.number().int().positive().optional().nullable(),
  priceListId: z.string().optional().nullable(),
  discountListId: z.string().optional().nullable(),

  // Sale conditions
  tipoCondicionVenta: tipoCondicionVentaSchema,
  porcentajeFormal: z.coerce.number().min(0).max(100).optional().nullable(),
  saleCondition: z.string().max(255).optional().nullable(),

  // Acopio (collection/storage)
  limiteAcopio: z.coerce.number().nonnegative().optional().nullable(),
  diasAlertaAcopio: z.coerce.number().int().nonnegative().optional().nullable(),

  // Check limits
  hasCheckLimit: z.boolean().optional().default(false),
  checkLimitType: z.string().max(50).optional().nullable(),
  checkLimit: z.coerce.number().nonnegative().optional().nullable(),

  // Other
  settlementPeriod: z.string().max(50).optional().nullable(),
  requiresPurchaseOrder: z.boolean().optional().default(false),
  grossIncome: z.string().max(50).optional().nullable(),
  activityStartDate: z.string().datetime().optional().nullable(),
  merchandisePendingDays: z.coerce.number().int().nonnegative().optional().nullable(),
  accountBlockDays: z.coerce.number().int().nonnegative().optional().nullable(),
  extraBonusDescription: z.string().max(500).optional().nullable(),
  transportCompanyId: z.string().optional().nullable(),
  businessSectorId: z.string().optional().nullable(),
  quickNote: z.string().max(500).optional().nullable(),
  quickNoteExpiry: z.string().datetime().optional().nullable(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  isActive: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  blockedReason: z.string().max(500).optional().nullable(),
});

export const clientFilterSchema = z.object({
  ...paginationSchema.shape,
  search: z.string().optional(),
  active: z.string().optional(), // 'true' or 'false'
  blocked: z.string().optional(), // 'true' or 'false'
  clientTypeId: z.string().optional(),
  deliveryZoneId: z.string().optional(),
  sellerId: z.string().optional(),
  taxCondition: z.string().optional(),
  sortBy: z.enum(['legalName', 'name', 'cuit', 'createdAt', 'currentBalance', 'creditLimit']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  includeCredit: z.string().optional(), // 'true' or 'false'
});

// =============================================================================
// Payment (Cobro) Schemas
// =============================================================================

export const chequeInputSchema = z.object({
  tipo: z.enum(['TERCERO', 'PROPIO', 'ECHEQ']).default('TERCERO'),
  numero: z.string().min(1, 'Número de cheque requerido').max(50),
  banco: z.string().min(1, 'Banco requerido').max(100),
  titular: z.string().max(255).optional().nullable(),
  cuit: z.string().max(13).optional().nullable(),
  fechaEmision: z.string().datetime().optional().nullable(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
  importe: z.coerce.number().positive('El importe debe ser positivo'),
});

export const paymentAllocationSchema = z.object({
  invoiceId: z.number().int().positive('ID de factura requerido'),
  monto: z.coerce.number().positive('El monto debe ser positivo'),
});

export const createPaymentSchema = z.object({
  clientId: z.string().min(1, 'Cliente requerido'),
  fechaPago: z.string().datetime().optional(),

  // Payment methods (all optional, but total must be > 0)
  efectivo: z.coerce.number().nonnegative().default(0),
  transferencia: z.coerce.number().nonnegative().default(0),
  chequesTerceros: z.coerce.number().nonnegative().default(0),
  chequesPropios: z.coerce.number().nonnegative().default(0),
  tarjetaCredito: z.coerce.number().nonnegative().default(0),
  tarjetaDebito: z.coerce.number().nonnegative().default(0),
  otrosMedios: z.coerce.number().nonnegative().default(0),

  // Retentions
  retIVA: z.coerce.number().nonnegative().default(0),
  retGanancias: z.coerce.number().nonnegative().default(0),
  retIngBrutos: z.coerce.number().nonnegative().default(0),

  // Transfer info
  bancoOrigen: z.string().max(100).optional().nullable(),
  numeroOperacion: z.string().max(100).optional().nullable(),

  // Notes
  notas: z.string().max(2000).optional().nullable(),

  // Allocations to invoices
  aplicaciones: z.array(paymentAllocationSchema).optional().default([]),

  // Cheques details
  cheques: z.array(chequeInputSchema).optional().default([]),
}).refine(
  (data) => {
    const total = data.efectivo + data.transferencia + data.chequesTerceros +
                  data.chequesPropios + data.tarjetaCredito + data.tarjetaDebito +
                  data.otrosMedios;
    return total > 0;
  },
  { message: 'El monto total del pago debe ser mayor a 0' }
);

export const paymentFilterSchema = z.object({
  ...paginationSchema.shape,
  estado: z.enum(['PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'ANULADO']).optional(),
  clienteId: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  search: z.string().optional(),
});

// =============================================================================
// Sale Order Schemas
// =============================================================================

export const saleItemSchema = z.object({
  productId: z.string().optional().nullable(),
  codigo: z.string().max(50).optional().nullable(),
  descripcion: z.string().min(1, 'Descripción requerida').max(500),
  cantidad: z.coerce.number().positive('La cantidad debe ser positiva'),
  unidad: z.string().max(20).default('UN'),
  precioUnitario: z.coerce.number().nonnegative('El precio debe ser positivo o cero'),
  descuento: z.coerce.number().min(0).max(100).default(0),
  notas: z.string().max(500).optional().nullable(),
  aplicaComision: z.boolean().default(true),
});

export const createSaleSchema = z.object({
  clientId: z.string().min(1, 'Cliente requerido'),
  sellerId: z.coerce.number().int().positive().optional(),
  fechaEmision: z.string().datetime().optional(),
  fechaEntregaEstimada: z.string().datetime().optional().nullable(),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
  condicionesPago: z.string().max(255).optional().nullable(),
  diasPlazo: z.coerce.number().int().nonnegative().optional().nullable(),
  lugarEntrega: z.string().max(500).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
  notasInternas: z.string().max(2000).optional().nullable(),
  descuentoGlobal: z.coerce.number().min(0).max(100).default(0),
  items: z.array(saleItemSchema).min(1, 'Debe agregar al menos un item'),
});

export const updateSaleSchema = createSaleSchema.partial().extend({
  estado: z.enum([
    'BORRADOR',
    'CONFIRMADA',
    'EN_PREPARACION',
    'PARCIALMENTE_ENTREGADA',
    'ENTREGADA',
    'PARCIALMENTE_FACTURADA',
    'FACTURADA',
    'CERRADA',
    'CANCELADA',
  ]).optional(),
});

export const saleFilterSchema = z.object({
  ...paginationSchema.shape,
  estado: z.string().optional(),
  clienteId: z.string().optional(),
  vendedorId: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  search: z.string().optional(),
});

// =============================================================================
// Invoice Schemas
// =============================================================================

export const invoiceItemSchema = z.object({
  productId: z.string().optional().nullable(),
  saleItemId: z.number().int().positive().optional().nullable(),
  codigo: z.string().max(50).optional().nullable(),
  descripcion: z.string().min(1, 'Descripción requerida').max(500),
  cantidad: z.coerce.number().positive('La cantidad debe ser positiva'),
  unidad: z.string().max(20).default('UN'),
  precioUnitario: z.coerce.number().nonnegative('El precio debe ser positivo o cero'),
  alicuotaIva: z.coerce.number().min(0).max(100).default(21),
  descuento: z.coerce.number().min(0).max(100).default(0),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Cliente requerido'),
  saleId: z.number().int().positive().optional().nullable(),
  tipoComprobante: z.enum(['FACTURA_A', 'FACTURA_B', 'FACTURA_C', 'NOTA_DEBITO_A', 'NOTA_DEBITO_B']).default('FACTURA_A'),
  puntoVenta: z.coerce.number().int().positive().optional(),
  fechaEmision: z.string().datetime().optional(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
  condicionesPago: z.string().max(255).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'Debe agregar al menos un item'),
  docType: docTypeSchema,
});

export const invoiceFilterSchema = z.object({
  ...paginationSchema.shape,
  estado: z.enum(['BORRADOR', 'EMITIDA', 'PARCIALMENTE_COBRADA', 'COBRADA', 'ANULADA']).optional(),
  clienteId: z.string().optional(),
  saleId: z.string().optional(),
  tipoComprobante: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  search: z.string().optional(),
  overdue: z.string().optional(), // 'true' or 'false'
});

// =============================================================================
// Credit/Debit Note Schemas
// =============================================================================

export const creditDebitNoteReasonSchema = z.enum([
  'DEVOLUCION',
  'DIFERENCIA_CARGA',
  'DIFERENCIA_PRECIO',
  'BONIFICACION',
  'AJUSTE_FINANCIERO',
  'REFACTURACION',
  'FLETE',
  'OTRO',
]);

export const creditDebitNoteItemSchema = z.object({
  productId: z.string().optional().nullable(),
  invoiceItemId: z.number().int().positive().optional().nullable(),
  codigo: z.string().max(50).optional().nullable(),
  descripcion: z.string().min(1, 'Descripción requerida').max(500),
  cantidad: z.coerce.number().positive('La cantidad debe ser positiva'),
  unidad: z.string().max(20).default('UN'),
  precioUnitario: z.coerce.number().nonnegative('El precio debe ser positivo o cero'),
  alicuotaIva: z.coerce.number().min(0).max(100).default(21),
});

export const createCreditDebitNoteSchema = z.object({
  tipo: z.enum(['NOTA_CREDITO', 'NOTA_DEBITO']),
  motivo: creditDebitNoteReasonSchema,
  clientId: z.string().min(1, 'Cliente requerido'),
  invoiceId: z.number().int().positive().optional().nullable(),
  deliveryId: z.number().int().positive().optional().nullable(),
  returnRequestId: z.number().int().positive().optional().nullable(),
  fecha: z.string().datetime().optional(),
  descripcion: z.string().max(2000).optional().nullable(),
  afectaStock: z.boolean().default(false),
  items: z.array(creditDebitNoteItemSchema).min(1, 'Debe agregar al menos un item'),
  docType: docTypeSchema,
});

export const creditDebitNoteFilterSchema = z.object({
  ...paginationSchema.shape,
  tipo: z.enum(['NOTA_CREDITO', 'NOTA_DEBITO']).optional(),
  estado: z.enum(['BORRADOR', 'EMITIDA', 'APLICADA', 'ANULADA']).optional(),
  clienteId: z.string().optional(),
  invoiceId: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  search: z.string().optional(),
});

// =============================================================================
// Load Order Schemas
// =============================================================================

export const loadOrderItemSchema = z.object({
  saleItemId: z.number().int().positive('ID de item de venta requerido'),
  cantidad: z.coerce.number().positive('La cantidad debe ser positiva'),
  secuencia: z.coerce.number().int().nonnegative().optional().default(0),
  posicion: z.string().max(50).optional().nullable(),
});

export const createLoadOrderSchema = z.object({
  saleId: z.number().int().positive('Orden de venta requerida'),
  vehiculo: z.string().max(100).optional().nullable(),
  vehiculoPatente: z.string().max(20).optional().nullable(),
  chofer: z.string().max(255).optional().nullable(),
  choferDNI: z.string().max(20).optional().nullable(),
  observaciones: z.string().max(2000).optional().nullable(),
  items: z.array(loadOrderItemSchema).min(1, 'Debe agregar al menos un item'),
  docType: docTypeSchema,
});

export const confirmLoadItemSchema = z.object({
  loadOrderItemId: z.number().int().positive('ID de item requerido'),
  cantidadCargada: z.coerce.number().nonnegative('La cantidad debe ser positiva o cero'),
  motivoDiferencia: z.string().max(500).optional().nullable(),
});

export const confirmLoadOrderSchema = z.object({
  items: z.array(confirmLoadItemSchema).min(1, 'Debe confirmar al menos un item'),
  firmaOperario: z.string().optional().nullable(), // Base64
});

export const loadOrderFilterSchema = z.object({
  ...paginationSchema.shape,
  estado: z.enum(['PENDIENTE', 'CARGANDO', 'CARGADA', 'DESPACHADA', 'CANCELADA']).optional(),
  saleId: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  search: z.string().optional(),
});

// =============================================================================
// Cost Breakdown Schema (Desglose de costos por item)
// =============================================================================

export const costBreakdownItemSchema = z.object({
  concepto: z.string().min(1, 'Concepto requerido').max(100),
  monto: z.coerce.number().nonnegative('El monto debe ser >= 0'),
});

export type CostBreakdownItemInput = z.infer<typeof costBreakdownItemSchema>;

// =============================================================================
// Quotation Schemas
// =============================================================================

export const quotationItemSchema = z.object({
  productId: z.string().optional().nullable(),
  codigo: z.string().max(50).optional().nullable(),
  descripcion: z.string().min(1, 'Descripción requerida').max(500),
  cantidad: z.coerce.number().positive('La cantidad debe ser positiva'),
  unidad: z.string().max(20).default('UN'),
  precioUnitario: z.coerce.number().nonnegative('El precio debe ser positivo o cero'),
  descuento: z.coerce.number().min(0).max(100).default(0),
  notas: z.string().max(500).optional().nullable(),
  costBreakdown: z.array(costBreakdownItemSchema).optional().default([]),
  aplicaComision: z.boolean().default(true),
});

export const createQuotationSchema = z.object({
  clientId: z.string().min(1, 'Cliente requerido'),
  sellerId: z.coerce.number().int().positive().optional().nullable(),
  templateId: z.coerce.number().int().positive().optional().nullable(),
  titulo: z.string().max(255).optional().nullable(),
  descripcion: z.string().max(2000).optional().nullable(),
  fechaEmision: z.string().datetime().optional(),
  fechaValidez: z.string().datetime().optional().nullable(),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
  condicionesPago: z.string().max(255).optional().nullable(),
  diasPlazo: z.coerce.number().int().nonnegative().optional().nullable(),
  condicionesEntrega: z.string().max(500).optional().nullable(),
  incluyeFlete: z.boolean().optional().default(false),
  tiempoEntrega: z.string().max(255).optional().nullable(),
  lugarEntrega: z.string().max(500).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
  notasInternas: z.string().max(2000).optional().nullable(),
  descuentoGlobal: z.coerce.number().min(0).max(100).default(0),
  discriminarIva: z.boolean().default(false),
  items: z.array(quotationItemSchema).min(1, 'Debe agregar al menos un item'),
});

export const quotationFilterSchema = z.object({
  ...paginationSchema.shape,
  estado: z.string().optional(),
  clienteId: z.string().optional(),
  vendedorId: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  search: z.string().optional(),
  vencidas: z.string().optional(), // 'true' or 'false'
});

// =============================================================================
// Credit Validation Schemas
// =============================================================================

export const validateCreditSchema = z.object({
  clientId: z.string().min(1, 'Cliente requerido'),
  orderAmount: z.coerce.number().nonnegative().default(0),
});

export const blockClientSchema = z.object({
  motivo: z.string().min(1, 'Motivo requerido').max(500),
  tipoBloqueo: z.enum(['CREDITO', 'MORA', 'MANUAL', 'CHEQUE_RECHAZADO']).default('MANUAL'),
});

export const unblockClientSchema = z.object({
  motivo: z.string().min(1, 'Motivo requerido').max(500),
});

// =============================================================================
// Pickup Slot / Turn Schemas
// =============================================================================

export const createPickupSlotSchema = z.object({
  fecha: z.string().datetime(),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido (HH:MM)'),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido (HH:MM)'),
  capacidadMaxima: z.coerce.number().int().positive().default(1),
});

export const reservePickupSlotSchema = z.object({
  slotId: z.number().int().positive('Turno requerido'),
  saleId: z.number().int().positive('Orden de venta requerida'),
  clientId: z.string().min(1, 'Cliente requerido'),
  observaciones: z.string().max(500).optional().nullable(),
});

export const completePickupSchema = z.object({
  retiroNombre: z.string().min(1, 'Nombre requerido').max(255),
  retiroDNI: z.string().min(1, 'DNI requerido').max(20),
  retiroVehiculo: z.string().max(100).optional().nullable(),
});

// =============================================================================
// Delivery Schemas
// =============================================================================

export const deliveryItemSchema = z.object({
  saleItemId: z.number().int().positive('ID de item requerido'),
  cantidadEntregada: z.coerce.number().positive('La cantidad debe ser positiva'),
});

export const createDeliverySchema = z.object({
  saleId: z.number().int().positive('Orden de venta requerida'),
  tipo: z.enum(['RETIRO', 'ENVIO']).default('ENVIO'),
  fechaProgramada: z.string().datetime().optional().nullable(),
  direccionEntrega: z.string().max(500).optional().nullable(),
  transportista: z.string().max(255).optional().nullable(),
  vehiculo: z.string().max(100).optional().nullable(),
  conductorNombre: z.string().max(255).optional().nullable(),
  conductorDNI: z.string().max(20).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
  items: z.array(deliveryItemSchema).min(1, 'Debe agregar al menos un item'),
  docType: docTypeSchema,
});

export const confirmDeliverySchema = z.object({
  firmaCliente: z.string().optional().nullable(), // Base64
  fotoEntrega: z.string().optional().nullable(), // Base64 or URL
  observaciones: z.string().max(2000).optional().nullable(),
  recibeNombre: z.string().max(255).optional().nullable(),
  recibeDNI: z.string().max(20).optional().nullable(),
});

// =============================================================================
// Price List Schemas
// =============================================================================

export const createPriceListSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  descripcion: z.string().max(500).optional().nullable(),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
  porcentajeBase: z.coerce.number().min(-100).max(1000).optional().nullable(),
  esDefault: z.boolean().optional().default(false),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
});

export const updatePriceListSchema = createPriceListSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const priceListItemSchema = z.object({
  productId: z.string().min(1, 'Producto requerido'),
  precioUnitario: z.coerce.number().nonnegative('El precio debe ser positivo o cero'),
  porcentaje: z.coerce.number().nonnegative().optional().nullable(),
});

export const bulkPriceListItemsSchema = z.object({
  items: z.array(priceListItemSchema).min(1, 'Debe agregar al menos un item'),
});

// =============================================================================
// Order Cancellation Schema
// =============================================================================

export const cancelOrderSchema = z.object({
  motivo: z.string().min(1, 'Motivo de cancelación requerido').max(500),
});

// =============================================================================
// Order Confirmation Schema
// =============================================================================

export const confirmOrderSchema = z.object({
  ignorarAlertasStock: z.boolean().optional().default(false),
  ignorarLimiteCredito: z.boolean().optional().default(false),
});

// =============================================================================
// Quote Action Schemas
// =============================================================================

export const quoteApprovalSchema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('aprobar'),
  }),
  z.object({
    accion: z.literal('rechazar'),
    motivo: z.string().min(1, 'Motivo de rechazo requerido').max(500),
  }),
]);

export const quoteSendSchema = z.object({
  mensaje: z.string().max(2000).optional().nullable(),
  crearPortalAccess: z.boolean().optional().default(false),
});

export const quoteDuplicateSchema = z.object({
  clientId: z.string().optional().nullable(),
});

export const quoteConvertSchema = z.object({
  forzarConversion: z.boolean().optional().default(false),
  docType: z.enum(['T1', 'T2']).optional(),
});

// =============================================================================
// Payment Action Schemas
// =============================================================================

export const paymentActionSchema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('confirmar'),
  }),
  z.object({
    accion: z.literal('anular'),
    motivo: z.string().min(1, 'Motivo de anulación requerido').max(500),
  }),
  z.object({
    accion: z.literal('rechazar'),
    motivo: z.string().min(1, 'Motivo de rechazo requerido').max(500),
  }),
]);

// =============================================================================
// Credit/Debit Note Action Schemas
// =============================================================================

export const creditNoteActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('emit'),
  }),
  z.object({
    action: z.literal('cancel'),
  }),
  z.object({
    action: z.literal('retry'),
  }),
]);

// =============================================================================
// Product Schemas
// =============================================================================

export const createProductSchema = z.object({
  // Required
  code: z.string().min(1, 'Código requerido').max(50),
  name: z.string().min(1, 'Nombre requerido').max(255),
  categoryId: z.coerce.number().int().positive('Categoría requerida'),

  // Optional fields
  description: z.string().max(2000).optional().default(''),
  unit: z.string().max(20).optional().default('unidad'),

  // Pricing
  costPrice: z.coerce.number().nonnegative().optional().default(0),
  costCurrency: z.enum(['ARS', 'USD']).optional().default('ARS'),
  salePrice: z.coerce.number().nonnegative().optional().nullable(),
  marginMin: z.coerce.number().optional().nullable(),
  marginMax: z.coerce.number().optional().nullable(),

  // Stock
  currentStock: z.coerce.number().nonnegative().optional().default(0),
  minStock: z.coerce.number().nonnegative().optional().default(0),

  // Physical properties
  weight: z.coerce.number().nonnegative().optional().default(0),
  volume: z.coerce.number().nonnegative().optional().default(0),
  volumeUnit: z.string().max(50).optional().default('metros_lineales'),
  blocksPerM2: z.coerce.number().int().positive().optional().nullable(),

  // Location
  location: z.string().max(100).optional().default(''),

  // Flags
  isActive: z.boolean().optional().default(true),
  aplicaComision: z.boolean().optional().default(true),

  // Additional
  barcode: z.string().max(100).optional().nullable(),
  sku: z.string().max(50).optional().nullable(),
  images: z.array(z.string()).optional().default([]),

  // Cost type and associations
  costType: z.enum(['PRODUCTION', 'PURCHASE', 'MANUAL']).optional().default('MANUAL'),
  recipeId: z.string().optional().nullable(),
  purchaseInputId: z.string().optional().nullable(),
});

export const updateProductSchema = createProductSchema.partial();

export const productFilterSchema = z.object({
  ...paginationSchema.shape,
  search: z.string().optional(),
  categoryId: z.string().optional(),
  active: z.string().optional(),
  sellable: z.string().optional(),
  lowStock: z.string().optional(), // 'true' to filter low stock
  sortBy: z.enum(['name', 'code', 'salePrice', 'stockQuantity', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// =============================================================================
// Dispute Schemas
// =============================================================================

export const disputeTypeSchema = z.enum([
  'FACTURACION_INCORRECTA',
  'MERCADERIA_DANADA',
  'MERCADERIA_FALTANTE',
  'PRECIO_INCORRECTO',
  'FLETE_INCORRECTO',
  'DUPLICADO',
  'NO_RECIBIDO',
  'OTRO',
]);

export const disputeStatusSchema = z.enum([
  'ABIERTA',
  'EN_INVESTIGACION',
  'PENDIENTE_CLIENTE',
  'PENDIENTE_INTERNO',
  'RESUELTA',
  'CERRADA',
]);

export const disputeResolutionSchema = z.enum([
  'FAVOR_CLIENTE',
  'FAVOR_EMPRESA',
  'PARCIAL',
  'ACUERDO',
]);

export const createDisputeSchema = z.object({
  clientId: z.string().min(1, 'Cliente requerido'),
  invoiceId: z.coerce.number().int().positive().optional().nullable(),
  deliveryId: z.coerce.number().int().positive().optional().nullable(),
  tipo: disputeTypeSchema,
  descripcion: z.string().min(1, 'Descripción requerida').max(2000),
  montoDisputa: z.coerce.number().nonnegative().optional().nullable(),
});

export const updateDisputeSchema = z.object({
  estado: disputeStatusSchema.optional(),
  descripcion: z.string().max(2000).optional(),
  montoDisputa: z.coerce.number().nonnegative().optional().nullable(),
});

export const resolveDisputeSchema = z.object({
  resolucion: disputeResolutionSchema,
  resolucionNotas: z.string().max(2000).optional().nullable(),
  creditNoteId: z.coerce.number().int().positive().optional().nullable(),
});

export const disputeFilterSchema = z.object({
  ...paginationSchema.shape,
  tipo: disputeTypeSchema.optional(),
  estado: disputeStatusSchema.optional(),
  clienteId: z.string().optional(),
  invoiceId: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  search: z.string().optional(),
});

// =============================================================================
// Collection Action Schemas
// =============================================================================

export const collectionActionTypeSchema = z.enum([
  'LLAMADA',
  'EMAIL',
  'CARTA',
  'VISITA',
  'WHATSAPP',
  'PROMESA_PAGO',
  'ACUERDO_PAGO',
  'DERIVACION_LEGAL',
]);

export const collectionActionStatusSchema = z.enum([
  'PENDIENTE',
  'EN_PROCESO',
  'COMPLETADA',
  'ESCALADA',
]);

export const createCollectionActionSchema = z.object({
  clientId: z.string().min(1, 'Cliente requerido'),
  invoiceId: z.coerce.number().int().positive().optional().nullable(),
  tipo: collectionActionTypeSchema,
  fecha: z.string().datetime().optional(),
  descripcion: z.string().max(2000).optional().nullable(),

  // Contact info
  contactoNombre: z.string().max(255).optional().nullable(),
  contactoTelefono: z.string().max(50).optional().nullable(),
  contactoEmail: z.string().email().optional().nullable(),

  // Assignment
  asignadoA: z.coerce.number().int().positive().optional().nullable(),

  // Follow-up
  proximaAccion: z.string().datetime().optional().nullable(),
  promesaPago: z.string().datetime().optional().nullable(),
  promesaMonto: z.coerce.number().nonnegative().optional().nullable(),
});

export const updateCollectionActionSchema = z.object({
  estado: collectionActionStatusSchema.optional(),
  resultado: z.string().max(2000).optional().nullable(),
  proximaAccion: z.string().datetime().optional().nullable(),
  promesaPago: z.string().datetime().optional().nullable(),
  promesaMonto: z.coerce.number().nonnegative().optional().nullable(),
});

export const collectionActionFilterSchema = z.object({
  ...paginationSchema.shape,
  tipo: collectionActionTypeSchema.optional(),
  estado: collectionActionStatusSchema.optional(),
  clienteId: z.string().optional(),
  invoiceId: z.string().optional(),
  asignadoA: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
});

// =============================================================================
// Update Schemas for existing entities
// =============================================================================

export const updateInvoiceSchema = z.object({
  fechaVencimiento: z.string().datetime().optional(),
  condicionesPago: z.string().max(255).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
});

export const updateDeliverySchema = z.object({
  fechaProgramada: z.string().datetime().optional().nullable(),
  direccionEntrega: z.string().max(500).optional().nullable(),
  transportista: z.string().max(255).optional().nullable(),
  vehiculo: z.string().max(100).optional().nullable(),
  conductorNombre: z.string().max(255).optional().nullable(),
  conductorDNI: z.string().max(20).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
});

export const updateQuotationSchema = z.object({
  titulo: z.string().max(255).optional(),
  fechaValidez: z.string().datetime().optional().nullable(),
  condicionesPago: z.string().max(255).optional().nullable(),
  plazoEntrega: z.string().max(255).optional().nullable(),
  lugarEntrega: z.string().max(500).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
  notasInternas: z.string().max(2000).optional().nullable(),
  descuentoGlobal: z.coerce.number().min(0).max(100).optional(),
});

export const updatePickupSlotSchema = z.object({
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido').optional(),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido').optional(),
  capacidadMaxima: z.coerce.number().int().positive().optional(),
});

// =============================================================================
// Payment Terms Schemas
// =============================================================================

export const createPaymentTermSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  dias: z.coerce.number().int().nonnegative('Los días deben ser 0 o más'),
  descuentoProntoPago: z.coerce.number().min(0).max(100).optional().default(0),
  diasDescuento: z.coerce.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updatePaymentTermSchema = createPaymentTermSchema.partial();

// =============================================================================
// Sales Zone Schemas
// =============================================================================

export const createSalesZoneSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  descripcion: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateSalesZoneSchema = createSalesZoneSchema.partial();

// =============================================================================
// Sales Rep (Vendedor) Schemas
// =============================================================================

export const createSalesRepSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(255),
  email: z.string().email('Email inválido'),
  telefono: z.string().max(50).optional().nullable(),
  zonaId: z.coerce.number().int().positive().optional().nullable(),
  comision: z.coerce.number().min(0).max(100).default(0),
  cuotaMensual: z.coerce.number().nonnegative().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateSalesRepSchema = createSalesRepSchema.partial();

// =============================================================================
// Type exports for TypeScript usage
// =============================================================================

export type CreatePaymentTermInput = z.infer<typeof createPaymentTermSchema>;
export type UpdatePaymentTermInput = z.infer<typeof updatePaymentTermSchema>;
export type CreateSalesZoneInput = z.infer<typeof createSalesZoneSchema>;
export type UpdateSalesZoneInput = z.infer<typeof updateSalesZoneSchema>;
export type CreateSalesRepInput = z.infer<typeof createSalesRepSchema>;
export type UpdateSalesRepInput = z.infer<typeof updateSalesRepSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateCreditDebitNoteInput = z.infer<typeof createCreditDebitNoteSchema>;
export type CreateLoadOrderInput = z.infer<typeof createLoadOrderSchema>;
export type ConfirmLoadOrderInput = z.infer<typeof confirmLoadOrderSchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type ValidateCreditInput = z.infer<typeof validateCreditSchema>;
export type BlockClientInput = z.infer<typeof blockClientSchema>;
export type UnblockClientInput = z.infer<typeof unblockClientSchema>;
export type CreatePickupSlotInput = z.infer<typeof createPickupSlotSchema>;
export type ReservePickupSlotInput = z.infer<typeof reservePickupSlotSchema>;
export type CompletePickupInput = z.infer<typeof completePickupSchema>;
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type ConfirmDeliveryInput = z.infer<typeof confirmDeliverySchema>;
export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>;
export type PriceListItemInput = z.infer<typeof priceListItemSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type UpdateDisputeInput = z.infer<typeof updateDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
export type CreateCollectionActionInput = z.infer<typeof createCollectionActionSchema>;
export type UpdateCollectionActionInput = z.infer<typeof updateCollectionActionSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type UpdateDeliveryInput = z.infer<typeof updateDeliverySchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type UpdatePickupSlotInput = z.infer<typeof updatePickupSlotSchema>;
export type ConfirmOrderInput = z.infer<typeof confirmOrderSchema>;
export type QuoteApprovalInput = z.infer<typeof quoteApprovalSchema>;
export type QuoteSendInput = z.infer<typeof quoteSendSchema>;
export type QuoteDuplicateInput = z.infer<typeof quoteDuplicateSchema>;
export type PaymentActionInput = z.infer<typeof paymentActionSchema>;
export type CreditNoteActionInput = z.infer<typeof creditNoteActionSchema>;

// =============================================================================
// Liquidaciones de Vendedores
// =============================================================================

export const liquidacionItemSchema = z.object({
  saleId: z.coerce.number().int().positive(),
  incluido: z.boolean().default(true),
  motivoExclusion: z.string().max(255).optional().nullable(),
});

export const createLiquidacionSchema = z.object({
  sellerId: z.coerce.number().int().positive('Vendedor requerido'),
  fechaDesde: z.string().min(1, 'Fecha desde requerida'),
  fechaHasta: z.string().min(1, 'Fecha hasta requerida'),
  comisionPorcentaje: z.coerce.number().min(0).max(100).optional(),
  ajustes: z.coerce.number().default(0),
  notas: z.string().max(2000).optional().nullable(),
  notasInternas: z.string().max(2000).optional().nullable(),
  items: z.array(liquidacionItemSchema).min(1, 'Debe incluir al menos una venta'),
});

export const updateLiquidacionSchema = createLiquidacionSchema.partial();

export const liquidacionFilterSchema = z.object({
  ...paginationSchema.shape,
  estado: z.enum(['BORRADOR', 'CONFIRMADA', 'PAGADA', 'ANULADA']).optional(),
  sellerId: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  search: z.string().optional(),
});

export const liquidacionActionSchema = z.object({
  action: z.enum(['confirmar', 'pagar', 'anular']),
  medioPago: z.string().max(100).optional(),
  referenciaPago: z.string().max(255).optional(),
  notas: z.string().max(2000).optional(),
});

export type CreateLiquidacionInput = z.infer<typeof createLiquidacionSchema>;
export type UpdateLiquidacionInput = z.infer<typeof updateLiquidacionSchema>;
export type LiquidacionActionInput = z.infer<typeof liquidacionActionSchema>;
