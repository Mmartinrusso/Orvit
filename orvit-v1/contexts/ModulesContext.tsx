'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

// Tipos de categorías de módulos
export type ModuleCategory = 'VENTAS' | 'COMPRAS' | 'MANTENIMIENTO' | 'COSTOS' | 'ADMINISTRACION' | 'GENERAL' | 'ALMACEN';

// Estructura de un módulo
export interface Module {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: ModuleCategory;
  icon: string | null;
  isActive: boolean;
  dependencies: string[];
}

// Módulo habilitado para la empresa actual
export interface CompanyModule {
  moduleId: string;
  moduleKey: string;
  isEnabled: boolean;
  config?: Record<string, unknown>;
}

interface ModulesContextType {
  // Lista de módulos habilitados para la empresa actual
  enabledModules: CompanyModule[];

  // Verificar si un módulo está habilitado
  isModuleEnabled: (moduleKey: string) => boolean;

  // Verificar si alguno de los módulos está habilitado
  isAnyModuleEnabled: (moduleKeys: string[]) => boolean;

  // Verificar si todos los módulos están habilitados
  areAllModulesEnabled: (moduleKeys: string[]) => boolean;

  // Obtener config de un módulo específico
  getModuleConfig: <T = Record<string, unknown>>(moduleKey: string) => T | null;

  // Estado de carga
  loading: boolean;

  // Recargar módulos
  refreshModules: () => Promise<void>;

  // Catálogo completo de módulos (para SUPERADMIN)
  allModules: Module[];

  // Indica si el usuario es SUPERADMIN (tiene acceso a todo)
  isSuperAdmin: boolean;
}

const ModulesContext = createContext<ModulesContextType | null>(null);

// Mapeo de rutas a módulos requeridos
export const ROUTE_MODULE_MAP: Record<string, string[]> = {
  // Ventas
  '/administracion/ventas': ['sales_core'],
  '/administracion/ventas/cotizaciones': ['sales_core'],
  '/administracion/ventas/ordenes': ['sales_core'],
  '/administracion/ventas/entregas': ['sales_core'],
  '/administracion/ventas/facturas': ['sales_core'],
  '/administracion/ventas/pagos': ['sales_core'],
  '/administracion/ventas/cobranzas': ['sales_core', 'client_ledger'],
  '/administracion/ventas/cuenta-corriente': ['sales_core', 'client_ledger'],
  '/administracion/ventas/acopios': ['sales_core', 'acopios'],
  '/administracion/ventas/listas-precios': ['sales_core', 'multi_price_lists'],
  '/administracion/ventas/comisiones': ['sales_core', 'seller_commissions'],

  // Compras
  '/administracion/compras': ['purchases_core'],
  '/administracion/compras/ordenes': ['purchases_core', 'purchase_orders'],
  '/administracion/compras/recepciones': ['purchases_core'],
  '/administracion/compras/stock': ['purchases_core', 'stock_management'],
  '/administracion/compras/cuentas-corrientes': ['purchases_core', 'supplier_ledger'],
  '/administracion/compras/centros-costo': ['purchases_core', 'cost_centers'],
  '/administracion/compras/proyectos': ['purchases_core', 'projects'],

  // Mantenimiento
  '/mantenimiento': ['maintenance_core'],
  '/mantenimiento/ordenes': ['maintenance_core'],
  '/mantenimiento/preventivo': ['maintenance_core', 'preventive_maintenance'],
  '/mantenimiento/correctivo': ['maintenance_core', 'corrective_maintenance'],
  '/mantenimiento/unidades-moviles': ['maintenance_core', 'mobile_units'],
  '/panol': ['maintenance_core', 'panol'],

  // Costos
  '/administracion/costos': ['costs_core'],
  '/administracion/costos/laborales': ['costs_core', 'labor_costs'],
  '/administracion/costos/indirectos': ['costs_core', 'indirect_costs'],

  // General
  '/tareas': ['tasks'],
  '/tareas/fijas': ['tasks', 'fixed_tasks'],
  '/administracion/cargas': ['cargas'],
  '/administracion/controles': ['controls'],
  '/administracion/agenda': ['agenda'],

  // Almacén
  '/almacen': ['almacen_core'],
  '/almacen/inventario': ['almacen_core'],
  '/almacen/solicitudes': ['almacen_core', 'material_requests'],
  '/almacen/despachos': ['almacen_core', 'dispatches'],
  '/almacen/devoluciones': ['almacen_core', 'returns'],
  '/almacen/movimientos': ['almacen_core'],
  '/almacen/reservas': ['almacen_core', 'reservations'],
};

