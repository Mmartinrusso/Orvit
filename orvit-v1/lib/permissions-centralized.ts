/**
 * PERMISOS CENTRALIZADOS DEL FRONTEND - ORVIT
 * 
 * Este archivo contiene TODOS los permisos utilizados en el frontend,
 * organizados por categorías para facilitar su gestión y mantenimiento.
 * 
 * Generado automáticamente mediante análisis exhaustivo del código.
 * Última actualización: ${new Date().toISOString()}
 */

// =============================================================================
// PERMISOS DE NAVEGACIÓN - ÁREAS PRINCIPALES
// =============================================================================

/**
 * Permisos para acceder a las áreas principales del sistema
 */
export const NAVIGATION_PERMISSIONS = {
  // Acceso a áreas principales
  INGRESAR_ADMINISTRACION: 'ingresar_administracion',          // Layout de administración
  INGRESAR_MANTENIMIENTO: 'ingresar_mantenimiento',           // Layout de mantenimiento
  
  // Navegación - Administración
  INGRESAR_DASHBOARD_ADMINISTRACION: 'ingresar_dashboard_administracion',     // Dashboard admin
  INGRESAR_TAREAS: 'ingresar_tareas',                         // Módulo de tareas
  INGRESAR_PERMISOS: 'ingresar_permisos',                     // Gestión de permisos
  INGRESAR_USUARIOS: 'ingresar_usuarios',                     // Gestión de usuarios
  INGRESAR_REPORTES: 'ingresar_reportes',                     // Módulo de reportes
  INGRESAR_CONFIGURACION: 'ingresar_configuracion',           // Configuración del sistema
  
  // Navegación - Mantenimiento
  INGRESAR_ORDENESDETRABAJO: 'ingresar_ordenesdetrabajo',     // Órdenes de trabajo
  INGRESAR_PLANIFICACION: 'ingresar_planificacion',           // Planificación preventiva
  INGRESAR_MAQUINAS_MANTENIMIENTO: 'ingresar_maquinas_mantenimiento',         // Máquinas (mantenimiento)
  INGRESAR_PANOL: 'ingresar_panol',                           // Gestión de pañol
  INGRESAR_HISTORIAL_MANTENIMIENTO: 'ingresar_historial_mantenimiento',       // Historial de mantenimiento
  
  // Navegación - Producción
  INGRESAR_DASHBOARD_PRODUCCION: 'ingresar_dashboard_produccion',             // Dashboard producción
  INGRESAR_MAQUINAS_PRODUCCION: 'ingresar_maquinas_produccion',               // Máquinas (producción)
  INGRESAR_VEHICULOS: 'ingresar_vehiculos',                   // Gestión de vehículos
} as const;

// =============================================================================
// PERMISOS DE ENTIDADES - CRUD OPERATIONS
// =============================================================================

/**
 * Permisos para gestión de usuarios
 */
export const USER_PERMISSIONS = {
  VIEW: 'users.view',                         // Ver usuarios
  CREATE: 'users.create',                     // Crear usuarios
  EDIT: 'users.edit',                         // Editar usuarios
  DELETE: 'users.delete',                     // Eliminar usuarios
  EDIT_ROLE: 'users.edit_role',               // Cambiar rol de usuarios
  ACTIVATE_DEACTIVATE: 'users.activate_deactivate',  // Activar/desactivar usuarios
  VIEW_ALL_COMPANIES: 'users.view_all_companies',    // Ver usuarios de todas las empresas
  MANAGE: 'users.manage',                     // Gestión general de usuarios
} as const;

/**
 * Permisos para gestión de empresas
 */
export const COMPANY_PERMISSIONS = {
  VIEW: 'companies.view',                     // Ver empresas
  CREATE: 'companies.create',                 // Crear empresas
  EDIT: 'companies.edit',                     // Editar empresas
  DELETE: 'companies.delete',                 // Eliminar empresas
  MANAGE_USERS: 'companies.manage_users',     // Gestionar usuarios de empresa
  SETTINGS: 'company.settings',               // Configuración de empresa
} as const;

/**
 * Permisos para gestión de máquinas
 */
export const MACHINE_PERMISSIONS = {
  VIEW: 'machines.view',                      // Ver máquinas
  CREATE: 'machines.create',                  // Crear máquinas
  EDIT: 'machines.edit',                      // Editar máquinas
  DELETE: 'machines.delete',                  // Eliminar máquinas
  MAINTAIN: 'machines.maintain',              // Realizar mantenimiento
  ADD_DOCUMENT: 'machines.add_document',      // Agregar documentos
  DELETE_COMPONENT: 'machines.delete_component',  // Eliminar componentes/subcomponentes
} as const;

