import { z } from 'zod';

// =============================================================================
// Common / Shared Schemas
// =============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const viewModeSchema = z.enum(['S', 'E']).default('S');

export const docTypeSchema = z.enum(['T1', 'T2']).default('T1');

// =============================================================================
// Cash Account (Caja) Schemas
// =============================================================================

export const createCashAccountSchema = z.object({
  codigo: z.string().min(1, 'Código requerido').max(20),
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
  esDefault: z.boolean().optional().default(false),
});

export const updateCashAccountSchema = createCashAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// =============================================================================
// Bank Account (Banco) Schemas
// =============================================================================

export const createBankAccountSchema = z.object({
  codigo: z.string().min(1, 'Código requerido').max(20),
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  banco: z.string().min(1, 'Banco requerido').max(100),
  tipoCuenta: z.enum(['CORRIENTE', 'AHORRO', 'CAJA_AHORRO']),
  numeroCuenta: z.string().min(1, 'Número de cuenta requerido').max(50),
  cbu: z.string().max(22).optional().nullable(),
  alias: z.string().max(50).optional().nullable(),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
  esDefault: z.boolean().optional().default(false),
});

export const updateBankAccountSchema = createBankAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
  saldoBancario: z.coerce.number().optional(),
});

// =============================================================================
// Treasury Movement Schemas
// =============================================================================

export const treasuryMovementTypeSchema = z.enum(['INGRESO', 'EGRESO', 'TRANSFERENCIA_INTERNA', 'AJUSTE']);

export const paymentMediumSchema = z.enum([
  'EFECTIVO',
  'TRANSFERENCIA',
  'CHEQUE_TERCERO',
  'CHEQUE_PROPIO',
  'ECHEQ',
  'TARJETA_CREDITO',
  'TARJETA_DEBITO',
  'DEPOSITO',
  'COMISION',
  'INTERES',
  'AJUSTE',
]);

export const accountTypeSchema = z.enum(['CASH', 'BANK', 'CHECK_PORTFOLIO']);

export const movementStatusSchema = z.enum(['PENDIENTE', 'CONFIRMADO', 'REVERSADO']);

export const createTreasuryMovementSchema = z.object({
  fecha: z.string().datetime(),
  fechaValor: z.string().datetime().optional().nullable(),
  tipo: treasuryMovementTypeSchema,
  medio: paymentMediumSchema,
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
  accountType: accountTypeSchema,
  cashAccountId: z.coerce.number().int().positive().optional().nullable(),
  bankAccountId: z.coerce.number().int().positive().optional().nullable(),
  chequeId: z.coerce.number().int().positive().optional().nullable(),
  descripcion: z.string().max(500).optional().nullable(),
  numeroComprobante: z.string().max(100).optional().nullable(),
  comprobanteUrl: z.string().max(500).optional().nullable(),
  docType: docTypeSchema,
}).refine(
  (data) => {
    if (data.accountType === 'CASH' && !data.cashAccountId) {
      return false;
    }
    if (data.accountType === 'BANK' && !data.bankAccountId) {
      return false;
    }
    return true;
  },
  { message: 'Debe especificar la cuenta correspondiente al tipo de cuenta' }
);

export const updateTreasuryMovementSchema = z.object({
  descripcion: z.string().max(500).optional().nullable(),
  numeroComprobante: z.string().max(100).optional().nullable(),
  comprobanteUrl: z.string().max(500).optional().nullable(),
});

export const reverseTreasuryMovementSchema = z.object({
  motivo: z.string().min(1, 'Motivo requerido').max(500),
});

// Schema for treasury movement PATCH actions
export const treasuryMovementActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reverse'),
    reverseReason: z.string().max(500).optional().default('Reversa manual'),
  }),
  z.object({
    action: z.literal('confirm'),
  }),
  z.object({
    action: z.literal('update'),
    descripcion: z.string().max(500).optional().nullable(),
    numeroComprobante: z.string().max(100).optional().nullable(),
    comprobanteUrl: z.string().max(500).optional().nullable(),
  }),
]);

