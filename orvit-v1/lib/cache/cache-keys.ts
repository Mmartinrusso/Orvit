/**
 * Centralized Cache Key Definitions
 * All cache keys should be defined here for consistency
 */

// Cache key prefixes by module
const PREFIXES = {
  AUTH: 'auth',
  PERMISSIONS: 'perm',
  COMPRAS: 'compras',
  VENTAS: 'ventas',
  TESORERIA: 'tesoreria',
  DASHBOARD: 'dash',
  SUPPLIERS: 'sup',
  PRODUCTS: 'prod',
  COST_PRODUCTS: 'cprod',
  STOCK: 'stock',
  CONFIG: 'cfg',
  AREAS: 'areas',
  SECTORS: 'sectors',
} as const;

// TTL values in seconds
export const TTL = {
  SHORT: 60,           // 1 minute - for frequently changing data
  MEDIUM: 300,         // 5 minutes - for moderately stable data
  LONG: 900,           // 15 minutes - for stable data
  VERY_LONG: 3600,     // 1 hour - for rarely changing data
  DAY: 86400,          // 24 hours - for static data
} as const;

/**
 * Cache key generators for Auth module
 */
export const authKeys = {
  me: (userId: number) =>
    `${PREFIXES.AUTH}:me:${userId}`,
};

/**
 * Cache key generators for Permissions module
 */
export const permissionKeys = {
  userPermissions: (userId: number, companyId: number) =>
    `${PREFIXES.PERMISSIONS}:user:${userId}:${companyId}`,

  adminPermissions: () =>
    `${PREFIXES.PERMISSIONS}:admin:all`,
};

/**
 * Cache key generators for Areas/Sectors
 */
export const areaKeys = {
  list: (companyId: number | string) =>
    `${PREFIXES.AREAS}:list:${companyId}`,
};

export const sectorKeys = {
  byArea: (areaId: number | string) =>
    `${PREFIXES.SECTORS}:area:${areaId}`,

  forProduction: (companyId: number | string) =>
    `${PREFIXES.SECTORS}:production:${companyId}`,
};

/**
 * Cache key generators for Cost Products
 */
export const costProductKeys = {
  list: (companyId: number, activeOnly?: boolean) =>
    `${PREFIXES.COST_PRODUCTS}:list:${companyId}${activeOnly ? ':active' : ''}`,
};

/**
 * Cache key generators for Dashboard Config
 */
export const dashboardConfigKeys = {
  userConfig: (userId: number, companyId: number) =>
    `${PREFIXES.DASHBOARD}:cfg:${userId}:${companyId}`,
};

/**
 * Cache key generators for Compras module
 */
export const comprasKeys = {
  // Dashboard
  dashboard: (companyId: number, mode: string, isAdmin: boolean) =>
    `${PREFIXES.DASHBOARD}:${PREFIXES.COMPRAS}:${companyId}:${mode}:${isAdmin ? 'a' : 'u'}`,

  dashboardWidget: (companyId: number, widgetId: string) =>
    `${PREFIXES.DASHBOARD}:${PREFIXES.COMPRAS}:widget:${companyId}:${widgetId}`,

  // Suppliers
  supplierList: (companyId: number) =>
    `${PREFIXES.SUPPLIERS}:list:${companyId}`,

  supplier: (supplierId: number) =>
    `${PREFIXES.SUPPLIERS}:${supplierId}`,

  supplierItems: (supplierId: number) =>
    `${PREFIXES.SUPPLIERS}:items:${supplierId}`,

  supplierBalance: (companyId: number, supplierId: number) =>
    `${PREFIXES.SUPPLIERS}:balance:${companyId}:${supplierId}`,

  // Purchase Orders
  purchaseOrder: (orderId: number) =>
    `${PREFIXES.COMPRAS}:oc:${orderId}`,

  purchaseOrderList: (companyId: number, status?: string) =>
    `${PREFIXES.COMPRAS}:oc:list:${companyId}${status ? `:${status}` : ''}`,

  // Invoices/Receipts
  invoice: (invoiceId: number) =>
    `${PREFIXES.COMPRAS}:inv:${invoiceId}`,

  invoiceList: (companyId: number) =>
    `${PREFIXES.COMPRAS}:inv:list:${companyId}`,

  // Stock
  stockLevels: (companyId: number, warehouseId?: number) =>
    `${PREFIXES.STOCK}:levels:${companyId}${warehouseId ? `:${warehouseId}` : ''}`,

  stockItem: (itemId: number) =>
    `${PREFIXES.STOCK}:item:${itemId}`,

  // Products/Supplies
  productCatalog: (companyId: number) =>
    `${PREFIXES.PRODUCTS}:catalog:${companyId}`,

  productPrices: (companyId: number) =>
    `${PREFIXES.PRODUCTS}:prices:${companyId}`,

  // Pending items
  pendingApprovals: (companyId: number) =>
    `${PREFIXES.COMPRAS}:pending:approvals:${companyId}`,

  pendingPayments: (companyId: number) =>
    `${PREFIXES.COMPRAS}:pending:payments:${companyId}`,

  // Configuration
  companyConfig: (companyId: number) =>
    `${PREFIXES.CONFIG}:company:${companyId}`,

  purchaseConfig: (companyId: number) =>
    `${PREFIXES.CONFIG}:${PREFIXES.COMPRAS}:${companyId}`,
};