/**
 * Permisos para gestión de tareas
 */
export const TASK_PERMISSIONS = {
  VIEW: 'tasks.view',                         // Ver tareas
  CREATE: 'tasks.create',                     // Crear tareas
  EDIT: 'tasks.edit',                         // Editar tareas
  DELETE: 'tasks.delete',                     // Eliminar tareas
  ASSIGN: 'tasks.assign',                     // Asignar tareas
  COMPLETE: 'tasks.complete',                 // Completar tareas
  VIEW_ALL: 'tasks.view_all',                 // Ver todas las tareas
} as const;

/**
 * Permisos para tareas fijas
 */
export const FIXED_TASK_PERMISSIONS = {
  CREATE: 'fixed_tasks.create',               // Crear tareas fijas
  EDIT: 'fixed_tasks.edit',                   // Editar tareas fijas
  DELETE: 'fixed_tasks.delete',               // Eliminar tareas fijas
  
  // Permisos específicos de módulos de tareas
  VER_AGENDA: 'ver_agenda',                   // Ver agenda de tareas
  VER_HISTORIAL: 'ver_historial',             // Ver historial de tareas
  VER_ESTADISTICAS: 'ver_estadisticas',       // Ver estadísticas de tareas
} as const;

/**
 * Permisos para órdenes de trabajo
 */
export const WORK_ORDER_PERMISSIONS = {
  VIEW: 'work_orders.view',                   // Ver órdenes de trabajo
  CREATE: 'work_orders.create',               // Crear órdenes de trabajo
  EDIT: 'work_orders.edit',                   // Editar órdenes de trabajo
  DELETE: 'work_orders.delete',               // Eliminar órdenes de trabajo
  ASSIGN: 'work_orders.assign',               // Asignar órdenes de trabajo
  APPROVE: 'work_orders.approve',             // Aprobar órdenes de trabajo
} as const;

/**
 * Permisos para mantenimiento preventivo
 */
export const PREVENTIVE_MAINTENANCE_PERMISSIONS = {
  VIEW: 'preventive_maintenance.view',        // Ver mantenimiento preventivo
  CREATE: 'preventive_maintenance.create',    // Crear mantenimiento preventivo
  EDIT: 'preventive_maintenance.edit',        // Editar mantenimiento preventivo
  DELETE: 'preventive_maintenance.delete',    // Eliminar mantenimiento preventivo
  COMPLETE: 'preventive_maintenance.complete', // Completar mantenimiento preventivo
} as const;

/**
 * Permisos para gestión de herramientas y pañol
 */
export const TOOL_PERMISSIONS = {
  VIEW: 'tools.view',                         // Ver herramientas
  CREATE: 'tools.create',                     // Crear herramientas
  EDIT: 'tools.edit',                         // Editar herramientas
  DELETE: 'tools.delete',                     // Eliminar herramientas
  MANAGE_STOCK: 'tools.manage_stock',         // Gestionar stock
  MANAGE_LOANS: 'tools.manage_loans',         // Gestionar préstamos
  APPROVE_REQUESTS: 'tools.approve_requests', // Aprobar solicitudes
} as const;

/**
 * Permisos específicos del pañol
 */
export const PANOL_PERMISSIONS = {
  VIEW_PRODUCTS: 'panol.view_products',       // Ver productos del pañol
  CREATE_PRODUCT: 'panol.create_product',     // Crear productos del pañol
  EDIT_PRODUCT: 'panol.edit_product',         // Editar productos del pañol
  REGISTER_MOVEMENT: 'panol.register_movement', // Registrar movimientos de stock
} as const;

/**
 * Permisos para gestión de sectores
 */
export const SECTOR_PERMISSIONS = {
  CREATE: 'sectors.create',                   // Crear sectores
  EDIT: 'sectors.edit',                       // Editar sectores
  DELETE: 'sectors.delete',                   // Eliminar sectores
} as const;

// =============================================================================
// PERMISOS DE VENTAS
// =============================================================================

/**
 * Permisos para el módulo de ventas
 */
