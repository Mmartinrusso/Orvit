/**
 * API Route to Module Mapping
 * Uses prefixes to cover dynamic routes like [id], /aprobar, /convertir, etc.
 */

/**
 * Route prefix to required modules mapping
 * If path.startsWith(prefix), those modules are required
 */
export const API_ROUTE_MODULE_PREFIXES: Array<{ prefix: string; modules: string[] }> = [
  // ═══════════════════════════════════════════════════════════
  // VENTAS
  // ═══════════════════════════════════════════════════════════
  { prefix: '/api/ventas/dashboard', modules: ['sales_core'] },
  { prefix: '/api/ventas/clientes', modules: ['sales_core'] },
  { prefix: '/api/ventas/productos', modules: ['sales_core'] },
  { prefix: '/api/ventas/cotizaciones', modules: ['sales_core', 'sales_quotes'] },
  { prefix: '/api/ventas/ordenes', modules: ['sales_core', 'sales_orders'] },
  { prefix: '/api/ventas/entregas', modules: ['sales_core', 'sales_deliveries'] },
  { prefix: '/api/ventas/facturas', modules: ['sales_core', 'sales_invoices'] },
  { prefix: '/api/ventas/pagos', modules: ['sales_core', 'sales_payments'] },
  { prefix: '/api/ventas/cuenta-corriente', modules: ['sales_core', 'sales_ledger'] },
  { prefix: '/api/ventas/acopios', modules: ['sales_core', 'acopios'] },
  { prefix: '/api/ventas/comisiones', modules: ['sales_core', 'seller_commissions'] },
  { prefix: '/api/ventas/listas-precio', modules: ['sales_core', 'multi_price_lists'] },

  // ═══════════════════════════════════════════════════════════
  // COMPRAS
  // ═══════════════════════════════════════════════════════════
  { prefix: '/api/compras/dashboard', modules: ['purchases_core'] },
  { prefix: '/api/compras/proveedores', modules: ['purchases_core'] },
  { prefix: '/api/compras/comprobantes', modules: ['purchases_core'] },
  { prefix: '/api/compras/ordenes-compra', modules: ['purchases_core', 'purchase_orders'] },
  { prefix: '/api/compras/recepciones', modules: ['purchases_core', 'purchase_orders'] },
  { prefix: '/api/compras/pagos', modules: ['purchases_core'] },
  { prefix: '/api/compras/cuenta-corriente', modules: ['purchases_core', 'supplier_ledger'] },

  // ═══════════════════════════════════════════════════════════
  // STOCK
  // ═══════════════════════════════════════════════════════════
  { prefix: '/api/stock/movimientos', modules: ['purchases_core', 'stock_management'] },
  { prefix: '/api/stock/ajustes', modules: ['purchases_core', 'stock_adjustments'] },
  { prefix: '/api/stock/transferencias', modules: ['purchases_core', 'stock_transfers'] },
  { prefix: '/api/stock/reposicion', modules: ['purchases_core', 'stock_replenishment'] },

  // ═══════════════════════════════════════════════════════════
  // MANTENIMIENTO
  // ═══════════════════════════════════════════════════════════
  { prefix: '/api/mantenimiento/preventivo', modules: ['maintenance_core', 'preventive_maintenance'] },
  { prefix: '/api/mantenimiento/correctivo', modules: ['maintenance_core', 'corrective_maintenance'] },
  { prefix: '/api/mantenimiento/unidades', modules: ['maintenance_core', 'mobile_units'] },
  { prefix: '/api/mantenimiento/panol', modules: ['maintenance_core', 'panol'] },
];

/**
 * Get required modules for a given API route path
 * Returns null if the route is not protected by modules
 * Returns the modules array if protected
 */
export function getRequiredModules(pathname: string): string[] | null {
  // Find the first matching prefix (more specific prefixes should come first)
  const match = API_ROUTE_MODULE_PREFIXES.find(r => pathname.startsWith(r.prefix));
  return match?.modules ?? null;
}

/**
 * Check if a path requires module validation
 */
export function isModuleProtectedRoute(pathname: string): boolean {
  return getRequiredModules(pathname) !== null;
}