// Mapeo de sidebar items a módulos requeridos
// Usamos el href como key para facilitar la integración
export const SIDEBAR_MODULE_MAP: Record<string, string[]> = {
  // ========== VENTAS ==========
  '/administracion/ventas': ['sales_core'],
  '/administracion/ventas/clientes': ['sales_core'],
  '/administracion/ventas/productos': ['sales_core'],
  '/administracion/ventas/cotizaciones': ['sales_core', 'quotes'],
  '/administracion/ventas/ordenes': ['sales_core', 'sales_orders'],
  '/administracion/ventas/entregas': ['sales_core'],
  '/administracion/ventas/facturas': ['sales_core', 'invoices'],
  '/administracion/ventas/cobranzas': ['sales_core', 'collections'],
  '/administracion/ventas/reportes': ['sales_core'],
  '/administracion/ventas/cuenta-corriente': ['sales_core', 'client_ledger'],
  '/administracion/ventas/acopios': ['sales_core', 'acopios'],
  '/administracion/ventas/listas-precios': ['sales_core', 'multi_price_lists'],
  '/administracion/ventas/comisiones': ['sales_core', 'seller_commissions'],

  // ========== COMPRAS ==========
  // Dashboard y base - solo purchases_core
  '/administracion/compras': ['purchases_core'],
  '/administracion/compras/proveedores': ['purchases_core'],
  '/administracion/compras/comprobantes': ['purchases_core'],
  '/administracion/compras/solicitudes': ['purchases_core'],
  '/administracion/compras/historial': ['purchases_core'],
  '/administracion/compras/reportes': ['purchases_core'],

  // Submódulos de compras
  '/administracion/compras/ordenes': ['purchases_core', 'purchase_orders'],
  '/administracion/compras/cuentas-corrientes': ['purchases_core', 'supplier_ledger'],
  '/administracion/compras/centros-costo': ['purchases_core', 'cost_centers'],
  '/administracion/compras/proyectos': ['purchases_core', 'projects'],

  // Stock (requiere stock_management)
  '/administracion/compras/stock': ['purchases_core', 'stock_management'],
  '/administracion/compras/stock/kardex': ['purchases_core', 'stock_management'],
  '/administracion/compras/stock/ajustes': ['purchases_core', 'stock_management', 'stock_adjustments'],
  '/administracion/compras/stock/transferencias': ['purchases_core', 'stock_management', 'stock_transfers'],
  '/administracion/compras/stock/reposicion': ['purchases_core', 'stock_management', 'stock_replenishment'],

  // ========== TESORERIA ==========
  '/administracion/tesoreria': ['tesoreria'],
  '/administracion/tesoreria/cajas': ['tesoreria'],
  '/administracion/tesoreria/bancos': ['tesoreria'],
  '/administracion/tesoreria/cheques': ['tesoreria'],
  '/administracion/tesoreria/transferencias': ['tesoreria'],
  '/administracion/tesoreria/flujo-caja': ['tesoreria'],

  // ========== MANTENIMIENTO ==========
  '/mantenimiento/dashboard': ['maintenance_core'],
  '/mantenimiento/ordenes': ['maintenance_core'],
  '/mantenimiento/fallas': ['maintenance_core'],
  '/mantenimiento/soluciones': ['maintenance_core'],
  '/mantenimiento/preventivo': ['maintenance_core', 'preventive_maintenance'],
  '/mantenimiento/maquinas': ['maintenance_core'],
  '/mantenimiento/unidades-moviles': ['maintenance_core', 'mobile_units'],
  '/mantenimiento/puestos-trabajo': ['maintenance_core'],
  '/panol': ['maintenance_core', 'panol'],

  // ========== COSTOS ==========
  '/administracion/costos': ['costs_core'],
  '/administracion/costos/laborales': ['costs_core', 'labor_costs'],
  '/administracion/costos/indirectos': ['costs_core', 'indirect_costs'],

  // ========== GENERAL ==========
  '/administracion/agenda': ['agenda'],
  '/administracion/tareas': ['tasks'],
  '/administracion/tareas/fijas': ['tasks', 'fixed_tasks'],
  '/administracion/cargas': ['cargas'],
  '/administracion/controles': ['controls'],

  // ========== ALMACÉN ==========
  '/almacen': ['almacen_core'],
  '/almacen/dashboard': ['almacen_core'],
  '/almacen/inventario': ['almacen_core'],
  '/almacen/solicitudes': ['almacen_core', 'material_requests'],
  '/almacen/solicitudes/nueva': ['almacen_core', 'material_requests'],
  '/almacen/despachos': ['almacen_core', 'dispatches'],
  '/almacen/despachos/nuevo': ['almacen_core', 'dispatches'],
  '/almacen/devoluciones': ['almacen_core', 'returns'],
  '/almacen/movimientos': ['almacen_core'],
  '/almacen/reservas': ['almacen_core', 'reservations'],
};

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [enabledModules, setEnabledModules] = useState<CompanyModule[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.role === 'SUPERADMIN';

  const fetchModules = useCallback(async () => {
    if (!user) {
      setEnabledModules([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch enabled modules for current company
      const response = await fetch('/api/company/modules', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setEnabledModules(data.modules || []);
      }

      // If SUPERADMIN, also fetch all modules
      if (isSuperAdmin) {
        const allResponse = await fetch('/api/superadmin/modules', {
          credentials: 'include',
        });

        if (allResponse.ok) {
          const data = await allResponse.json();
          setAllModules(data.modules || []);
        }
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // Verificar si un módulo está habilitado
  const isModuleEnabled = useCallback((moduleKey: string): boolean => {
    // SUPERADMIN tiene acceso a todo
    if (isSuperAdmin) return true;

    return enabledModules.some(m => m.moduleKey === moduleKey && m.isEnabled);
  }, [enabledModules, isSuperAdmin]);

  // Verificar si alguno de los módulos está habilitado
  const isAnyModuleEnabled = useCallback((moduleKeys: string[]): boolean => {
    if (isSuperAdmin) return true;
    return moduleKeys.some(key => isModuleEnabled(key));
  }, [isModuleEnabled, isSuperAdmin]);

  // Verificar si todos los módulos están habilitados
  const areAllModulesEnabled = useCallback((moduleKeys: string[]): boolean => {
    if (isSuperAdmin) return true;
    return moduleKeys.every(key => isModuleEnabled(key));
  }, [isModuleEnabled, isSuperAdmin]);

  // Obtener config de un módulo
  const getModuleConfig = useCallback(<T = Record<string, unknown>>(moduleKey: string): T | null => {
    const module = enabledModules.find(m => m.moduleKey === moduleKey);
    return module?.config as T || null;
  }, [enabledModules]);

  const value = useMemo(() => ({
    enabledModules,
    isModuleEnabled,
    isAnyModuleEnabled,
    areAllModulesEnabled,
    getModuleConfig,
    loading,
    refreshModules: fetchModules,
    allModules,
    isSuperAdmin,
  }), [
    enabledModules,
    isModuleEnabled,
    isAnyModuleEnabled,
    areAllModulesEnabled,
    getModuleConfig,
    loading,
    fetchModules,
    allModules,
    isSuperAdmin,
  ]);

  return (
    <ModulesContext.Provider value={value}>
      {children}
    </ModulesContext.Provider>
  );
}

export const useModules = () => {
  const context = useContext(ModulesContext);
  if (!context) {
    throw new Error('useModules debe ser usado dentro de un ModulesProvider');
  }
  return context;
};

// Hook para verificar si una ruta requiere módulos específicos
export const useRouteModuleAccess = (path: string): boolean => {
  const { areAllModulesEnabled, loading, isSuperAdmin } = useModules();

  if (loading) return true; // Durante carga, permitir
  if (isSuperAdmin) return true; // SUPERADMIN tiene acceso total

  const requiredModules = ROUTE_MODULE_MAP[path];
  if (!requiredModules) return true; // Ruta sin restricción

  return areAllModulesEnabled(requiredModules);
};

// Componente wrapper para proteger contenido basado en módulos
export function ModuleGuard({
  moduleKeys,
  children,
  fallback = null
}: {
  moduleKeys: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { areAllModulesEnabled, loading } = useModules();

  if (loading) return null;

  if (!areAllModulesEnabled(moduleKeys)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export { ModulesContext };
