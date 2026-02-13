/**
 * ViewMode System
 * Export all ViewMode utilities from a single entry point
 */

// Types
export type { ViewMode, DocType, ViewModeCookiePayload, ViewModeConfig, ViewPreferencesResponse, SupplierBalance, ViewModeLogAction } from './types';
export { MODE, DOC_TYPE } from './types';

// Get mode from request
export { getViewMode, isExtendedMode, isStandardMode } from './get-mode';

// Prisma helpers
export { applyViewMode, applyViewModeToOr, getDocTypeFilter, buildStockFilter, formatViewModeResponse } from './prisma-helper';

// Cookie management
export { VM_COOKIE_NAME, createViewModeCookie, verifyViewModeCookie, setViewModeCookie, clearViewModeCookie, getViewModeFromCookie } from './cookie';

// Protected routes
export { ALWAYS_STANDARD_ROUTES, isProtectedRoute, isFiscalRoute } from './protected-routes';

// Permissions
export { VIEW_MODE_PERMISSIONS, canActivateExtended, canCreateT2, canConfigureViewMode, canViewLogs, getCompanyViewConfig, isPinRequired, verifyViewModePin, logViewModeAction } from './permissions';

// Supplier balance
export { getSupplierBalance, getSuppliersBalances, getSupplierMovements } from './supplier-balance';

// T2 Database helpers
export { shouldQueryT2, isT2AvailableForCompany, getT2AvailabilityStatus, invalidateT2ConfigCache } from './should-query-t2';

// T2 Data enrichment (combine T2 data with master data from main DB)
export { enrichT2Receipts, enrichT2PaymentOrders, enrichT2StockMovements, enrichT2AccountMovements } from './t2-enrichment';
export type { EnrichedT2Receipt, EnrichedT2PaymentOrder, EnrichedT2StockMovement } from './t2-enrichment';

// T2 Query helper (consistent error handling)
export { executeT2Query, combineT2Status, createT2StatusResponse } from './t2-query-helper';
export type { T2QueryStatus, T2QueryResult } from './t2-query-helper';
