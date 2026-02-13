/**
 * State Machine - O2C Phase 2
 *
 * Manages document state transitions with validation and permissions.
 * Ensures business rules are enforced at transition boundaries.
 *
 * PATTERNS:
 * - Declarative transition rules
 * - Permission-based access control
 * - Side effects on transition (hooks)
 * - Audit trail generation
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT STATES
// ═══════════════════════════════════════════════════════════════════════════════

// Sale (Pedido de Venta)
export enum SaleStatus {
  BORRADOR = 'BORRADOR',
  CONFIRMADA = 'CONFIRMADA',
  EN_PREPARACION = 'EN_PREPARACION',
  PARCIALMENTE_ENTREGADA = 'PARCIALMENTE_ENTREGADA',
  ENTREGADA = 'ENTREGADA',
  PARCIALMENTE_FACTURADA = 'PARCIALMENTE_FACTURADA',
  FACTURADA = 'FACTURADA',
  CERRADA = 'CERRADA',
  CANCELADA = 'CANCELADA',
}

// LoadOrder (Orden de Carga)
export enum LoadOrderStatus {
  PENDIENTE = 'PENDIENTE',
  CARGANDO = 'CARGANDO',
  CARGADA = 'CARGADA',
  DESPACHADA = 'DESPACHADA',
  CANCELADA = 'CANCELADA',
}

// SaleDelivery (Entrega)
export enum DeliveryStatus {
  PENDIENTE = 'PENDIENTE',
  EN_PREPARACION = 'EN_PREPARACION',
  LISTA_PARA_DESPACHO = 'LISTA_PARA_DESPACHO',
  EN_TRANSITO = 'EN_TRANSITO',
  RETIRADA = 'RETIRADA',
  ENTREGADA = 'ENTREGADA',
  ENTREGA_FALLIDA = 'ENTREGA_FALLIDA',
  CANCELADA = 'CANCELADA',
}

// SaleRemito (Remito)
export enum RemitoStatus {
  BORRADOR = 'BORRADOR',
  PREPARADO = 'PREPARADO',
  EMITIDO = 'EMITIDO',
  ANULADO = 'ANULADO',
  CANCELADO = 'CANCELADO',
}

// SalesInvoice (Factura)
// Note: VENCIDA is a calculated flag, not a state
export enum InvoiceStatus {
  BORRADOR = 'BORRADOR',
  EMITIDA = 'EMITIDA',
  PARCIALMENTE_COBRADA = 'PARCIALMENTE_COBRADA',
  COBRADA = 'COBRADA',
  ANULADA = 'ANULADA',
}

// ClientPayment (Pago/Recibo)
export enum PaymentStatus {
  BORRADOR = 'BORRADOR',
  CONFIRMADO = 'CONFIRMADO',
  APLICADO = 'APLICADO',
  PARCIALMENTE_APLICADO = 'PARCIALMENTE_APLICADO',
  ANULADO = 'ANULADO',
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITION RULES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TransitionRule {
  from: string;
  to: string[];
  permission?: string;
  requiresReason?: boolean;
  hooks?: string[]; // Names of side effect functions
}

// Sale Transitions
export const saleTransitions: Record<string, string[]> = {
  [SaleStatus.BORRADOR]: [SaleStatus.CONFIRMADA, SaleStatus.CANCELADA],
  [SaleStatus.CONFIRMADA]: [SaleStatus.EN_PREPARACION, SaleStatus.CANCELADA],
  [SaleStatus.EN_PREPARACION]: [
    SaleStatus.PARCIALMENTE_ENTREGADA,
    SaleStatus.ENTREGADA,
    SaleStatus.CANCELADA,
  ],
  [SaleStatus.PARCIALMENTE_ENTREGADA]: [
    SaleStatus.PARCIALMENTE_ENTREGADA,
    SaleStatus.ENTREGADA,
  ],
  [SaleStatus.ENTREGADA]: [
    SaleStatus.PARCIALMENTE_FACTURADA,
    SaleStatus.FACTURADA,
  ],
  [SaleStatus.PARCIALMENTE_FACTURADA]: [SaleStatus.FACTURADA],
  [SaleStatus.FACTURADA]: [SaleStatus.CERRADA],
  [SaleStatus.CERRADA]: [],
  [SaleStatus.CANCELADA]: [],
};

// LoadOrder Transitions
export const loadOrderTransitions: Record<string, string[]> = {
  [LoadOrderStatus.PENDIENTE]: [LoadOrderStatus.CARGANDO, LoadOrderStatus.CANCELADA],
  [LoadOrderStatus.CARGANDO]: [LoadOrderStatus.CARGADA, LoadOrderStatus.CANCELADA],
  [LoadOrderStatus.CARGADA]: [LoadOrderStatus.DESPACHADA],
  [LoadOrderStatus.DESPACHADA]: [],
  [LoadOrderStatus.CANCELADA]: [],
};

// Delivery Transitions
export const deliveryTransitions: Record<string, string[]> = {
  [DeliveryStatus.PENDIENTE]: [DeliveryStatus.EN_PREPARACION, DeliveryStatus.CANCELADA],
  [DeliveryStatus.EN_PREPARACION]: [DeliveryStatus.LISTA_PARA_DESPACHO, DeliveryStatus.CANCELADA],
  [DeliveryStatus.LISTA_PARA_DESPACHO]: [DeliveryStatus.EN_TRANSITO, DeliveryStatus.RETIRADA],
  [DeliveryStatus.EN_TRANSITO]: [DeliveryStatus.ENTREGADA, DeliveryStatus.ENTREGA_FALLIDA],
  [DeliveryStatus.RETIRADA]: [DeliveryStatus.ENTREGADA],
  [DeliveryStatus.ENTREGADA]: [],
  [DeliveryStatus.ENTREGA_FALLIDA]: [DeliveryStatus.EN_TRANSITO],
  [DeliveryStatus.CANCELADA]: [],
};

// Remito Transitions
export const remitoTransitions: Record<string, string[]> = {
  [RemitoStatus.BORRADOR]: [RemitoStatus.PREPARADO, RemitoStatus.CANCELADO],
  [RemitoStatus.PREPARADO]: [RemitoStatus.EMITIDO, RemitoStatus.CANCELADO],
  [RemitoStatus.EMITIDO]: [RemitoStatus.ANULADO],
  [RemitoStatus.ANULADO]: [],
  [RemitoStatus.CANCELADO]: [],
};

// Invoice Transitions
export const invoiceTransitions: Record<string, string[]> = {
  [InvoiceStatus.BORRADOR]: [InvoiceStatus.EMITIDA, InvoiceStatus.ANULADA],
  [InvoiceStatus.EMITIDA]: [
    InvoiceStatus.PARCIALMENTE_COBRADA,
    InvoiceStatus.COBRADA,
    InvoiceStatus.ANULADA,
  ],
  [InvoiceStatus.PARCIALMENTE_COBRADA]: [InvoiceStatus.COBRADA, InvoiceStatus.ANULADA],
  [InvoiceStatus.COBRADA]: [InvoiceStatus.ANULADA], // Anular genera NC
  [InvoiceStatus.ANULADA]: [],
};

// Payment Transitions
export const paymentTransitions: Record<string, string[]> = {
  [PaymentStatus.BORRADOR]: [PaymentStatus.CONFIRMADO, PaymentStatus.ANULADO],
  [PaymentStatus.CONFIRMADO]: [
    PaymentStatus.APLICADO,
    PaymentStatus.PARCIALMENTE_APLICADO,
    PaymentStatus.ANULADO,
  ],
  [PaymentStatus.PARCIALMENTE_APLICADO]: [PaymentStatus.APLICADO, PaymentStatus.ANULADO],
  [PaymentStatus.APLICADO]: [PaymentStatus.ANULADO],
  [PaymentStatus.ANULADO]: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSIONS BY TRANSITION
// ═══════════════════════════════════════════════════════════════════════════════

export const transitionPermissions: Record<string, string> = {
  // Sale
  'sale.BORRADOR->CONFIRMADA': 'sales.confirm',
  'sale.CONFIRMADA->EN_PREPARACION': 'sales.prepare',
  'sale.CONFIRMADA->CANCELADA': 'sales.cancel',
  'sale.EN_PREPARACION->CANCELADA': 'sales.cancel',

  // LoadOrder
  'loadOrder.PENDIENTE->CARGANDO': 'loadOrders.startLoading',
  'loadOrder.CARGANDO->CARGADA': 'loadOrders.confirmLoaded',
  'loadOrder.CARGADA->DESPACHADA': 'loadOrders.dispatch',
  'loadOrder.PENDIENTE->CANCELADA': 'loadOrders.cancel',
  'loadOrder.CARGANDO->CANCELADA': 'loadOrders.cancel',

  // Delivery
  'delivery.PENDIENTE->EN_PREPARACION': 'deliveries.prepare',
  'delivery.EN_PREPARACION->LISTA_PARA_DESPACHO': 'deliveries.ready',
  'delivery.LISTA_PARA_DESPACHO->EN_TRANSITO': 'deliveries.dispatch',
  'delivery.LISTA_PARA_DESPACHO->RETIRADA': 'deliveries.pickup',
  'delivery.EN_TRANSITO->ENTREGADA': 'deliveries.confirm',
  'delivery.RETIRADA->ENTREGADA': 'deliveries.confirm',
  'delivery.EN_TRANSITO->ENTREGA_FALLIDA': 'deliveries.fail',
  'delivery.ENTREGA_FALLIDA->EN_TRANSITO': 'deliveries.retry',
  'delivery.PENDIENTE->CANCELADA': 'deliveries.cancel',
  'delivery.EN_PREPARACION->CANCELADA': 'deliveries.cancel',

  // Remito
  'remito.BORRADOR->PREPARADO': 'remitos.prepare',
  'remito.PREPARADO->EMITIDO': 'remitos.emit',
  'remito.EMITIDO->ANULADO': 'remitos.void',
  'remito.BORRADOR->CANCELADO': 'remitos.cancel',
  'remito.PREPARADO->CANCELADO': 'remitos.cancel',

  // Invoice
  'invoice.BORRADOR->EMITIDA': 'invoices.emit',
  'invoice.EMITIDA->ANULADA': 'invoices.void',
  'invoice.PARCIALMENTE_COBRADA->ANULADA': 'invoices.void',
  'invoice.COBRADA->ANULADA': 'invoices.void',

  // Payment
  'payment.BORRADOR->CONFIRMADO': 'payments.confirm',
  'payment.CONFIRMADO->ANULADO': 'payments.void',
  'payment.PARCIALMENTE_APLICADO->ANULADO': 'payments.void',
  'payment.APLICADO->ANULADO': 'payments.void',
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MACHINE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type DocumentType = 'sale' | 'loadOrder' | 'delivery' | 'remito' | 'invoice' | 'payment';

export interface TransitionRequest {
  documentType: DocumentType;
  documentId: number;
  fromState: string;
  toState: string;
  userId: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  success: boolean;
  previousState: string;
  newState: string;
  error?: string;
  warnings?: string[];
  hooks?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MACHINE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get transition rules for a document type
 */
