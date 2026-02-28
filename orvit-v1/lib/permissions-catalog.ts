// Catálogo completo de permisos con metadata bilingüe
// Fuente de verdad para descripciones, categorías y tags semánticos

export interface PermissionMeta {
  es: string;       // Descripción en español
  en: string;       // Descripción en inglés
  category: string; // Categoría para agrupación
  tags: string[];   // Tags semánticos para búsqueda IA
}

// Nombres de categoría en español para la UI
export const CATEGORY_LABELS: Record<string, { es: string; en: string }> = {
  usuarios: { es: 'Usuarios', en: 'Users' },
  empresas: { es: 'Empresas', en: 'Companies' },
  maquinas: { es: 'Máquinas', en: 'Machines' },
  tareas: { es: 'Tareas', en: 'Tasks' },
  tareas_fijas: { es: 'Tareas Fijas', en: 'Fixed Tasks' },
  ordenes_trabajo: { es: 'Órdenes de Trabajo', en: 'Work Orders' },
  mantenimiento_preventivo: { es: 'Mantenimiento Preventivo', en: 'Preventive Maintenance' },
  panol: { es: 'Pañol / Herramientas', en: 'Tool Room / Inventory' },
  reportes: { es: 'Reportes', en: 'Reports' },
  configuracion: { es: 'Configuración', en: 'Settings' },
  auditoria: { es: 'Auditoría', en: 'Audit' },
  notificaciones: { es: 'Notificaciones', en: 'Notifications' },
  admin: { es: 'Administración del Sistema', en: 'System Administration' },
  navegacion: { es: 'Navegación / Acceso a Módulos', en: 'Navigation / Module Access' },
  sectores: { es: 'Sectores', en: 'Sectors' },
  planta: { es: 'Planta', en: 'Plant' },
  controles: { es: 'Controles', en: 'Controls' },
  ventas_legacy: { es: 'Ventas (Legacy)', en: 'Sales (Legacy)' },
  ventas: { es: 'Ventas', en: 'Sales' },
  ventas_clientes: { es: 'Ventas - Clientes', en: 'Sales - Clients' },
  ventas_vendedores: { es: 'Ventas - Vendedores', en: 'Sales - Sellers' },
  ventas_liquidaciones: { es: 'Ventas - Liquidaciones', en: 'Sales - Settlements' },
  ventas_cotizaciones: { es: 'Ventas - Cotizaciones', en: 'Sales - Quotations' },
  ventas_ordenes: { es: 'Ventas - Órdenes', en: 'Sales - Orders' },
  ventas_entregas: { es: 'Ventas - Entregas', en: 'Sales - Deliveries' },
  ventas_remitos: { es: 'Ventas - Remitos', en: 'Sales - Packing Slips' },
  ventas_facturas: { es: 'Ventas - Facturas', en: 'Sales - Invoices' },
  ventas_notas: { es: 'Ventas - Notas de Crédito/Débito', en: 'Sales - Credit/Debit Notes' },
  ventas_pagos: { es: 'Ventas - Pagos y Cobranzas', en: 'Sales - Payments & Collections' },
  ventas_cuenta_corriente: { es: 'Ventas - Cuenta Corriente', en: 'Sales - Current Account' },
  ventas_precios: { es: 'Ventas - Listas de Precios', en: 'Sales - Price Lists' },
  ventas_descuentos: { es: 'Ventas - Descuentos', en: 'Sales - Discounts' },
  ventas_margenes: { es: 'Ventas - Márgenes y Costos', en: 'Sales - Margins & Costs' },
  ventas_comisiones: { es: 'Ventas - Comisiones', en: 'Sales - Commissions' },
  ventas_aprobaciones: { es: 'Ventas - Aprobaciones', en: 'Sales - Approvals' },
  ventas_reportes: { es: 'Ventas - Reportes', en: 'Sales - Reports' },
  ventas_portal: { es: 'Ventas - Portal Cliente', en: 'Sales - Client Portal' },
  ventas_config: { es: 'Ventas - Configuración', en: 'Sales - Configuration' },
  ventas_auditoria: { es: 'Ventas - Auditoría', en: 'Sales - Audit' },
  ventas_fiscal: { es: 'Ventas - FiscalScope', en: 'Sales - FiscalScope' },
  cargas: { es: 'Cargas', en: 'Loads' },
  preferencias: { es: 'Preferencias del Sistema', en: 'System Preferences' },
  tesoreria: { es: 'Tesorería', en: 'Treasury' },
  compras_pedidos: { es: 'Compras - Pedidos', en: 'Purchases - Orders' },
  compras_cotizaciones: { es: 'Compras - Cotizaciones', en: 'Purchases - Quotations' },
  ptw: { es: 'Permiso de Trabajo (PTW)', en: 'Permit to Work (PTW)' },
  loto: { es: 'Bloqueo/Etiquetado (LOTO)', en: 'Lockout/Tagout (LOTO)' },
  skills: { es: 'Habilidades y Certificaciones', en: 'Skills & Certifications' },
  contadores: { es: 'Contadores de Máquinas', en: 'Machine Counters' },
  qr: { es: 'Códigos QR', en: 'QR Codes' },
  moc: { es: 'Gestión del Cambio (MOC)', en: 'Management of Change (MOC)' },
  calibracion: { es: 'Calibración', en: 'Calibration' },
  lubricacion: { es: 'Lubricación', en: 'Lubrication' },
  contratistas: { es: 'Contratistas', en: 'Contractors' },
  monitoreo: { es: 'Monitoreo de Condición', en: 'Condition Monitoring' },
  conocimiento: { es: 'Base de Conocimiento', en: 'Knowledge Base' },
  produccion: { es: 'Producción', en: 'Production' },
  produccion_ordenes: { es: 'Producción - Órdenes', en: 'Production - Orders' },
  produccion_partes: { es: 'Producción - Partes Diarios', en: 'Production - Daily Reports' },
  produccion_paradas: { es: 'Producción - Paradas', en: 'Production - Downtimes' },
  produccion_calidad: { es: 'Producción - Calidad', en: 'Production - Quality' },
  produccion_defectos: { es: 'Producción - Defectos', en: 'Production - Defects' },
  produccion_rutinas: { es: 'Producción - Rutinas', en: 'Production - Routines' },
  produccion_config: { es: 'Producción - Configuración', en: 'Production - Configuration' },
  produccion_reportes: { es: 'Producción - Reportes', en: 'Production - Reports' },
  almacen: { es: 'Almacén', en: 'Warehouse' },
  almacen_solicitudes: { es: 'Almacén - Solicitudes', en: 'Warehouse - Requests' },
  almacen_despachos: { es: 'Almacén - Despachos', en: 'Warehouse - Dispatches' },
  almacen_devoluciones: { es: 'Almacén - Devoluciones', en: 'Warehouse - Returns' },
  almacen_reservas: { es: 'Almacén - Reservas', en: 'Warehouse - Reservations' },
  almacen_operaciones: { es: 'Almacén - Operaciones', en: 'Warehouse - Operations' },
  almacen_admin: { es: 'Almacén - Administración', en: 'Warehouse - Administration' },
};

