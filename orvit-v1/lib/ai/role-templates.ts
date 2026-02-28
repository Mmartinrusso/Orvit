// Templates pre-armados para roles comunes en empresas industriales

export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  permissions: string[];
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: 'supervisor_mantenimiento',
    name: 'Supervisor de Mantenimiento',
    description: 'Gestiona órdenes de trabajo, máquinas, preventivos y equipo técnico',
    icon: 'Wrench',
    permissions: [
      // Navegación
      'ingresar_mantenimiento',
      'ingresar_ordenesdetrabajo',
      'ingresar_planificacion',
      'ingresar_maquinas_mantenimiento',
      'ingresar_panol',
      'ingresar_historial_mantenimiento',
      // Máquinas
      'machines.view',
      'machines.create',
      'machines.edit',
      'machines.maintain',
      'machines.add_document',
      // Órdenes de trabajo
      'work_orders.view',
      'work_orders.create',
      'work_orders.edit',
      'work_orders.assign',
      'work_orders.approve',
      // Preventivos
      'preventive_maintenance.view',
      'preventive_maintenance.create',
      'preventive_maintenance.edit',
      'preventive_maintenance.complete',
      // Tareas
      'ingresar_tareas',
      'tasks.create',
      'tasks.edit',
      'tasks.assign',
      'tasks.complete',
      'tasks.view_all',
      // Pañol
      'panol.view_products',
      'tools.view',
      'tools.manage_loans',
      // Agenda y estadísticas
      'ver_agenda',
      'ver_historial',
      'ver_estadisticas',
      // Reportes
      'reports.view',
      'reports.export',
    ],
  },
  {
    id: 'tecnico_mantenimiento',
    name: 'Técnico de Mantenimiento',
    description: 'Ejecuta órdenes de trabajo, registra actividades y consulta máquinas',
    icon: 'Hammer',
    permissions: [
      // Navegación
      'ingresar_mantenimiento',
      'ingresar_ordenesdetrabajo',
      'ingresar_maquinas_mantenimiento',
      'ingresar_panol',
      'ingresar_historial_mantenimiento',
      // Máquinas
      'machines.view',
      'machines.maintain',
      'machines.add_document',
      // Órdenes de trabajo
      'work_orders.view',
      'work_orders.create',
      'work_orders.edit',
      // Preventivos
      'preventive_maintenance.view',
      'preventive_maintenance.complete',
      // Tareas
      'ingresar_tareas',
      'tasks.create',
      'tasks.complete',
      // Pañol
      'panol.view_products',
      'tools.view',
      // Agenda
      'ver_agenda',
      'ver_historial',
    ],
  },
  {
    id: 'operario_produccion',
    name: 'Operario de Producción',
    description: 'Ejecuta rutinas, crea partes diarios y reporta paradas',
    icon: 'Factory',
    permissions: [
      // Navegación
      'ingresar_produccion',
      'ingresar_dashboard_produccion',
      'ingresar_maquinas_produccion',
      'produccion.ingresar',
      // Producción
      'produccion.dashboard.view',
      'produccion.partes.view',
      'produccion.partes.create',
      'produccion.partes.edit',
      'produccion.paradas.view',
      'produccion.paradas.create',
      'produccion.rutinas.view',
      'produccion.rutinas.execute',
      'produccion.defectos.view',
      'produccion.defectos.create',
      'produccion.calidad.view',
      // Máquinas (solo ver)
      'machines.view',
    ],
  },
  {
    id: 'supervisor_produccion',
    name: 'Supervisor de Producción',
    description: 'Gestiona órdenes de producción, revisa partes y controla calidad',
    icon: 'ClipboardCheck',
    permissions: [
      // Navegación
      'ingresar_produccion',
      'ingresar_dashboard_produccion',
      'ingresar_maquinas_produccion',
      'produccion.ingresar',
      // Producción completa
      'produccion.dashboard.view',
      'produccion.ordenes.view',
      'produccion.ordenes.create',
      'produccion.ordenes.edit',
      'produccion.ordenes.release',
      'produccion.ordenes.start',
      'produccion.ordenes.complete',
      'produccion.partes.view',
      'produccion.partes.create',
      'produccion.partes.edit',
      'produccion.partes.confirm',
      'produccion.partes.review',
      'produccion.partes.view_all',
      'produccion.paradas.view',
      'produccion.paradas.create',
      'produccion.paradas.edit',
      'produccion.paradas.create_workorder',
      'produccion.calidad.view',
      'produccion.calidad.create',
      'produccion.calidad.approve',
      'produccion.defectos.view',
      'produccion.defectos.create',
      'produccion.rutinas.view',
      'produccion.rutinas.execute',
      'produccion.rutinas.manage',
      'produccion.reportes.view',
      'produccion.reportes.export',
      // Máquinas
      'machines.view',
      'machines.maintain',
      // Reportes
      'reports.view',
      'ver_estadisticas',
    ],
  },
  {
    id: 'vendedor',
    name: 'Vendedor',
    description: 'Gestiona cotizaciones, órdenes de venta y clientes',
    icon: 'ShoppingCart',
    permissions: [
      // Navegación
      'ventas.ingresar',
      'ventas.dashboard.view',
      // Cotizaciones
      'ventas.cotizaciones.view',
      'ventas.cotizaciones.create',
      'ventas.cotizaciones.edit',
      'ventas.cotizaciones.send',
      'ventas.cotizaciones.duplicate',
      'ventas.cotizaciones.version',
      'ventas.cotizaciones.export',
      'ventas.cotizaciones.stats',
      // Órdenes
      'ventas.ordenes.view',
      'ventas.ordenes.create',
      'ventas.ordenes.edit',
      // Clientes
      'ventas.clientes.view',
      'ventas.clientes.create',
      'ventas.clientes.edit',
      // Comisiones propias
      'ventas.comisiones.view_own',
      // Reportes básicos
      'ventas.reportes.view',
      // Descuentos normales
      'ventas.descuentos.apply',
    ],
  },
  {
    id: 'jefe_compras',
    name: 'Jefe de Compras',
    description: 'Gestiona pedidos, cotizaciones de compra y aprobaciones',
    icon: 'Package',
    permissions: [
      // Compras - Pedidos
      'compras.pedidos.view',
      'compras.pedidos.create',
      'compras.pedidos.edit',
      'compras.pedidos.delete',
      'compras.pedidos.enviar',
      'compras.pedidos.cancelar',
      'compras.pedidos.aprobar',
      'compras.pedidos.rechazar',
      // Compras - Cotizaciones
      'compras.cotizaciones.view',
      'compras.cotizaciones.create',
      'compras.cotizaciones.edit',
      'compras.cotizaciones.delete',
      'compras.cotizaciones.seleccionar',
      'compras.cotizaciones.convertir_oc',
      // Compras - Comprobantes
      'compras.comprobantes.view',
      'compras.comprobantes.create',
      'compras.comprobantes.edit',
      'compras.comprobantes.delete',
      'compras.comprobantes.approve',
      'compras.comprobantes.reject',
      'compras.comprobantes.anular',
      // Compras - Proveedores
      'compras.proveedores.view',
      'compras.proveedores.create',
      'compras.proveedores.edit',
      'compras.proveedores.delete',
      // Compras - Solicitudes
      'compras.solicitudes.view',
      'compras.solicitudes.create',
      'compras.solicitudes.edit',
      'compras.solicitudes.delete',
      'compras.solicitudes.approve',
      'compras.solicitudes.reject',
      // Compras - Órdenes
      'compras.ordenes.view',
      'compras.ordenes.create',
      'compras.ordenes.edit',
      'compras.ordenes.delete',
      'compras.ordenes.approve',
      'compras.ordenes.cancel',
      // Compras - Stock
      'compras.stock.view',
      'compras.stock.ajustes',
      'compras.stock.transferencias',
      // Compras - Notas Cr/Db
      'compras.notas.view',
      'compras.notas.create',
      'compras.notas.edit',
      'compras.notas.delete',
      // Compras - Devoluciones
      'compras.devoluciones.view',
      'compras.devoluciones.create',
      'compras.devoluciones.edit',
      'compras.devoluciones.delete',
      // Compras - Centros de Costo
      'compras.centros_costo.view',
      'compras.centros_costo.create',
      'compras.centros_costo.edit',
      'compras.centros_costo.delete',
      // Compras - Depósitos
      'compras.depositos.view',
      'compras.depositos.create',
      'compras.depositos.edit',
      'compras.depositos.delete',
      // Pañol (consulta)
      'panol.view_products',
      'tools.view',
      // Reportes
      'reports.view',
      'reports.export',
    ],
  },
  {
    id: 'panolero',
    name: 'Pañolero',
    description: 'Gestiona inventario, stock, préstamos y movimientos del pañol',
    icon: 'Warehouse',
    permissions: [
      // Navegación
      'ingresar_mantenimiento',
      'ingresar_panol',
      // Pañol completo
      'panol.view_products',
      'panol.create_product',
      'panol.edit_product',
      'panol.register_movement',
      'tools.view',
      'tools.create',
      'tools.edit',
      'tools.manage_stock',
      'tools.manage_loans',
      'tools.approve_requests',
    ],
  },
  {
    id: 'admin_empresa',
    name: 'Administrador de Empresa',
    description: 'Acceso completo a administración: usuarios, permisos, configuración y reportes',
    icon: 'Shield',
    permissions: [
      // Navegación admin
      'ingresar_administracion',
      'ingresar_dashboard_administracion',
      'ingresar_usuarios',
      'ingresar_permisos',
      'ingresar_reportes',
      'ingresar_configuracion',
      'ingresar_controles',
      // Usuarios
      'users.view',
      'users.create',
      'users.edit',
      'users.delete',
      'users.edit_role',
      'users.activate_deactivate',
      'gestionar_usuarios',
      // Admin
      'admin.permissions',
      'admin.roles',
      // Sectores
      'sectors.create',
      'sectors.edit',
      'sectors.delete',
      // Reportes
      'reports.view',
      'reports.export',
      'reports.advanced',
      // Configuración
      'settings.view',
      'settings.edit',
      // Auditoría
      'audit.view',
      'audit.export',
      // Notificaciones
      'notifications.manage',
      // Controles
      'controles.manage',
      'controles.create_records',
      // Tareas
      'ingresar_tareas',
      'tasks.create',
      'tasks.edit',
      'tasks.delete',
      'tasks.assign',
      'tasks.complete',
      'tasks.view_all',
      'fixed_tasks.create',
      'fixed_tasks.edit',
      'fixed_tasks.delete',
      'ver_agenda',
      'ver_historial',
      'ver_estadisticas',
    ],
  },
  {
    id: 'auditor',
    name: 'Auditor (Solo Lectura)',
    description: 'Acceso de solo lectura a todos los módulos para auditoría y revisión',
    icon: 'Eye',
    permissions: [
      // Navegación
      'ingresar_administracion',
      'ingresar_dashboard_administracion',
      'ingresar_mantenimiento',
      'ingresar_ordenesdetrabajo',
      'ingresar_maquinas_mantenimiento',
      'ingresar_panol',
      'ingresar_historial_mantenimiento',
      'ingresar_reportes',
      // Solo lectura
      'users.view',
      'machines.view',
      'work_orders.view',
      'preventive_maintenance.view',
      'tools.view',
      'panol.view_products',
      'reports.view',
      'reports.export',
      'reports.advanced',
      'audit.view',
      'audit.export',
      'settings.view',
      'ver_agenda',
      'ver_historial',
      'ver_estadisticas',
      'tasks.view_all',
    ],
  },
  {
    id: 'tesorero',
    name: 'Tesorero',
    description: 'Gestiona cajas, bancos, cheques y conciliaciones',
    icon: 'Landmark',
    permissions: [
      'treasury.ingresar',
      'treasury.view',
      'treasury.manage_cash',
      'treasury.manage_bank',
      'treasury.manage_cheque',
      'treasury.transfer',
      'treasury.reconcile',
      'treasury.reports',
      // Reportes generales
      'reports.view',
      'reports.export',
    ],
  },
];

// Helper: buscar template por ID
export function getRoleTemplate(id: string): RoleTemplate | undefined {
  return ROLE_TEMPLATES.find(t => t.id === id);
}