// =============================================================================
// Cheque Schemas
// =============================================================================

export const chequeOrigenSchema = z.enum(['RECIBIDO', 'EMITIDO']);
export const chequeTipoSchema = z.enum(['FISICO', 'ECHEQ']);
export const chequeEstadoSchema = z.enum([
  'CARTERA',
  'DEPOSITADO',
  'COBRADO',
  'RECHAZADO',
  'ENDOSADO',
  'CANJEADO',
  'ANULADO',
  'VENCIDO',
]);

export const createChequeSchema = z.object({
  origen: chequeOrigenSchema,
  tipo: chequeTipoSchema,
  numero: z.string().min(1, 'Número requerido').max(50),
  banco: z.string().min(1, 'Banco requerido').max(100),
  sucursal: z.string().max(50).optional().nullable(),
  titular: z.string().min(1, 'Titular requerido').max(255),
  cuitTitular: z.string().max(13).optional().nullable(),
  importe: z.coerce.number().positive('El importe debe ser positivo'),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
  fechaEmision: z.string().datetime(),
  fechaVencimiento: z.string().datetime(),
  bankAccountId: z.coerce.number().int().positive().optional().nullable(),
  docType: docTypeSchema,
}).refine(
  (data) => {
    // ECHEQ siempre es T1
    if (data.tipo === 'ECHEQ' && data.docType === 'T2') {
      return false;
    }
    // Cheques emitidos físicos requieren cuenta bancaria
    if (data.origen === 'EMITIDO' && data.tipo === 'FISICO' && !data.bankAccountId) {
      return false;
    }
    return true;
  },
  { message: 'Configuración de cheque inválida' }
);

export const updateChequeSchema = z.object({
  titular: z.string().max(255).optional(),
  cuitTitular: z.string().max(13).optional().nullable(),
  fechaVencimiento: z.string().datetime().optional(),
});

// Schema for cheque state change via PATCH
// Note: .refine() on a member of discriminatedUnion converts ZodObject to ZodEffects,
// which breaks the discriminator lookup. Validation for 'endosar' is done at the union level.
export const chequeStateChangeSchema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('depositar'),
    bankAccountId: z.coerce.number().int().positive('Cuenta bancaria requerida'),
  }),
  z.object({
    accion: z.literal('cobrar'),
  }),
  z.object({
    accion: z.literal('rechazar'),
    motivoRechazo: z.string().min(1, 'Motivo de rechazo requerido').max(500),
  }),
  z.object({
    accion: z.literal('endosar'),
    endosadoA: z.string().max(255).optional().nullable(),
    endosadoPaymentOrderId: z.coerce.number().int().positive().optional().nullable(),
  }),
  z.object({
    accion: z.literal('anular'),
  }),
  z.object({
    accion: z.literal('volver_cartera'),
  }),
]).refine(
  (data) => {
    if (data.accion === 'endosar') {
      return data.endosadoA || data.endosadoPaymentOrderId;
    }
    return true;
  },
  { message: 'Debe indicar a quién se endosa o la orden de pago' }
);

export const depositChequeSchema = z.object({
  bankAccountId: z.coerce.number().int().positive('Cuenta bancaria requerida'),
  fechaDeposito: z.string().datetime().optional(),
});

export const endorseChequeSchema = z.object({
  endosadoA: z.string().min(1, 'Destinatario requerido').max(255),
  cuitEndosatario: z.string().max(13).optional().nullable(),
  motivoEndoso: z.string().max(500).optional().nullable(),
});

export const rejectChequeSchema = z.object({
  motivoRechazo: z.string().min(1, 'Motivo requerido').max(500),
  gastoRechazo: z.coerce.number().nonnegative().optional().default(0),
});