export const PERMISSION_CATALOG: Record<string, PermissionMeta> = {
  // ═══════════════════════════════════════════════════════
  // USUARIOS
  // ═══════════════════════════════════════════════════════
  'users.view': {
    es: 'Ver listado de usuarios',
    en: 'View user list',
    category: 'usuarios',
    tags: ['lectura', 'usuarios', 'listado'],
  },
  'users.create': {
    es: 'Crear nuevos usuarios',
    en: 'Create new users',
    category: 'usuarios',
    tags: ['escritura', 'usuarios', 'crear'],
  },
  'users.edit': {
    es: 'Editar datos de usuarios',
    en: 'Edit user data',
    category: 'usuarios',
    tags: ['escritura', 'usuarios', 'editar'],
  },
  'users.delete': {
    es: 'Eliminar usuarios',
    en: 'Delete users',
    category: 'usuarios',
    tags: ['escritura', 'usuarios', 'eliminar', 'destructivo'],
  },
  'users.edit_role': {
    es: 'Cambiar el rol de un usuario',
    en: 'Change a user\'s role',
    category: 'usuarios',
    tags: ['escritura', 'usuarios', 'roles', 'editar'],
  },
  'users.activate_deactivate': {
    es: 'Activar o desactivar usuarios',
    en: 'Activate or deactivate users',
    category: 'usuarios',
    tags: ['escritura', 'usuarios', 'estado'],
  },
  'users.view_all_companies': {
    es: 'Ver usuarios de todas las empresas',
    en: 'View users across all companies',
    category: 'usuarios',
    tags: ['lectura', 'usuarios', 'empresas', 'global'],
  },
  'gestionar_usuarios': {
    es: 'Acceso a la gestión completa de usuarios',
    en: 'Access to full user management',
    category: 'usuarios',
    tags: ['navegacion', 'usuarios', 'gestion'],
  },

  // ═══════════════════════════════════════════════════════
  // EMPRESAS
  // ═══════════════════════════════════════════════════════
  'companies.view': {
    es: 'Ver información de empresas',
    en: 'View company information',
    category: 'empresas',
    tags: ['lectura', 'empresas'],
  },
  'companies.create': {
    es: 'Crear nuevas empresas',
    en: 'Create new companies',
    category: 'empresas',
    tags: ['escritura', 'empresas', 'crear'],
  },
  'companies.edit': {
    es: 'Editar datos de empresas',
    en: 'Edit company data',
    category: 'empresas',
    tags: ['escritura', 'empresas', 'editar'],
  },
  'companies.delete': {
    es: 'Eliminar empresas',
    en: 'Delete companies',
    category: 'empresas',
    tags: ['escritura', 'empresas', 'eliminar', 'destructivo'],
  },
  'companies.manage_users': {
    es: 'Gestionar usuarios dentro de una empresa',
    en: 'Manage users within a company',
    category: 'empresas',
    tags: ['escritura', 'empresas', 'usuarios', 'gestion'],
  },

  // ═══════════════════════════════════════════════════════
  // MÁQUINAS
  // ═══════════════════════════════════════════════════════
  'machines.view': {
    es: 'Ver listado y detalle de máquinas',
    en: 'View machine list and details',
    category: 'maquinas',
    tags: ['lectura', 'maquinas', 'activos'],
  },
  'machines.create': {
    es: 'Crear nuevas máquinas',
    en: 'Create new machines',
    category: 'maquinas',
    tags: ['escritura', 'maquinas', 'crear'],
  },
  'machines.edit': {
    es: 'Editar información de máquinas',
    en: 'Edit machine information',
    category: 'maquinas',
    tags: ['escritura', 'maquinas', 'editar'],
  },
  'machines.delete': {
    es: 'Eliminar máquinas',
    en: 'Delete machines',
    category: 'maquinas',
    tags: ['escritura', 'maquinas', 'eliminar', 'destructivo'],
  },
  'machines.maintain': {
    es: 'Realizar mantenimiento en máquinas',
    en: 'Perform maintenance on machines',
    category: 'maquinas',
    tags: ['escritura', 'maquinas', 'mantenimiento'],
  },
  'machines.add_document': {
    es: 'Agregar documentos a máquinas',
    en: 'Add documents to machines',
    category: 'maquinas',
    tags: ['escritura', 'maquinas', 'documentos'],
  },
  'machines.delete_component': {
    es: 'Eliminar componentes de máquinas',
    en: 'Delete machine components',
    category: 'maquinas',
    tags: ['escritura', 'maquinas', 'componentes', 'eliminar'],
  },
  'machines.promote_component': {
    es: 'Promover un componente a máquina independiente',
    en: 'Promote a component to standalone machine',
    category: 'maquinas',
    tags: ['escritura', 'maquinas', 'componentes'],
  },
  'machines.disassemble': {
    es: 'Desmontar máquinas (separar componentes)',
    en: 'Disassemble machines (separate components)',
    category: 'maquinas',
    tags: ['escritura', 'maquinas', 'componentes', 'desmontar'],
  },

  // ═══════════════════════════════════════════════════════
  // TAREAS
  // ═══════════════════════════════════════════════════════
  'ingresar_tareas': {
    es: 'Acceder al módulo de tareas',
    en: 'Access the tasks module',
    category: 'navegacion',
    tags: ['navegacion', 'tareas'],
  },
  'tasks.create': {
    es: 'Crear tareas',
    en: 'Create tasks',
    category: 'tareas',
    tags: ['escritura', 'tareas', 'crear'],
  },
  'tasks.edit': {
    es: 'Editar tareas',
    en: 'Edit tasks',
    category: 'tareas',
    tags: ['escritura', 'tareas', 'editar'],
  },
  'tasks.delete': {
    es: 'Eliminar tareas',
    en: 'Delete tasks',
    category: 'tareas',
    tags: ['escritura', 'tareas', 'eliminar', 'destructivo'],
  },
  'tasks.assign': {
    es: 'Asignar tareas a usuarios',
    en: 'Assign tasks to users',
    category: 'tareas',
    tags: ['escritura', 'tareas', 'asignar'],
  },
  'tasks.complete': {
    es: 'Completar tareas',
    en: 'Complete tasks',
    category: 'tareas',
    tags: ['escritura', 'tareas', 'completar', 'workflow'],
  },
  'tasks.view_all': {
    es: 'Ver todas las tareas (no solo las propias)',
    en: 'View all tasks (not just own)',
    category: 'tareas',
    tags: ['lectura', 'tareas', 'global'],
  },

  // ═══════════════════════════════════════════════════════
  // ÓRDENES DE TRABAJO
  // ═══════════════════════════════════════════════════════
  'work_orders.view': {
    es: 'Ver órdenes de trabajo',
    en: 'View work orders',
    category: 'ordenes_trabajo',
    tags: ['lectura', 'ordenes', 'mantenimiento'],
  },
  'work_orders.create': {
    es: 'Crear órdenes de trabajo',
    en: 'Create work orders',
    category: 'ordenes_trabajo',
    tags: ['escritura', 'ordenes', 'crear', 'mantenimiento'],
  },
  'work_orders.edit': {
    es: 'Editar órdenes de trabajo',
    en: 'Edit work orders',
    category: 'ordenes_trabajo',
    tags: ['escritura', 'ordenes', 'editar', 'mantenimiento'],
  },
  'work_orders.delete': {
    es: 'Eliminar órdenes de trabajo',
    en: 'Delete work orders',
    category: 'ordenes_trabajo',
    tags: ['escritura', 'ordenes', 'eliminar', 'destructivo', 'mantenimiento'],
  },
  'work_orders.assign': {
    es: 'Asignar órdenes de trabajo a técnicos',
    en: 'Assign work orders to technicians',
    category: 'ordenes_trabajo',
    tags: ['escritura', 'ordenes', 'asignar', 'mantenimiento'],
  },
  'work_orders.approve': {
    es: 'Aprobar órdenes de trabajo',
    en: 'Approve work orders',
    category: 'ordenes_trabajo',
    tags: ['escritura', 'ordenes', 'aprobar', 'workflow', 'mantenimiento'],
  },

  // ═══════════════════════════════════════════════════════
  // MANTENIMIENTO PREVENTIVO
  // ═══════════════════════════════════════════════════════
  'preventive_maintenance.view': {
    es: 'Ver planes de mantenimiento preventivo',
    en: 'View preventive maintenance plans',
    category: 'mantenimiento_preventivo',
    tags: ['lectura', 'preventivo', 'mantenimiento', 'planificacion'],
  },
  'preventive_maintenance.create': {
    es: 'Crear planes de mantenimiento preventivo',
    en: 'Create preventive maintenance plans',
    category: 'mantenimiento_preventivo',
    tags: ['escritura', 'preventivo', 'crear', 'mantenimiento', 'planificacion'],
  },
  'preventive_maintenance.edit': {
    es: 'Editar planes de mantenimiento preventivo',
    en: 'Edit preventive maintenance plans',
    category: 'mantenimiento_preventivo',
    tags: ['escritura', 'preventivo', 'editar', 'mantenimiento'],
  },
  'preventive_maintenance.delete': {
    es: 'Eliminar planes de mantenimiento preventivo',
    en: 'Delete preventive maintenance plans',
    category: 'mantenimiento_preventivo',
    tags: ['escritura', 'preventivo', 'eliminar', 'destructivo', 'mantenimiento'],
  },
  'preventive_maintenance.complete': {
    es: 'Completar actividades de mantenimiento preventivo',
    en: 'Complete preventive maintenance activities',
    category: 'mantenimiento_preventivo',
    tags: ['escritura', 'preventivo', 'completar', 'workflow', 'mantenimiento'],
  },

  // ═══════════════════════════════════════════════════════
  // PAÑOL / HERRAMIENTAS
  // ═══════════════════════════════════════════════════════
  'tools.view': {
    es: 'Ver herramientas e inventario',
    en: 'View tools and inventory',
    category: 'panol',
    tags: ['lectura', 'panol', 'herramientas', 'inventario'],
  },
  'tools.create': {
    es: 'Crear herramientas en el catálogo',
    en: 'Create tools in catalog',
    category: 'panol',
    tags: ['escritura', 'panol', 'herramientas', 'crear'],
  },
  'tools.edit': {
    es: 'Editar herramientas',
    en: 'Edit tools',
    category: 'panol',
    tags: ['escritura', 'panol', 'herramientas', 'editar'],
  },
  'tools.delete': {
    es: 'Eliminar herramientas',
    en: 'Delete tools',
    category: 'panol',
    tags: ['escritura', 'panol', 'herramientas', 'eliminar', 'destructivo'],
  },
  'tools.manage_stock': {
    es: 'Gestionar stock de herramientas',
    en: 'Manage tool stock levels',
    category: 'panol',
    tags: ['escritura', 'panol', 'stock', 'inventario'],
  },
  'tools.manage_loans': {
    es: 'Gestionar préstamos de herramientas',
    en: 'Manage tool loans',
    category: 'panol',
    tags: ['escritura', 'panol', 'prestamos'],
  },
  'tools.approve_requests': {
    es: 'Aprobar solicitudes de herramientas',
    en: 'Approve tool requests',
    category: 'panol',
    tags: ['escritura', 'panol', 'aprobar', 'workflow'],
  },
  'panol.view_products': {
    es: 'Ver productos del pañol',
    en: 'View tool room products',
    category: 'panol',
    tags: ['lectura', 'panol', 'productos'],
  },
  'panol.create_product': {
    es: 'Crear productos en el pañol',
    en: 'Create tool room products',
    category: 'panol',
    tags: ['escritura', 'panol', 'productos', 'crear'],
  },
  'panol.edit_product': {
    es: 'Editar productos del pañol',
    en: 'Edit tool room products',
    category: 'panol',
    tags: ['escritura', 'panol', 'productos', 'editar'],
  },
  'panol.register_movement': {
    es: 'Registrar movimientos de stock (entradas y salidas)',
    en: 'Register stock movements (in and out)',
    category: 'panol',
    tags: ['escritura', 'panol', 'movimientos', 'stock'],
  },
  'panol.view_costs': {
    es: 'Ver costos de productos del pañol',
    en: 'View tool room product costs',
    category: 'panol',
    tags: ['lectura', 'panol', 'costos'],
  },
  'panol.delete_product': {
    es: 'Eliminar productos del pañol',
    en: 'Delete tool room products',
    category: 'panol',
    tags: ['escritura', 'panol', 'productos', 'eliminar'],
  },

  // ═══════════════════════════════════════════════════════
  // REPORTES
  // ═══════════════════════════════════════════════════════
  'reports.view': {
    es: 'Ver reportes',
    en: 'View reports',
    category: 'reportes',
    tags: ['lectura', 'reportes'],
  },
  'reports.export': {
    es: 'Exportar reportes a Excel/PDF',
    en: 'Export reports to Excel/PDF',
    category: 'reportes',
    tags: ['lectura', 'reportes', 'exportar'],
  },
  'reports.advanced': {
    es: 'Acceder a reportes avanzados y análisis',
    en: 'Access advanced reports and analytics',
    category: 'reportes',
    tags: ['lectura', 'reportes', 'avanzado', 'analytics'],
  },

  // ═══════════════════════════════════════════════════════
  // CONFIGURACIÓN
  // ═══════════════════════════════════════════════════════
  'settings.view': {
    es: 'Ver configuración del sistema',
    en: 'View system settings',
    category: 'configuracion',
    tags: ['lectura', 'configuracion'],
  },
  'settings.edit': {
    es: 'Editar configuración del sistema',
    en: 'Edit system settings',
    category: 'configuracion',
    tags: ['escritura', 'configuracion', 'editar'],
  },
  'settings.system': {
    es: 'Configuración avanzada del sistema',
    en: 'Advanced system configuration',
    category: 'configuracion',
    tags: ['escritura', 'configuracion', 'sistema', 'avanzado'],
  },

  // ═══════════════════════════════════════════════════════
  // AUDITORÍA
  // ═══════════════════════════════════════════════════════
  'audit.view': {
    es: 'Ver registros de auditoría',
    en: 'View audit logs',
    category: 'auditoria',
    tags: ['lectura', 'auditoria', 'seguridad'],
  },
  'audit.export': {
    es: 'Exportar registros de auditoría',
    en: 'Export audit logs',
    category: 'auditoria',
    tags: ['lectura', 'auditoria', 'exportar'],
  },

  // ═══════════════════════════════════════════════════════
  // NOTIFICACIONES
  // ═══════════════════════════════════════════════════════
  'notifications.manage': {
    es: 'Gestionar notificaciones',
    en: 'Manage notifications',
    category: 'notificaciones',
    tags: ['escritura', 'notificaciones', 'gestion'],
  },
  'notifications.system': {
    es: 'Enviar notificaciones del sistema',
    en: 'Send system notifications',
    category: 'notificaciones',
    tags: ['escritura', 'notificaciones', 'sistema'],
  },

  // ═══════════════════════════════════════════════════════
  // ADMINISTRACIÓN
  // ═══════════════════════════════════════════════════════
  'admin.permissions': {
    es: 'Gestionar permisos del sistema',
    en: 'Manage system permissions',
    category: 'admin',
    tags: ['escritura', 'admin', 'permisos', 'seguridad'],
  },
  'admin.roles': {
    es: 'Gestionar roles del sistema',
    en: 'Manage system roles',
    category: 'admin',
    tags: ['escritura', 'admin', 'roles', 'seguridad'],
  },

  // ═══════════════════════════════════════════════════════
  // TAREAS FIJAS
  // ═══════════════════════════════════════════════════════
  'fixed_tasks.create': {
    es: 'Crear tareas fijas recurrentes',
    en: 'Create recurring fixed tasks',
    category: 'tareas_fijas',
    tags: ['escritura', 'tareas_fijas', 'crear', 'planificacion'],
  },
  'fixed_tasks.edit': {
    es: 'Editar tareas fijas',
    en: 'Edit fixed tasks',
    category: 'tareas_fijas',
    tags: ['escritura', 'tareas_fijas', 'editar'],
  },
  'fixed_tasks.delete': {
    es: 'Eliminar tareas fijas',
    en: 'Delete fixed tasks',
    category: 'tareas_fijas',
    tags: ['escritura', 'tareas_fijas', 'eliminar', 'destructivo'],
  },
  'ver_agenda': {
    es: 'Ver la agenda personal y de tareas',
    en: 'View personal agenda and tasks',
    category: 'tareas_fijas',
    tags: ['lectura', 'agenda', 'tareas'],
  },
  'ver_historial': {
    es: 'Ver historial de tareas y actividades',
    en: 'View task and activity history',
    category: 'tareas_fijas',
    tags: ['lectura', 'historial', 'tareas'],
  },
  'ver_estadisticas': {
    es: 'Ver estadísticas de tareas y rendimiento',
    en: 'View task and performance statistics',
    category: 'tareas_fijas',
    tags: ['lectura', 'estadisticas', 'tareas', 'analytics'],
  },

  // ═══════════════════════════════════════════════════════
  // PLANTA
  // ═══════════════════════════════════════════════════════
  'plant.stop': {
    es: 'Detener la planta (parada de emergencia)',
    en: 'Stop the plant (emergency shutdown)',
    category: 'planta',
    tags: ['escritura', 'planta', 'emergencia', 'critico'],
  },

  // ═══════════════════════════════════════════════════════
  // NAVEGACIÓN
  // ═══════════════════════════════════════════════════════
  'ingresar_ordenesdetrabajo': {
    es: 'Acceder al módulo de órdenes de trabajo',
    en: 'Access work orders module',
    category: 'navegacion',
    tags: ['navegacion', 'ordenes', 'mantenimiento'],
  },
  'ingresar_planificacion': {
    es: 'Acceder al módulo de planificación',
    en: 'Access planning module',
    category: 'navegacion',
    tags: ['navegacion', 'planificacion', 'mantenimiento'],
  },
  'ingresar_maquinas_mantenimiento': {
    es: 'Acceder a máquinas desde mantenimiento',
    en: 'Access machines from maintenance',
    category: 'navegacion',
    tags: ['navegacion', 'maquinas', 'mantenimiento'],
  },
  'ingresar_panol': {
    es: 'Acceder al módulo de pañol',
    en: 'Access tool room module',
    category: 'navegacion',
    tags: ['navegacion', 'panol'],
  },
  'ingresar_historial_mantenimiento': {
    es: 'Acceder al historial de mantenimiento',
    en: 'Access maintenance history',
    category: 'navegacion',
    tags: ['navegacion', 'historial', 'mantenimiento'],
  },
  'ingresar_dashboard_administracion': {
    es: 'Acceder al dashboard de administración',
    en: 'Access administration dashboard',
    category: 'navegacion',
    tags: ['navegacion', 'dashboard', 'administracion'],
  },
  'ingresar_permisos': {
    es: 'Acceder al módulo de permisos y roles',
    en: 'Access permissions and roles module',
    category: 'navegacion',
    tags: ['navegacion', 'permisos', 'admin'],
  },
  'ingresar_usuarios': {
    es: 'Acceder al módulo de usuarios',
    en: 'Access users module',
    category: 'navegacion',
    tags: ['navegacion', 'usuarios'],
  },
  'ingresar_reportes': {
    es: 'Acceder al módulo de reportes',
    en: 'Access reports module',
    category: 'navegacion',
    tags: ['navegacion', 'reportes'],
  },
  'ingresar_configuracion': {
    es: 'Acceder al módulo de configuración',
    en: 'Access settings module',
    category: 'navegacion',
    tags: ['navegacion', 'configuracion'],
  },
  'ingresar_controles': {
    es: 'Acceder al módulo de controles',
    en: 'Access controls module',
    category: 'navegacion',
    tags: ['navegacion', 'controles'],
  },
  'ingresar_dashboard_produccion': {
    es: 'Acceder al dashboard de producción',
    en: 'Access production dashboard',
    category: 'navegacion',
    tags: ['navegacion', 'dashboard', 'produccion'],
  },
  'ingresar_maquinas_produccion': {
    es: 'Acceder a máquinas desde producción',
    en: 'Access machines from production',
    category: 'navegacion',
    tags: ['navegacion', 'maquinas', 'produccion'],
  },
  'ingresar_vehiculos': {
    es: 'Acceder al módulo de vehículos',
    en: 'Access vehicles module',
    category: 'navegacion',
    tags: ['navegacion', 'vehiculos', 'produccion'],
  },
  'ingresar_administracion': {
    es: 'Acceder al área de administración',
    en: 'Access administration area',
    category: 'navegacion',
    tags: ['navegacion', 'administracion', 'area'],
  },
  'ingresar_mantenimiento': {
    es: 'Acceder al área de mantenimiento',
    en: 'Access maintenance area',
    category: 'navegacion',
    tags: ['navegacion', 'mantenimiento', 'area'],
  },
  'ingresar_produccion': {
    es: 'Acceder al área de producción',
    en: 'Access production area',
    category: 'navegacion',
    tags: ['navegacion', 'produccion', 'area'],
  },
  'mantenimientos': {
    es: 'Acceder a la sección de mantenimientos',
    en: 'Access maintenance section',
    category: 'navegacion',
    tags: ['navegacion', 'mantenimiento'],
  },
  'maquinas_mantenimiento': {
    es: 'Acceder a máquinas desde mantenimiento',
    en: 'Access machines from maintenance',
    category: 'navegacion',
    tags: ['navegacion', 'maquinas', 'mantenimiento'],
  },
  'maquinas_produccion': {
    es: 'Acceder a máquinas desde producción',
    en: 'Access machines from production',
    category: 'navegacion',
    tags: ['navegacion', 'maquinas', 'produccion'],
  },
  'ordenes_de_trabajo': {
    es: 'Acceder a órdenes de trabajo',
    en: 'Access work orders',
    category: 'navegacion',
    tags: ['navegacion', 'ordenes', 'trabajo'],
  },
  'puestos_trabajo': {
    es: 'Acceder a puestos de trabajo',
    en: 'Access work stations',
    category: 'navegacion',
    tags: ['navegacion', 'puestos', 'trabajo'],
  },
  'reportes_mantenimiento': {
    es: 'Acceder a reportes de mantenimiento',
    en: 'Access maintenance reports',
    category: 'navegacion',
    tags: ['navegacion', 'reportes', 'mantenimiento'],
  },
  'unidades_moviles': {
    es: 'Acceder a unidades móviles',
    en: 'Access mobile units',
    category: 'navegacion',
    tags: ['navegacion', 'unidades', 'moviles'],
  },
  'vehiculos_produccion': {
    es: 'Acceder a vehículos desde producción',
    en: 'Access vehicles from production',
    category: 'navegacion',
    tags: ['navegacion', 'vehiculos', 'produccion'],
  },
  'ingresar_clientes': {
    es: 'Acceder al módulo de clientes',
    en: 'Access clients module',
    category: 'navegacion',
    tags: ['navegacion', 'clientes', 'administracion'],
  },
  'ingresar_costos': {
    es: 'Acceder al módulo de costos',
    en: 'Access costs module',
    category: 'navegacion',
    tags: ['navegacion', 'costos', 'administracion'],
  },
  'ingresar_cotizaciones': {
    es: 'Acceder al módulo de cotizaciones',
    en: 'Access quotations module',
    category: 'navegacion',
    tags: ['navegacion', 'cotizaciones', 'administracion'],
  },
  'ingresar_dashboard_ventas': {
    es: 'Acceder al dashboard de ventas',
    en: 'Access sales dashboard',
    category: 'navegacion',
    tags: ['navegacion', 'dashboard', 'ventas'],
  },
  'ingresar_permisos_roles': {
    es: 'Acceder al módulo de permisos y roles',
    en: 'Access permissions and roles module',
    category: 'navegacion',
    tags: ['navegacion', 'permisos', 'roles', 'admin'],
  },
  'ingresar_personal': {
    es: 'Acceder al módulo de personal',
    en: 'Access personnel module',
    category: 'navegacion',
    tags: ['navegacion', 'personal', 'administracion'],
  },
  'ingresar_productos': {
    es: 'Acceder al módulo de productos',
    en: 'Access products module',
    category: 'navegacion',
    tags: ['navegacion', 'productos', 'administracion'],
  },
  'ingresar_ventas': {
    es: 'Acceder al grupo de ventas',
    en: 'Access sales group',
    category: 'navegacion',
    tags: ['navegacion', 'ventas', 'administracion'],
  },
  'ingresar_ventas_modulo': {
    es: 'Acceder al módulo de ventas',
    en: 'Access sales module',
    category: 'navegacion',
    tags: ['navegacion', 'ventas', 'modulo'],
  },
  'ingresar_compras': {
    es: 'Acceder al módulo de compras',
    en: 'Access purchases module',
    category: 'navegacion',
    tags: ['navegacion', 'compras'],
  },
  'ingresar_tesoreria': {
    es: 'Acceder al módulo de tesorería',
    en: 'Access treasury module',
    category: 'navegacion',
    tags: ['navegacion', 'tesoreria'],
  },
  'ingresar_nominas': {
    es: 'Acceder al módulo de nóminas',
    en: 'Access payroll module',
    category: 'navegacion',
    tags: ['navegacion', 'nominas'],
  },
  'ingresar_auditoria': {
    es: 'Acceder a la sección de auditoría',
    en: 'Access audit section',
    category: 'navegacion',
    tags: ['navegacion', 'auditoria'],
  },
  'ingresar_automatizaciones': {
    es: 'Acceder a las automatizaciones del sistema',
    en: 'Access system automations',
    category: 'navegacion',
    tags: ['navegacion', 'automatizaciones'],
  },
  'ingresar_costos_modulo': {
    es: 'Acceder al módulo de costos',
    en: 'Access costs module',
    category: 'navegacion',
    tags: ['navegacion', 'costos'],
  },

  // ═══════════════════════════════════════════════════════
  // CONTROLES
  // ═══════════════════════════════════════════════════════
  'controles.manage': {
    es: 'Gestionar plantillas y configuración de controles',
    en: 'Manage control templates and configuration',
    category: 'controles',
    tags: ['escritura', 'controles', 'gestion'],
  },
  'controles.create_records': {
    es: 'Crear registros de controles',
    en: 'Create control records',
    category: 'controles',
    tags: ['escritura', 'controles', 'registros', 'crear'],
  },

  // ═══════════════════════════════════════════════════════
  // SECTORES
  // ═══════════════════════════════════════════════════════
  'sectors.edit': {
    es: 'Editar sectores',
    en: 'Edit sectors',
    category: 'sectores',
    tags: ['escritura', 'sectores', 'editar'],
  },
  'sectors.delete': {
    es: 'Eliminar sectores',
    en: 'Delete sectors',
    category: 'sectores',
    tags: ['escritura', 'sectores', 'eliminar', 'destructivo'],
  },
  'sectors.create': {
    es: 'Crear nuevos sectores',
    en: 'Create new sectors',
    category: 'sectores',
    tags: ['escritura', 'sectores', 'crear'],
  },

  // ═══════════════════════════════════════════════════════
  // VENTAS LEGACY
  // ═══════════════════════════════════════════════════════
  'VIEW_SALES_DASHBOARD': {
    es: 'Ver dashboard de ventas',
    en: 'View sales dashboard',
    category: 'ventas_legacy',
    tags: ['lectura', 'ventas', 'dashboard'],
  },
  'ventas.clientes.view': {
    es: 'Ver clientes',
    en: 'View clients',
    category: 'ventas',
    tags: ['lectura', 'ventas', 'clientes'],
  },
  'ventas.clientes.create': {
    es: 'Crear clientes',
    en: 'Create clients',
    category: 'ventas',
    tags: ['escritura', 'ventas', 'clientes', 'crear'],
  },
  'ventas.clientes.edit': {
    es: 'Editar clientes',
    en: 'Edit clients',
    category: 'ventas',
    tags: ['escritura', 'ventas', 'clientes', 'editar'],
  },
  'ventas.clientes.delete': {
    es: 'Eliminar clientes',
    en: 'Delete clients',
    category: 'ventas',
    tags: ['escritura', 'ventas', 'clientes', 'eliminar', 'destructivo'],
  },
  'ventas.productos.view': {
    es: 'Ver productos',
    en: 'View products',
    category: 'ventas',
    tags: ['lectura', 'ventas', 'productos'],
  },
  'ventas.productos.create': {
    es: 'Crear productos',
    en: 'Create products',
    category: 'ventas',
    tags: ['escritura', 'ventas', 'productos', 'crear'],
  },
  'ventas.productos.edit': {
    es: 'Editar productos',
    en: 'Edit products',
    category: 'ventas',
    tags: ['escritura', 'ventas', 'productos', 'editar'],
  },
  'ventas.productos.delete': {
    es: 'Eliminar productos',
    en: 'Delete products',
    category: 'ventas',
    tags: ['escritura', 'ventas', 'productos', 'eliminar', 'destructivo'],
  },
  'VIEW_QUOTES': {
    es: 'Ver cotizaciones',
    en: 'View quotes',
    category: 'ventas_legacy',
    tags: ['lectura', 'ventas', 'cotizaciones'],
  },
  'CREATE_QUOTE': {
    es: 'Crear cotizaciones',
    en: 'Create quotes',
    category: 'ventas_legacy',
    tags: ['escritura', 'ventas', 'cotizaciones', 'crear'],
  },
  'EDIT_QUOTE': {
    es: 'Editar cotizaciones',
    en: 'Edit quotes',
    category: 'ventas_legacy',
    tags: ['escritura', 'ventas', 'cotizaciones', 'editar'],
  },
  'DELETE_QUOTE': {
    es: 'Eliminar cotizaciones',
    en: 'Delete quotes',
    category: 'ventas_legacy',
    tags: ['escritura', 'ventas', 'cotizaciones', 'eliminar', 'destructivo'],
  },
  'APPROVE_QUOTE': {
    es: 'Aprobar cotizaciones',
    en: 'Approve quotes',
    category: 'ventas_legacy',
    tags: ['escritura', 'ventas', 'cotizaciones', 'aprobar', 'workflow'],
  },
  'CONVERT_QUOTE_TO_SALE': {
    es: 'Convertir cotización en venta',
    en: 'Convert quote to sale',
    category: 'ventas_legacy',
    tags: ['escritura', 'ventas', 'cotizaciones', 'convertir'],
  },
  'VIEW_SALES': {
    es: 'Ver ventas',
    en: 'View sales',
    category: 'ventas_legacy',
    tags: ['lectura', 'ventas'],
  },
  'CREATE_SALE': {
    es: 'Crear ventas',
    en: 'Create sales',
    category: 'ventas_legacy',
    tags: ['escritura', 'ventas', 'crear'],
  },
  'EDIT_SALE': {
    es: 'Editar ventas',
    en: 'Edit sales',
    category: 'ventas_legacy',
    tags: ['escritura', 'ventas', 'editar'],
  },
  'DELETE_SALE': {
    es: 'Eliminar ventas',
    en: 'Delete sales',
    category: 'ventas_legacy',
    tags: ['escritura', 'ventas', 'eliminar', 'destructivo'],
  },
  'CANCEL_SALE': {
    es: 'Cancelar ventas',
    en: 'Cancel sales',
    category: 'ventas_legacy',
    tags: ['escritura', 'ventas', 'cancelar'],
  },
  'VIEW_SALES_REPORTS': {
    es: 'Ver reportes de ventas',
    en: 'View sales reports',
    category: 'ventas_legacy',
    tags: ['lectura', 'ventas', 'reportes'],
  },
  'EXPORT_SALES_DATA': {
    es: 'Exportar datos de ventas',
    en: 'Export sales data',
    category: 'ventas_legacy',
    tags: ['lectura', 'ventas', 'exportar'],
  },

  // ═══════════════════════════════════════════════════════
  // VENTAS PREMIUM V2
  // ═══════════════════════════════════════════════════════
  'ventas.ingresar': {
    es: 'Acceso al módulo de ventas',
    en: 'Access the sales module',
    category: 'ventas',
    tags: ['navegacion', 'ventas'],
  },
  'ventas.dashboard.view': {
    es: 'Ver dashboard de ventas',
    en: 'View sales dashboard',
    category: 'ventas',
    tags: ['lectura', 'ventas', 'dashboard'],
  },

  // Clientes
  'ventas.clientes.view': {
    es: 'Ver clientes del módulo de ventas',
    en: 'View sales module clients',
    category: 'ventas_clientes',
    tags: ['lectura', 'ventas', 'clientes'],
  },

  // Vendedores
  'ventas.vendedores.resumen': {
    es: 'Ver resumen de vendedores',
    en: 'View sellers summary',
    category: 'ventas_vendedores',
    tags: ['lectura', 'ventas', 'vendedores', 'resumen'],
  },

  // Liquidaciones
  'ventas.liquidaciones.view': {
    es: 'Ver liquidaciones de ventas',
    en: 'View sales settlements',
    category: 'ventas_liquidaciones',
    tags: ['lectura', 'ventas', 'liquidaciones'],
  },
  'ventas.liquidaciones.create': {
    es: 'Crear liquidaciones de ventas',
    en: 'Create sales settlements',
    category: 'ventas_liquidaciones',
    tags: ['escritura', 'ventas', 'liquidaciones', 'crear'],
  },
  'ventas.liquidaciones.edit': {
    es: 'Editar liquidaciones de ventas',
    en: 'Edit sales settlements',
    category: 'ventas_liquidaciones',
    tags: ['escritura', 'ventas', 'liquidaciones', 'editar'],
  },
  'ventas.liquidaciones.delete': {
    es: 'Eliminar liquidaciones de ventas',
    en: 'Delete sales settlements',
    category: 'ventas_liquidaciones',
    tags: ['escritura', 'ventas', 'liquidaciones', 'eliminar'],
  },
  'ventas.liquidaciones.confirm': {
    es: 'Confirmar liquidaciones de ventas',
    en: 'Confirm sales settlements',
    category: 'ventas_liquidaciones',
    tags: ['escritura', 'ventas', 'liquidaciones', 'confirmar'],
  },
  'ventas.liquidaciones.pay': {
    es: 'Pagar liquidaciones de ventas',
    en: 'Pay sales settlements',
    category: 'ventas_liquidaciones',
    tags: ['escritura', 'ventas', 'liquidaciones', 'pagar'],
  },

  // Cotizaciones
  'ventas.cotizaciones.view': {
    es: 'Ver cotizaciones',
    en: 'View quotations',
    category: 'ventas_cotizaciones',
    tags: ['lectura', 'ventas', 'cotizaciones'],
  },
  'ventas.cotizaciones.create': {
    es: 'Crear cotizaciones',
    en: 'Create quotations',
    category: 'ventas_cotizaciones',
    tags: ['escritura', 'ventas', 'cotizaciones', 'crear'],
  },
  'ventas.cotizaciones.edit': {
    es: 'Editar cotizaciones',
    en: 'Edit quotations',
    category: 'ventas_cotizaciones',
    tags: ['escritura', 'ventas', 'cotizaciones', 'editar'],
  },
  'ventas.cotizaciones.delete': {
    es: 'Eliminar cotizaciones',
    en: 'Delete quotations',
    category: 'ventas_cotizaciones',
    tags: ['escritura', 'ventas', 'cotizaciones', 'eliminar', 'destructivo'],
  },
  'ventas.cotizaciones.send': {
    es: 'Enviar cotizaciones a clientes',
    en: 'Send quotations to clients',
    category: 'ventas_cotizaciones',
    tags: ['escritura', 'ventas', 'cotizaciones', 'enviar'],
  },
  'ventas.cotizaciones.approve': {
    es: 'Aprobar cotizaciones',
    en: 'Approve quotations',
    category: 'ventas_cotizaciones',
    tags: ['escritura', 'ventas', 'cotizaciones', 'aprobar', 'workflow'],
  },
  'ventas.cotizaciones.convert': {
    es: 'Convertir cotización a orden de venta',
    en: 'Convert quotation to sales order',
    category: 'ventas_cotizaciones',
    tags: ['escritura', 'ventas', 'cotizaciones', 'convertir'],
  },
  'ventas.cotizaciones.duplicate': {
    es: 'Duplicar cotizaciones',
    en: 'Duplicate quotations',
    category: 'ventas_cotizaciones',
    tags: ['escritura', 'ventas', 'cotizaciones', 'duplicar'],
  },
  'ventas.cotizaciones.version': {
    es: 'Ver historial de versiones de cotizaciones',
    en: 'View quotation version history',
    category: 'ventas_cotizaciones',
    tags: ['lectura', 'ventas', 'cotizaciones', 'historial'],
  },
  'ventas.cotizaciones.export': {
    es: 'Exportar cotizaciones a Excel',
    en: 'Export quotations to Excel',
    category: 'ventas_cotizaciones',
    tags: ['lectura', 'ventas', 'cotizaciones', 'exportar'],
  },
  'ventas.cotizaciones.stats': {
    es: 'Ver estadísticas de cotizaciones',
    en: 'View quotation statistics',
    category: 'ventas_cotizaciones',
    tags: ['lectura', 'ventas', 'cotizaciones', 'estadisticas'],
  },

  // Órdenes de Venta
  'ventas.ordenes.view': {
    es: 'Ver órdenes de venta',
    en: 'View sales orders',
    category: 'ventas_ordenes',
    tags: ['lectura', 'ventas', 'ordenes'],
  },
  'ventas.ordenes.create': {
    es: 'Crear órdenes de venta',
    en: 'Create sales orders',
    category: 'ventas_ordenes',
    tags: ['escritura', 'ventas', 'ordenes', 'crear'],
  },
  'ventas.ordenes.edit': {
    es: 'Editar órdenes de venta',
    en: 'Edit sales orders',
    category: 'ventas_ordenes',
    tags: ['escritura', 'ventas', 'ordenes', 'editar'],
  },
  'ventas.ordenes.delete': {
    es: 'Eliminar órdenes de venta',
    en: 'Delete sales orders',
    category: 'ventas_ordenes',
    tags: ['escritura', 'ventas', 'ordenes', 'eliminar', 'destructivo'],
  },
  'ventas.ordenes.confirm': {
    es: 'Confirmar órdenes de venta',
    en: 'Confirm sales orders',
    category: 'ventas_ordenes',
    tags: ['escritura', 'ventas', 'ordenes', 'confirmar', 'workflow'],
  },
  'ventas.ordenes.cancel': {
    es: 'Cancelar órdenes de venta',
    en: 'Cancel sales orders',
    category: 'ventas_ordenes',
    tags: ['escritura', 'ventas', 'ordenes', 'cancelar'],
  },

  // Entregas
  'ventas.entregas.view': {
    es: 'Ver entregas',
    en: 'View deliveries',
    category: 'ventas_entregas',
    tags: ['lectura', 'ventas', 'entregas', 'logistica'],
  },
  'ventas.entregas.create': {
    es: 'Crear entregas',
    en: 'Create deliveries',
    category: 'ventas_entregas',
    tags: ['escritura', 'ventas', 'entregas', 'crear'],
  },
  'ventas.entregas.edit': {
    es: 'Editar entregas',
    en: 'Edit deliveries',
    category: 'ventas_entregas',
    tags: ['escritura', 'ventas', 'entregas', 'editar'],
  },
  'ventas.entregas.program': {
    es: 'Programar entregas',
    en: 'Schedule deliveries',
    category: 'ventas_entregas',
    tags: ['escritura', 'ventas', 'entregas', 'programar'],
  },
  'ventas.entregas.dispatch': {
    es: 'Despachar entregas',
    en: 'Dispatch deliveries',
    category: 'ventas_entregas',
    tags: ['escritura', 'ventas', 'entregas', 'despachar'],
  },
  'ventas.entregas.complete': {
    es: 'Completar entregas',
    en: 'Complete deliveries',
    category: 'ventas_entregas',
    tags: ['escritura', 'ventas', 'entregas', 'completar', 'workflow'],
  },
  'ventas.entregas.evidence': {
    es: 'Subir evidencias de entrega',
    en: 'Upload delivery evidence',
    category: 'ventas_entregas',
    tags: ['escritura', 'ventas', 'entregas', 'evidencia'],
  },

  // Remitos
  'ventas.remitos.view': {
    es: 'Ver remitos',
    en: 'View packing slips',
    category: 'ventas_remitos',
    tags: ['lectura', 'ventas', 'remitos', 'documentos'],
  },
  'ventas.remitos.create': {
    es: 'Crear remitos',
    en: 'Create packing slips',
    category: 'ventas_remitos',
    tags: ['escritura', 'ventas', 'remitos', 'crear'],
  },
  'ventas.remitos.emit': {
    es: 'Emitir remitos',
    en: 'Issue packing slips',
    category: 'ventas_remitos',
    tags: ['escritura', 'ventas', 'remitos', 'emitir', 'fiscal'],
  },
  'ventas.remitos.void': {
    es: 'Anular remitos',
    en: 'Void packing slips',
    category: 'ventas_remitos',
    tags: ['escritura', 'ventas', 'remitos', 'anular', 'destructivo'],
  },

  // Facturas
  'ventas.facturas.view': {
    es: 'Ver facturas',
    en: 'View invoices',
    category: 'ventas_facturas',
    tags: ['lectura', 'ventas', 'facturas', 'documentos'],
  },
  'ventas.facturas.create': {
    es: 'Crear facturas',
    en: 'Create invoices',
    category: 'ventas_facturas',
    tags: ['escritura', 'ventas', 'facturas', 'crear'],
  },
  'ventas.facturas.edit': {
    es: 'Editar borradores de facturas',
    en: 'Edit invoice drafts',
    category: 'ventas_facturas',
    tags: ['escritura', 'ventas', 'facturas', 'editar'],
  },
  'ventas.facturas.emit': {
    es: 'Emitir facturas',
    en: 'Issue invoices',
    category: 'ventas_facturas',
    tags: ['escritura', 'ventas', 'facturas', 'emitir', 'fiscal'],
  },
  'ventas.facturas.void': {
    es: 'Anular facturas',
    en: 'Void invoices',
    category: 'ventas_facturas',
    tags: ['escritura', 'ventas', 'facturas', 'anular', 'destructivo'],
  },
  'ventas.facturas.send': {
    es: 'Enviar facturas por email',
    en: 'Send invoices by email',
    category: 'ventas_facturas',
    tags: ['escritura', 'ventas', 'facturas', 'enviar'],
  },

  // Notas Cr/Db
  'ventas.notas.view': {
    es: 'Ver notas de crédito y débito',
    en: 'View credit and debit notes',
    category: 'ventas_notas',
    tags: ['lectura', 'ventas', 'notas', 'documentos'],
  },
  'ventas.notas.create': {
    es: 'Crear notas de crédito y débito',
    en: 'Create credit and debit notes',
    category: 'ventas_notas',
    tags: ['escritura', 'ventas', 'notas', 'crear'],
  },
  'ventas.notas.emit': {
    es: 'Emitir notas de crédito y débito',
    en: 'Issue credit and debit notes',
    category: 'ventas_notas',
    tags: ['escritura', 'ventas', 'notas', 'emitir', 'fiscal'],
  },
  'ventas.notas.void': {
    es: 'Anular notas de crédito y débito',
    en: 'Void credit and debit notes',
    category: 'ventas_notas',
    tags: ['escritura', 'ventas', 'notas', 'anular', 'destructivo'],
  },

  // Pagos y Cobranzas
  'ventas.pagos.view': {
    es: 'Ver pagos registrados',
    en: 'View registered payments',
    category: 'ventas_pagos',
    tags: ['lectura', 'ventas', 'pagos', 'financiero'],
  },
  'ventas.pagos.create': {
    es: 'Registrar pagos',
    en: 'Register payments',
    category: 'ventas_pagos',
    tags: ['escritura', 'ventas', 'pagos', 'crear', 'financiero'],
  },
  'ventas.pagos.edit': {
    es: 'Editar pagos',
    en: 'Edit payments',
    category: 'ventas_pagos',
    tags: ['escritura', 'ventas', 'pagos', 'editar', 'financiero'],
  },
  'ventas.pagos.cancel': {
    es: 'Cancelar o anular pagos',
    en: 'Cancel or void payments',
    category: 'ventas_pagos',
    tags: ['escritura', 'ventas', 'pagos', 'cancelar', 'destructivo', 'financiero'],
  },
  'ventas.pagos.apply': {
    es: 'Aplicar pagos a facturas',
    en: 'Apply payments to invoices',
    category: 'ventas_pagos',
    tags: ['escritura', 'ventas', 'pagos', 'aplicar', 'financiero'],
  },
  'ventas.cobranzas.view': {
    es: 'Ver cobranzas pendientes',
    en: 'View pending collections',
    category: 'ventas_pagos',
    tags: ['lectura', 'ventas', 'cobranzas', 'financiero'],
  },
  'ventas.cobranzas.manage': {
    es: 'Gestionar cobranzas',
    en: 'Manage collections',
    category: 'ventas_pagos',
    tags: ['escritura', 'ventas', 'cobranzas', 'gestion', 'financiero'],
  },

  // Cuenta Corriente
  'ventas.cuenta_corriente.view': {
    es: 'Ver cuenta corriente de clientes',
    en: 'View client current account',
    category: 'ventas_cuenta_corriente',
    tags: ['lectura', 'ventas', 'cuenta_corriente', 'financiero'],
  },
  'ventas.cuenta_corriente.adjust': {
    es: 'Realizar ajustes en cuenta corriente',
    en: 'Make adjustments to current account',
    category: 'ventas_cuenta_corriente',
    tags: ['escritura', 'ventas', 'cuenta_corriente', 'ajustar', 'financiero'],
  },
  'ventas.cuenta_corriente.recalculate': {
    es: 'Recalcular saldos de cuenta corriente',
    en: 'Recalculate current account balances',
    category: 'ventas_cuenta_corriente',
    tags: ['escritura', 'ventas', 'cuenta_corriente', 'recalcular', 'admin', 'financiero'],
  },
  'ventas.ledger.view_full': {
    es: 'Ver libro mayor completo',
    en: 'View full ledger',
    category: 'ventas_cuenta_corriente',
    tags: ['lectura', 'ventas', 'ledger', 'financiero', 'avanzado'],
  },

  // Listas de Precios
  'ventas.listas_precios.view': {
    es: 'Ver listas de precios',
    en: 'View price lists',
    category: 'ventas_precios',
    tags: ['lectura', 'ventas', 'precios'],
  },
  'ventas.listas_precios.create': {
    es: 'Crear listas de precios',
    en: 'Create price lists',
    category: 'ventas_precios',
    tags: ['escritura', 'ventas', 'precios', 'crear'],
  },
  'ventas.listas_precios.edit': {
    es: 'Editar listas de precios',
    en: 'Edit price lists',
    category: 'ventas_precios',
    tags: ['escritura', 'ventas', 'precios', 'editar'],
  },
  'ventas.listas_precios.delete': {
    es: 'Eliminar listas de precios',
    en: 'Delete price lists',
    category: 'ventas_precios',
    tags: ['escritura', 'ventas', 'precios', 'eliminar', 'destructivo'],
  },
  'ventas.listas_precios.assign': {
    es: 'Asignar listas de precios a clientes',
    en: 'Assign price lists to clients',
    category: 'ventas_precios',
    tags: ['escritura', 'ventas', 'precios', 'asignar'],
  },

  // Descuentos
  'ventas.descuentos.apply': {
    es: 'Aplicar descuentos normales',
    en: 'Apply standard discounts',
    category: 'ventas_descuentos',
    tags: ['escritura', 'ventas', 'descuentos', 'financiero'],
  },
  'ventas.descuentos.approve': {
    es: 'Aprobar descuentos especiales',
    en: 'Approve special discounts',
    category: 'ventas_descuentos',
    tags: ['escritura', 'ventas', 'descuentos', 'aprobar', 'workflow', 'financiero'],
  },
  'ventas.descuentos.unlimited': {
    es: 'Aplicar descuentos sin límite',
    en: 'Apply unlimited discounts',
    category: 'ventas_descuentos',
    tags: ['escritura', 'ventas', 'descuentos', 'critico', 'financiero'],
  },

  // Márgenes y Costos
  'ventas.margins.view': {
    es: 'Ver márgenes en documentos de venta',
    en: 'View margins in sales documents',
    category: 'ventas_margenes',
    tags: ['lectura', 'ventas', 'margenes', 'financiero', 'confidencial'],
  },
  'ventas.costs.view': {
    es: 'Ver costos en documentos de venta',
    en: 'View costs in sales documents',
    category: 'ventas_margenes',
    tags: ['lectura', 'ventas', 'costos', 'financiero', 'confidencial'],
  },
  'ventas.margins.override': {
    es: 'Aprobar ventas bajo el margen mínimo',
    en: 'Approve sales below minimum margin',
    category: 'ventas_margenes',
    tags: ['escritura', 'ventas', 'margenes', 'aprobar', 'critico', 'financiero'],
  },

  // Comisiones
  'ventas.comisiones.view_own': {
    es: 'Ver comisiones propias',
    en: 'View own commissions',
    category: 'ventas_comisiones',
    tags: ['lectura', 'ventas', 'comisiones', 'financiero'],
  },
  'ventas.comisiones.view_all': {
    es: 'Ver todas las comisiones',
    en: 'View all commissions',
    category: 'ventas_comisiones',
    tags: ['lectura', 'ventas', 'comisiones', 'financiero', 'global'],
  },
  'ventas.comisiones.calculate': {
    es: 'Calcular comisiones',
    en: 'Calculate commissions',
    category: 'ventas_comisiones',
    tags: ['escritura', 'ventas', 'comisiones', 'calcular', 'financiero'],
  },
  'ventas.comisiones.pay': {
    es: 'Pagar comisiones',
    en: 'Pay commissions',
    category: 'ventas_comisiones',
    tags: ['escritura', 'ventas', 'comisiones', 'pagar', 'financiero'],
  },

  // Aprobaciones
  'ventas.aprobaciones.view': {
    es: 'Ver aprobaciones pendientes',
    en: 'View pending approvals',
    category: 'ventas_aprobaciones',
    tags: ['lectura', 'ventas', 'aprobaciones', 'workflow'],
  },
  'ventas.aprobaciones.approve': {
    es: 'Aprobar solicitudes de ventas',
    en: 'Approve sales requests',
    category: 'ventas_aprobaciones',
    tags: ['escritura', 'ventas', 'aprobaciones', 'aprobar', 'workflow'],
  },
  'ventas.aprobaciones.reject': {
    es: 'Rechazar solicitudes de ventas',
    en: 'Reject sales requests',
    category: 'ventas_aprobaciones',
    tags: ['escritura', 'ventas', 'aprobaciones', 'rechazar', 'workflow'],
  },

  // Reportes de Ventas
  'ventas.reportes.view': {
    es: 'Ver reportes básicos de ventas',
    en: 'View basic sales reports',
    category: 'ventas_reportes',
    tags: ['lectura', 'ventas', 'reportes'],
  },
  'ventas.reportes.advanced': {
    es: 'Ver reportes avanzados de ventas',
    en: 'View advanced sales reports',
    category: 'ventas_reportes',
    tags: ['lectura', 'ventas', 'reportes', 'avanzado'],
  },
  'ventas.reportes.rentabilidad': {
    es: 'Ver reportes de rentabilidad',
    en: 'View profitability reports',
    category: 'ventas_reportes',
    tags: ['lectura', 'ventas', 'reportes', 'rentabilidad', 'financiero'],
  },
  'ventas.reportes.export': {
    es: 'Exportar reportes de ventas',
    en: 'Export sales reports',
    category: 'ventas_reportes',
    tags: ['lectura', 'ventas', 'reportes', 'exportar'],
  },
  'ventas.reportes.aging': {
    es: 'Ver aging de cartera (antigüedad de deuda)',
    en: 'View portfolio aging (debt age)',
    category: 'ventas_reportes',
    tags: ['lectura', 'ventas', 'reportes', 'aging', 'financiero'],
  },

  // Portal Cliente
  'ventas.portal.config': {
    es: 'Configurar portal de clientes',
    en: 'Configure client portal',
    category: 'ventas_portal',
    tags: ['escritura', 'ventas', 'portal', 'configuracion'],
  },
  'ventas.portal.manage_access': {
    es: 'Gestionar accesos al portal de clientes',
    en: 'Manage client portal access',
    category: 'ventas_portal',
    tags: ['escritura', 'ventas', 'portal', 'accesos'],
  },

  // Configuración de Ventas
  'ventas.config.view': {
    es: 'Ver configuración de ventas',
    en: 'View sales configuration',
    category: 'ventas_config',
    tags: ['lectura', 'ventas', 'configuracion'],
  },
  'ventas.config.edit': {
    es: 'Editar configuración de ventas',
    en: 'Edit sales configuration',
    category: 'ventas_config',
    tags: ['escritura', 'ventas', 'configuracion', 'editar'],
  },
  'ventas.config.numeracion': {
    es: 'Configurar numeración de documentos de venta',
    en: 'Configure sales document numbering',
    category: 'ventas_config',
    tags: ['escritura', 'ventas', 'configuracion', 'numeracion'],
  },

  // Auditoría de Ventas
  'ventas.audit.view': {
    es: 'Ver auditoría de ventas',
    en: 'View sales audit logs',
    category: 'ventas_auditoria',
    tags: ['lectura', 'ventas', 'auditoria', 'seguridad'],
  },
  'ventas.audit.export': {
    es: 'Exportar auditoría de ventas',
    en: 'Export sales audit logs',
    category: 'ventas_auditoria',
    tags: ['lectura', 'ventas', 'auditoria', 'exportar'],
  },

  // FiscalScope
  'ventas.fiscalscope.t1': {
    es: 'Operar con documentos T1 (formales/fiscales)',
    en: 'Operate with T1 documents (formal/fiscal)',
    category: 'ventas_fiscal',
    tags: ['escritura', 'ventas', 'fiscal', 'T1'],
  },
  'ventas.fiscalscope.t2': {
    es: 'Operar con documentos T2 (internos)',
    en: 'Operate with T2 documents (internal)',
    category: 'ventas_fiscal',
    tags: ['escritura', 'ventas', 'fiscal', 'T2'],
  },
  'ventas.fiscalscope.t3': {
    es: 'Operar con documentos T3 (presupuestos)',
    en: 'Operate with T3 documents (budgets)',
    category: 'ventas_fiscal',
    tags: ['escritura', 'ventas', 'fiscal', 'T3'],
  },

  // ═══════════════════════════════════════════════════════
  // CARGAS
  // ═══════════════════════════════════════════════════════
  'cargas.view': {
    es: 'Ver cargas y camiones',
    en: 'View loads and trucks',
    category: 'cargas',
    tags: ['lectura', 'cargas', 'logistica'],
  },
  'cargas.manage_trucks': {
    es: 'Gestionar camiones',
    en: 'Manage trucks',
    category: 'cargas',
    tags: ['escritura', 'cargas', 'camiones', 'logistica'],
  },
  'cargas.manage_loads': {
    es: 'Gestionar cargas',
    en: 'Manage loads',
    category: 'cargas',
    tags: ['escritura', 'cargas', 'logistica'],
  },

  // ═══════════════════════════════════════════════════════
  // PREFERENCIAS DEL SISTEMA
  // ═══════════════════════════════════════════════════════
  'pref.l2': {
    es: 'Acceso a modo extendido (Level 2)',
    en: 'Access extended mode (Level 2)',
    category: 'preferencias',
    tags: ['sistema', 'preferencias', 'avanzado'],
  },
  'pref.adv': {
    es: 'Creación avanzada de documentos',
    en: 'Advanced document creation',
    category: 'preferencias',
    tags: ['sistema', 'preferencias', 'avanzado', 'documentos'],
  },
  'pref.cfg': {
    es: 'Acceso a configuración avanzada',
    en: 'Access advanced configuration',
    category: 'preferencias',
    tags: ['sistema', 'preferencias', 'configuracion'],
  },
  'pref.aud': {
    es: 'Acceso a logs de auditoría avanzada (solo SUPERADMIN)',
    en: 'Access advanced audit logs (SUPERADMIN only)',
    category: 'preferencias',
    tags: ['sistema', 'preferencias', 'auditoria', 'superadmin'],
  },

  // ═══════════════════════════════════════════════════════
  // TESORERÍA
  // ═══════════════════════════════════════════════════════
  'treasury.ingresar': {
    es: 'Acceso al módulo de tesorería',
    en: 'Access treasury module',
    category: 'tesoreria',
    tags: ['navegacion', 'tesoreria', 'financiero'],
  },
  'treasury.view': {
    es: 'Ver posición y movimientos de tesorería',
    en: 'View treasury position and movements',
    category: 'tesoreria',
    tags: ['lectura', 'tesoreria', 'financiero'],
  },
  'treasury.manage_cash': {
    es: 'Gestionar cajas (crear, ajustar saldos)',
    en: 'Manage cash registers (create, adjust balances)',
    category: 'tesoreria',
    tags: ['escritura', 'tesoreria', 'cajas', 'financiero'],
  },
  'treasury.manage_bank': {
    es: 'Gestionar cuentas bancarias',
    en: 'Manage bank accounts',
    category: 'tesoreria',
    tags: ['escritura', 'tesoreria', 'bancos', 'financiero'],
  },
  'treasury.manage_cheque': {
    es: 'Gestionar cheques (depositar, endosar)',
    en: 'Manage checks (deposit, endorse)',
    category: 'tesoreria',
    tags: ['escritura', 'tesoreria', 'cheques', 'financiero'],
  },
  'treasury.transfer': {
    es: 'Realizar transferencias internas entre cuentas',
    en: 'Make internal transfers between accounts',
    category: 'tesoreria',
    tags: ['escritura', 'tesoreria', 'transferencias', 'financiero'],
  },
  'treasury.reconcile': {
    es: 'Conciliar cuentas bancarias',
    en: 'Reconcile bank accounts',
    category: 'tesoreria',
    tags: ['escritura', 'tesoreria', 'conciliacion', 'financiero'],
  },
  'treasury.reports': {
    es: 'Ver reportes de tesorería',
    en: 'View treasury reports',
    category: 'tesoreria',
    tags: ['lectura', 'tesoreria', 'reportes', 'financiero'],
  },

  // ═══════════════════════════════════════════════════════
  // COMPRAS - PEDIDOS
  // ═══════════════════════════════════════════════════════
  'compras.pedidos.view': {
    es: 'Ver pedidos de compra',
    en: 'View purchase orders',
    category: 'compras_pedidos',
    tags: ['lectura', 'compras', 'pedidos'],
  },
  'compras.pedidos.create': {
    es: 'Crear pedidos de compra',
    en: 'Create purchase orders',
    category: 'compras_pedidos',
    tags: ['escritura', 'compras', 'pedidos', 'crear'],
  },
  'compras.pedidos.edit': {
    es: 'Editar pedidos de compra',
    en: 'Edit purchase orders',
    category: 'compras_pedidos',
    tags: ['escritura', 'compras', 'pedidos', 'editar'],
  },
  'compras.pedidos.delete': {
    es: 'Eliminar pedidos de compra',
    en: 'Delete purchase orders',
    category: 'compras_pedidos',
    tags: ['escritura', 'compras', 'pedidos', 'eliminar', 'destructivo'],
  },
  'compras.pedidos.enviar': {
    es: 'Enviar pedidos a cotización',
    en: 'Send orders for quotation',
    category: 'compras_pedidos',
    tags: ['escritura', 'compras', 'pedidos', 'enviar'],
  },
  'compras.pedidos.cancelar': {
    es: 'Cancelar pedidos de compra',
    en: 'Cancel purchase orders',
    category: 'compras_pedidos',
    tags: ['escritura', 'compras', 'pedidos', 'cancelar'],
  },
  'compras.pedidos.aprobar': {
    es: 'Aprobar selección de cotización de compra',
    en: 'Approve purchase quotation selection',
    category: 'compras_pedidos',
    tags: ['escritura', 'compras', 'pedidos', 'aprobar', 'workflow'],
  },
  'compras.pedidos.rechazar': {
    es: 'Rechazar pedidos de compra',
    en: 'Reject purchase orders',
    category: 'compras_pedidos',
    tags: ['escritura', 'compras', 'pedidos', 'rechazar', 'workflow'],
  },

  // COMPRAS - COTIZACIONES
  'compras.cotizaciones.view': {
    es: 'Ver cotizaciones de compra',
    en: 'View purchase quotations',
    category: 'compras_cotizaciones',
    tags: ['lectura', 'compras', 'cotizaciones'],
  },
  'compras.cotizaciones.create': {
    es: 'Cargar cotizaciones de proveedores',
    en: 'Upload supplier quotations',
    category: 'compras_cotizaciones',
    tags: ['escritura', 'compras', 'cotizaciones', 'crear'],
  },
  'compras.cotizaciones.edit': {
    es: 'Editar cotizaciones de compra',
    en: 'Edit purchase quotations',
    category: 'compras_cotizaciones',
    tags: ['escritura', 'compras', 'cotizaciones', 'editar'],
  },
  'compras.cotizaciones.delete': {
    es: 'Eliminar cotizaciones de compra',
    en: 'Delete purchase quotations',
    category: 'compras_cotizaciones',
    tags: ['escritura', 'compras', 'cotizaciones', 'eliminar', 'destructivo'],
  },
  'compras.cotizaciones.seleccionar': {
    es: 'Seleccionar cotización ganadora',
    en: 'Select winning quotation',
    category: 'compras_cotizaciones',
    tags: ['escritura', 'compras', 'cotizaciones', 'seleccionar', 'workflow'],
  },
  'compras.cotizaciones.convertir_oc': {
    es: 'Crear orden de compra desde cotización',
    en: 'Create purchase order from quotation',
    category: 'compras_cotizaciones',
    tags: ['escritura', 'compras', 'cotizaciones', 'convertir'],
  },

  // COMPRAS - COMPROBANTES
  'compras.comprobantes.view': {
    es: 'Ver comprobantes de compra',
    en: 'View purchase receipts',
    category: 'compras_comprobantes',
    tags: ['lectura', 'compras', 'comprobantes'],
  },
  'compras.comprobantes.create': {
    es: 'Crear comprobantes de compra',
    en: 'Create purchase receipts',
    category: 'compras_comprobantes',
    tags: ['escritura', 'compras', 'comprobantes', 'crear'],
  },
  'compras.comprobantes.edit': {
    es: 'Editar comprobantes de compra',
    en: 'Edit purchase receipts',
    category: 'compras_comprobantes',
    tags: ['escritura', 'compras', 'comprobantes', 'editar'],
  },
  'compras.comprobantes.delete': {
    es: 'Eliminar comprobantes de compra',
    en: 'Delete purchase receipts',
    category: 'compras_comprobantes',
    tags: ['escritura', 'compras', 'comprobantes', 'eliminar', 'destructivo'],
  },
  'compras.comprobantes.approve': {
    es: 'Aprobar comprobantes de compra',
    en: 'Approve purchase receipts',
    category: 'compras_comprobantes',
    tags: ['escritura', 'compras', 'comprobantes', 'aprobar', 'workflow'],
  },
  'compras.comprobantes.reject': {
    es: 'Rechazar comprobantes de compra',
    en: 'Reject purchase receipts',
    category: 'compras_comprobantes',
    tags: ['escritura', 'compras', 'comprobantes', 'rechazar', 'workflow'],
  },
  'compras.comprobantes.anular': {
    es: 'Anular comprobantes de compra',
    en: 'Void purchase receipts',
    category: 'compras_comprobantes',
    tags: ['escritura', 'compras', 'comprobantes', 'anular', 'destructivo'],
  },

  // COMPRAS - PROVEEDORES
  'compras.proveedores.view': {
    es: 'Ver proveedores',
    en: 'View suppliers',
    category: 'compras_proveedores',
    tags: ['lectura', 'compras', 'proveedores'],
  },
  'compras.proveedores.create': {
    es: 'Crear proveedores',
    en: 'Create suppliers',
    category: 'compras_proveedores',
    tags: ['escritura', 'compras', 'proveedores', 'crear'],
  },
  'compras.proveedores.edit': {
    es: 'Editar proveedores',
    en: 'Edit suppliers',
    category: 'compras_proveedores',
    tags: ['escritura', 'compras', 'proveedores', 'editar'],
  },
  'compras.proveedores.delete': {
    es: 'Eliminar proveedores',
    en: 'Delete suppliers',
    category: 'compras_proveedores',
    tags: ['escritura', 'compras', 'proveedores', 'eliminar', 'destructivo'],
  },

  // COMPRAS - SOLICITUDES
  'compras.solicitudes.view': {
    es: 'Ver solicitudes de compra',
    en: 'View purchase requests',
    category: 'compras_solicitudes',
    tags: ['lectura', 'compras', 'solicitudes'],
  },
  'compras.solicitudes.create': {
    es: 'Crear solicitudes de compra',
    en: 'Create purchase requests',
    category: 'compras_solicitudes',
    tags: ['escritura', 'compras', 'solicitudes', 'crear'],
  },
  'compras.solicitudes.edit': {
    es: 'Editar solicitudes de compra',
    en: 'Edit purchase requests',
    category: 'compras_solicitudes',
    tags: ['escritura', 'compras', 'solicitudes', 'editar'],
  },
  'compras.solicitudes.delete': {
    es: 'Eliminar solicitudes de compra',
    en: 'Delete purchase requests',
    category: 'compras_solicitudes',
    tags: ['escritura', 'compras', 'solicitudes', 'eliminar', 'destructivo'],
  },
  'compras.solicitudes.approve': {
    es: 'Aprobar solicitudes de compra',
    en: 'Approve purchase requests',
    category: 'compras_solicitudes',
    tags: ['escritura', 'compras', 'solicitudes', 'aprobar', 'workflow'],
  },
  'compras.solicitudes.reject': {
    es: 'Rechazar solicitudes de compra',
    en: 'Reject purchase requests',
    category: 'compras_solicitudes',
    tags: ['escritura', 'compras', 'solicitudes', 'rechazar', 'workflow'],
  },

  // COMPRAS - ÓRDENES DE COMPRA
  'compras.ordenes.view': {
    es: 'Ver órdenes de compra',
    en: 'View purchase orders',
    category: 'compras_ordenes',
    tags: ['lectura', 'compras', 'ordenes'],
  },
  'compras.ordenes.create': {
    es: 'Crear órdenes de compra',
    en: 'Create purchase orders',
    category: 'compras_ordenes',
    tags: ['escritura', 'compras', 'ordenes', 'crear'],
  },
  'compras.ordenes.edit': {
    es: 'Editar órdenes de compra',
    en: 'Edit purchase orders',
    category: 'compras_ordenes',
    tags: ['escritura', 'compras', 'ordenes', 'editar'],
  },
  'compras.ordenes.delete': {
    es: 'Eliminar órdenes de compra',
    en: 'Delete purchase orders',
    category: 'compras_ordenes',
    tags: ['escritura', 'compras', 'ordenes', 'eliminar', 'destructivo'],
  },
  'compras.ordenes.approve': {
    es: 'Aprobar órdenes de compra',
    en: 'Approve purchase orders',
    category: 'compras_ordenes',
    tags: ['escritura', 'compras', 'ordenes', 'aprobar', 'workflow'],
  },
  'compras.ordenes.cancel': {
    es: 'Cancelar órdenes de compra',
    en: 'Cancel purchase orders',
    category: 'compras_ordenes',
    tags: ['escritura', 'compras', 'ordenes', 'cancelar'],
  },

  // COMPRAS - STOCK / INVENTARIO
  'compras.stock.view': {
    es: 'Ver inventario y stock',
    en: 'View inventory and stock',
    category: 'compras_stock',
    tags: ['lectura', 'compras', 'stock', 'inventario'],
  },
  'compras.stock.ajustes': {
    es: 'Crear ajustes de stock',
    en: 'Create stock adjustments',
    category: 'compras_stock',
    tags: ['escritura', 'compras', 'stock', 'ajustes'],
  },
  'compras.stock.transferencias': {
    es: 'Crear transferencias de stock',
    en: 'Create stock transfers',
    category: 'compras_stock',
    tags: ['escritura', 'compras', 'stock', 'transferencias'],
  },

  // COMPRAS - NOTAS DE CRÉDITO/DÉBITO
  'compras.notas.view': {
    es: 'Ver notas de crédito/débito',
    en: 'View credit/debit notes',
    category: 'compras_notas',
    tags: ['lectura', 'compras', 'notas'],
  },
  'compras.notas.create': {
    es: 'Crear notas de crédito/débito',
    en: 'Create credit/debit notes',
    category: 'compras_notas',
    tags: ['escritura', 'compras', 'notas', 'crear'],
  },
  'compras.notas.edit': {
    es: 'Editar notas de crédito/débito',
    en: 'Edit credit/debit notes',
    category: 'compras_notas',
    tags: ['escritura', 'compras', 'notas', 'editar'],
  },
  'compras.notas.delete': {
    es: 'Eliminar notas de crédito/débito',
    en: 'Delete credit/debit notes',
    category: 'compras_notas',
    tags: ['escritura', 'compras', 'notas', 'eliminar', 'destructivo'],
  },

  // COMPRAS - DEVOLUCIONES
  'compras.devoluciones.view': {
    es: 'Ver devoluciones a proveedores',
    en: 'View returns to suppliers',
    category: 'compras_devoluciones',
    tags: ['lectura', 'compras', 'devoluciones'],
  },
  'compras.devoluciones.create': {
    es: 'Crear devoluciones a proveedores',
    en: 'Create returns to suppliers',
    category: 'compras_devoluciones',
    tags: ['escritura', 'compras', 'devoluciones', 'crear'],
  },
  'compras.devoluciones.edit': {
    es: 'Editar devoluciones a proveedores',
    en: 'Edit returns to suppliers',
    category: 'compras_devoluciones',
    tags: ['escritura', 'compras', 'devoluciones', 'editar'],
  },
  'compras.devoluciones.delete': {
    es: 'Eliminar devoluciones a proveedores',
    en: 'Delete returns to suppliers',
    category: 'compras_devoluciones',
    tags: ['escritura', 'compras', 'devoluciones', 'eliminar', 'destructivo'],
  },

  // COMPRAS - CENTROS DE COSTO
  'compras.centros_costo.view': {
    es: 'Ver centros de costo',
    en: 'View cost centers',
    category: 'compras_centros_costo',
    tags: ['lectura', 'compras', 'centros_costo'],
  },
  'compras.centros_costo.create': {
    es: 'Crear centros de costo',
    en: 'Create cost centers',
    category: 'compras_centros_costo',
    tags: ['escritura', 'compras', 'centros_costo', 'crear'],
  },
  'compras.centros_costo.edit': {
    es: 'Editar centros de costo',
    en: 'Edit cost centers',
    category: 'compras_centros_costo',
    tags: ['escritura', 'compras', 'centros_costo', 'editar'],
  },
  'compras.centros_costo.delete': {
    es: 'Eliminar centros de costo',
    en: 'Delete cost centers',
    category: 'compras_centros_costo',
    tags: ['escritura', 'compras', 'centros_costo', 'eliminar', 'destructivo'],
  },

  // COMPRAS - DEPÓSITOS
  'compras.depositos.view': {
    es: 'Ver depósitos',
    en: 'View warehouses',
    category: 'compras_depositos',
    tags: ['lectura', 'compras', 'depositos'],
  },
  'compras.depositos.create': {
    es: 'Crear depósitos',
    en: 'Create warehouses',
    category: 'compras_depositos',
    tags: ['escritura', 'compras', 'depositos', 'crear'],
  },
  'compras.depositos.edit': {
    es: 'Editar depósitos',
    en: 'Edit warehouses',
    category: 'compras_depositos',
    tags: ['escritura', 'compras', 'depositos', 'editar'],
  },
  'compras.depositos.delete': {
    es: 'Eliminar depósitos',
    en: 'Delete warehouses',
    category: 'compras_depositos',
    tags: ['escritura', 'compras', 'depositos', 'eliminar', 'destructivo'],
  },

  // ═══════════════════════════════════════════════════════
  // PTW (PERMISO DE TRABAJO)
  // ═══════════════════════════════════════════════════════
  'ptw.view': {
    es: 'Ver permisos de trabajo',
    en: 'View work permits',
    category: 'ptw',
    tags: ['lectura', 'ptw', 'seguridad'],
  },
  'ptw.create': {
    es: 'Crear permisos de trabajo',
    en: 'Create work permits',
    category: 'ptw',
    tags: ['escritura', 'ptw', 'crear', 'seguridad'],
  },
  'ptw.edit': {
    es: 'Editar permisos de trabajo',
    en: 'Edit work permits',
    category: 'ptw',
    tags: ['escritura', 'ptw', 'editar', 'seguridad'],
  },
  'ptw.delete': {
    es: 'Eliminar permisos de trabajo',
    en: 'Delete work permits',
    category: 'ptw',
    tags: ['escritura', 'ptw', 'eliminar', 'destructivo', 'seguridad'],
  },
  'ptw.approve': {
    es: 'Aprobar permisos de trabajo',
    en: 'Approve work permits',
    category: 'ptw',
    tags: ['escritura', 'ptw', 'aprobar', 'workflow', 'seguridad'],
  },
  'ptw.reject': {
    es: 'Rechazar permisos de trabajo',
    en: 'Reject work permits',
    category: 'ptw',
    tags: ['escritura', 'ptw', 'rechazar', 'workflow', 'seguridad'],
  },
  'ptw.activate': {
    es: 'Activar permisos de trabajo',
    en: 'Activate work permits',
    category: 'ptw',
    tags: ['escritura', 'ptw', 'activar', 'seguridad'],
  },
  'ptw.suspend': {
    es: 'Suspender permisos de trabajo',
    en: 'Suspend work permits',
    category: 'ptw',
    tags: ['escritura', 'ptw', 'suspender', 'seguridad'],
  },
  'ptw.close': {
    es: 'Cerrar permisos de trabajo',
    en: 'Close work permits',
    category: 'ptw',
    tags: ['escritura', 'ptw', 'cerrar', 'workflow', 'seguridad'],
  },
  'ptw.verify': {
    es: 'Verificar requisitos de permisos de trabajo',
    en: 'Verify work permit requirements',
    category: 'ptw',
    tags: ['lectura', 'ptw', 'verificar', 'seguridad'],
  },

  // ═══════════════════════════════════════════════════════
  // LOTO (LOCKOUT/TAGOUT)
  // ═══════════════════════════════════════════════════════
  'loto.view': {
    es: 'Ver procedimientos y ejecuciones LOTO',
    en: 'View LOTO procedures and executions',
    category: 'loto',
    tags: ['lectura', 'loto', 'seguridad'],
  },
  'loto.procedures.create': {
    es: 'Crear procedimientos LOTO',
    en: 'Create LOTO procedures',
    category: 'loto',
    tags: ['escritura', 'loto', 'procedimientos', 'crear', 'seguridad'],
  },
  'loto.procedures.edit': {
    es: 'Editar procedimientos LOTO',
    en: 'Edit LOTO procedures',
    category: 'loto',
    tags: ['escritura', 'loto', 'procedimientos', 'editar', 'seguridad'],
  },
  'loto.procedures.delete': {
    es: 'Eliminar procedimientos LOTO',
    en: 'Delete LOTO procedures',
    category: 'loto',
    tags: ['escritura', 'loto', 'procedimientos', 'eliminar', 'destructivo', 'seguridad'],
  },
  'loto.procedures.approve': {
    es: 'Aprobar procedimientos LOTO',
    en: 'Approve LOTO procedures',
    category: 'loto',
    tags: ['escritura', 'loto', 'procedimientos', 'aprobar', 'workflow', 'seguridad'],
  },
  'loto.execute': {
    es: 'Ejecutar bloqueo LOTO',
    en: 'Execute LOTO lockout',
    category: 'loto',
    tags: ['escritura', 'loto', 'ejecutar', 'seguridad', 'critico'],
  },
  'loto.release': {
    es: 'Liberar bloqueo LOTO',
    en: 'Release LOTO lockout',
    category: 'loto',
    tags: ['escritura', 'loto', 'liberar', 'seguridad', 'critico'],
  },
  'loto.verify_zero_energy': {
    es: 'Verificar estado de energía cero',
    en: 'Verify zero energy state',
    category: 'loto',
    tags: ['escritura', 'loto', 'verificar', 'seguridad', 'critico'],
  },

  // ═══════════════════════════════════════════════════════
  // SKILLS & CERTIFICACIONES
  // ═══════════════════════════════════════════════════════
  'skills.view': {
    es: 'Ver habilidades y matriz de skills',
    en: 'View skills and skills matrix',
    category: 'skills',
    tags: ['lectura', 'skills', 'rrhh'],
  },
  'skills.create': {
    es: 'Crear habilidades en el catálogo',
    en: 'Create skills in catalog',
    category: 'skills',
    tags: ['escritura', 'skills', 'crear', 'rrhh'],
  },
  'skills.edit': {
    es: 'Editar habilidades',
    en: 'Edit skills',
    category: 'skills',
    tags: ['escritura', 'skills', 'editar', 'rrhh'],
  },
  'skills.delete': {
    es: 'Eliminar habilidades',
    en: 'Delete skills',
    category: 'skills',
    tags: ['escritura', 'skills', 'eliminar', 'destructivo', 'rrhh'],
  },
  'skills.assign': {
    es: 'Asignar habilidades a usuarios',
    en: 'Assign skills to users',
    category: 'skills',
    tags: ['escritura', 'skills', 'asignar', 'rrhh'],
  },
  'skills.verify': {
    es: 'Verificar y aprobar habilidades de usuarios',
    en: 'Verify and approve user skills',
    category: 'skills',
    tags: ['escritura', 'skills', 'verificar', 'aprobar', 'rrhh'],
  },
  'skills.requirements.manage': {
    es: 'Gestionar requisitos de habilidades por tarea/máquina',
    en: 'Manage skill requirements per task/machine',
    category: 'skills',
    tags: ['escritura', 'skills', 'requisitos', 'gestion', 'rrhh'],
  },
  'certifications.view': {
    es: 'Ver certificaciones',
    en: 'View certifications',
    category: 'skills',
    tags: ['lectura', 'certificaciones', 'rrhh'],
  },
  'certifications.create': {
    es: 'Crear y registrar certificaciones',
    en: 'Create and register certifications',
    category: 'skills',
    tags: ['escritura', 'certificaciones', 'crear', 'rrhh'],
  },
  'certifications.edit': {
    es: 'Editar certificaciones',
    en: 'Edit certifications',
    category: 'skills',
    tags: ['escritura', 'certificaciones', 'editar', 'rrhh'],
  },
  'certifications.delete': {
    es: 'Eliminar certificaciones',
    en: 'Delete certifications',
    category: 'skills',
    tags: ['escritura', 'certificaciones', 'eliminar', 'destructivo', 'rrhh'],
  },

  // ═══════════════════════════════════════════════════════
  // CONTADORES DE MÁQUINAS
  // ═══════════════════════════════════════════════════════
  'counters.view': {
    es: 'Ver contadores de máquinas',
    en: 'View machine counters',
    category: 'contadores',
    tags: ['lectura', 'contadores', 'maquinas'],
  },
  'counters.create': {
    es: 'Crear contadores',
    en: 'Create counters',
    category: 'contadores',
    tags: ['escritura', 'contadores', 'crear'],
  },
  'counters.record_reading': {
    es: 'Registrar lecturas de contadores',
    en: 'Record counter readings',
    category: 'contadores',
    tags: ['escritura', 'contadores', 'registrar'],
  },
  'counters.edit': {
    es: 'Editar contadores',
    en: 'Edit counters',
    category: 'contadores',
    tags: ['escritura', 'contadores', 'editar'],
  },
  'counters.delete': {
    es: 'Eliminar contadores',
    en: 'Delete counters',
    category: 'contadores',
    tags: ['escritura', 'contadores', 'eliminar', 'destructivo'],
  },
  'counters.manage_triggers': {
    es: 'Gestionar triggers de mantenimiento preventivo',
    en: 'Manage preventive maintenance triggers',
    category: 'contadores',
    tags: ['escritura', 'contadores', 'triggers', 'preventivo'],
  },

  // ═══════════════════════════════════════════════════════
  // QR
  // ═══════════════════════════════════════════════════════
  'qr.view': {
    es: 'Ver códigos QR generados',
    en: 'View generated QR codes',
    category: 'qr',
    tags: ['lectura', 'qr'],
  },
  'qr.generate': {
    es: 'Generar códigos QR para activos',
    en: 'Generate QR codes for assets',
    category: 'qr',
    tags: ['escritura', 'qr', 'generar'],
  },
  'qr.print': {
    es: 'Imprimir códigos QR',
    en: 'Print QR codes',
    category: 'qr',
    tags: ['lectura', 'qr', 'imprimir'],
  },

  // ═══════════════════════════════════════════════════════
  // MOC (GESTIÓN DEL CAMBIO)
  // ═══════════════════════════════════════════════════════
  'moc.view': {
    es: 'Ver registros de gestión del cambio',
    en: 'View management of change records',
    category: 'moc',
    tags: ['lectura', 'moc', 'cambio'],
  },
  'moc.create': {
    es: 'Crear solicitudes de cambio',
    en: 'Create change requests',
    category: 'moc',
    tags: ['escritura', 'moc', 'crear', 'cambio'],
  },
  'moc.edit': {
    es: 'Editar solicitudes de cambio en borrador',
    en: 'Edit draft change requests',
    category: 'moc',
    tags: ['escritura', 'moc', 'editar', 'cambio'],
  },
  'moc.delete': {
    es: 'Eliminar solicitudes de cambio',
    en: 'Delete change requests',
    category: 'moc',
    tags: ['escritura', 'moc', 'eliminar', 'destructivo', 'cambio'],
  },
  'moc.review': {
    es: 'Revisar solicitudes de cambio',
    en: 'Review change requests',
    category: 'moc',
    tags: ['escritura', 'moc', 'revisar', 'workflow', 'cambio'],
  },
  'moc.approve': {
    es: 'Aprobar o rechazar cambios',
    en: 'Approve or reject changes',
    category: 'moc',
    tags: ['escritura', 'moc', 'aprobar', 'workflow', 'cambio'],
  },
  'moc.implement': {
    es: 'Ejecutar implementación de cambios aprobados',
    en: 'Execute approved change implementation',
    category: 'moc',
    tags: ['escritura', 'moc', 'implementar', 'cambio'],
  },

  // ═══════════════════════════════════════════════════════
  // CALIBRACIÓN
  // ═══════════════════════════════════════════════════════
  'calibration.view': {
    es: 'Ver calibraciones de instrumentos',
    en: 'View instrument calibrations',
    category: 'calibracion',
    tags: ['lectura', 'calibracion', 'instrumentos'],
  },
  'calibration.create': {
    es: 'Crear órdenes de calibración',
    en: 'Create calibration orders',
    category: 'calibracion',
    tags: ['escritura', 'calibracion', 'crear'],
  },
  'calibration.edit': {
    es: 'Editar calibraciones',
    en: 'Edit calibrations',
    category: 'calibracion',
    tags: ['escritura', 'calibracion', 'editar'],
  },
  'calibration.delete': {
    es: 'Eliminar calibraciones',
    en: 'Delete calibrations',
    category: 'calibracion',
    tags: ['escritura', 'calibracion', 'eliminar', 'destructivo'],
  },
  'calibration.execute': {
    es: 'Ejecutar calibración de instrumentos',
    en: 'Execute instrument calibration',
    category: 'calibracion',
    tags: ['escritura', 'calibracion', 'ejecutar'],
  },
  'calibration.approve': {
    es: 'Aprobar resultados de calibración',
    en: 'Approve calibration results',
    category: 'calibracion',
    tags: ['escritura', 'calibracion', 'aprobar', 'workflow'],
  },

  // ═══════════════════════════════════════════════════════
  // LUBRICACIÓN
  // ═══════════════════════════════════════════════════════
  'lubrication.view': {
    es: 'Ver puntos y rutas de lubricación',
    en: 'View lubrication points and routes',
    category: 'lubricacion',
    tags: ['lectura', 'lubricacion', 'mantenimiento'],
  },
  'lubrication.create': {
    es: 'Crear puntos de lubricación',
    en: 'Create lubrication points',
    category: 'lubricacion',
    tags: ['escritura', 'lubricacion', 'crear', 'mantenimiento'],
  },
  'lubrication.edit': {
    es: 'Editar puntos de lubricación',
    en: 'Edit lubrication points',
    category: 'lubricacion',
    tags: ['escritura', 'lubricacion', 'editar', 'mantenimiento'],
  },
  'lubrication.delete': {
    es: 'Eliminar puntos de lubricación',
    en: 'Delete lubrication points',
    category: 'lubricacion',
    tags: ['escritura', 'lubricacion', 'eliminar', 'destructivo', 'mantenimiento'],
  },
  'lubrication.execute': {
    es: 'Ejecutar rutina de lubricación',
    en: 'Execute lubrication routine',
    category: 'lubricacion',
    tags: ['escritura', 'lubricacion', 'ejecutar', 'mantenimiento'],
  },

  // ═══════════════════════════════════════════════════════
  // CONTRATISTAS
  // ═══════════════════════════════════════════════════════
  'contractors.view': {
    es: 'Ver contratistas registrados',
    en: 'View registered contractors',
    category: 'contratistas',
    tags: ['lectura', 'contratistas'],
  },
  'contractors.create': {
    es: 'Crear contratistas',
    en: 'Create contractors',
    category: 'contratistas',
    tags: ['escritura', 'contratistas', 'crear'],
  },
  'contractors.edit': {
    es: 'Editar datos de contratistas',
    en: 'Edit contractor data',
    category: 'contratistas',
    tags: ['escritura', 'contratistas', 'editar'],
  },
  'contractors.delete': {
    es: 'Eliminar contratistas',
    en: 'Delete contractors',
    category: 'contratistas',
    tags: ['escritura', 'contratistas', 'eliminar', 'destructivo'],
  },
  'contractors.assign': {
    es: 'Asignar contratistas a órdenes de trabajo',
    en: 'Assign contractors to work orders',
    category: 'contratistas',
    tags: ['escritura', 'contratistas', 'asignar', 'ordenes'],
  },
  'contractors.rate': {
    es: 'Calificar y evaluar contratistas',
    en: 'Rate and evaluate contractors',
    category: 'contratistas',
    tags: ['escritura', 'contratistas', 'calificar'],
  },

  // ═══════════════════════════════════════════════════════
  // MONITOREO DE CONDICIÓN
  // ═══════════════════════════════════════════════════════
  'condition_monitoring.view': {
    es: 'Ver monitores de condición de equipos',
    en: 'View equipment condition monitors',
    category: 'monitoreo',
    tags: ['lectura', 'monitoreo', 'maquinas'],
  },
  'condition_monitoring.create': {
    es: 'Crear puntos de monitoreo',
    en: 'Create monitoring points',
    category: 'monitoreo',
    tags: ['escritura', 'monitoreo', 'crear'],
  },
  'condition_monitoring.edit': {
    es: 'Editar puntos de monitoreo',
    en: 'Edit monitoring points',
    category: 'monitoreo',
    tags: ['escritura', 'monitoreo', 'editar'],
  },
  'condition_monitoring.delete': {
    es: 'Eliminar puntos de monitoreo',
    en: 'Delete monitoring points',
    category: 'monitoreo',
    tags: ['escritura', 'monitoreo', 'eliminar', 'destructivo'],
  },
  'condition_monitoring.record': {
    es: 'Registrar lecturas de monitoreo',
    en: 'Record monitoring readings',
    category: 'monitoreo',
    tags: ['escritura', 'monitoreo', 'registrar'],
  },
  'condition_monitoring.alerts': {
    es: 'Gestionar alertas de monitoreo',
    en: 'Manage monitoring alerts',
    category: 'monitoreo',
    tags: ['escritura', 'monitoreo', 'alertas'],
  },

  // ═══════════════════════════════════════════════════════
  // BASE DE CONOCIMIENTO
  // ═══════════════════════════════════════════════════════
  'knowledge.view': {
    es: 'Ver artículos de la base de conocimiento',
    en: 'View knowledge base articles',
    category: 'conocimiento',
    tags: ['lectura', 'conocimiento', 'documentacion'],
  },
  'knowledge.create': {
    es: 'Crear artículos',
    en: 'Create articles',
    category: 'conocimiento',
    tags: ['escritura', 'conocimiento', 'crear', 'documentacion'],
  },
  'knowledge.edit': {
    es: 'Editar artículos',
    en: 'Edit articles',
    category: 'conocimiento',
    tags: ['escritura', 'conocimiento', 'editar', 'documentacion'],
  },
  'knowledge.delete': {
    es: 'Eliminar artículos',
    en: 'Delete articles',
    category: 'conocimiento',
    tags: ['escritura', 'conocimiento', 'eliminar', 'destructivo', 'documentacion'],
  },
  'knowledge.publish': {
    es: 'Publicar artículos',
    en: 'Publish articles',
    category: 'conocimiento',
    tags: ['escritura', 'conocimiento', 'publicar', 'workflow', 'documentacion'],
  },
  'knowledge.review': {
    es: 'Revisar artículos antes de publicar',
    en: 'Review articles before publishing',
    category: 'conocimiento',
    tags: ['escritura', 'conocimiento', 'revisar', 'workflow', 'documentacion'],
  },

  // ═══════════════════════════════════════════════════════
  // PRODUCCIÓN
  // ═══════════════════════════════════════════════════════
  'produccion.ingresar': {
    es: 'Acceso al módulo de producción',
    en: 'Access production module',
    category: 'produccion',
    tags: ['navegacion', 'produccion'],
  },
  'produccion.dashboard.view': {
    es: 'Ver dashboard de producción',
    en: 'View production dashboard',
    category: 'produccion',
    tags: ['lectura', 'produccion', 'dashboard'],
  },

  // Órdenes de Producción
  'produccion.ordenes.view': {
    es: 'Ver órdenes de producción',
    en: 'View production orders',
    category: 'produccion_ordenes',
    tags: ['lectura', 'produccion', 'ordenes'],
  },
  'produccion.ordenes.create': {
    es: 'Crear órdenes de producción',
    en: 'Create production orders',
    category: 'produccion_ordenes',
    tags: ['escritura', 'produccion', 'ordenes', 'crear'],
  },
  'produccion.ordenes.edit': {
    es: 'Editar órdenes de producción',
    en: 'Edit production orders',
    category: 'produccion_ordenes',
    tags: ['escritura', 'produccion', 'ordenes', 'editar'],
  },
  'produccion.ordenes.delete': {
    es: 'Eliminar órdenes de producción',
    en: 'Delete production orders',
    category: 'produccion_ordenes',
    tags: ['escritura', 'produccion', 'ordenes', 'eliminar', 'destructivo'],
  },
  'produccion.ordenes.release': {
    es: 'Liberar órdenes de producción',
    en: 'Release production orders',
    category: 'produccion_ordenes',
    tags: ['escritura', 'produccion', 'ordenes', 'liberar', 'workflow'],
  },
  'produccion.ordenes.start': {
    es: 'Iniciar órdenes de producción',
    en: 'Start production orders',
    category: 'produccion_ordenes',
    tags: ['escritura', 'produccion', 'ordenes', 'iniciar', 'workflow'],
  },
  'produccion.ordenes.complete': {
    es: 'Completar órdenes de producción',
    en: 'Complete production orders',
    category: 'produccion_ordenes',
    tags: ['escritura', 'produccion', 'ordenes', 'completar', 'workflow'],
  },

  // Partes Diarios
  'produccion.partes.view': {
    es: 'Ver partes diarios de producción',
    en: 'View daily production reports',
    category: 'produccion_partes',
    tags: ['lectura', 'produccion', 'partes'],
  },
  'produccion.partes.create': {
    es: 'Crear partes diarios',
    en: 'Create daily reports',
    category: 'produccion_partes',
    tags: ['escritura', 'produccion', 'partes', 'crear'],
  },
  'produccion.partes.edit': {
    es: 'Editar partes diarios',
    en: 'Edit daily reports',
    category: 'produccion_partes',
    tags: ['escritura', 'produccion', 'partes', 'editar'],
  },
  'produccion.partes.confirm': {
    es: 'Confirmar partes diarios',
    en: 'Confirm daily reports',
    category: 'produccion_partes',
    tags: ['escritura', 'produccion', 'partes', 'confirmar', 'workflow'],
  },
  'produccion.partes.review': {
    es: 'Revisar partes diarios',
    en: 'Review daily reports',
    category: 'produccion_partes',
    tags: ['escritura', 'produccion', 'partes', 'revisar', 'workflow'],
  },
  'produccion.partes.view_all': {
    es: 'Ver todos los partes (no solo los propios)',
    en: 'View all reports (not just own)',
    category: 'produccion_partes',
    tags: ['lectura', 'produccion', 'partes', 'global'],
  },

  // Paradas
  'produccion.paradas.view': {
    es: 'Ver paradas de producción',
    en: 'View production downtimes',
    category: 'produccion_paradas',
    tags: ['lectura', 'produccion', 'paradas'],
  },
  'produccion.paradas.create': {
    es: 'Crear registros de paradas',
    en: 'Create downtime records',
    category: 'produccion_paradas',
    tags: ['escritura', 'produccion', 'paradas', 'crear'],
  },
  'produccion.paradas.edit': {
    es: 'Editar registros de paradas',
    en: 'Edit downtime records',
    category: 'produccion_paradas',
    tags: ['escritura', 'produccion', 'paradas', 'editar'],
  },
  'produccion.paradas.delete': {
    es: 'Eliminar registros de paradas',
    en: 'Delete downtime records',
    category: 'produccion_paradas',
    tags: ['escritura', 'produccion', 'paradas', 'eliminar', 'destructivo'],
  },
  'produccion.paradas.create_workorder': {
    es: 'Crear orden de trabajo desde una parada',
    en: 'Create work order from a downtime',
    category: 'produccion_paradas',
    tags: ['escritura', 'produccion', 'paradas', 'ordenes', 'mantenimiento'],
  },

  // Calidad
  'produccion.calidad.view': {
    es: 'Ver controles de calidad',
    en: 'View quality controls',
    category: 'produccion_calidad',
    tags: ['lectura', 'produccion', 'calidad'],
  },
  'produccion.calidad.create': {
    es: 'Crear controles de calidad',
    en: 'Create quality controls',
    category: 'produccion_calidad',
    tags: ['escritura', 'produccion', 'calidad', 'crear'],
  },
  'produccion.calidad.approve': {
    es: 'Aprobar controles de calidad',
    en: 'Approve quality controls',
    category: 'produccion_calidad',
    tags: ['escritura', 'produccion', 'calidad', 'aprobar', 'workflow'],
  },
  'produccion.calidad.block_lot': {
    es: 'Bloquear lotes por problemas de calidad',
    en: 'Block lots due to quality issues',
    category: 'produccion_calidad',
    tags: ['escritura', 'produccion', 'calidad', 'bloquear', 'critico'],
  },
  'produccion.calidad.release_lot': {
    es: 'Liberar lotes bloqueados',
    en: 'Release blocked lots',
    category: 'produccion_calidad',
    tags: ['escritura', 'produccion', 'calidad', 'liberar'],
  },

  // Defectos
  'produccion.defectos.view': {
    es: 'Ver defectos registrados',
    en: 'View registered defects',
    category: 'produccion_defectos',
    tags: ['lectura', 'produccion', 'defectos', 'calidad'],
  },
  'produccion.defectos.create': {
    es: 'Crear registros de defectos',
    en: 'Create defect records',
    category: 'produccion_defectos',
    tags: ['escritura', 'produccion', 'defectos', 'crear', 'calidad'],
  },

  // Rutinas
  'produccion.rutinas.view': {
    es: 'Ver rutinas de producción',
    en: 'View production routines',
    category: 'produccion_rutinas',
    tags: ['lectura', 'produccion', 'rutinas'],
  },
  'produccion.rutinas.execute': {
    es: 'Ejecutar rutinas de producción',
    en: 'Execute production routines',
    category: 'produccion_rutinas',
    tags: ['escritura', 'produccion', 'rutinas', 'ejecutar'],
  },
  'produccion.rutinas.manage': {
    es: 'Gestionar plantillas de rutinas',
    en: 'Manage routine templates',
    category: 'produccion_rutinas',
    tags: ['escritura', 'produccion', 'rutinas', 'gestion'],
  },

  // Config Producción
  'produccion.config.view': {
    es: 'Ver configuración de producción',
    en: 'View production configuration',
    category: 'produccion_config',
    tags: ['lectura', 'produccion', 'configuracion'],
  },
  'produccion.config.edit': {
    es: 'Editar configuración de producción',
    en: 'Edit production configuration',
    category: 'produccion_config',
    tags: ['escritura', 'produccion', 'configuracion', 'editar'],
  },
  'produccion.config.work_centers': {
    es: 'Gestionar centros de trabajo',
    en: 'Manage work centers',
    category: 'produccion_config',
    tags: ['escritura', 'produccion', 'configuracion', 'centros_trabajo'],
  },
  'produccion.config.reason_codes': {
    es: 'Gestionar códigos de motivo de parada',
    en: 'Manage downtime reason codes',
    category: 'produccion_config',
    tags: ['escritura', 'produccion', 'configuracion', 'codigos'],
  },
  'produccion.config.shifts': {
    es: 'Gestionar turnos de producción',
    en: 'Manage production shifts',
    category: 'produccion_config',
    tags: ['escritura', 'produccion', 'configuracion', 'turnos'],
  },
  'produccion.config.routines': {
    es: 'Gestionar plantillas de rutinas de producción',
    en: 'Manage production routine templates',
    category: 'produccion_config',
    tags: ['escritura', 'produccion', 'configuracion', 'rutinas'],
  },

  // Reportes Producción
  'produccion.reportes.view': {
    es: 'Ver reportes de producción',
    en: 'View production reports',
    category: 'produccion_reportes',
    tags: ['lectura', 'produccion', 'reportes'],
  },
  'produccion.reportes.export': {
    es: 'Exportar reportes de producción',
    en: 'Export production reports',
    category: 'produccion_reportes',
    tags: ['lectura', 'produccion', 'reportes', 'exportar'],
  },

  // ─── ALMACÉN ────────────────────────────────────────────────────────────────

  // Acceso base
  'ingresar_almacen': {
    es: 'Acceso al módulo de almacén',
    en: 'Access to warehouse module',
    category: 'almacen',
    tags: ['navegacion', 'almacen'],
  },
  'almacen.view': {
    es: 'Ver módulo almacén',
    en: 'View warehouse module',
    category: 'almacen',
    tags: ['lectura', 'almacen'],
  },
  'almacen.view_dashboard': {
    es: 'Ver dashboard de almacén',
    en: 'View warehouse dashboard',
    category: 'almacen',
    tags: ['lectura', 'almacen', 'dashboard'],
  },
  'almacen.view_inventory': {
    es: 'Ver inventario unificado',
    en: 'View unified inventory',
    category: 'almacen',
    tags: ['lectura', 'almacen', 'inventario'],
  },
  'almacen.view_costs': {
    es: 'Ver costos en almacén',
    en: 'View warehouse costs',
    category: 'almacen',
    tags: ['lectura', 'almacen', 'costos'],
  },

  // Solicitudes
  'almacen.request.view': {
    es: 'Ver solicitudes de material',
    en: 'View material requests',
    category: 'almacen_solicitudes',
    tags: ['lectura', 'almacen', 'solicitudes'],
  },
  'almacen.request.view_all': {
    es: 'Ver todas las solicitudes',
    en: 'View all requests',
    category: 'almacen_solicitudes',
    tags: ['lectura', 'almacen', 'solicitudes'],
  },
  'almacen.request.create': {
    es: 'Crear solicitudes de material',
    en: 'Create material requests',
    category: 'almacen_solicitudes',
    tags: ['escritura', 'almacen', 'solicitudes'],
  },
  'almacen.request.edit': {
    es: 'Editar solicitudes propias',
    en: 'Edit own requests',
    category: 'almacen_solicitudes',
    tags: ['escritura', 'almacen', 'solicitudes'],
  },
  'almacen.request.approve': {
    es: 'Aprobar solicitudes',
    en: 'Approve requests',
    category: 'almacen_solicitudes',
    tags: ['aprobacion', 'almacen', 'solicitudes'],
  },
  'almacen.request.reject': {
    es: 'Rechazar solicitudes',
    en: 'Reject requests',
    category: 'almacen_solicitudes',
    tags: ['aprobacion', 'almacen', 'solicitudes'],
  },
  'almacen.request.cancel': {
    es: 'Cancelar solicitudes',
    en: 'Cancel requests',
    category: 'almacen_solicitudes',
    tags: ['escritura', 'almacen', 'solicitudes'],
  },

  // Despachos
  'almacen.dispatch.view': {
    es: 'Ver despachos',
    en: 'View dispatches',
    category: 'almacen_despachos',
    tags: ['lectura', 'almacen', 'despachos'],
  },
  'almacen.dispatch.create': {
    es: 'Crear despachos',
    en: 'Create dispatches',
    category: 'almacen_despachos',
    tags: ['escritura', 'almacen', 'despachos'],
  },
  'almacen.dispatch.process': {
    es: 'Procesar despachos',
    en: 'Process dispatches',
    category: 'almacen_despachos',
    tags: ['escritura', 'almacen', 'despachos'],
  },
  'almacen.dispatch.confirm': {
    es: 'Confirmar entrega',
    en: 'Confirm delivery',
    category: 'almacen_despachos',
    tags: ['escritura', 'almacen', 'despachos', 'confirmacion'],
  },
  'almacen.dispatch.receive': {
    es: 'Confirmar recepción',
    en: 'Confirm reception',
    category: 'almacen_despachos',
    tags: ['escritura', 'almacen', 'despachos', 'recepcion'],
  },
  'almacen.dispatch.cancel': {
    es: 'Cancelar despachos',
    en: 'Cancel dispatches',
    category: 'almacen_despachos',
    tags: ['escritura', 'almacen', 'despachos'],
  },

  // Devoluciones
  'almacen.return.view': {
    es: 'Ver devoluciones',
    en: 'View returns',
    category: 'almacen_devoluciones',
    tags: ['lectura', 'almacen', 'devoluciones'],
  },
  'almacen.return.create': {
    es: 'Crear devoluciones',
    en: 'Create returns',
    category: 'almacen_devoluciones',
    tags: ['escritura', 'almacen', 'devoluciones'],
  },
  'almacen.return.process': {
    es: 'Procesar devoluciones',
    en: 'Process returns',
    category: 'almacen_devoluciones',
    tags: ['escritura', 'almacen', 'devoluciones'],
  },

  // Reservas
  'almacen.reservation.view': {
    es: 'Ver reservas de material',
    en: 'View material reservations',
    category: 'almacen_reservas',
    tags: ['lectura', 'almacen', 'reservas'],
  },
  'almacen.reservation.create': {
    es: 'Crear reservas manuales',
    en: 'Create manual reservations',
    category: 'almacen_reservas',
    tags: ['escritura', 'almacen', 'reservas'],
  },
  'almacen.reservation.release': {
    es: 'Liberar reservas',
    en: 'Release reservations',
    category: 'almacen_reservas',
    tags: ['escritura', 'almacen', 'reservas'],
  },

  // Operaciones
  'almacen.transfer': {
    es: 'Transferir stock entre depósitos',
    en: 'Transfer stock between warehouses',
    category: 'almacen_operaciones',
    tags: ['escritura', 'almacen', 'transferencia'],
  },
  'almacen.adjust': {
    es: 'Ajustar inventario',
    en: 'Adjust inventory',
    category: 'almacen_operaciones',
    tags: ['escritura', 'almacen', 'ajuste'],
  },
  'almacen.cycle_count': {
    es: 'Realizar conteo cíclico',
    en: 'Perform cycle count',
    category: 'almacen_operaciones',
    tags: ['escritura', 'almacen', 'conteo'],
  },

  // Administración de almacén
  'almacen.manage_warehouses': {
    es: 'Administrar depósitos',
    en: 'Manage warehouses',
    category: 'almacen_admin',
    tags: ['admin', 'almacen', 'depositos'],
  },
  'almacen.manage_locations': {
    es: 'Administrar ubicaciones',
    en: 'Manage locations',
    category: 'almacen_admin',
    tags: ['admin', 'almacen', 'ubicaciones'],
  },
  'almacen.manage_all': {
    es: 'Superadmin de almacén',
    en: 'Warehouse superadmin',
    category: 'almacen_admin',
    tags: ['admin', 'almacen', 'superadmin'],
  },
};

