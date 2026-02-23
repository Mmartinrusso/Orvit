/**
 * Catálogo de Módulos - Ventas
 *
 * Define todos los módulos disponibles en el sidebar de Ventas.
 * Cada módulo puede ser habilitado/deshabilitado por empresa y usuario.
 */

export interface SidebarModule {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  path: string;
  permission?: string;
  isCore: boolean; // true = no se puede desactivar
  isNew?: boolean; // badge "NEW"
  category: 'core' | 'optional' | 'advanced' | 'future';
  description?: string;
  order: number;
}

/**
 * Módulos de Ventas
 * Orden define el orden por defecto en el sidebar
 */
export const VENTAS_MODULES: SidebarModule[] = [
  // === CORE MODULES (siempre visibles) ===
  {
    id: 'ventas.dashboard',
    name: 'Dashboard',
    icon: 'LayoutDashboard',
    path: '/administracion/ventas',
    permission: 'VENTAS_VIEW',
    isCore: true,
    category: 'core',
    description: 'Panel principal con KPIs y resumen ejecutivo',
    order: 0,
  },

  // === CICLO O2C (Order-to-Cash) ===
  {
    id: 'ventas.cotizaciones',
    name: 'Cotizaciones',
    icon: 'FileText',
    path: '/administracion/ventas/cotizaciones',
    permission: 'COTIZACIONES_VIEW',
    isCore: true,
    category: 'core',
    description: 'Gestión de cotizaciones y presupuestos',
    order: 10,
  },
  {
    id: 'ventas.ordenes',
    name: 'Órdenes de Venta',
    icon: 'Package',
    path: '/administracion/ventas/ordenes',
    permission: 'ORDENES_VIEW',
    isCore: true,
    category: 'core',
    description: 'Órdenes de venta confirmadas',
    order: 20,
  },
  {
    id: 'ventas.entregas',
    name: 'Entregas',
    icon: 'Truck',
    path: '/administracion/ventas/entregas',
    permission: 'ENTREGAS_VIEW',
    isCore: true,
    category: 'core',
    description: 'Gestión de entregas y remitos',
    order: 30,
  },
  {
    id: 'ventas.facturas',
    name: 'Facturas',
    icon: 'FileText',
    path: '/administracion/ventas/facturas',
    permission: 'FACTURAS_VIEW',
    isCore: true,
    category: 'core',
    description: 'Facturación y comprobantes',
    order: 40,
  },

  // === OPTIONAL MODULES (pueden desactivarse) ===
  {
    id: 'ventas.ordenes-carga',
    name: 'Órdenes de Carga',
    icon: 'TruckIcon',
    path: '/administracion/ventas/ordenes-carga',
    permission: 'ENTREGAS_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Planificación de rutas y cargas',
    order: 35,
  },
  {
    id: 'ventas.turnos',
    name: 'Turnos de Retiro',
    icon: 'Calendar',
    path: '/administracion/ventas/turnos',
    permission: 'ENTREGAS_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Gestión de turnos para retiro en local',
    order: 36,
  },

  // === CUENTAS POR COBRAR ===
  {
    id: 'ventas.cobranzas',
    name: 'Cobranzas',
    icon: 'DollarSign',
    path: '/administracion/ventas/cobranzas',
    permission: 'COBRANZAS_VIEW',
    isCore: true,
    category: 'core',
    description: 'Recibos y registro de pagos',
    order: 50,
  },
  {
    id: 'ventas.cuenta-corriente',
    name: 'Cuenta Corriente',
    icon: 'FileSpreadsheet',
    path: '/administracion/ventas/cuenta-corriente',
    permission: 'CLIENTES_CREDIT_VIEW',
    isCore: true,
    category: 'core',
    description: 'Estado de cuenta por cliente con ML',
    order: 60,
  },

  // === POSTVENTA (nuevos módulos) ===
  {
    id: 'ventas.notas-credito',
    name: 'Notas de Crédito',
    icon: 'FileDown',
    path: '/administracion/ventas/notas-credito',
    permission: 'FACTURAS_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Notas de crédito y débito',
    order: 65,
  },
  {
    id: 'ventas.postventa',
    name: 'Postventa',
    icon: 'RefreshCw',
    path: '/administracion/ventas/postventa',
    permission: 'ENTREGAS_VIEW',
    isCore: false,
    category: 'future',
    description: 'Devoluciones, RMA y garantías',
    order: 70,
    isNew: true,
  },

  // === MAESTROS ===
  {
    id: 'ventas.clientes',
    name: 'Clientes',
    icon: 'Users',
    path: '/administracion/ventas/clientes',
    permission: 'CLIENTES_VIEW',
    isCore: true,
    category: 'core',
    description: 'Gestión de clientes',
    order: 100,
  },
  {
    id: 'ventas.productos',
    name: 'Productos',
    icon: 'Package',
    path: '/administracion/ventas/productos',
    permission: 'PRODUCTOS_VIEW',
    isCore: true,
    category: 'core',
    description: 'Catálogo de productos',
    order: 110,
  },
  {
    id: 'ventas.listas-precios',
    name: 'Listas de Precios',
    icon: 'DollarSign',
    path: '/administracion/ventas/listas-precios',
    permission: 'PRODUCTOS_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Gestión de precios por lista',
    order: 120,
  },

  // === GESTIÓN COMERCIAL ===
  {
    id: 'ventas.metas',
    name: 'Metas y Objetivos',
    icon: 'Target',
    path: '/administracion/ventas/metas',
    permission: 'VENTAS_VIEW',
    isCore: false,
    category: 'future',
    description: 'Metas de venta y seguimiento',
    order: 130,
    isNew: true,
  },

  // === REPORTES Y ANÁLISIS ===
  {
    id: 'ventas.reportes',
    name: 'Reportes',
    icon: 'BarChart3',
    path: '/administracion/ventas/reportes',
    permission: 'VENTAS_VIEW',
    isCore: true,
    category: 'core',
    description: 'Reportes y análisis avanzados',
    order: 200,
  },

  // === NOTAS DE PEDIDO ===
  {
    id: 'ventas.notas-pedido',
    name: 'Notas de Pedido',
    icon: 'ClipboardList',
    path: '/administracion/ventas/cotizaciones?tipo=nota_pedido',
    permission: 'COTIZACIONES_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Pedidos de clientes',
    order: 15,
  },

  // === MAESTROS ADICIONALES ===
  {
    id: 'ventas.zonas',
    name: 'Zonas de Venta',
    icon: 'MapPin',
    path: '/administracion/ventas/zonas',
    permission: 'VENTAS_CONFIG',
    isCore: false,
    category: 'optional',
    description: 'Territorios y zonas comerciales',
    order: 115,
  },
  {
    id: 'ventas.condiciones-pago',
    name: 'Condiciones de Pago',
    icon: 'Calendar',
    path: '/administracion/ventas/condiciones-pago',
    permission: 'VENTAS_CONFIG',
    isCore: false,
    category: 'optional',
    description: 'Términos y condiciones de pago',
    order: 116,
  },

  // === EQUIPO COMERCIAL ===
  {
    id: 'ventas.vendedores',
    name: 'Vendedores',
    icon: 'Users',
    path: '/administracion/ventas/vendedores',
    permission: 'VENTAS_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Equipo de ventas',
    order: 120,
  },
  {
    id: 'ventas.liquidaciones',
    name: 'Liquidaciones',
    icon: 'Receipt',
    path: '/administracion/ventas/liquidaciones',
    permission: 'VENTAS_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Comisiones de vendedores',
    order: 125,
  },

  // === LOGÍSTICA ===
  {
    id: 'ventas.entregas-rutas',
    name: 'Planificación de Rutas',
    icon: 'Route',
    path: '/administracion/ventas/entregas/rutas',
    permission: 'ENTREGAS_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Optimizar rutas de entrega',
    order: 32,
  },

  // === FACTURACIÓN ADICIONAL ===
  {
    id: 'ventas.comprobantes',
    name: 'Comprobantes',
    icon: 'FileCheck',
    path: '/administracion/ventas/comprobantes',
    permission: 'FACTURAS_VIEW',
    isCore: true,
    category: 'core',
    description: 'Facturas, NC y ND unificados',
    order: 42,
  },
  {
    id: 'ventas.aprobacion-pagos',
    name: 'Aprobación de Pagos',
    icon: 'ClipboardCheck',
    path: '/administracion/ventas/aprobacion-pagos',
    permission: 'COBRANZAS_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Aprobación de cobros',
    order: 52,
  },
  {
    id: 'ventas.valores',
    name: 'Gestión de Valores',
    icon: 'CreditCard',
    path: '/administracion/ventas/valores',
    permission: 'COBRANZAS_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Cheques y echeqs',
    order: 54,
  },
  {
    id: 'ventas.disputas',
    name: 'Disputas',
    icon: 'AlertTriangle',
    path: '/administracion/ventas/disputas',
    permission: 'CLIENTES_CREDIT_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Reclamos de clientes',
    order: 62,
  },
  {
    id: 'ventas.alertas',
    name: 'Alertas de Riesgo',
    icon: 'AlertCircle',
    path: '/administracion/ventas/alertas',
    permission: 'CLIENTES_CREDIT_VIEW',
    isCore: false,
    category: 'optional',
    description: 'Alertas crediticias',
    order: 64,
  },

  // === CONFIGURACIÓN ===
  {
    id: 'ventas.configuracion',
    name: 'Configuración',
    icon: 'Settings',
    path: '/administracion/ventas/configuracion',
    permission: 'VENTAS_CONFIG',
    isCore: true,
    category: 'core',
    description: 'Configuración del módulo',
    order: 900,
  },
];