export const cashChequeSchema = z.object({
  cashAccountId: z.coerce.number().int().positive('Cuenta caja requerida'),
  fechaCobro: z.string().datetime().optional(),
});

// Unified cheque action schema - validates based on action type
export const chequeActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('deposit'),
    bankAccountId: z.coerce.number().int().positive('Cuenta bancaria requerida'),
    fechaDeposito: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal('endorse'),
    endosadoA: z.string().min(1, 'Destinatario requerido').max(255),
    cuitEndosatario: z.string().max(13).optional().nullable(),
    motivoEndoso: z.string().max(500).optional().nullable(),
  }),
  z.object({
    action: z.literal('reject'),
    motivoRechazo: z.string().min(1, 'Motivo requerido').max(500),
    gastoRechazo: z.coerce.number().nonnegative().optional().default(0),
  }),
  z.object({
    action: z.literal('cash'),
    cashAccountId: z.coerce.number().int().positive('Cuenta caja requerida'),
    fechaCobro: z.string().datetime().optional(),
  }),
]);

// =============================================================================
// Cash Deposit (Depósito de Caja a Banco) Schemas
// =============================================================================

export const createCashDepositSchema = z.object({
  cashAccountId: z.coerce.number().int().positive('Caja requerida'),
  bankAccountId: z.coerce.number().int().positive('Banco requerido'),
  fecha: z.string().datetime(),
  efectivo: z.coerce.number().nonnegative().default(0),
  chequeIds: z.array(z.coerce.number().int().positive()).optional().default([]),
  numeroComprobante: z.string().max(100).optional().nullable(),
  comprobanteUrl: z.string().max(500).optional().nullable(),
  docType: docTypeSchema,
}).refine(
  (data) => data.efectivo > 0 || (data.chequeIds && data.chequeIds.length > 0),
  { message: 'Debe incluir efectivo o cheques' }
);

export const confirmDepositSchema = z.object({
  numeroComprobanteBanco: z.string().max(100).optional().nullable(),
});

// Unified deposit action schema for confirm/reject
export const depositActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('confirm'),
    numeroComprobanteBanco: z.string().max(100).optional().nullable(),
  }),
  z.object({
    action: z.literal('reject'),
    motivoRechazo: z.string().max(500).optional().nullable(),
  }),
]);

// =============================================================================
// Cash Closing (Cierre de Caja) Schemas
// =============================================================================

export const cashClosingDesgloseSchema = z.record(
  z.string(), // denominations like "1000", "500", "100", etc.
  z.coerce.number().int().nonnegative()
);

export const createCashClosingSchema = z.object({
  cashAccountId: z.coerce.number().int().positive('Caja requerida'),
  fecha: z.string().datetime(),
  arqueoEfectivo: z.coerce.number().nonnegative('Arqueo de efectivo requerido'),
  arqueoCheques: z.coerce.number().nonnegative().default(0),
  desglose: cashClosingDesgloseSchema.optional().nullable(),
  diferenciaNotas: z.string().max(500).optional().nullable(),
  docType: docTypeSchema,
});

export const approveCashClosingSchema = z.object({
  aprobar: z.boolean(),
  notas: z.string().max(500).optional().nullable(),
  crearAjuste: z.boolean().optional().default(false), // Create adjustment if difference
});

// Unified cash closing action schema for approve/approveWithAdjustment/reject
export const cashClosingActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
  }),
  z.object({
    action: z.literal('approveWithAdjustment'),
    adjustmentReason: z.string().max(500).optional().nullable(),
  }),
  z.object({
    action: z.literal('reject'),
  }),
]);

// =============================================================================
// Bank Reconciliation (Conciliación) Schemas
// =============================================================================

