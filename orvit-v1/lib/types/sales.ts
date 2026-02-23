export interface Category {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  companyId: number;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  description: string;
  categoryId: number;
  category?: Category & { parent?: { id: number; name: string } }; // Relacion con categoria padre
  unit: string;
  costPrice: number;
  costCurrency?: string; // ARS, USD, EUR
  costType?: 'MANUAL' | 'PRODUCTION' | 'PURCHASE';
  minStock: number;
  currentStock: number;
  volume: number;
  volumeUnit?: 'metros_lineales' | 'metros_cuadrados'; // Unidad de volumen
  weight: number;
  location: string;
  blocksPerM2?: number; // Solo para categoria 'bloques'
  isActive: boolean;
  images: string[];
  files: string[];
  image?: string; // Imagen principal
  companyId: number;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;

  // Campos de costo avanzado
  recipeId?: string;
  purchaseInputId?: string;
  recipe?: {
    id: string;
    name: string;
    totalCost?: number;
  };
  purchaseInput?: {
    id: string;
    name: string;
    currentPrice?: number;
    supplier?: string;
  };
  weightedAverageCost?: number;
  lastCostUpdate?: Date;
  costCalculationStock?: number;
  supplier?: {
    id: string;
    name: string;
  };

  // Precios de venta y margen
  salePrice?: number; // Precio de venta sugerido
  saleCurrency?: string; // Moneda del precio de venta
  marginMin?: number; // Margen mínimo permitido (%)
  marginMax?: number; // Margen máximo permitido (%)

  // Códigos adicionales
  barcode?: string; // Código de barras
  sku?: string; // SKU alternativo

  // Características
  tags?: string[]; // Array de etiquetas

  // Trazabilidad
  trackBatches?: boolean; // Seguimiento por lote
  trackExpiration?: boolean; // Control de vencimiento

  // Alertas
  alertStockEmail?: boolean; // Alertar por email
  alertStockDays?: number; // Días de anticipación para alertas

  // Historial de costos (solo lectura)
  costLogs?: ProductCostLog[];
}

// Historial de cambios de costo
export interface ProductCostLog {
  id: string;
  productId: string;
  companyId: number;
  previousCost?: number;
  newCost: number;
  previousStock?: number;
  newStock?: number;
  changeSource: 'PURCHASE' | 'RECIPE_UPDATE' | 'MANUAL' | 'BATCH_RUN';
  sourceDocumentId?: string;
  sourceDocumentType?: string;
  calculationMethod?: string;
  createdAt: Date;
  createdById?: number;
  notes?: string;
}