export const SALES_PERMISSIONS = {
  // Dashboard y general
  VIEW_SALES_DASHBOARD: 'VIEW_SALES_DASHBOARD',              // Ver dashboard de ventas
  VIEW_SALES_REPORTS: 'VIEW_SALES_REPORTS',                  // Ver reportes de ventas
  EXPORT_SALES_DATA: 'EXPORT_SALES_DATA',                    // Exportar datos de ventas
  
  // Clientes
  VIEW_CLIENTS: 'VIEW_CLIENTS',                               // Ver clientes
  CREATE_CLIENT: 'CREATE_CLIENT',                             // Crear clientes
  EDIT_CLIENT: 'EDIT_CLIENT',                                 // Editar clientes
  DELETE_CLIENT: 'DELETE_CLIENT',                             // Eliminar clientes
  
  // Productos
  VIEW_PRODUCTS: 'VIEW_PRODUCTS',                             // Ver productos
  CREATE_PRODUCT: 'CREATE_PRODUCT',                           // Crear productos
  EDIT_PRODUCT: 'EDIT_PRODUCT',                               // Editar productos
  DELETE_PRODUCT: 'DELETE_PRODUCT',                           // Eliminar productos
  
  // Cotizaciones
  VIEW_QUOTES: 'VIEW_QUOTES',                                 // Ver cotizaciones
  CREATE_QUOTE: 'CREATE_QUOTE',                               // Crear cotizaciones
  EDIT_QUOTE: 'EDIT_QUOTE',                                   // Editar cotizaciones
  DELETE_QUOTE: 'DELETE_QUOTE',                               // Eliminar cotizaciones
  APPROVE_QUOTE: 'APPROVE_QUOTE',                             // Aprobar cotizaciones
  CONVERT_QUOTE_TO_SALE: 'CONVERT_QUOTE_TO_SALE',             // Convertir cotización a venta
  
  // Ventas
  VIEW_SALES: 'VIEW_SALES',                                   // Ver ventas
  CREATE_SALE: 'CREATE_SALE',                                 // Crear ventas
  EDIT_SALE: 'EDIT_SALE',                                     // Editar ventas
  DELETE_SALE: 'DELETE_SALE',                                 // Eliminar ventas
  CANCEL_SALE: 'CANCEL_SALE',                                 // Cancelar ventas
} as const;

// =============================================================================
// PERMISOS DE SISTEMA Y ADMINISTRACIÓN
// =============================================================================

/**
 * Permisos administrativos del sistema
 */
export const ADMIN_PERMISSIONS = {
  PERMISSIONS: 'admin.permissions',           // Gestionar permisos del sistema
  ROLES: 'admin.roles',                       // Gestionar roles del sistema
} as const;

/**
 * Permisos para reportes y auditoría
 */
export const REPORTING_PERMISSIONS = {
  VIEW: 'reports.view',                       // Ver reportes
  EXPORT: 'reports.export',                   // Exportar reportes
  ADVANCED: 'reports.advanced',               // Reportes avanzados
  
  AUDIT_VIEW: 'audit.view',                   // Ver auditoría
  AUDIT_EXPORT: 'audit.export',               // Exportar auditoría
} as const;

/**
 * Permisos para configuración del sistema
 */
export const SETTINGS_PERMISSIONS = {
  VIEW: 'settings.view',                      // Ver configuración
  EDIT: 'settings.edit',                      // Editar configuración
  SYSTEM: 'settings.system',                  // Configuración del sistema
} as const;

/**
 * Permisos para notificaciones
 */
export const NOTIFICATION_PERMISSIONS = {
  MANAGE: 'notifications.manage',             // Gestionar notificaciones
  SYSTEM: 'notifications.system',             // Notificaciones del sistema
} as const;

/**
 * Permisos especiales de planta
 */
export const PLANT_PERMISSIONS = {
  STOP: 'plant.stop',                         // Parar planta (funcionalidad crítica)
} as const;

// =============================================================================
// PERMISOS DE ALMACÉN
// =============================================================================

/**
 * Permisos para el módulo de almacén (inventario unificado, despachos, solicitudes)
 */