export function getTransitionRules(docType: DocumentType): Record<string, string[]> {
  switch (docType) {
    case 'sale':
      return saleTransitions;
    case 'loadOrder':
      return loadOrderTransitions;
    case 'delivery':
      return deliveryTransitions;
    case 'remito':
      return remitoTransitions;
    case 'invoice':
      return invoiceTransitions;
    case 'payment':
      return paymentTransitions;
    default:
      throw new Error(`Unknown document type: ${docType}`);
  }
}

/**
 * Check if a transition is valid
 */
export function isValidTransition(
  docType: DocumentType,
  fromState: string,
  toState: string
): boolean {
  const rules = getTransitionRules(docType);
  const allowedStates = rules[fromState];

  if (!allowedStates) {
    return false;
  }

  return allowedStates.includes(toState);
}

/**
 * Get allowed transitions from current state
 */
export function getAllowedTransitions(
  docType: DocumentType,
  currentState: string
): string[] {
  const rules = getTransitionRules(docType);
  return rules[currentState] || [];
}

/**
 * Get required permission for a transition
 */
export function getTransitionPermission(
  docType: DocumentType,
  fromState: string,
  toState: string
): string | null {
  const key = `${docType}.${fromState}->${toState}`;
  return transitionPermissions[key] || null;
}

