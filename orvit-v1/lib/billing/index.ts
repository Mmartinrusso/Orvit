/**
 * Billing Module - ORVIT
 *
 * Sistema de facturación y gestión de suscripciones SaaS
 *
 * Arquitectura:
 * - 1 suscripción por owner/usuario pagador
 * - Todas las empresas del owner cuelgan de esa suscripción
 * - Tokens: 2 bolsillos (allowance mensual + purchased carry-over)
 * - Soporte para pagos en efectivo (T2) y fiscal (T1)
 */

// Servicio de límites - validaciones de plan
export {
  canCreateCompany,
  canAddUser,
  getAllowedModules,
  isModuleAllowed,
  calculateEnabledModules,
  getSubscriptionLimits,
  type LimitCheckResult,
} from './limits';

// Servicio de tokens - consumo atómico y gestión de balance
export {
  consumeTokens,
  addPurchasedTokens,
  resetMonthlyAllowance,
  adjustTokens,
  refundTokens,
  getTokenBalance,
  calculateAvailableTokens,
  hasEnoughTokens,
  getTokenHistory,
  type TokenConsumptionResult,
  type TokenBalance,
} from './tokens';

// Servicio de facturación - facturas y pagos
export {
  generateInvoiceNumber,
  createPlanSnapshot,
  createInvoice,
  updateInvoiceStatus,
  openInvoice,
  registerPayment,
  voidInvoice,
  getInvoiceWithDetails,
  listInvoices,
  generateRenewalInvoice,
  getBillingSummary,
  type PlanSnapshot,
  type InvoiceItemInput,
  type CreateInvoiceInput,
  type PaymentInput,
} from './invoicing';

// Servicio de auditoría - trazabilidad de acciones
export {
  logBillingAction,
  getAuditHistory,
  getUserAuditHistory,
  searchAuditLogs,
  getAuditStats,
  getActionDescription,
  formatAuditValue,
  getAuditDiff,
  type BillingAction,
  type BillingEntityType,
} from './audit';

// Servicio de prorrateo - cálculos para cambio de plan
export {
  calculateProration,
  getPlanChangeType,
  getEffectiveMonthlyPrice,
  getNextBillingDateAfterChange,
  formatProrationForDisplay,
  type ProrationResult,
  type ProrationItem,
  type PlanPricing,
} from './proration';

// Servicio de cupones - descuentos y promociones
export {
  createCoupon,
  validateCoupon,
  applyCouponToInvoice,
  getActiveRedemption,
  listCoupons,
  getCoupon,
  updateCoupon,
  deactivateCoupon,
  type CouponValidationResult,
  type CreateCouponInput,
} from './coupons';

// Servicio de débito automático - pagos recurrentes
export {
  setupAutoPayment,
  getAutoPaymentConfig,
  enableAutoPayment,
  disableAutoPayment,
  processAutoPayment,
  listAutoPaymentConfigs,
  getAutoPaymentStats,
  processAllPendingAutoPayments,
  type PaymentProvider,
  type CardInfo,
  type SetupAutoPaymentInput,
} from './auto-payment';

// Servicio de notificaciones - emails transaccionales
export {
  sendBillingNotification,
  sendInvoiceCreatedEmail,
  sendPaymentReminderEmail,
  sendPaymentReceivedEmail,
  sendPaymentFailedEmail,
  sendSubscriptionExpiringEmail,
  sendLowTokensEmail,
  type BillingEmailType,
  type EmailRecipient,
} from './notifications';

// Servicio de PDF - generación de facturas
export {
  generateInvoiceHTML,
  getInvoiceForPDF,
} from './pdf';