export const ALMACEN_PERMISSIONS = {
  // Navegación y acceso general
  INGRESAR_ALMACEN: 'ingresar_almacen',                    // Acceso al módulo almacén
  VIEW: 'almacen.view',                                     // Ver módulo almacén
  VIEW_INVENTORY: 'almacen.view_inventory',                 // Ver inventario unificado
  VIEW_COSTS: 'almacen.view_costs',                         // Ver costos (no todos deben verlo)
  VIEW_DASHBOARD: 'almacen.view_dashboard',                 // Ver dashboard de almacén

  // Solicitudes de material
  REQUEST_CREATE: 'almacen.request.create',                 // Crear solicitudes de material
  REQUEST_VIEW: 'almacen.request.view',                     // Ver solicitudes de material
  REQUEST_VIEW_ALL: 'almacen.request.view_all',             // Ver todas las solicitudes (no solo las propias)
  REQUEST_APPROVE: 'almacen.request.approve',               // Aprobar solicitudes (genera reservas)
  REQUEST_REJECT: 'almacen.request.reject',                 // Rechazar solicitudes
  REQUEST_CANCEL: 'almacen.request.cancel',                 // Cancelar solicitudes (libera reservas)
  REQUEST_EDIT: 'almacen.request.edit',                     // Editar solicitudes propias

  // Despachos
  DISPATCH_CREATE: 'almacen.dispatch.create',               // Crear despachos
  DISPATCH_VIEW: 'almacen.dispatch.view',                   // Ver despachos
  DISPATCH_PROCESS: 'almacen.dispatch.process',             // Procesar despachos (picking/preparar)
  DISPATCH_CONFIRM: 'almacen.dispatch.confirm',             // Confirmar entrega de despacho
  DISPATCH_RECEIVE: 'almacen.dispatch.receive',             // Confirmar recepción de despacho
  DISPATCH_CANCEL: 'almacen.dispatch.cancel',               // Cancelar despachos

  // Devoluciones
  RETURN_CREATE: 'almacen.return.create',                   // Crear devoluciones de material
  RETURN_VIEW: 'almacen.return.view',                       // Ver devoluciones
  RETURN_PROCESS: 'almacen.return.process',                 // Procesar devoluciones (aceptar/rechazar)

  // Reservas
  RESERVATION_VIEW: 'almacen.reservation.view',             // Ver reservas
  RESERVATION_CREATE: 'almacen.reservation.create',         // Crear reservas manuales
  RESERVATION_RELEASE: 'almacen.reservation.release',       // Liberar reservas

  // Operaciones de inventario (ya existen en stock pero se replican para scope de almacén)
  TRANSFER: 'almacen.transfer',                             // Transferir entre depósitos
  ADJUST: 'almacen.adjust',                                 // Ajustar inventario
  CYCLE_COUNT: 'almacen.cycle_count',                       // Conteo cíclico

  // Administración
  MANAGE_WAREHOUSES: 'almacen.manage_warehouses',           // Administrar depósitos
  MANAGE_LOCATIONS: 'almacen.manage_locations',             // Administrar ubicaciones físicas
  MANAGE_ALL: 'almacen.manage_all',                         // Superadmin almacén
} as const;

// =============================================================================
// PERMISOS PARA COMPONENTES MÓVILES
// =============================================================================

/**
 * Permisos específicos utilizados en componentes móviles
 */
export const MOBILE_PERMISSIONS = {
  CREATE_TASK: 'CREATE_TASK',                 // Crear tarea (mobile)
  CREATE_FIXED_TASK: 'CREATE_FIXED_TASK',     // Crear tarea fija (mobile)
  VIEW_TASKS: 'VIEW_TASKS',                   // Ver tareas (mobile)
  VIEW_MACHINES: 'VIEW_MACHINES',             // Ver máquinas (mobile)
  VIEW_AGENDA: 'VIEW_AGENDA',                 // Ver agenda (mobile)
  VIEW_USERS: 'VIEW_USERS',                   // Ver usuarios (mobile)
} as const;

// =============================================================================
// EXPORT COMPLETO DE TODOS LOS PERMISOS
// =============================================================================

/**
 * Objeto que contiene TODOS los permisos del sistema organizados por categoría
 */
export const ALL_PERMISSIONS = {
  ...NAVIGATION_PERMISSIONS,
  ...USER_PERMISSIONS,
  ...COMPANY_PERMISSIONS,
  ...MACHINE_PERMISSIONS,
  ...TASK_PERMISSIONS,
  ...FIXED_TASK_PERMISSIONS,
  ...WORK_ORDER_PERMISSIONS,
  ...PREVENTIVE_MAINTENANCE_PERMISSIONS,
  ...TOOL_PERMISSIONS,
  ...PANOL_PERMISSIONS,
  ...SECTOR_PERMISSIONS,
  ...SALES_PERMISSIONS,
  ...ADMIN_PERMISSIONS,
  ...REPORTING_PERMISSIONS,
  ...SETTINGS_PERMISSIONS,
  ...NOTIFICATION_PERMISSIONS,
  ...PLANT_PERMISSIONS,
  ...MOBILE_PERMISSIONS,
  ...ALMACEN_PERMISSIONS,
} as const;