// Movimientos de stock de productos
export interface ProductStockMovement {
  id: string;
  productId: string;
  companyId: number;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  cantidad: number;
  stockAnterior: number;
  stockPosterior: number;
  sourceType?: 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'PRODUCTION' | 'MANUAL';
  sourceId?: string;
  sourceNumber?: string;
  motivo?: string;
  notas?: string;
  createdBy: number;
  createdAt: Date;
  user?: {
    id: number;
    name: string;
  };
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  cuit?: string;
  taxCondition: 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final';
  discounts: ClientDiscount[];
  priceLists?: ClientPriceList[];
  creditLimit?: number;
  currentBalance: number;
  paymentTerms: number; // días de plazo de pago
  isActive: boolean;
  observations?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientDiscount {
  id: string;
  clientId: string;
  name: string;
  percentage?: number;
  amount?: number;
  categoryId?: number;
  productId?: string;
  minQuantity?: number;
  isActive: boolean;
  validFrom?: Date;
  validUntil?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientPriceList {
  id: string;
  clientId: string;
  priceListId: string;
  priceListName: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface Quote {
  id: string;
  number: string; // Número de cotización (ej: COT-2024-001)
  clientId: string;
  client: Client;
  description: string; // Descripción de la cotización
  items: QuoteItem[];
  subtotal: number;
  taxes: number; // Cambiado de tax a taxes para consistencia
  total: number;
  status: 'draft' | 'sent' | 'pending_closure' | 'payment_confirmed' | 'lost' | 'expired' | 'converted';
  paymentMethod: string;
  paymentTerms?: number; // Términos de pago en días
  validUntil: string; // Fecha hasta cuando es válida la cotización
  notes?: string; // Notas públicas
  deliveryTerms?: string; // Términos de entrega
  lostReason?: string;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  paymentConfirmedAt?: Date;
  lostAt?: Date;
  convertedToInvoiceAt?: Date;
  convertedInvoiceId?: string;
}

export interface Invoice {
  id: string;
  number: string; // Número de factura (ej: FA-A-0001-00000001)
  type: 'A' | 'B' | 'C'; // Tipo de factura
  clientId: string;
  client: Client;
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  totalDiscount: number;
  total: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod: string;
  dueDate: Date;
  paidDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sale {
  id: string;
  number: string; // Número de venta (ej: VEN-2024-001)
  clientId: string;
  client: Client;
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  paymentMethod: string;
  paidDate?: Date;
  deliveryDate?: Date;
  notes?: string;
  quoteId?: string; // Si viene de una cotización
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientActivity {
  id: string;
  clientId: string;
  type: 'quote' | 'invoice' | 'credit_note' | 'debit_note' | 'payment' | 'contact' | 'discount_applied';
  documentId?: string;
  description: string;
  amount?: number;
  status?: string;
  createdAt: Date;
  createdBy: string;
}

export interface ClientSummary {
  client: Client;
  totalQuotes: number;
  totalInvoices: number;
  totalSales: number;
  pendingAmount: number;
  overdueAmount: number;
  lastActivity: Date;
  conversionRate: number; // % de cotizaciones que se convierten en ventas
  averageOrderValue: number;
  totalPaid: number;
  creditNotesTotal: number;
  debitNotesTotal: number;
}

// Categorías de productos (temporal - las categorías reales se obtienen de la API)
export const CATEGORIES = [
  'bloques',
  'viguetas',
  'losas',
  'columnas',
  'vigas',
  'otros'
] as const;

export type CategoryType = typeof CATEGORIES[number];

// Unidades de medida comunes
export const UNITS = [
  'unidad',
  'metro',
  'metro cuadrado',
  'metro cúbico',
  'kilogramo',
  'gramo',
  'tonelada',
  'litro',
  'mililitro',
  'bolsa',
  'caja',
  'pallet',
  'rollo',
  'hoja',
  'set',
  'docena',
  'par'
] as const;

export type UnitType = typeof UNITS[number];

// Funciones de utilidad para categorías (reemplaza el enum CATEGORIES)
export const getCategoriesByCompany = async (companyId: number): Promise<Category[]> => {
  // Esta función será implementada en las APIs
  return [];
};

export const getActiveCategories = (categories: Category[]): Category[] => {
  return categories.filter(cat => cat.isActive);
};

export const PAYMENT_METHODS = [
  'efectivo',
  'transferencia',
  'cheque',
  'tarjeta',
  'cuenta_corriente'
] as const;

export const TAX_CONDITIONS = [
  'responsable_inscripto',
  'monotributo',
  'exento',
  'consumidor_final'
] as const;

export const TAX_CONDITION_LABELS = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final'
} as const;

export const QUOTE_STATUS_LABELS = {
  draft: 'Borrador',
  sent: 'Enviada',
  pending_closure: 'Pendiente de Cierre',
  payment_confirmed: 'Pago Confirmado',
  lost: 'Perdida',
  expired: 'Vencida',
  converted: 'Convertida a Factura'
} as const;

export const INVOICE_STATUS_LABELS = {
  draft: 'Borrador',
  issued: 'Emitida',
  paid: 'Pagada',
  overdue: 'Vencida',
  cancelled: 'Cancelada'
} as const;

export const SALE_STATUS_LABELS = {
  confirmed: 'Confirmada',
  delivered: 'Entregada',
  paid: 'Pagada',
  cancelled: 'Cancelada'
} as const;

// Tipos para filtros y búsquedas
export interface ClientFilter {
  search?: string;
  taxCondition?: string;
  isActive?: boolean;
  hasOverdueInvoices?: boolean;
  hasDiscounts?: boolean;
  sortBy?: 'name' | 'totalSales' | 'lastActivity' | 'currentBalance';
  sortOrder?: 'asc' | 'desc';
}

export interface DocumentFilter {
  clientId?: string;
  type?: 'quote' | 'invoice' | 'credit_note' | 'debit_note';
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountFrom?: number;
  amountTo?: number;
}

// ============================================================================
// SISTEMA DE VENTAS EMPRESARIAL - TIPOS EXTENDIDOS
// ============================================================================

// Enums que coinciden con Prisma
export type QuoteStatus =
  | 'BORRADOR'
  | 'PENDIENTE_APROBACION'
  | 'APROBADA'
  | 'ENVIADA'
  | 'EN_NEGOCIACION'
  | 'ACEPTADA'
  | 'CONVERTIDA'
  | 'PERDIDA'
  | 'VENCIDA'
  | 'CANCELADA';

export type SaleStatus =
  | 'BORRADOR'
  | 'PENDIENTE_APROBACION'
  | 'APROBADA'
  | 'CONFIRMADA'
  | 'EN_PREPARACION'
  | 'PARCIALMENTE_ENTREGADA'
  | 'ENTREGADA'
  | 'FACTURADA'
  | 'COMPLETADA'
  | 'CANCELADA';

export type DeliveryStatus =
  | 'PENDIENTE'
  | 'EN_PREPARACION'
  | 'EN_TRANSITO'
  | 'ENTREGADA'
  | 'PARCIAL'
  | 'CANCELADA';

export type RemitoStatus = 'BORRADOR' | 'EMITIDO' | 'ANULADO';

export type SalesInvoiceType = 'A' | 'B' | 'C' | 'M' | 'E';

export type SalesInvoiceStatus =
  | 'BORRADOR'
  | 'EMITIDA'
  | 'ENVIADA'
  | 'PARCIALMENTE_COBRADA'
  | 'COBRADA'
  | 'VENCIDA'
  | 'ANULADA';

export type AFIPStatus = 'PENDIENTE' | 'PROCESANDO' | 'APROBADO' | 'RECHAZADO' | 'ERROR';

export type SalesCreditDebitType = 'NOTA_CREDITO' | 'NOTA_DEBITO';

export type CreditDebitNoteStatus = 'PENDIENTE' | 'APLICADA' | 'ANULADA';

export type ClientPaymentStatus = 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO' | 'ANULADO';

export type ChequeStatus = 'CARTERA' | 'DEPOSITADO' | 'COBRADO' | 'RECHAZADO' | 'ENDOSADO';

export type ClientMovementType =
  | 'FACTURA'
  | 'NOTA_CREDITO'
  | 'NOTA_DEBITO'
  | 'PAGO'
  | 'ANTICIPO'
  | 'AJUSTE';

export type SalesApprovalType =
  | 'DESCUENTO'
  | 'CREDITO'
  | 'PRECIO_ESPECIAL'
  | 'MONTO_ALTO'
  | 'PLAZO_PAGO';

export type SalesApprovalStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'ESCALADA';

export type DocType = 'T1' | 'T2' | 'T3';

// Labels para los estados
export const QUOTE_STATUS_LABELS_EXTENDED: Record<QuoteStatus, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente Aprobación',
  APROBADA: 'Aprobada',
  ENVIADA: 'Enviada',
  EN_NEGOCIACION: 'En Negociación',
  ACEPTADA: 'Aceptada',
  CONVERTIDA: 'Convertida',
  PERDIDA: 'Perdida',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
};

export const SALE_STATUS_LABELS_EXTENDED: Record<SaleStatus, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente Aprobación',
  APROBADA: 'Aprobada',
  CONFIRMADA: 'Confirmada',
  EN_PREPARACION: 'En Preparación',
  PARCIALMENTE_ENTREGADA: 'Parcialmente Entregada',
  ENTREGADA: 'Entregada',
  FACTURADA: 'Facturada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En Preparación',
  EN_TRANSITO: 'En Tránsito',
  ENTREGADA: 'Entregada',
  PARCIAL: 'Parcial',
  CANCELADA: 'Cancelada',
};

export const INVOICE_STATUS_LABELS_EXTENDED: Record<SalesInvoiceStatus, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Emitida',
  ENVIADA: 'Enviada',
  PARCIALMENTE_COBRADA: 'Parcialmente Cobrada',
  COBRADA: 'Cobrada',
  VENCIDA: 'Vencida',
  ANULADA: 'Anulada',
};

// Interfaces para los modelos extendidos
export interface SalesConfig {
  id: number;
  companyId: number;
  quotePrefix: string;
  quoteNextNumber: number;
  salePrefix: string;
  saleNextNumber: number;
  deliveryPrefix: string;
  deliveryNextNumber: number;
  remitoPrefix: string;
  remitoNextNumber: number;
  invoicePrefix: string;
  paymentPrefix: string;
  paymentNextNumber: number;
  puntoVenta: string;
  invoiceNextNumberA: number;
  invoiceNextNumberB: number;
  invoiceNextNumberC: number;
  requiereAprobacionCotizacion: boolean;
  montoMinimoAprobacionCot?: number;
  requiereAprobacionDescuento: boolean;
  maxDescuentoSinAprobacion: number;
  validarLimiteCredito: boolean;
  bloquearVentaSinCredito: boolean;
  diasVencimientoDefault: number;
  validarStockDisponible: boolean;
  permitirVentaSinStock: boolean;
  reservarStockEnCotizacion: boolean;
  margenMinimoPermitido: number;
  alertarMargenBajo: boolean;
  comisionVendedorDefault: number;
  tasaIvaDefault: number;
  diasValidezCotizacion: number;
}

export interface QuoteExtended {
  id: number;
  numero: string;
  clientId: string;
  client?: Client;
  sellerId?: number;
  seller?: { id: number; name: string };
  estado: QuoteStatus;
  fechaEmision: Date;
  fechaValidez: Date;
  fechaEnvio?: Date;
  fechaCierre?: Date;
  subtotal: number;
  descuentoGlobal: number;
  descuentoMonto: number;
  tasaIva: number;
  impuestos: number;
  total: number;
  moneda: string;
  tipoCambio?: number;
  condicionesPago?: string;
  diasPlazo?: number;
  condicionesEntrega?: string;
  tiempoEntrega?: string;
  lugarEntrega?: string;
  titulo?: string;
  descripcion?: string;
  notas?: string;
  notasInternas?: string;
  requiereAprobacion: boolean;
  aprobadoPor?: number;
  aprobadoAt?: Date;
  motivoPerdida?: string;
  competidorGanador?: string;
  precioCompetidor?: number;
  convertidaAVentaId?: number;
  convertidaAt?: Date;
  costoTotal?: number; // Solo visible con permiso
  margenBruto?: number;
  margenPorcentaje?: number;
  comisionPorcentaje?: number;
  comisionMonto?: number;
  docType: DocType;
  companyId: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  items?: QuoteItemExtended[];
  attachments?: QuoteAttachment[];
  acceptance?: QuoteAcceptance;
}

export interface CostBreakdownItem {
  id?: number;
  concepto: string;
  monto: number;
  orden: number;
}

export interface QuoteItemExtended {
  id: number;
  quoteId: number;
  productId?: string;
  product?: Product;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  costoUnitario?: number; // Solo visible con permiso
  margenItem?: number;
  notas?: string;
  orden: number;
  costBreakdown?: CostBreakdownItem[];
}

export interface QuoteAttachment {
  id: number;
  quoteId: number;
  nombre: string;
  url: string;
  tipo: string;
  tamanio?: number;
  createdAt: Date;
}

export interface QuoteVersion {
  id: number;
  quoteId: number;
  version: number;
  datos: unknown;
  motivo?: string;
  createdBy: number;
  createdAt: Date;
}

export interface QuoteAcceptance {
  id: number;
  quoteId: number;
  aceptadoAt: Date;
  ipAddress?: string;
  userAgent?: string;
  firmaDigital?: string;
  nombreFirmante?: string;
  dniCuitFirmante?: string;
  observaciones?: string;
}

export interface SaleExtended {
  id: number;
  numero: string;
  clientId: string;
  client?: Client;
  sellerId?: number;
  seller?: { id: number; name: string };
  quoteId?: number;
  quote?: QuoteExtended;
  estado: SaleStatus;
  fechaEmision: Date;
  fechaEntregaEstimada?: Date;
  fechaEntregaReal?: Date;
  subtotal: number;
  descuentoGlobal: number;
  descuentoMonto: number;
  tasaIva: number;
  impuestos: number;
  total: number;
  moneda: string;
  condicionesPago?: string;
  diasPlazo?: number;
  lugarEntrega?: string;
  notas?: string;
  notasInternas?: string;
  requiereAprobacion: boolean;
  aprobadoPor?: number;
  aprobadoAt?: Date;
  comisionPorcentaje?: number;
  comisionMonto?: number;
  comisionPagada: boolean;
  comisionPagadaAt?: Date;
  costoTotal?: number;
  margenBruto?: number;
  margenPorcentaje?: number;
  docType: DocType;
  companyId: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  items?: SaleItemExtended[];
  deliveries?: SaleDeliveryExtended[];
  invoices?: SalesInvoiceExtended[];
}

export interface SaleItemExtended {
  id: number;
  saleId: number;
  productId?: string;
  product?: Product;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  cantidadEntregada: number;
  cantidadPendiente: number;
  unidad: string;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  costoUnitario?: number;
  notas?: string;
  orden: number;
}

export interface SaleDeliveryExtended {
  id: number;
  numero: string;
  saleId: number;
  clientId: string;
  client?: Client;
  estado: DeliveryStatus;
  fechaProgramada?: Date;
  horaProgramada?: string;
  fechaEntrega?: Date;
  horaEntrega?: string;
  direccionEntrega?: string;
  transportista?: string;
  vehiculo?: string;
  conductorNombre?: string;
  conductorDNI?: string;
  costoFlete?: number;
  costoSeguro?: number;
  otrosCostos?: number;
  recibeNombre?: string;
  recibeDNI?: string;
  firmaRecepcion?: string;
  latitudEntrega?: number;
  longitudEntrega?: number;
  notas?: string;
  observacionesEntrega?: string;
  docType: DocType;
  companyId: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  items?: SaleDeliveryItem[];
  evidences?: SaleDeliveryEvidence[];
}

export interface SaleDeliveryItem {
  id: number;
  deliveryId: number;
  saleItemId: number;
  productId?: string;
  cantidad: number;
  notas?: string;
}

export interface SaleDeliveryEvidence {
  id: number;
  deliveryId: number;
  tipo: string;
  url: string;
  descripcion?: string;
  createdAt: Date;
}

export interface SalesInvoiceExtended {
  id: number;
  tipo: SalesInvoiceType;
  letra: string;
  puntoVenta: string;
  numero: string;
  numeroCompleto: string;
  clientId: string;
  client?: Client;
  saleId?: number;
  estado: SalesInvoiceStatus;
  fechaEmision: Date;
  fechaVencimiento: Date;
  fechaServicioDesde?: Date;
  fechaServicioHasta?: Date;
  netoGravado: number;
  netoNoGravado: number;
  exento: number;
  iva21: number;
  iva105: number;
  iva27: number;
  percepcionIVA: number;
  percepcionIIBB: number;
  otrosImpuestos: number;
  total: number;
  moneda: string;
  tipoCambio?: number;
  totalCobrado: number;
  saldoPendiente: number;
  cae?: string;
  fechaVtoCae?: Date;
  estadoAFIP?: AFIPStatus;
  condicionesPago?: string;
  notas?: string;
  notasInternas?: string;
  docType: DocType;
  companyId: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  items?: SalesInvoiceItem[];
  paymentAllocations?: InvoicePaymentAllocation[];
}

export interface SalesInvoiceItem {
  id: number;
  invoiceId: number;
  saleItemId?: number;
  productId?: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  descuento: number;
  alicuotaIVA: number;
  subtotal: number;
}

export interface SalesCreditDebitNoteExtended {
  id: number;
  tipo: SalesCreditDebitType;
  letra: string;
  puntoVenta: string;
  numero: string;
  numeroCompleto: string;
  clientId: string;
  client?: Client;
  facturaId?: number;
  estado: CreditDebitNoteStatus;
  fechaEmision: Date;
  motivo: string;
  netoGravado: number;
  iva21: number;
  iva105: number;
  iva27: number;
  total: number;
  cae?: string;
  fechaVtoCae?: Date;
  aplicada: boolean;
  aplicadaAt?: Date;
  notas?: string;
  docType: DocType;
  companyId: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  items?: SalesCreditDebitNoteItem[];
}

export interface SalesCreditDebitNoteItem {
  id: number;
  noteId: number;
  productId?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  alicuotaIVA: number;
  subtotal: number;
}

export interface ClientPaymentExtended {
  id: number;
  numero: string;
  clientId: string;
  client?: Client;
  fechaPago: Date;
  totalPago: number;
  efectivo: number;
  transferencia: number;
  chequesTerceros: number;
  chequesPropios: number;
  tarjetaCredito: number;
  tarjetaDebito: number;
  otrosMedios: number;
  retIVA: number;
  retGanancias: number;
  retIngBrutos: number;
  estado: ClientPaymentStatus;
  bancoOrigen?: string;
  numeroOperacion?: string;
  notas?: string;
  docType: DocType;
  companyId: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  allocations?: InvoicePaymentAllocation[];
  cheques?: ClientPaymentCheque[];
}

export interface InvoicePaymentAllocation {
  id: number;
  paymentId: number;
  invoiceId: number;
  montoAplicado: number;
  fechaAplicacion: Date;
  createdAt: Date;
}

export interface ClientPaymentCheque {
  id: number;
  paymentId: number;
  tipo: string;
  numero: string;
  banco?: string;
  titular?: string;
  cuit?: string;
  fechaEmision?: Date;
  fechaVencimiento?: Date;
  importe: number;
  estado: ChequeStatus;
}

export interface ClientLedgerEntryExtended {
  id: number;
  clientId: string;
  companyId: number;
  tipo: ClientMovementType;
  facturaId?: number;
  notaCreditoDebitoId?: number;
  pagoId?: number;
  fecha: Date;
  fechaVencimiento?: Date;
  debe: number;
  haber: number;
  comprobante?: string;
  descripcion?: string;
  anulado: boolean;
  anuladoPor?: number;
  anuladoAt?: Date;
  conciliado: boolean;
  conciliadoAt?: Date;
  conciliadoBy?: number;
  createdBy?: number;
  createdAt: Date;
}

export interface SalesPriceListExtended {
  id: number;
  nombre: string;
  descripcion?: string;
  moneda: string;
  porcentajeBase?: number;
  esDefault: boolean;
  isActive: boolean;
  validFrom?: Date;
  validUntil?: Date;
  companyId: number;
  createdAt: Date;
  updatedAt: Date;
  items?: SalesPriceListItem[];
}

export interface SalesPriceListItem {
  id: number;
  priceListId: number;
  productId: string;
  precioUnitario: number;
  porcentaje?: number;
}

export interface SalesApprovalExtended {
  id: number;
  entidad: 'quote' | 'sale';
  entidadId: number;
  tipo: SalesApprovalType;
  estado: SalesApprovalStatus;
  motivo?: string;
  monto?: number;
  porcentaje?: number;
  solicitadoPor: number;
  solicitante?: { id: number; name: string };
  asignadoA?: number;
  asignado?: { id: number; name: string };
  resueltoPor?: number;
  resolutor?: { id: number; name: string };
  resueltoAt?: Date;
  comentarios?: string;
  companyId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerKPI {
  id: number;
  sellerId: number;
  seller?: { id: number; name: string };
  periodo: Date;
  cotizacionesCreadas: number;
  cotizacionesGanadas: number;
  cotizacionesPerdidas: number;
  tasaConversion: number;
  ventasTotales: number;
  margenPromedio: number;
  comisionesGeneradas: number;
  comisionesPagadas: number;
  clientesNuevos: number;
  ticketPromedio: number;
  companyId: number;
  createdAt: Date;
  updatedAt: Date;
}

// DTOs para crear/actualizar
export interface CreateQuoteDTO {
  clientId: string;
  sellerId?: number;
  fechaEmision: Date;
  fechaValidez: Date;
  titulo?: string;
  descripcion?: string;
  condicionesPago?: string;
  diasPlazo?: number;
  condicionesEntrega?: string;
  tiempoEntrega?: string;
  lugarEntrega?: string;
  descuentoGlobal?: number;
  notas?: string;
  notasInternas?: string;
  items: CreateQuoteItemDTO[];
  docType?: DocType;
}

export interface CreateQuoteItemDTO {
  productId?: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  descuento?: number;
  notas?: string;
}

export interface CreateSaleDTO {
  clientId: string;
  sellerId?: number;
  quoteId?: number;
  fechaEmision: Date;
  fechaEntregaEstimada?: Date;
  condicionesPago?: string;
  diasPlazo?: number;
  lugarEntrega?: string;
  descuentoGlobal?: number;
  notas?: string;
  notasInternas?: string;
  items: CreateSaleItemDTO[];
  docType?: DocType;
}

export interface CreateSaleItemDTO {
  productId?: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  descuento?: number;
  notas?: string;
}

export interface CreateDeliveryDTO {
  saleId: number;
  fechaProgramada?: Date;
  horaProgramada?: string;
  direccionEntrega?: string;
  transportista?: string;
  vehiculo?: string;
  conductorNombre?: string;
  conductorDNI?: string;
  costoFlete?: number;
  costoSeguro?: number;
  otrosCostos?: number;
  notas?: string;
  items: { saleItemId: number; cantidad: number; notas?: string }[];
}

export interface CreateInvoiceDTO {
  tipo: SalesInvoiceType;
  clientId: string;
  saleId?: number;
  fechaEmision: Date;
  fechaVencimiento: Date;
  fechaServicioDesde?: Date;
  fechaServicioHasta?: Date;
  condicionesPago?: string;
  notas?: string;
  notasInternas?: string;
  items: CreateInvoiceItemDTO[];
  docType?: DocType;
}

export interface CreateInvoiceItemDTO {
  saleItemId?: number;
  productId?: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  descuento?: number;
  alicuotaIVA?: number;
}

export interface CreatePaymentDTO {
  clientId: string;
  fechaPago: Date;
  efectivo?: number;
  transferencia?: number;
  chequesTerceros?: number;
  chequesPropios?: number;
  tarjetaCredito?: number;
  tarjetaDebito?: number;
  otrosMedios?: number;
  retIVA?: number;
  retGanancias?: number;
  retIngBrutos?: number;
  bancoOrigen?: string;
  numeroOperacion?: string;
  notas?: string;
  allocations: { invoiceId: number; monto: number }[];
  cheques?: CreateChequeDTO[];
}

export interface CreateChequeDTO {
  tipo: string;
  numero: string;
  banco?: string;
  titular?: string;
  cuit?: string;
  fechaEmision?: Date;
  fechaVencimiento?: Date;
  importe: number;
}

// Dashboard y reportes
export interface SalesDashboard {
  cotizacionesPendientes: number;
  cotizacionesEnviadas: number;
  ordenesConfirmadas: number;
  entregasPendientes: number;
  facturasPendientes: number;
  cobranzasVencidas: number;
  ventasMes: number;
  cobranzasMes: number;
  margenPromedio: number;
  clientesActivos: number;
}

export interface ClientAccountSummary {
  clientId: string;
  client: Client;
  saldoActual: number;
  facturado: number;
  cobrado: number;
  notasCredito: number;
  notasDebito: number;
  facturasPendientes: number;
  facturasVencidas: number;
  ultimoPago?: Date;
  ultimaFactura?: Date;
}

export interface AgingReport {
  clientId: string;
  clientName: string;
  corriente: number;
  vencido1a30: number;
  vencido31a60: number;
  vencido61a90: number;
  vencidoMas90: number;
  total: number;
} 