/**
 * Cache key generators for Ventas module
 */
export const ventasKeys = {
  dashboard: (companyId: number, mode: string) =>
    `${PREFIXES.DASHBOARD}:${PREFIXES.VENTAS}:${companyId}:${mode}`,

  clientList: (companyId: number) =>
    `${PREFIXES.VENTAS}:clients:${companyId}`,

  quotationList: (companyId: number) =>
    `${PREFIXES.VENTAS}:quotes:list:${companyId}`,

  orderList: (companyId: number) =>
    `${PREFIXES.VENTAS}:orders:list:${companyId}`,
};

/**
 * Cache key generators for Tesoreria module
 */
export const tesoreriaKeys = {
  summary: (companyId: number, viewMode: string) =>
    `${PREFIXES.TESORERIA}:posicion:${companyId}:${viewMode}`,
};

/**
 * Invalidation patterns - which keys to invalidate when data changes
 */
export const invalidationPatterns = {
  // When a purchase order changes
  purchaseOrder: (companyId: number) => [
    comprasKeys.purchaseOrderList(companyId),
    comprasKeys.dashboard(companyId, 'S', true),
    comprasKeys.dashboard(companyId, 'S', false),
    comprasKeys.dashboard(companyId, 'E', true),
    comprasKeys.dashboard(companyId, 'E', false),
    comprasKeys.pendingApprovals(companyId),
  ],

  // When an invoice changes
  invoice: (companyId: number, supplierId?: number) => {
    const keys = [
      comprasKeys.invoiceList(companyId),
      comprasKeys.dashboard(companyId, 'S', true),
      comprasKeys.dashboard(companyId, 'S', false),
      comprasKeys.dashboard(companyId, 'E', true),
      comprasKeys.dashboard(companyId, 'E', false),
      comprasKeys.pendingPayments(companyId),
    ];
    if (supplierId) {
      keys.push(comprasKeys.supplierBalance(companyId, supplierId));
    }
    return keys;
  },

  // When stock changes
  stock: (companyId: number, warehouseId?: number) => [
    comprasKeys.stockLevels(companyId),
    comprasKeys.stockLevels(companyId, warehouseId),
  ],

  // When supplier data changes
  supplier: (companyId: number, supplierId: number) => [
    comprasKeys.supplierList(companyId),
    comprasKeys.supplier(supplierId),
    comprasKeys.supplierItems(supplierId),
  ],

  // When user logs out
  userLogout: (userId: number, companyId: number) => [
    authKeys.me(userId),
    permissionKeys.userPermissions(userId, companyId),
  ],

  // When costs are recalculated
  costRecalculate: (companyId: number) => [
    costProductKeys.list(companyId),
    costProductKeys.list(companyId, true),
    comprasKeys.productCatalog(companyId),
  ],

  // When products change
  products: (companyId: number) => [
    comprasKeys.productCatalog(companyId),
    costProductKeys.list(companyId),
    costProductKeys.list(companyId, true),
  ],

  // When dashboard config changes
  dashboardConfig: (userId: number, companyId: number) => [
    dashboardConfigKeys.userConfig(userId, companyId),
  ],
};