/**
 * Array con todos los valores de permisos únicos para validaciones
 */
export const ALL_PERMISSION_VALUES = Object.values(ALL_PERMISSIONS);

/**
 * Tipo TypeScript que incluye todos los permisos válidos
 */
export type PermissionKey = typeof ALL_PERMISSION_VALUES[number];

// =============================================================================
// UTILIDADES PARA TRABAJAR CON PERMISOS
// =============================================================================

/**
 * Función utilitaria para verificar si un permiso existe
 */
export function isValidPermission(permission: string): permission is PermissionKey {
  return ALL_PERMISSION_VALUES.includes(permission as PermissionKey);
}

/**
 * Función para obtener todos los permisos de una categoría específica
 */
export function getPermissionsByCategory(category: keyof typeof ALL_PERMISSIONS) {
  switch (category) {
    case 'NAVIGATION_PERMISSIONS':
      return Object.values(NAVIGATION_PERMISSIONS);
    case 'USER_PERMISSIONS':
      return Object.values(USER_PERMISSIONS);
    case 'COMPANY_PERMISSIONS':
      return Object.values(COMPANY_PERMISSIONS);
    case 'MACHINE_PERMISSIONS':
      return Object.values(MACHINE_PERMISSIONS);
    case 'TASK_PERMISSIONS':
      return Object.values(TASK_PERMISSIONS);
    case 'FIXED_TASK_PERMISSIONS':
      return Object.values(FIXED_TASK_PERMISSIONS);
    case 'WORK_ORDER_PERMISSIONS':
      return Object.values(WORK_ORDER_PERMISSIONS);
    case 'PREVENTIVE_MAINTENANCE_PERMISSIONS':
      return Object.values(PREVENTIVE_MAINTENANCE_PERMISSIONS);
    case 'TOOL_PERMISSIONS':
      return Object.values(TOOL_PERMISSIONS);
    case 'PANOL_PERMISSIONS':
      return Object.values(PANOL_PERMISSIONS);
    case 'SECTOR_PERMISSIONS':
      return Object.values(SECTOR_PERMISSIONS);
    case 'SALES_PERMISSIONS':
      return Object.values(SALES_PERMISSIONS);
    case 'ADMIN_PERMISSIONS':
      return Object.values(ADMIN_PERMISSIONS);
    case 'REPORTING_PERMISSIONS':
      return Object.values(REPORTING_PERMISSIONS);
    case 'SETTINGS_PERMISSIONS':
      return Object.values(SETTINGS_PERMISSIONS);
    case 'NOTIFICATION_PERMISSIONS':
      return Object.values(NOTIFICATION_PERMISSIONS);
    case 'PLANT_PERMISSIONS':
      return Object.values(PLANT_PERMISSIONS);
    case 'MOBILE_PERMISSIONS':
      return Object.values(MOBILE_PERMISSIONS);
    case 'ALMACEN_PERMISSIONS':
      return Object.values(ALMACEN_PERMISSIONS);
    default:
      return [];
  }
}

/**
 * Función para buscar permisos por patrón
 */
export function findPermissionsByPattern(pattern: RegExp): PermissionKey[] {
  return ALL_PERMISSION_VALUES.filter(permission => pattern.test(permission));
}

// =============================================================================
// DOCUMENTACIÓN DE USO
// =============================================================================

/**
 * CÓMO USAR ESTE ARCHIVO:
 * 
 * 1. Importar permisos específicos:
 *    import { USER_PERMISSIONS, MACHINE_PERMISSIONS } from '@/lib/permissions-centralized';
 * 
 * 2. Usar en componentes:
 *    const { hasPermission } = usePermissionRobust(USER_PERMISSIONS.EDIT);
 * 
 * 3. Validaciones:
 *    if (isValidPermission(somePermission)) { ... }
 * 
 * 4. Obtener todos los permisos:
 *    import { ALL_PERMISSION_VALUES } from '@/lib/permissions-centralized';
 * 
 * NOTAS IMPORTANTES:
 * - Este archivo es la FUENTE ÚNICA DE VERDAD para todos los permisos del frontend
 * - Cualquier nuevo permiso debe agregarse aquí para mantener consistencia
 * - Los permisos están organizados por funcionalidad para facilitar mantenimiento
 * - Se recomienda usar las constantes en lugar de strings literales en el código
 */
