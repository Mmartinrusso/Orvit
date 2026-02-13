/**
 * API Module Guard
 * Provides caching and verification of module access
 */

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getEffectiveModules } from './dependencies';

// Cache de módulos por company (60s TTL)
const moduleCache = new Map<number, { modules: string[]; expires: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Get enabled modules for a company (with caching)
 */
export async function getCompanyModules(companyId: number): Promise<string[]> {
  // Check cache first
  const cached = moduleCache.get(companyId);
  if (cached && cached.expires > Date.now()) {
    return cached.modules;
  }

  try {
    // Query enabled modules
    const companyModules = await prisma.companyModule.findMany({
      where: {
        companyId,
        isEnabled: true,
      },
      include: {
        module: {
          select: { key: true }
        }
      }
    });

    const moduleKeys = companyModules.map(cm => cm.module.key);

    // Update cache
    moduleCache.set(companyId, {
      modules: moduleKeys,
      expires: Date.now() + CACHE_TTL,
    });

    return moduleKeys;
  } catch (error) {
    console.error('[API Guard] Error fetching company modules:', error);
    // On error, return empty array (fail closed)
    return [];
  }
}

/**
 * Invalidate module cache for a company
 * Call this when modules are enabled/disabled
 */
export function invalidateModuleCache(companyId: number): void {
  moduleCache.delete(companyId);
}

/**
 * Invalidate all module cache
 * Call this when global module changes are made
 */
export function invalidateAllModuleCache(): void {
  moduleCache.clear();
}

/**
 * Check if modules are enabled for a company
 */
export async function checkModulesEnabled(
  companyId: number,
  requiredModules: string[]
): Promise<{ allowed: boolean; missing: string[] }> {
  if (requiredModules.length === 0) {
    return { allowed: true, missing: [] };
  }

  const enabledModules = await getCompanyModules(companyId);
  return getEffectiveModules(enabledModules, requiredModules);
}

/**
 * Create 403 response for disabled module
 */
export function createModuleDisabledResponse(
  missingModules: string[],
  companyId?: number
): NextResponse {
  return NextResponse.json(
    {
      error: 'Módulo no habilitado',
      code: 'MODULE_DISABLED',
      required: missingModules,
      ...(companyId && { companyId }),
    },
    { status: 403 }
  );
}

/**
 * Route to module mapping for API endpoints
 */
export const API_ROUTE_MODULES: Record<string, string[]> = {
  // Base compras - solo purchases_core
  '/api/compras/comprobantes': ['purchases_core'],
  '/api/compras/proveedores': ['purchases_core'],
  '/api/compras/recepciones': ['purchases_core'],
  '/api/compras/ordenes-pago': ['purchases_core'],
  '/api/compras/notas-credito-debito': ['purchases_core'],
  '/api/compras/dashboard': ['purchases_core'],
  '/api/compras/solicitudes': ['purchases_core'],
  '/api/compras/historial': ['purchases_core'],
  '/api/compras/match': ['purchases_core'],
  '/api/compras/facturas-sin-pagar': ['purchases_core'],

  // Submódulos de compras
  '/api/compras/ordenes-compra': ['purchases_core', 'purchase_orders'],
  '/api/compras/cuentas-corrientes': ['purchases_core', 'supplier_ledger'],
  '/api/compras/centros-costo': ['purchases_core', 'cost_centers'],
  '/api/compras/proyectos': ['purchases_core', 'projects'],

  // Stock (requiere stock_management)
  '/api/compras/stock': ['purchases_core', 'stock_management'],
  '/api/compras/stock/movimientos': ['purchases_core', 'stock_management'],
  '/api/compras/stock/kpis': ['purchases_core', 'stock_management'],
  '/api/compras/stock/ajustes': ['purchases_core', 'stock_management', 'stock_adjustments'],
  '/api/compras/stock/transferencias': ['purchases_core', 'stock_management', 'stock_transfers'],
  '/api/compras/stock/reposicion': ['purchases_core', 'stock_management', 'stock_replenishment'],
  '/api/compras/stock/ubicaciones': ['purchases_core', 'stock_management'],
  '/api/compras/stock/sin-deposito': ['purchases_core', 'stock_management'],
  '/api/compras/depositos': ['purchases_core', 'stock_management'],

  // Ventas
  '/api/ventas/cotizaciones': ['sales_core', 'quotes'],
  '/api/ventas/ordenes': ['sales_core', 'sales_orders'],
  '/api/ventas/facturas': ['sales_core', 'invoices'],
  '/api/ventas/pagos': ['sales_core', 'collections'],
  '/api/ventas/cuenta-corriente': ['sales_core', 'client_ledger'],
  '/api/ventas/dashboard': ['sales_core'],
  '/api/ventas/entregas': ['sales_core'],

  // Tesorería
  '/api/tesoreria/cajas': ['tesoreria'],
  '/api/tesoreria/bancos': ['tesoreria'],
  '/api/tesoreria/cheques': ['tesoreria'],
  '/api/tesoreria/transferencias': ['tesoreria'],
  '/api/tesoreria/posicion': ['tesoreria'],

  // Mantenimiento
  '/api/mantenimiento/preventivo': ['maintenance_core', 'preventive_maintenance'],
  '/api/mantenimiento/correctivo': ['maintenance_core', 'corrective_maintenance'],
  '/api/mantenimiento/ordenes': ['maintenance_core'],

  // Costos
  '/api/dashboard/metrics': ['costs_core'],
  '/api/dashboard/top-products': ['costs_core'],
};

/**
 * Get required modules for a route
 */
export function getRouteModules(pathname: string): string[] | undefined {
  // Exact match first
  if (API_ROUTE_MODULES[pathname]) {
    return API_ROUTE_MODULES[pathname];
  }

  // Check for prefix match (for dynamic routes like /api/compras/ordenes-compra/[id])
  for (const [route, modules] of Object.entries(API_ROUTE_MODULES)) {
    if (pathname.startsWith(route + '/')) {
      return modules;
    }
  }

  return undefined;
}