/**
 * Get modules by category
 */
export function getModulesByCategory(category: SidebarModule['category']): SidebarModule[] {
  return VENTAS_MODULES.filter(m => m.category === category);
}

/**
 * Get core modules (cannot be disabled)
 */
export function getCoreModules(): SidebarModule[] {
  return VENTAS_MODULES.filter(m => m.isCore);
}

/**
 * Get optional modules (can be disabled)
 */
export function getOptionalModules(): SidebarModule[] {
  return VENTAS_MODULES.filter(m => !m.isCore);
}

/**
 * Get module by id
 */
export function getModuleById(id: string): SidebarModule | undefined {
  return VENTAS_MODULES.find(m => m.id === id);
}

/**
 * Get default user preferences (all modules visible except future ones)
 */
export function getDefaultUserPreferences() {
  return {
    ventas: {
      visible: VENTAS_MODULES
        .filter(m => m.category !== 'future')
        .map(m => m.id),
      pinned: ['ventas.dashboard'], // Solo dashboard pinned por defecto
      order: VENTAS_MODULES.map(m => m.id), // Orden por defecto
      collapsed: [], // Ninguno colapsado por defecto
    }
  };
}

/**
 * Module categories metadata
 */
export const MODULE_CATEGORIES = {
  core: {
    label: 'Módulos Principales',
    description: 'Módulos esenciales del ciclo de ventas',
    color: 'blue',
  },
  optional: {
    label: 'Módulos Opcionales',
    description: 'Módulos adicionales según necesidad',
    color: 'gray',
  },
  advanced: {
    label: 'Módulos Avanzados',
    description: 'Funcionalidades avanzadas',
    color: 'purple',
  },
  future: {
    label: 'Nuevos Módulos',
    description: 'Módulos en desarrollo o recién agregados',
    color: 'green',
  },
} as const;