/**
 * Validate a transition request
 */
export function validateTransition(request: TransitionRequest): {
  valid: boolean;
  error?: string;
  permission?: string;
} {
  const { documentType, fromState, toState } = request;

  // Check if transition is valid
  if (!isValidTransition(documentType, fromState, toState)) {
    const allowed = getAllowedTransitions(documentType, fromState);
    return {
      valid: false,
      error: `Transición inválida: ${fromState} → ${toState}. Estados permitidos: ${allowed.join(', ') || 'ninguno'}`,
    };
  }

  // Get required permission
  const permission = getTransitionPermission(documentType, fromState, toState);

  return {
    valid: true,
    permission: permission || undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITION HOOKS (Side Effects)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hooks that run when specific transitions occur.
 * These are identifiers that the calling code should handle.
 */
export const transitionHooks: Record<string, string[]> = {
  // Sale hooks
  'sale.CONFIRMADA->EN_PREPARACION': ['reserveStock', 'notifySeller'],
  'sale.EN_PREPARACION->ENTREGADA': ['updateDeliveredQty'],
  'sale.FACTURADA->CERRADA': ['calculateCommission'],
  'sale.CONFIRMADA->CANCELADA': ['releaseStock', 'notifyClient'],
  'sale.EN_PREPARACION->CANCELADA': ['releaseStock', 'notifyClient'],

  // LoadOrder hooks
  'loadOrder.CARGANDO->CARGADA': [
    'updateLoadedQty',
    'emitRemito',
    'decrementStock',
    'maybeEmitInvoice',
  ],
  'loadOrder.CARGADA->DESPACHADA': ['updateDeliveryStatus', 'notifyClient'],
  'loadOrder.CARGANDO->CANCELADA': ['releaseLoadOrderItems'],

  // Delivery hooks
  'delivery.EN_TRANSITO->ENTREGADA': ['confirmDelivery', 'updatePOD'],
  'delivery.RETIRADA->ENTREGADA': ['confirmPickup'],
  'delivery.EN_TRANSITO->ENTREGA_FALLIDA': ['logFailedDelivery', 'notifyClient'],

  // Remito hooks
  'remito.PREPARADO->EMITIDO': ['assignNumber', 'decrementStock'],
  'remito.EMITIDO->ANULADO': ['incrementStock', 'createAuditLog'],

  // Invoice hooks
  'invoice.BORRADOR->EMITIDA': ['assignNumber', 'createLedgerEntry', 'updateClientBalance'],
  'invoice.EMITIDA->ANULADA': ['reverseLedgerEntry', 'updateClientBalance', 'requireCreditNote'],
  'invoice.COBRADA->ANULADA': ['reverseLedgerEntry', 'updateClientBalance', 'requireCreditNote'],

  // Payment hooks
  'payment.BORRADOR->CONFIRMADO': ['createTreasuryMovements', 'applyToInvoices', 'createLedgerEntry'],
  'payment.CONFIRMADO->ANULADO': ['reverseTreasuryMovements', 'unapplyFromInvoices', 'reverseLedgerEntry'],
};

/**
 * Get hooks for a specific transition
 */
export function getTransitionHooks(
  docType: DocumentType,
  fromState: string,
  toState: string
): string[] {
  const key = `${docType}.${fromState}->${toState}`;
  return transitionHooks[key] || [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a state is a terminal state (no further transitions)
 */
export function isTerminalState(docType: DocumentType, state: string): boolean {
  const allowed = getAllowedTransitions(docType, state);
  return allowed.length === 0;
}

/**
 * Check if a state is cancellable
 */
export function isCancellable(docType: DocumentType, state: string): boolean {
  const allowed = getAllowedTransitions(docType, state);
  return allowed.some(s => s.includes('CANCELAD') || s.includes('ANULAD'));
}

/**
 * Get the initial state for a document type
 */
export function getInitialState(docType: DocumentType): string {
  switch (docType) {
    case 'sale':
      return SaleStatus.BORRADOR;
    case 'loadOrder':
      return LoadOrderStatus.PENDIENTE;
    case 'delivery':
      return DeliveryStatus.PENDIENTE;
    case 'remito':
      return RemitoStatus.BORRADOR;
    case 'invoice':
      return InvoiceStatus.BORRADOR;
    case 'payment':
      return PaymentStatus.BORRADOR;
    default:
      throw new Error(`Unknown document type: ${docType}`);
  }
}

/**
 * Get display label for a state
 */
export function getStateLabel(state: string): string {
  const labels: Record<string, string> = {
    // Sale
    BORRADOR: 'Borrador',
    CONFIRMADA: 'Confirmada',
    EN_PREPARACION: 'En Preparación',
    PARCIALMENTE_ENTREGADA: 'Parcialmente Entregada',
    ENTREGADA: 'Entregada',
    PARCIALMENTE_FACTURADA: 'Parcialmente Facturada',
    FACTURADA: 'Facturada',
    CERRADA: 'Cerrada',
    CANCELADA: 'Cancelada',

    // LoadOrder
    PENDIENTE: 'Pendiente',
    CARGANDO: 'Cargando',
    CARGADA: 'Cargada',
    DESPACHADA: 'Despachada',

    // Delivery
    LISTA_PARA_DESPACHO: 'Lista para Despacho',
    EN_TRANSITO: 'En Tránsito',
    RETIRADA: 'Retirada',
    ENTREGA_FALLIDA: 'Entrega Fallida',

    // Remito
    PREPARADO: 'Preparado',
    EMITIDO: 'Emitido',
    ANULADO: 'Anulado',
    CANCELADO: 'Cancelado',

    // Invoice
    EMITIDA: 'Emitida',
    PARCIALMENTE_COBRADA: 'Parcialmente Cobrada',
    COBRADA: 'Cobrada',
    ANULADA: 'Anulada',

    // Payment
    CONFIRMADO: 'Confirmado',
    APLICADO: 'Aplicado',
    PARCIALMENTE_APLICADO: 'Parcialmente Aplicado',
  };

  return labels[state] || state;
}

/**
 * Get color/badge variant for a state
 */
export function getStateColor(state: string): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
  const successStates = ['ENTREGADA', 'FACTURADA', 'CERRADA', 'COBRADA', 'APLICADO', 'EMITIDO', 'CARGADA', 'DESPACHADA', 'CONFIRMADO'];
  const warningStates = ['EN_PREPARACION', 'PARCIALMENTE_ENTREGADA', 'PARCIALMENTE_FACTURADA', 'PARCIALMENTE_COBRADA', 'PARCIALMENTE_APLICADO', 'CARGANDO', 'EN_TRANSITO', 'PREPARADO'];
  const destructiveStates = ['CANCELADA', 'ANULADA', 'ANULADO', 'CANCELADO', 'ENTREGA_FALLIDA'];
  const secondaryStates = ['BORRADOR', 'PENDIENTE'];

  if (successStates.includes(state)) return 'success';
  if (warningStates.includes(state)) return 'warning';
  if (destructiveStates.includes(state)) return 'destructive';
  if (secondaryStates.includes(state)) return 'secondary';

  return 'default';
}