// Helper: obtener descripción en el idioma indicado
export function getPermissionDescription(permissionName: string, lang: 'es' | 'en' = 'es'): string {
  const meta = PERMISSION_CATALOG[permissionName];
  if (!meta) return permissionName;
  return lang === 'en' ? meta.en : meta.es;
}

// Helper: obtener categoría display name (con normalización para valores de BD inconsistentes)
export function getCategoryLabel(category: string, lang: 'es' | 'en' = 'es'): string {
  // Try exact match first
  let label = CATEGORY_LABELS[category];
  if (!label) {
    // Normalize: lowercase, trim, replace spaces with underscores, remove accents
    const normalized = category.trim().toLowerCase()
      .replace(/\s+/g, '_')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    label = CATEGORY_LABELS[normalized];
  }
  if (!label) return category;
  return lang === 'en' ? label.en : label.es;
}

// Helper: obtener todos los permisos de una categoría
export function getPermissionsByCategory(category: string): string[] {
  return Object.entries(PERMISSION_CATALOG)
    .filter(([, meta]) => meta.category === category)
    .map(([name]) => name);
}

// Helper: buscar permisos por texto (busca en nombre, descripción ES/EN, tags)
export function searchPermissions(query: string): string[] {
  const q = query.toLowerCase();
  return Object.entries(PERMISSION_CATALOG)
    .filter(([name, meta]) =>
      name.toLowerCase().includes(q) ||
      meta.es.toLowerCase().includes(q) ||
      meta.en.toLowerCase().includes(q) ||
      meta.tags.some(tag => tag.includes(q))
    )
    .map(([name]) => name);
}

// Helper: formato compacto para prompt de IA
export function buildCompactCatalogForAI(): string {
  const byCategory: Record<string, string[]> = {};
  for (const [name, meta] of Object.entries(PERMISSION_CATALOG)) {
    const cat = meta.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(`${name}|${meta.es}`);
  }
  return Object.entries(byCategory)
    .map(([cat, perms]) => {
      const label = CATEGORY_LABELS[cat]?.es || cat;
      return `---${label.toUpperCase()}---\n${perms.join('\n')}`;
    })
    .join('\n\n');
}