export const createBankStatementSchema = z.object({
  bankAccountId: z.coerce.number().int().positive('Cuenta bancaria requerida'),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato de período inválido (YYYY-MM)'),
  saldoInicial: z.coerce.number(),
  saldoFinal: z.coerce.number(),
  toleranciaMonto: z.coerce.number().nonnegative().default(0.01),
  toleranciaDias: z.coerce.number().int().nonnegative().default(3),
  docType: docTypeSchema,
});

export const bankStatementItemSchema = z.object({
  lineNumber: z.coerce.number().int().positive(),
  fecha: z.string().datetime(),
  fechaValor: z.string().datetime().optional().nullable(),
  descripcion: z.string().max(500),
  referencia: z.string().max(100).optional().nullable(),
  debito: z.coerce.number().nonnegative().default(0),
  credito: z.coerce.number().nonnegative().default(0),
  saldo: z.coerce.number(),
});

export const importBankStatementSchema = z.object({
  bankAccountId: z.coerce.number().int().positive('Cuenta bancaria requerida'),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato de período inválido (YYYY-MM)'),
  saldoInicial: z.coerce.number(),
  saldoFinal: z.coerce.number().optional().default(0),
  items: z.array(bankStatementItemSchema).min(1, 'Debe incluir al menos un movimiento'),
  toleranciaMonto: z.coerce.number().nonnegative().default(0.01),
  toleranciaDias: z.coerce.number().int().nonnegative().default(3),
  docType: docTypeSchema,
});

export const manualMatchSchema = z.object({
  statementItemId: z.coerce.number().int().positive('Item del extracto requerido'),
  treasuryMovementId: z.coerce.number().int().positive('Movimiento de tesorería requerido'),
  notas: z.string().max(500).optional().nullable(),
});

export const markAsSuspenseSchema = z.object({
  statementItemId: z.coerce.number().int().positive('Item del extracto requerido'),
  notas: z.string().max(500).optional().nullable(),
});

export const closeConciliacionSchema = z.object({
  notas: z.string().max(500).optional().nullable(),
  forzarCierre: z.boolean().optional().default(false), // Close even with pending items
});

// Unified statement action schema for close/reopen/updateTolerances
export const statementActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('close'),
  }),
  z.object({
    action: z.literal('reopen'),
  }),
  z.object({
    action: z.literal('updateTolerances'),
    toleranciaMonto: z.coerce.number().nonnegative().optional(),
    toleranciaDias: z.coerce.number().int().nonnegative().optional(),
  }),
]);

// Reconciliation match request schema
export const reconciliationMatchRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('match'),
    itemId: z.coerce.number().int().positive('Item ID requerido'),
    movementId: z.coerce.number().int().positive('Movement ID requerido para match'),
  }),
  z.object({
    action: z.literal('unmatch'),
    itemId: z.coerce.number().int().positive('Item ID requerido'),
  }),
  z.object({
    action: z.literal('resolveSuspense'),
    itemId: z.coerce.number().int().positive('Item ID requerido'),
    notas: z.string().min(1, 'Notas requeridas para resolver suspense').max(500),
  }),
  z.object({
    action: z.literal('createMovement'),
    itemId: z.coerce.number().int().positive('Item ID requerido'),
    referenceType: z.string().min(1, 'Reference type requerido').max(50),
    descripcion: z.string().min(1, 'Descripción requerida').max(500),
  }),
]);

// =============================================================================
// Transfer Schemas
// =============================================================================

export const createTransferSchema = z.object({
  tipoOrigen: z.enum(['caja', 'banco']),
  origenId: z.coerce.number().int().positive('Origen requerido'),
  tipoDestino: z.enum(['caja', 'banco']),
  destinoId: z.coerce.number().int().positive('Destino requerido'),
  importe: z.coerce.number().positive('El importe debe ser positivo'),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
  descripcion: z.string().max(500).optional().nullable(),
  docType: docTypeSchema,
});

// =============================================================================
// Filter Schemas
// =============================================================================

