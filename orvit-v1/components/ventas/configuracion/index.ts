// =====================================================
// VENTAS CONFIGURATION COMPONENTS
// Export all configuration components from a single entry point
// =====================================================

// Core Configuration Components
export { NotificationTemplatesConfig } from './notification-templates-config';
export { DiscountTiersConfig } from './discount-tiers-config';
export { CommissionConfig } from './commission-config';
export { NumberFormatConfig } from './number-format-config';
export { QuoteFollowupConfig } from './quote-followup-config';
export { SegmentPricingConfig } from './segment-pricing-config';

// Wizard & Setup
export { ConfigWizard, QuickSetupChecklist } from './config-wizard';

// Previously existing configs (if they exist)
export * from './credit-config';
export * from './currency-config';
export * from './delivery-config';
export * from './discount-config';
export * from './logistics-config';
export * from './modules-config';
export * from './notifications-config';
export * from './quote-config';
export * from './sidebar-preferences-config';
export * from './tax-config';
export * from './workflow-config';
