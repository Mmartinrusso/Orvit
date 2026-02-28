'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * ✨ OPTIMIZADO: Hook para permisos de navegación
 * Ya NO hace múltiples fetches - lee directamente de AuthContext
 * Elimina ~45 requests al cargar
 */
export function useNavigationPermissions() {
  const { user, loading, hasPermission, hasAnyPermission } = useAuth();

  // ✨ OPTIMIZACIÓN: Todos los permisos calculados en memoria
  const permissions = useMemo(() => {
    if (!user) {
      return {
        // Mantenimiento
        canAccessMaintenanceDashboard: false,
        canAccessWorkOrders: false,
        canAccessMaintenances: false,
        canAccessMaintenanceMachines: false,
        canAccessMobileUnits: false,
        canAccessWorkStations: false,
        canAccessPanol: false,
        canAccessMaintenanceReports: false,
        canAccessMaintenanceFallas: false,
        canAccessMaintenanceOrdenes: false,
        canAccessMaintenancePreventivo: false,
        canAccessMaintenanceCostos: false,
        canAccessPTW: false,
        canAccessLOTO: false,
        canAccessMOC: false,
        canAccessSkills: false,
        canAccessCalibration: false,
        canAccessContractors: false,

        // Administración
        canAccessAdminDashboard: false,
        canAccessTasks: false,
        canAccessPermissions: false,
        canAccessUsers: false,
        canAccessReports: false,
        canAccessSettings: false,
        canAccessSales: false,
        canAccessSalesDashboard: false,
        canAccessClients: false,
        canAccessProducts: false,
        canAccessQuotes: false,
        canAccessSalesModule: false,
        canAccessCosts: false,
        canAccessControls: false,
        canAccessCargas: false,
        canAccessCompras: false,
        canAccessTesoreria: false,
        canAccessNominas: false,
        canAccessAuditoria: false,
        canAccessAutomatizaciones: false,
        canAccessCostosModule: false,

        // Grupos del sidebar de Administración
        canAccessPersonalGroup: false,
        canAccessVentasGroup: false,
        canAccessCostosGroup: false,

        // Producción
        canAccessProductionDashboard: false,
        canAccessProductionMachines: false,
        canAccessVehicles: false,
        canAccessProductionOrders: false,
        canAccessProductionPartes: false,
        canAccessProductionParadas: false,
        canAccessProductionCalidad: false,
        canAccessProductionRutinas: false,
        canAccessProductionConfig: false,
        canAccessWorkCenters: false,
        canAccessShifts: false,
        canAccessReasonCodes: false,
        canAccessProductionReports: false,

        // Planta
        canStopPlant: false,

        // Almacén
        canAccessAlmacen: false,
        canAccessAlmacenDashboard: false,
        canAccessAlmacenInventario: false,
        canAccessAlmacenSolicitudes: false,
        canAccessAlmacenDespachos: false,
        canAccessAlmacenDevoluciones: false,
        canAccessAlmacenReservas: false,
      };
    }

    return {
      // Mantenimiento
      canAccessMaintenanceDashboard: hasPermission('ingresar_mantenimiento'),
      canAccessWorkOrders: hasPermission('ordenes_de_trabajo'),
      canAccessMaintenances: hasPermission('mantenimientos'),
      canAccessMaintenanceMachines: hasPermission('maquinas_mantenimiento'),
      canAccessMobileUnits: hasPermission('unidades_moviles'),
      canAccessWorkStations: hasPermission('puestos_trabajo'),
      canAccessPanol: hasPermission('panol'),
      canAccessMaintenanceReports: hasPermission('reportes_mantenimiento'),
      canAccessMaintenanceFallas: hasPermission('ingresar_mantenimiento'),
      canAccessMaintenanceOrdenes: hasPermission('ordenes_de_trabajo'),
      canAccessMaintenancePreventivo: hasPermission('preventive_maintenance.view'),
      canAccessMaintenanceCostos: hasPermission('ingresar_mantenimiento'),
      canAccessPTW: hasPermission('ptw.view'),
      canAccessLOTO: hasPermission('loto.view'),
      canAccessMOC: hasPermission('moc.view'),
      canAccessSkills: hasPermission('skills.view'),
      canAccessCalibration: hasPermission('calibration.view'),
      canAccessContractors: hasPermission('contractors.view'),

      // Administración
      canAccessAdminDashboard: hasPermission('ingresar_dashboard_administracion'),
      canAccessTasks: hasAnyPermission(['tasks.view_all', 'ingresar_tareas']),
      canAccessPermissions: hasPermission('ingresar_permisos_roles'),
      canAccessUsers: hasPermission('ingresar_usuarios'),
      canAccessReports: hasPermission('ingresar_reportes'),
      canAccessSettings: hasPermission('ingresar_configuracion'),
      canAccessSales: hasPermission('ventas'),
      canAccessSalesDashboard: hasPermission('ingresar_dashboard_ventas'),
      canAccessClients: hasPermission('ingresar_clientes'),
      canAccessProducts: hasPermission('ingresar_productos'),
      canAccessQuotes: hasPermission('ingresar_cotizaciones'),
      canAccessSalesModule: hasPermission('ingresar_ventas_modulo'),
      canAccessCosts: hasPermission('costos'),
      canAccessControls: hasPermission('ingresar_controles'),
      canAccessCargas: hasPermission('cargas.view'),
      canAccessCompras: hasPermission('ingresar_compras'),
      canAccessTesoreria: hasPermission('ingresar_tesoreria'),
      canAccessNominas: hasPermission('ingresar_nominas'),
      canAccessAuditoria: hasPermission('ingresar_auditoria'),
      canAccessAutomatizaciones: hasPermission('ingresar_automatizaciones'),
      canAccessCostosModule: hasPermission('ingresar_costos_modulo'),

      // Grupos del sidebar de Administración
      canAccessPersonalGroup: hasPermission('ingresar_personal'),
      canAccessVentasGroup: hasPermission('ingresar_ventas'),
      canAccessCostosGroup: hasPermission('ingresar_costos'),

      // Producción
      canAccessProductionDashboard: hasPermission('produccion.dashboard.view'),
      canAccessProductionMachines: hasPermission('maquinas_produccion'),
      canAccessVehicles: hasPermission('vehiculos_produccion'),
      canAccessProductionOrders: hasPermission('produccion.ordenes.view'),
      canAccessProductionPartes: hasPermission('produccion.partes.view'),
      canAccessProductionParadas: hasPermission('produccion.paradas.view'),
      canAccessProductionCalidad: hasPermission('produccion.calidad.view'),
      canAccessProductionRutinas: hasPermission('produccion.rutinas.view'),
      canAccessProductionConfig: hasPermission('produccion.config.view'),
      canAccessWorkCenters: hasPermission('produccion.config.work_centers'),
      canAccessShifts: hasPermission('produccion.config.shifts'),
      canAccessReasonCodes: hasPermission('produccion.config.reason_codes'),
      canAccessProductionReports: hasPermission('produccion.reportes.view'),

      // Planta
      canStopPlant: hasPermission('plant.stop'),

      // Almacén
      canAccessAlmacen: hasPermission('ingresar_almacen') || hasPermission('almacen.view'),
      canAccessAlmacenDashboard: hasPermission('almacen.view_dashboard'),
      canAccessAlmacenInventario: hasPermission('almacen.view_inventory'),
      canAccessAlmacenSolicitudes: hasPermission('almacen.request.view'),
      canAccessAlmacenDespachos: hasPermission('almacen.dispatch.view'),
      canAccessAlmacenDevoluciones: hasPermission('almacen.return.view'),
      canAccessAlmacenReservas: hasPermission('almacen.reservation.view'),
    };
  }, [user, hasPermission]);

  return {
    ...permissions,
    isLoading: loading
  };
}