export const treasuryMovementFilterSchema = z.object({
  ...paginationSchema.shape,
  accountType: accountTypeSchema.optional(),
  cashAccountId: z.string().optional(),
  bankAccountId: z.string().optional(),
  tipo: treasuryMovementTypeSchema.optional(),
  medio: paymentMediumSchema.optional(),
  estado: movementStatusSchema.optional(),
  conciliado: z.string().optional(), // 'true' or 'false'
  referenceType: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
});

export const chequeFilterSchema = z.object({
  ...paginationSchema.shape,
  estado: chequeEstadoSchema.optional(),
  origen: chequeOrigenSchema.optional(),
  tipo: chequeTipoSchema.optional(),
  enCartera: z.string().optional(), // 'true' or 'false'
  vencidosHoy: z.string().optional(), // 'true' or 'false'
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
});

export const depositFilterSchema = z.object({
  ...paginationSchema.shape,
  cashAccountId: z.string().optional(),
  bankAccountId: z.string().optional(),
  estado: z.enum(['PENDIENTE', 'CONFIRMADO', 'RECHAZADO']).optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
});

export const cashClosingFilterSchema = z.object({
  ...paginationSchema.shape,
  cashAccountId: z.string().optional(),
  estado: z.enum(['PENDIENTE', 'APROBADO', 'CON_DIFERENCIA_APROBADA', 'RECHAZADO']).optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
});

export const conciliacionFilterSchema = z.object({
  ...paginationSchema.shape,
  bankAccountId: z.string().optional(),
  periodo: z.string().optional(),
  estado: z.enum(['PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CON_DIFERENCIAS', 'CERRADA']).optional(),
});

// =============================================================================
// Type exports for TypeScript usage
// =============================================================================

export type CreateCashAccountInput = z.infer<typeof createCashAccountSchema>;
export type UpdateCashAccountInput = z.infer<typeof updateCashAccountSchema>;
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type CreateTreasuryMovementInput = z.infer<typeof createTreasuryMovementSchema>;
export type UpdateTreasuryMovementInput = z.infer<typeof updateTreasuryMovementSchema>;
export type ReverseTreasuryMovementInput = z.infer<typeof reverseTreasuryMovementSchema>;
export type CreateChequeInput = z.infer<typeof createChequeSchema>;
export type UpdateChequeInput = z.infer<typeof updateChequeSchema>;
export type DepositChequeInput = z.infer<typeof depositChequeSchema>;
export type EndorseChequeInput = z.infer<typeof endorseChequeSchema>;
export type RejectChequeInput = z.infer<typeof rejectChequeSchema>;
export type CreateCashDepositInput = z.infer<typeof createCashDepositSchema>;
export type ConfirmDepositInput = z.infer<typeof confirmDepositSchema>;
export type CreateCashClosingInput = z.infer<typeof createCashClosingSchema>;
export type ApproveCashClosingInput = z.infer<typeof approveCashClosingSchema>;
export type CreateBankStatementInput = z.infer<typeof createBankStatementSchema>;
export type ImportBankStatementInput = z.infer<typeof importBankStatementSchema>;
export type ManualMatchInput = z.infer<typeof manualMatchSchema>;
export type MarkAsSuspenseInput = z.infer<typeof markAsSuspenseSchema>;
export type CloseConciliacionInput = z.infer<typeof closeConciliacionSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ChequeActionInput = z.infer<typeof chequeActionSchema>;
export type CashChequeInput = z.infer<typeof cashChequeSchema>;
export type DepositActionInput = z.infer<typeof depositActionSchema>;
export type CashClosingActionInput = z.infer<typeof cashClosingActionSchema>;
export type StatementActionInput = z.infer<typeof statementActionSchema>;
export type ReconciliationMatchRequestInput = z.infer<typeof reconciliationMatchRequestSchema>;
export type ChequeStateChangeInput = z.infer<typeof chequeStateChangeSchema>;
export type TreasuryMovementActionInput = z.infer<typeof treasuryMovementActionSchema>;
