// Sistema de permisos granulares para ORVIT

export type Permission = 
  // Permisos de Usuarios
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  | 'users.edit_role'
  | 'users.activate_deactivate'
  | 'users.view_all_companies'
  | 'gestionar_usuarios'

  // Permisos de Empresas
  | 'companies.view'
  | 'companies.create'
  | 'companies.edit'
  | 'companies.delete'
  | 'companies.manage_users'

  // Permisos de Máquinas
  | 'machines.view'
  | 'machines.create'
  | 'machines.edit'
  | 'machines.delete'
  | 'machines.maintain'
  | 'machines.add_document'
  | 'machines.delete_component'
  | 'machines.promote_component'
  | 'machines.disassemble'

  // Permisos de Tareas
  | 'ingresar_tareas'
  | 'tasks.create'
  | 'tasks.edit'
  | 'tasks.delete'
  | 'tasks.assign'
  | 'tasks.complete'
  | 'tasks.view_all'

  // Permisos de Órdenes de Trabajo
  | 'work_orders.view'
  | 'work_orders.create'
  | 'work_orders.edit'
  | 'work_orders.delete'
  | 'work_orders.assign'
  | 'work_orders.approve'

  // Permisos de Mantenimiento Preventivo
  | 'preventive_maintenance.view'
  | 'preventive_maintenance.create'
  | 'preventive_maintenance.edit'
  | 'preventive_maintenance.delete'
  | 'preventive_maintenance.complete'

  // Permisos de Pañol/Herramientas
  | 'tools.view'
  | 'tools.create'
  | 'tools.edit'
  | 'tools.delete'
  | 'tools.manage_stock'
  | 'tools.manage_loans'
  | 'tools.approve_requests'
  | 'panol.view_products'
  | 'panol.create_product'
  | 'panol.edit_product'
  | 'panol.register_movement'

  // Permisos de Reportes
  | 'reports.view'
  | 'reports.export'
  | 'reports.advanced'

  // Permisos de Configuración
  | 'settings.view'
  | 'settings.edit'
  | 'settings.system'

  // Permisos de Auditoría
  | 'audit.view'
  | 'audit.export'

  // Permisos de Notificaciones
  | 'notifications.manage'
  | 'notifications.system'

  // Permisos de Administración
  | 'admin.permissions'
  | 'admin.roles'

  // Permisos de Tareas Fijas
  | 'fixed_tasks.create'
  | 'fixed_tasks.edit'
  | 'fixed_tasks.delete'
  | 'ver_agenda'
  | 'ver_historial'
  | 'ver_estadisticas'

  // Permisos de Planta
  | 'plant.stop'

  // Permisos de Navegación - Mantenimiento
  | 'ingresar_ordenesdetrabajo'
  | 'ingresar_planificacion'
  | 'ingresar_maquinas_mantenimiento'
  | 'ingresar_panol'
  | 'ingresar_historial_mantenimiento'

  // Permisos de Navegación - Administración
  | 'ingresar_dashboard_administracion'
  | 'ingresar_tareas'
  | 'ingresar_permisos'
  | 'ingresar_usuarios'
  | 'ingresar_reportes'
  | 'ingresar_configuracion'
  | 'ingresar_controles'
  
  // Permisos de Controles
  | 'controles.manage'
  | 'controles.create_records'

  // Permisos de Navegación - Producción
  | 'ingresar_dashboard_produccion'
  | 'ingresar_maquinas_produccion'
  | 'ingresar_vehiculos'

  // Permisos de Sectores
  | 'sectors.edit'
  | 'sectors.delete'
  | 'sectors.create'

  // Permisos de Navegación - Áreas
  | 'ingresar_administracion'
  | 'ingresar_mantenimiento'
  | 'ingresar_produccion'

  // Permisos de Ventas (Legacy - mantener para compatibilidad)
  | 'VIEW_SALES_DASHBOARD'
  | 'VIEW_CLIENTS'
  | 'CREATE_CLIENT'
  | 'EDIT_CLIENT'
  | 'DELETE_CLIENT'
  | 'VIEW_PRODUCTS'
  | 'CREATE_PRODUCT'
  | 'EDIT_PRODUCT'
  | 'DELETE_PRODUCT'
  | 'VIEW_QUOTES'
  | 'CREATE_QUOTE'
  | 'EDIT_QUOTE'
  | 'DELETE_QUOTE'
  | 'APPROVE_QUOTE'
  | 'CONVERT_QUOTE_TO_SALE'
  | 'VIEW_SALES'
  | 'CREATE_SALE'
  | 'EDIT_SALE'
  | 'DELETE_SALE'
  | 'CANCEL_SALE'
  | 'VIEW_SALES_REPORTS'
  | 'EXPORT_SALES_DATA'

  // Permisos de Ventas Premium v2 - Navegación
  | 'ventas.ingresar'                    // Acceso al módulo de ventas
  | 'ventas.dashboard.view'              // Ver dashboard de ventas

  // Permisos de Cotizaciones
  | 'ventas.cotizaciones.view'           // Ver cotizaciones
  | 'ventas.cotizaciones.create'         // Crear cotizaciones
  | 'ventas.cotizaciones.edit'           // Editar cotizaciones
  | 'ventas.cotizaciones.delete'         // Eliminar cotizaciones
  | 'ventas.cotizaciones.send'           // Enviar cotizaciones a clientes
  | 'ventas.cotizaciones.approve'        // Aprobar cotizaciones
  | 'ventas.cotizaciones.convert'        // Convertir a orden de venta
  | 'ventas.cotizaciones.duplicate'      // Duplicar cotizaciones
  | 'ventas.cotizaciones.version'        // Ver historial de versiones
  | 'ventas.cotizaciones.export'         // Exportar cotizaciones a Excel
  | 'ventas.cotizaciones.stats'          // Ver estadísticas/dashboard

  // Permisos de Órdenes de Venta
  | 'ventas.ordenes.view'                // Ver órdenes de venta
  | 'ventas.ordenes.create'              // Crear órdenes de venta
  | 'ventas.ordenes.edit'                // Editar órdenes de venta
  | 'ventas.ordenes.delete'              // Eliminar órdenes de venta
  | 'ventas.ordenes.confirm'             // Confirmar órdenes
  | 'ventas.ordenes.cancel'              // Cancelar órdenes

  // Permisos de Entregas (Delivery físico)
  | 'ventas.entregas.view'               // Ver entregas
  | 'ventas.entregas.create'             // Crear entregas
  | 'ventas.entregas.edit'               // Editar entregas
  | 'ventas.entregas.program'            // Programar entregas
  | 'ventas.entregas.dispatch'           // Despachar entregas
  | 'ventas.entregas.complete'           // Completar entregas
  | 'ventas.entregas.evidence'           // Subir evidencias de entrega

  // Permisos de Remitos (Documento fiscal)
  | 'ventas.remitos.view'                // Ver remitos
  | 'ventas.remitos.create'              // Crear remitos
  | 'ventas.remitos.emit'                // Emitir remitos
  | 'ventas.remitos.void'                // Anular remitos

  // Permisos de Facturas
  | 'ventas.facturas.view'               // Ver facturas
  | 'ventas.facturas.create'             // Crear facturas
  | 'ventas.facturas.edit'               // Editar borradores
  | 'ventas.facturas.emit'               // Emitir facturas
  | 'ventas.facturas.void'               // Anular facturas
  | 'ventas.facturas.send'               // Enviar facturas por email

  // Permisos de Notas de Crédito/Débito
  | 'ventas.notas.view'                  // Ver notas
  | 'ventas.notas.create'                // Crear notas
  | 'ventas.notas.emit'                  // Emitir notas
  | 'ventas.notas.void'                  // Anular notas

  // Permisos de Pagos/Cobranzas
  | 'ventas.pagos.view'                  // Ver pagos
  | 'ventas.pagos.create'                // Registrar pagos
  | 'ventas.pagos.edit'                  // Editar pagos
  | 'ventas.pagos.cancel'                // Cancelar/anular pagos
  | 'ventas.pagos.apply'                 // Aplicar pagos a facturas
  | 'ventas.cobranzas.view'              // Ver cobranzas pendientes
  | 'ventas.cobranzas.manage'            // Gestionar cobranzas

  // Permisos de Cuenta Corriente (Ledger)
  | 'ventas.cuenta_corriente.view'       // Ver cuenta corriente
  | 'ventas.cuenta_corriente.adjust'     // Realizar ajustes
  | 'ventas.cuenta_corriente.recalculate' // Recalcular saldos (admin)
  | 'ventas.ledger.view_full'            // Ver ledger completo

  // Permisos de Listas de Precios
  | 'ventas.listas_precios.view'         // Ver listas de precios
  | 'ventas.listas_precios.create'       // Crear listas
  | 'ventas.listas_precios.edit'         // Editar listas
  | 'ventas.listas_precios.delete'       // Eliminar listas
  | 'ventas.listas_precios.assign'       // Asignar a clientes

  // Permisos de Descuentos
  | 'ventas.descuentos.apply'            // Aplicar descuentos normales
  | 'ventas.descuentos.approve'          // Aprobar descuentos especiales
  | 'ventas.descuentos.unlimited'        // Descuentos sin límite

  // Permisos de Márgenes y Costos (SOLO SERVER-SIDE)
  | 'ventas.margins.view'                // Ver márgenes en documentos
  | 'ventas.costs.view'                  // Ver costos en documentos
  | 'ventas.margins.override'            // Aprobar ventas bajo margen mínimo

  // Permisos de Comisiones
  | 'ventas.comisiones.view_own'         // Ver propias comisiones
  | 'ventas.comisiones.view_all'         // Ver todas las comisiones
  | 'ventas.comisiones.calculate'        // Calcular comisiones
  | 'ventas.comisiones.pay'              // Pagar comisiones

  // Permisos de Aprobaciones
  | 'ventas.aprobaciones.view'           // Ver aprobaciones pendientes
  | 'ventas.aprobaciones.approve'        // Aprobar solicitudes
  | 'ventas.aprobaciones.reject'         // Rechazar solicitudes

  // Permisos de Reportes de Ventas
  | 'ventas.reportes.view'               // Ver reportes básicos
  | 'ventas.reportes.advanced'           // Ver reportes avanzados
  | 'ventas.reportes.rentabilidad'       // Ver rentabilidad
  | 'ventas.reportes.export'             // Exportar reportes
  | 'ventas.reportes.aging'              // Ver aging de cartera

  // Permisos de Portal Cliente
  | 'ventas.portal.config'               // Configurar portal cliente
  | 'ventas.portal.manage_access'        // Gestionar accesos de clientes

  // Permisos de Configuración de Ventas
  | 'ventas.config.view'                 // Ver configuración
  | 'ventas.config.edit'                 // Editar configuración
  | 'ventas.config.numeracion'           // Configurar numeración

  // Permisos de Auditoría de Ventas
  | 'ventas.audit.view'                  // Ver auditoría de ventas
  | 'ventas.audit.export'                // Exportar auditoría

  // Permisos especiales FiscalScope
  | 'ventas.fiscalscope.t1'              // Operar con documentos T1 (formal)
  | 'ventas.fiscalscope.t2'              // Operar con documentos T2 (interno)
  | 'ventas.fiscalscope.t3'              // Operar con documentos T3 (presupuesto)

  // Permisos de Cargas
  | 'cargas.view'
  | 'cargas.manage_trucks'
  | 'cargas.manage_loads'

  // Preference permissions
  | 'pref.l2'      // Level 2 access
  | 'pref.adv'     // Advanced creation
  | 'pref.cfg'     // Configuration
  | 'pref.aud'     // Audit access (SUPERADMIN only)

  // Permisos de Tesorería
  | 'treasury.ingresar'           // Acceso al módulo de tesorería
  | 'treasury.view'               // Ver posición y movimientos
  | 'treasury.manage_cash'        // Gestionar cajas (crear, ajustar)
  | 'treasury.manage_bank'        // Gestionar cuentas bancarias
  | 'treasury.manage_cheque'      // Gestionar cheques (depositar, etc)
  | 'treasury.transfer'           // Realizar transferencias internas
  | 'treasury.reconcile'          // Conciliar cuentas bancarias
  | 'treasury.reports'            // Ver reportes de tesorería

  // Permisos de Pedidos de Compra (Purchase Requests)
  | 'compras.pedidos.view'        // Ver pedidos de compra
  | 'compras.pedidos.create'      // Crear pedidos de compra
  | 'compras.pedidos.edit'        // Editar pedidos de compra
  | 'compras.pedidos.delete'      // Eliminar pedidos de compra
  | 'compras.pedidos.enviar'      // Enviar pedidos a cotización
  | 'compras.pedidos.cancelar'    // Cancelar pedidos
  | 'compras.pedidos.aprobar'     // Aprobar selección de cotización
  | 'compras.pedidos.rechazar'    // Rechazar pedidos

  // Permisos de Cotizaciones de Compra (Purchase Quotations)
  | 'compras.cotizaciones.view'         // Ver cotizaciones
  | 'compras.cotizaciones.create'       // Cargar cotizaciones
  | 'compras.cotizaciones.edit'         // Editar cotizaciones
  | 'compras.cotizaciones.delete'       // Eliminar cotizaciones
  | 'compras.cotizaciones.seleccionar'  // Seleccionar cotización ganadora
  | 'compras.cotizaciones.convertir_oc' // Crear OC desde cotización

  // Permisos de PTW (Permit to Work)
  | 'ptw.view'                          // Ver permisos de trabajo
  | 'ptw.create'                        // Crear permisos de trabajo
  | 'ptw.edit'                          // Editar permisos de trabajo
  | 'ptw.delete'                        // Eliminar permisos de trabajo
  | 'ptw.approve'                       // Aprobar permisos de trabajo
  | 'ptw.reject'                        // Rechazar permisos de trabajo
  | 'ptw.activate'                      // Activar permisos de trabajo
  | 'ptw.suspend'                       // Suspender permisos de trabajo
  | 'ptw.close'                         // Cerrar permisos de trabajo
  | 'ptw.verify'                        // Verificar requisitos de PTW

  // Permisos de LOTO (Lockout-Tagout)
  | 'loto.view'                         // Ver procedimientos y ejecuciones LOTO
  | 'loto.procedures.create'            // Crear procedimientos LOTO
  | 'loto.procedures.edit'              // Editar procedimientos LOTO
  | 'loto.procedures.delete'            // Eliminar procedimientos LOTO
  | 'loto.procedures.approve'           // Aprobar procedimientos LOTO
  | 'loto.execute'                      // Ejecutar bloqueo LOTO
  | 'loto.release'                      // Liberar bloqueo LOTO
  | 'loto.verify_zero_energy'           // Verificar energía cero

  // Permisos de Skills & Certifications
  | 'skills.view'                       // Ver habilidades y matriz de skills
  | 'skills.create'                     // Crear habilidades en el catálogo
  | 'skills.edit'                       // Editar habilidades
  | 'skills.delete'                     // Eliminar habilidades
  | 'skills.assign'                     // Asignar skills a usuarios
  | 'skills.verify'                     // Verificar/aprobar skills de usuarios
  | 'skills.requirements.manage'        // Gestionar requisitos de skills por tarea/máquina
  | 'certifications.view'               // Ver certificaciones
  | 'certifications.create'             // Crear/registrar certificaciones
  | 'certifications.edit'               // Editar certificaciones
  | 'certifications.delete'             // Eliminar certificaciones

  // Permisos de Machine Counters (Usage-Based Maintenance)
  | 'counters.view'                      // Ver contadores
  | 'counters.create'                    // Crear contadores
  | 'counters.record_reading'            // Registrar lecturas
  | 'counters.edit'                      // Editar contadores
  | 'counters.delete'                    // Eliminar contadores
  | 'counters.manage_triggers'           // Gestionar triggers de PM

  // Permisos de QR Codes
  | 'qr.view'                            // Ver códigos QR
  | 'qr.generate'                        // Generar códigos QR
  | 'qr.print'                           // Imprimir códigos QR

  // Permisos de MOC (Management of Change)
  | 'moc.view'                           // Ver registros MOC
  | 'moc.create'                         // Crear solicitudes MOC
  | 'moc.edit'                           // Editar MOC en borrador
  | 'moc.delete'                         // Eliminar MOC
  | 'moc.review'                         // Revisar MOC
  | 'moc.approve'                        // Aprobar/rechazar MOC
  | 'moc.implement'                      // Ejecutar implementación

  // Permisos de Calibration
  | 'calibration.view'                   // Ver calibraciones
  | 'calibration.create'                 // Crear calibraciones
  | 'calibration.edit'                   // Editar calibraciones
  | 'calibration.delete'                 // Eliminar calibraciones
  | 'calibration.execute'                // Ejecutar calibración
  | 'calibration.approve'                // Aprobar resultados

  // Permisos de Lubrication
  | 'lubrication.view'                   // Ver puntos de lubricación
  | 'lubrication.create'                 // Crear puntos de lubricación
  | 'lubrication.edit'                   // Editar puntos
  | 'lubrication.delete'                 // Eliminar puntos
  | 'lubrication.execute'                // Ejecutar lubricación

  // Permisos de Contractors
  | 'contractors.view'                   // Ver contratistas
  | 'contractors.create'                 // Crear contratistas
  | 'contractors.edit'                   // Editar contratistas
  | 'contractors.delete'                 // Eliminar contratistas
  | 'contractors.assign'                 // Asignar a OTs
  | 'contractors.rate'                   // Calificar contratistas

  // Permisos de Condition Monitoring
  | 'condition_monitoring.view'          // Ver monitores
  | 'condition_monitoring.create'        // Crear monitores
  | 'condition_monitoring.edit'          // Editar monitores
  | 'condition_monitoring.delete'        // Eliminar monitores
  | 'condition_monitoring.record'        // Registrar lecturas
  | 'condition_monitoring.alerts'        // Gestionar alertas

  // Permisos de Knowledge Base
  | 'knowledge.view'                     // Ver artículos
  | 'knowledge.create'                   // Crear artículos
  | 'knowledge.edit'                     // Editar artículos
  | 'knowledge.delete'                   // Eliminar artículos
  | 'knowledge.publish'                  // Publicar artículos
  | 'knowledge.review'                   // Revisar artículos

  // Permisos de Producción
  | 'produccion.ingresar'                // Acceso al módulo de producción
  | 'produccion.dashboard.view'          // Ver dashboard de producción

  // Permisos de Órdenes de Producción
  | 'produccion.ordenes.view'            // Ver órdenes de producción
  | 'produccion.ordenes.create'          // Crear órdenes de producción
  | 'produccion.ordenes.edit'            // Editar órdenes de producción
  | 'produccion.ordenes.delete'          // Eliminar órdenes de producción
  | 'produccion.ordenes.release'         // Liberar órdenes de producción
  | 'produccion.ordenes.start'           // Iniciar órdenes de producción
  | 'produccion.ordenes.complete'        // Completar órdenes de producción

  // Permisos de Partes Diarios
  | 'produccion.partes.view'             // Ver partes diarios
  | 'produccion.partes.create'           // Crear partes diarios
  | 'produccion.partes.edit'             // Editar partes diarios
  | 'produccion.partes.confirm'          // Confirmar partes diarios
  | 'produccion.partes.review'           // Revisar partes diarios
  | 'produccion.partes.view_all'         // Ver todos los partes (no solo los propios)

  // Permisos de Paradas
  | 'produccion.paradas.view'            // Ver paradas
  | 'produccion.paradas.create'          // Crear paradas
  | 'produccion.paradas.edit'            // Editar paradas
  | 'produccion.paradas.delete'          // Eliminar paradas
  | 'produccion.paradas.create_workorder' // Crear OT desde parada

  // Permisos de Calidad
  | 'produccion.calidad.view'            // Ver controles de calidad
  | 'produccion.calidad.create'          // Crear controles de calidad
  | 'produccion.calidad.approve'         // Aprobar controles de calidad
  | 'produccion.calidad.block_lot'       // Bloquear lotes
  | 'produccion.calidad.release_lot'     // Liberar lotes

  // Permisos de Defectos
  | 'produccion.defectos.view'           // Ver defectos
  | 'produccion.defectos.create'         // Crear defectos

  // Permisos de Rutinas
  | 'produccion.rutinas.view'            // Ver rutinas
  | 'produccion.rutinas.execute'         // Ejecutar rutinas
  | 'produccion.rutinas.manage'          // Gestionar plantillas de rutinas

  // Permisos de Configuración de Producción
  | 'produccion.config.view'             // Ver configuración
  | 'produccion.config.edit'             // Editar configuración
  | 'produccion.config.work_centers'     // Gestionar centros de trabajo
  | 'produccion.config.reason_codes'     // Gestionar códigos de motivo
  | 'produccion.config.shifts'           // Gestionar turnos
  | 'produccion.config.routines'         // Gestionar plantillas de rutinas

  // Permisos de Reportes de Producción
  | 'produccion.reportes.view'           // Ver reportes de producción
  | 'produccion.reportes.export';        // Exportar reportes de producción

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'ADMIN_ENTERPRISE' | 'SUPERVISOR' | 'USER';

// Permisos de Tareas Fijas
export type FixedTaskPermission =
  | 'fixed_tasks.create'
  | 'fixed_tasks.edit'
  | 'fixed_tasks.delete';

// Definición de capacidades por rol
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPERADMIN: [
    // Acceso total - todas las capacidades
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'users.edit_role',
    'users.activate_deactivate',
    'users.view_all_companies',
    'gestionar_usuarios',
    'companies.view',
    'companies.edit',
    'companies.delete',
    'companies.manage_users',
    'machines.view',
    'machines.create',
    'machines.edit',
    'machines.delete',
    'machines.maintain',
    'machines.add_document',
    'machines.delete_component',
    'machines.promote_component',
    'machines.disassemble',
    'ingresar_tareas',
    'tasks.create',
    'tasks.edit',
    'tasks.delete',
    'tasks.assign',
    'tasks.complete',
    'tasks.view_all',
    'work_orders.view',
    'work_orders.create',
    'work_orders.edit',
    'work_orders.delete',
    'work_orders.assign',
    'work_orders.approve',
    // Permisos de mantenimiento preventivo
    'preventive_maintenance.view',
    'preventive_maintenance.create',
    'preventive_maintenance.edit',
    'preventive_maintenance.delete',
    'preventive_maintenance.complete',
    'tools.view',
    'tools.create',
    'tools.edit',
    'tools.delete',
    'tools.manage_stock',
    'tools.manage_loans',
    'tools.approve_requests',
    'panol.view_products',
    'panol.create_product',
    'panol.edit_product',
    'panol.register_movement',
    'reports.view',
    'reports.export',
    'reports.advanced',
    'settings.view',
    'settings.edit',
    'settings.system',
    'audit.view',
    'audit.export',
    'notifications.manage',
    'notifications.system',
    'admin.permissions',
    'admin.roles',
    'fixed_tasks.create',
    'fixed_tasks.edit',
    'fixed_tasks.delete',
    'ver_agenda',
    'ver_historial',
    'ver_estadisticas',
    // Permisos de sectores
    'sectors.edit',
    'sectors.delete',
    'sectors.create',
    // Permisos de navegación
    'ingresar_administracion',
    'ingresar_mantenimiento',
    'ingresar_produccion',
    'ingresar_controles',
    // Permisos de controles
    'controles.manage',
    'controles.create_records',
    // Permisos de ventas (Legacy)
    'VIEW_SALES_DASHBOARD',
    'VIEW_CLIENTS',
    'CREATE_CLIENT',
    'EDIT_CLIENT',
    'DELETE_CLIENT',
    'VIEW_PRODUCTS',
    'CREATE_PRODUCT',
    'EDIT_PRODUCT',
    'DELETE_PRODUCT',
    'VIEW_QUOTES',
    'CREATE_QUOTE',
    'EDIT_QUOTE',
    'DELETE_QUOTE',
    'APPROVE_QUOTE',
    'CONVERT_QUOTE_TO_SALE',
    'VIEW_SALES',
    'CREATE_SALE',
    'EDIT_SALE',
    'DELETE_SALE',
    'CANCEL_SALE',
    'VIEW_SALES_REPORTS',
    'EXPORT_SALES_DATA',
    // Permisos de Ventas Premium v2 - SUPERADMIN tiene TODOS
    'ventas.ingresar',
    'ventas.dashboard.view',
    // Cotizaciones
    'ventas.cotizaciones.view',
    'ventas.cotizaciones.create',
    'ventas.cotizaciones.edit',
    'ventas.cotizaciones.delete',
    'ventas.cotizaciones.send',
    'ventas.cotizaciones.approve',
    'ventas.cotizaciones.convert',
    'ventas.cotizaciones.duplicate',
    'ventas.cotizaciones.version',
    'ventas.cotizaciones.export',
    'ventas.cotizaciones.stats',
    // Órdenes de venta
    'ventas.ordenes.view',
    'ventas.ordenes.create',
    'ventas.ordenes.edit',
    'ventas.ordenes.delete',
    'ventas.ordenes.confirm',
    'ventas.ordenes.cancel',
    // Entregas
    'ventas.entregas.view',
    'ventas.entregas.create',
    'ventas.entregas.edit',
    'ventas.entregas.program',
    'ventas.entregas.dispatch',
    'ventas.entregas.complete',
    'ventas.entregas.evidence',
    // Remitos
    'ventas.remitos.view',
    'ventas.remitos.create',
    'ventas.remitos.emit',
    'ventas.remitos.void',
    // Facturas
    'ventas.facturas.view',
    'ventas.facturas.create',
    'ventas.facturas.edit',
    'ventas.facturas.emit',
    'ventas.facturas.void',
    'ventas.facturas.send',
    // Notas Cr/Db
    'ventas.notas.view',
    'ventas.notas.create',
    'ventas.notas.emit',
    'ventas.notas.void',
    // Pagos y Cobranzas
    'ventas.pagos.view',
    'ventas.pagos.create',
    'ventas.pagos.edit',
    'ventas.pagos.cancel',
    'ventas.pagos.apply',
    'ventas.cobranzas.view',
    'ventas.cobranzas.manage',
    // Cuenta Corriente
    'ventas.cuenta_corriente.view',
    'ventas.cuenta_corriente.adjust',
    'ventas.cuenta_corriente.recalculate',
    'ventas.ledger.view_full',
    // Listas de precios
    'ventas.listas_precios.view',
    'ventas.listas_precios.create',
    'ventas.listas_precios.edit',
    'ventas.listas_precios.delete',
    'ventas.listas_precios.assign',
    // Descuentos
    'ventas.descuentos.apply',
    'ventas.descuentos.approve',
    'ventas.descuentos.unlimited',
    // Márgenes y Costos
    'ventas.margins.view',
    'ventas.costs.view',
    'ventas.margins.override',
    // Comisiones
    'ventas.comisiones.view_own',
    'ventas.comisiones.view_all',
    'ventas.comisiones.calculate',
    'ventas.comisiones.pay',
    // Aprobaciones
    'ventas.aprobaciones.view',
    'ventas.aprobaciones.approve',
    'ventas.aprobaciones.reject',
    // Reportes
    'ventas.reportes.view',
    'ventas.reportes.advanced',
    'ventas.reportes.rentabilidad',
    'ventas.reportes.export',
    'ventas.reportes.aging',
    // Portal Cliente
    'ventas.portal.config',
    'ventas.portal.manage_access',
    // Configuración
    'ventas.config.view',
    'ventas.config.edit',
    'ventas.config.numeracion',
    // Auditoría
    'ventas.audit.view',
    'ventas.audit.export',
    // FiscalScope
    'ventas.fiscalscope.t1',
    'ventas.fiscalscope.t2',
    'ventas.fiscalscope.t3',
    // Permisos de cargas
    'cargas.view',
    'cargas.manage_trucks',
    'cargas.manage_loads',
    // Preference permissions - SUPERADMIN has all
    'pref.l2',
    'pref.adv',
    'pref.cfg',
    'pref.aud',
    // Permisos de Tesorería - SUPERADMIN tiene todos
    'treasury.ingresar',
    'treasury.view',
    'treasury.manage_cash',
    'treasury.manage_bank',
    'treasury.manage_cheque',
    'treasury.transfer',
    'treasury.reconcile',
    'treasury.reports',
    // Permisos de Pedidos de Compra - SUPERADMIN tiene todos
    'compras.pedidos.view',
    'compras.pedidos.create',
    'compras.pedidos.edit',
    'compras.pedidos.delete',
    'compras.pedidos.enviar',
    'compras.pedidos.cancelar',
    'compras.pedidos.aprobar',
    'compras.pedidos.rechazar',
    // Permisos de Cotizaciones de Compra - SUPERADMIN tiene todos
    'compras.cotizaciones.view',
    'compras.cotizaciones.create',
    'compras.cotizaciones.edit',
    'compras.cotizaciones.delete',
    'compras.cotizaciones.seleccionar',
    'compras.cotizaciones.convertir_oc',
    // Permisos de PTW - SUPERADMIN tiene todos
    'ptw.view',
    'ptw.create',
    'ptw.edit',
    'ptw.delete',
    'ptw.approve',
    'ptw.reject',
    'ptw.activate',
    'ptw.suspend',
    'ptw.close',
    'ptw.verify',
    // Permisos de LOTO - SUPERADMIN tiene todos
    'loto.view',
    'loto.procedures.create',
    'loto.procedures.edit',
    'loto.procedures.delete',
    'loto.procedures.approve',
    'loto.execute',
    'loto.release',
    'loto.verify_zero_energy',

    // Skills & Certifications - Full access
    'skills.view',
    'skills.create',
    'skills.edit',
    'skills.delete',
    'skills.assign',
    'skills.verify',
    'skills.requirements.manage',
    'certifications.view',
    'certifications.create',
    'certifications.edit',
    'certifications.delete',

    // Counters - Full access
    'counters.view',
    'counters.create',
    'counters.record_reading',
    'counters.edit',
    'counters.delete',
    'counters.manage_triggers',

    // QR Codes - Full access
    'qr.view',
    'qr.generate',
    'qr.print',

    // MOC - Full access
    'moc.view',
    'moc.create',
    'moc.edit',
    'moc.delete',
    'moc.review',
    'moc.approve',
    'moc.implement',

    // Calibration - Full access
    'calibration.view',
    'calibration.create',
    'calibration.edit',
    'calibration.delete',
    'calibration.execute',
    'calibration.approve',

    // Lubrication - Full access
    'lubrication.view',
    'lubrication.create',
    'lubrication.edit',
    'lubrication.delete',
    'lubrication.execute',

    // Contractors - Full access
    'contractors.view',
    'contractors.create',
    'contractors.edit',
    'contractors.delete',
    'contractors.assign',
    'contractors.rate',

    // Condition Monitoring - Full access
    'condition_monitoring.view',
    'condition_monitoring.create',
    'condition_monitoring.edit',
    'condition_monitoring.delete',
    'condition_monitoring.record',
    'condition_monitoring.alerts',

    // Knowledge Base - Full access
    'knowledge.view',
    'knowledge.create',
    'knowledge.edit',
    'knowledge.delete',
    'knowledge.publish',
    'knowledge.review',

    // Producción - Full access
    'produccion.ingresar',
    'produccion.dashboard.view',
    'produccion.ordenes.view',
    'produccion.ordenes.create',
    'produccion.ordenes.edit',
    'produccion.ordenes.delete',
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
    'produccion.paradas.delete',
    'produccion.paradas.create_workorder',
    'produccion.calidad.view',
    'produccion.calidad.create',
    'produccion.calidad.approve',
    'produccion.calidad.block_lot',
    'produccion.calidad.release_lot',
    'produccion.defectos.view',
    'produccion.defectos.create',
    'produccion.rutinas.view',
    'produccion.rutinas.execute',
    'produccion.rutinas.manage',
    'produccion.config.view',
    'produccion.config.edit',
    'produccion.config.work_centers',
    'produccion.config.reason_codes',
    'produccion.config.shifts',
    'produccion.config.routines',
    'produccion.reportes.view',
    'produccion.reportes.export'
  ],

  ADMIN: [
    // Administrador Global - puede crear múltiples empresas y administradores de empresa
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'users.edit_role', // Solo USER y SUPERVISOR
    'users.activate_deactivate',
    'gestionar_usuarios',
    'companies.view',
    'companies.edit', // Solo su empresa
    'companies.manage_users',
    'machines.view',
    'machines.create',
    'machines.edit',
    'machines.delete',
    'machines.maintain',
    'machines.add_document',
    'machines.delete_component',
    'machines.promote_component',
    'machines.disassemble',
    'ingresar_tareas',
    'tasks.create',
    'tasks.edit',
    'tasks.delete',
    'tasks.assign',
    'tasks.complete',
    'tasks.view_all',
    'work_orders.view',
    'work_orders.create',
    'work_orders.edit',
    'work_orders.delete',
    'work_orders.assign',
    'work_orders.approve',
    // Permisos de mantenimiento preventivo
    'preventive_maintenance.view',
    'preventive_maintenance.create',
    'preventive_maintenance.edit',
    'preventive_maintenance.delete',
    'preventive_maintenance.complete',
    'tools.view',
    'tools.create',
    'tools.edit',
    'tools.delete',
    'tools.manage_stock',
    'tools.manage_loans',
    'tools.approve_requests',
    'panol.view_products',
    'panol.create_product',
    'panol.edit_product',
    'panol.register_movement',
    'reports.view',
    'reports.export',
    'reports.advanced',
    'settings.view',
    'settings.edit',
    'audit.view',
    'notifications.manage',
    'admin.permissions',
    'admin.roles',
    'fixed_tasks.create',
    'fixed_tasks.edit',
    'fixed_tasks.delete',
    'ver_agenda',
    'ver_historial',
    'ver_estadisticas',
    // Permisos de sectores
    'sectors.edit',
    'sectors.delete',
    'sectors.create',
    // Permisos de navegación
    'ingresar_administracion',
    'ingresar_mantenimiento',
    'ingresar_produccion',
    'ingresar_controles',
    // Permisos de controles
    'controles.manage',
    'controles.create_records',
    // Permisos de ventas (Legacy - excepto DELETE)
    'VIEW_SALES_DASHBOARD',
    'VIEW_CLIENTS',
    'CREATE_CLIENT',
    'EDIT_CLIENT',
    'VIEW_PRODUCTS',
    'CREATE_PRODUCT',
    'EDIT_PRODUCT',
    'VIEW_QUOTES',
    'CREATE_QUOTE',
    'EDIT_QUOTE',
    'APPROVE_QUOTE',
    'CONVERT_QUOTE_TO_SALE',
    'VIEW_SALES',
    'CREATE_SALE',
    'EDIT_SALE',
    'VIEW_SALES_REPORTS',
    'EXPORT_SALES_DATA',
    // Permisos de Ventas Premium v2 - ADMIN (sin DELETE, sin unlimited)
    'ventas.ingresar',
    'ventas.dashboard.view',
    // Cotizaciones (sin delete)
    'ventas.cotizaciones.view',
    'ventas.cotizaciones.create',
    'ventas.cotizaciones.edit',
    'ventas.cotizaciones.send',
    'ventas.cotizaciones.approve',
    'ventas.cotizaciones.convert',
    'ventas.cotizaciones.duplicate',
    'ventas.cotizaciones.version',
    'ventas.cotizaciones.export',
    'ventas.cotizaciones.stats',
    // Órdenes de venta (sin delete)
    'ventas.ordenes.view',
    'ventas.ordenes.create',
    'ventas.ordenes.edit',
    'ventas.ordenes.confirm',
    'ventas.ordenes.cancel',
    // Entregas
    'ventas.entregas.view',
    'ventas.entregas.create',
    'ventas.entregas.edit',
    'ventas.entregas.program',
    'ventas.entregas.dispatch',
    'ventas.entregas.complete',
    'ventas.entregas.evidence',
    // Remitos (sin void)
    'ventas.remitos.view',
    'ventas.remitos.create',
    'ventas.remitos.emit',
    // Facturas (sin void)
    'ventas.facturas.view',
    'ventas.facturas.create',
    'ventas.facturas.edit',
    'ventas.facturas.emit',
    'ventas.facturas.send',
    // Notas Cr/Db
    'ventas.notas.view',
    'ventas.notas.create',
    'ventas.notas.emit',
    // Pagos y Cobranzas (sin cancel)
    'ventas.pagos.view',
    'ventas.pagos.create',
    'ventas.pagos.edit',
    'ventas.pagos.apply',
    'ventas.cobranzas.view',
    'ventas.cobranzas.manage',
    // Cuenta Corriente (sin recalculate)
    'ventas.cuenta_corriente.view',
    'ventas.cuenta_corriente.adjust',
    'ventas.ledger.view_full',
    // Listas de precios (sin delete)
    'ventas.listas_precios.view',
    'ventas.listas_precios.create',
    'ventas.listas_precios.edit',
    'ventas.listas_precios.assign',
    // Descuentos (sin unlimited)
    'ventas.descuentos.apply',
    'ventas.descuentos.approve',
    // Márgenes y Costos
    'ventas.margins.view',
    'ventas.costs.view',
    // Comisiones
    'ventas.comisiones.view_own',
    'ventas.comisiones.view_all',
    'ventas.comisiones.calculate',
    // Aprobaciones
    'ventas.aprobaciones.view',
    'ventas.aprobaciones.approve',
    'ventas.aprobaciones.reject',
    // Reportes
    'ventas.reportes.view',
    'ventas.reportes.advanced',
    'ventas.reportes.rentabilidad',
    'ventas.reportes.export',
    'ventas.reportes.aging',
    // Portal Cliente
    'ventas.portal.config',
    'ventas.portal.manage_access',
    // Configuración (sin numeracion)
    'ventas.config.view',
    'ventas.config.edit',
    // Auditoría
    'ventas.audit.view',
    'ventas.audit.export',
    // FiscalScope
    'ventas.fiscalscope.t1',
    'ventas.fiscalscope.t2',
    'ventas.fiscalscope.t3',
    // Permisos de cargas
    'cargas.view',
    'cargas.manage_trucks',
    'cargas.manage_loads',
    // Preference permissions - ADMIN can access level 2 and advanced
    'pref.l2',
    'pref.adv',
    // Permisos de Tesorería - ADMIN tiene casi todos (sin reconcile)
    'treasury.ingresar',
    'treasury.view',
    'treasury.manage_cash',
    'treasury.manage_bank',
    'treasury.manage_cheque',
    'treasury.transfer',
    'treasury.reports',
    // Permisos de Pedidos de Compra - ADMIN (sin delete)
    'compras.pedidos.view',
    'compras.pedidos.create',
    'compras.pedidos.edit',
    'compras.pedidos.enviar',
    'compras.pedidos.cancelar',
    'compras.pedidos.aprobar',
    'compras.pedidos.rechazar',
    // Permisos de Cotizaciones de Compra - ADMIN (sin delete)
    'compras.cotizaciones.view',
    'compras.cotizaciones.create',
    'compras.cotizaciones.edit',
    'compras.cotizaciones.seleccionar',
    'compras.cotizaciones.convertir_oc',
    // Permisos de PTW - ADMIN (sin delete)
    'ptw.view',
    'ptw.create',
    'ptw.edit',
    'ptw.approve',
    'ptw.reject',
    'ptw.activate',
    'ptw.suspend',
    'ptw.close',
    'ptw.verify',
    // Permisos de LOTO - ADMIN (sin delete de procedimientos)
    'loto.view',
    'loto.procedures.create',
    'loto.procedures.edit',
    'loto.procedures.approve',
    'loto.execute',
    'loto.release',
    'loto.verify_zero_energy',

    // Skills & Certifications (sin delete)
    'skills.view',
    'skills.create',
    'skills.edit',
    'skills.assign',
    'skills.verify',
    'skills.requirements.manage',
    'certifications.view',
    'certifications.create',
    'certifications.edit',

    // Counters - Full access (sin delete)
    'counters.view',
    'counters.create',
    'counters.record_reading',
    'counters.edit',
    'counters.manage_triggers',

    // QR Codes
    'qr.view',
    'qr.generate',
    'qr.print',

    // MOC - Full access (sin delete)
    'moc.view',
    'moc.create',
    'moc.edit',
    'moc.review',
    'moc.approve',
    'moc.implement',

    // Calibration - ADMIN (sin delete)
    'calibration.view',
    'calibration.create',
    'calibration.edit',
    'calibration.execute',
    'calibration.approve',

    // Lubrication - ADMIN (sin delete)
    'lubrication.view',
    'lubrication.create',
    'lubrication.edit',
    'lubrication.execute',

    // Contractors - ADMIN (sin delete)
    'contractors.view',
    'contractors.create',
    'contractors.edit',
    'contractors.assign',
    'contractors.rate',

    // Condition Monitoring - ADMIN (sin delete)
    'condition_monitoring.view',
    'condition_monitoring.create',
    'condition_monitoring.edit',
    'condition_monitoring.record',
    'condition_monitoring.alerts',

    // Knowledge Base - ADMIN (sin delete)
    'knowledge.view',
    'knowledge.create',
    'knowledge.edit',
    'knowledge.publish',
    'knowledge.review',

    // Producción - ADMIN (sin delete)
    'produccion.ingresar',
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
    'produccion.calidad.block_lot',
    'produccion.calidad.release_lot',
    'produccion.defectos.view',
    'produccion.defectos.create',
    'produccion.rutinas.view',
    'produccion.rutinas.execute',
    'produccion.rutinas.manage',
    'produccion.config.view',
    'produccion.config.edit',
    'produccion.config.work_centers',
    'produccion.config.reason_codes',
    'produccion.config.shifts',
    'produccion.config.routines',
    'produccion.reportes.view',
    'produccion.reportes.export'
  ],

  ADMIN_ENTERPRISE: [
    // Administrador de Empresa - gestión completa de UNA empresa específica
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'users.edit_role', // Solo USER y SUPERVISOR
    'users.activate_deactivate',
    'gestionar_usuarios',
    'companies.view',
    'companies.create',
    'companies.edit', // Solo su empresa
    'companies.manage_users',
    'machines.view',
    'machines.create',
    'machines.edit',
    'machines.delete',
    'machines.maintain',
    'machines.add_document',
    'machines.delete_component',
    'machines.promote_component',
    'machines.disassemble',
    'ingresar_tareas',
    'tasks.create',
    'tasks.edit',
    'tasks.delete',
    'tasks.assign',
    'tasks.complete',
    'tasks.view_all',
    'work_orders.view',
    'work_orders.create',
    'work_orders.edit',
    'work_orders.delete',
    'work_orders.assign',
    'work_orders.approve',
    // Permisos de mantenimiento preventivo
    'preventive_maintenance.view',
    'preventive_maintenance.create',
    'preventive_maintenance.edit',
    'preventive_maintenance.delete',
    'preventive_maintenance.complete',
    'tools.view',
    'tools.create',
    'tools.edit',
    'tools.delete',
    'tools.manage_stock',
    'tools.manage_loans',
    'tools.approve_requests',
    'panol.view_products',
    'panol.create_product',
    'panol.edit_product',
    'panol.register_movement',
    'reports.view',
    'reports.export',
    'reports.advanced',
    'settings.view',
    'settings.edit',
    'audit.view',
    'notifications.manage',
    'admin.permissions',
    'admin.roles',
    'fixed_tasks.create',
    'fixed_tasks.edit',
    'fixed_tasks.delete',
    'ver_agenda',
    'ver_historial',
    'ver_estadisticas',
    // Permisos de sectores
    'sectors.edit',
    'sectors.delete',
    'sectors.create',
    // Permisos de navegación
    'ingresar_administracion',
    'ingresar_mantenimiento',
    'ingresar_produccion',
    'ingresar_historial_mantenimiento',
    'ingresar_permisos',
    'ingresar_usuarios',
    'ingresar_dashboard_administracion',
    'ingresar_tareas',
    'ingresar_reportes',
    'ingresar_configuracion',
    'ingresar_ordenesdetrabajo',
    'ingresar_planificacion',
    'ingresar_maquinas_mantenimiento',
    'ingresar_panol',
    // Permisos de ventas (Legacy - excepto DELETE)
    'VIEW_SALES_DASHBOARD',
    'VIEW_CLIENTS',
    'CREATE_CLIENT',
    'EDIT_CLIENT',
    'VIEW_PRODUCTS',
    'CREATE_PRODUCT',
    'EDIT_PRODUCT',
    'VIEW_QUOTES',
    'CREATE_QUOTE',
    'EDIT_QUOTE',
    'APPROVE_QUOTE',
    'CONVERT_QUOTE_TO_SALE',
    'VIEW_SALES',
    'CREATE_SALE',
    'EDIT_SALE',
    'VIEW_SALES_REPORTS',
    'EXPORT_SALES_DATA',
    // Permisos de Ventas Premium v2 - ADMIN_ENTERPRISE (gestión completa de su empresa)
    'ventas.ingresar',
    'ventas.dashboard.view',
    // Cotizaciones (TODOS los permisos)
    'ventas.cotizaciones.view',
    'ventas.cotizaciones.create',
    'ventas.cotizaciones.edit',
    'ventas.cotizaciones.delete',
    'ventas.cotizaciones.send',
    'ventas.cotizaciones.approve',
    'ventas.cotizaciones.convert',
    'ventas.cotizaciones.duplicate',
    'ventas.cotizaciones.version',
    'ventas.cotizaciones.export',
    'ventas.cotizaciones.stats',
    // Órdenes de venta (sin delete)
    'ventas.ordenes.view',
    'ventas.ordenes.create',
    'ventas.ordenes.edit',
    'ventas.ordenes.confirm',
    'ventas.ordenes.cancel',
    // Entregas
    'ventas.entregas.view',
    'ventas.entregas.create',
    'ventas.entregas.edit',
    'ventas.entregas.program',
    'ventas.entregas.dispatch',
    'ventas.entregas.complete',
    'ventas.entregas.evidence',
    // Remitos
    'ventas.remitos.view',
    'ventas.remitos.create',
    'ventas.remitos.emit',
    // Facturas (sin void)
    'ventas.facturas.view',
    'ventas.facturas.create',
    'ventas.facturas.edit',
    'ventas.facturas.emit',
    'ventas.facturas.send',
    // Notas Cr/Db
    'ventas.notas.view',
    'ventas.notas.create',
    'ventas.notas.emit',
    // Pagos y Cobranzas
    'ventas.pagos.view',
    'ventas.pagos.create',
    'ventas.pagos.edit',
    'ventas.pagos.apply',
    'ventas.cobranzas.view',
    'ventas.cobranzas.manage',
    // Cuenta Corriente
    'ventas.cuenta_corriente.view',
    'ventas.cuenta_corriente.adjust',
    'ventas.ledger.view_full',
    // Listas de precios
    'ventas.listas_precios.view',
    'ventas.listas_precios.create',
    'ventas.listas_precios.edit',
    'ventas.listas_precios.assign',
    // Descuentos (sin unlimited)
    'ventas.descuentos.apply',
    'ventas.descuentos.approve',
    // Márgenes (puede ver, no costos)
    'ventas.margins.view',
    // Comisiones
    'ventas.comisiones.view_own',
    'ventas.comisiones.view_all',
    'ventas.comisiones.calculate',
    // Aprobaciones
    'ventas.aprobaciones.view',
    'ventas.aprobaciones.approve',
    'ventas.aprobaciones.reject',
    // Reportes
    'ventas.reportes.view',
    'ventas.reportes.advanced',
    'ventas.reportes.rentabilidad',
    'ventas.reportes.export',
    'ventas.reportes.aging',
    // Portal Cliente
    'ventas.portal.manage_access',
    // Configuración (solo view)
    'ventas.config.view',
    // Auditoría
    'ventas.audit.view',
    // FiscalScope
    'ventas.fiscalscope.t1',
    'ventas.fiscalscope.t3',
    // Permisos de cargas
    'cargas.view',
    'cargas.manage_trucks',
    'cargas.manage_loads',
    // Preference permissions - ADMIN_ENTERPRISE can access level 2
    'pref.l2',
    // Permisos de Tesorería - ADMIN_ENTERPRISE gestiona su empresa
    'treasury.ingresar',
    'treasury.view',
    'treasury.manage_cash',
    'treasury.manage_bank',
    'treasury.manage_cheque',
    'treasury.transfer',
    'treasury.reports',
    // Permisos de Pedidos de Compra - ADMIN_ENTERPRISE (sin delete)
    'compras.pedidos.view',
    'compras.pedidos.create',
    'compras.pedidos.edit',
    'compras.pedidos.enviar',
    'compras.pedidos.cancelar',
    'compras.pedidos.aprobar',
    'compras.pedidos.rechazar',
    // Permisos de Cotizaciones de Compra - ADMIN_ENTERPRISE (sin delete)
    'compras.cotizaciones.view',
    'compras.cotizaciones.create',
    'compras.cotizaciones.edit',
    'compras.cotizaciones.seleccionar',
    'compras.cotizaciones.convertir_oc',
    // Permisos de PTW - ADMIN_ENTERPRISE (gestión completa de su empresa)
    'ptw.view',
    'ptw.create',
    'ptw.edit',
    'ptw.delete',
    'ptw.approve',
    'ptw.reject',
    'ptw.activate',
    'ptw.suspend',
    'ptw.close',
    'ptw.verify',
    // Permisos de LOTO - ADMIN_ENTERPRISE (gestión completa de su empresa)
    'loto.view',
    'loto.procedures.create',
    'loto.procedures.edit',
    'loto.procedures.delete',
    'loto.procedures.approve',
    'loto.execute',
    'loto.release',
    'loto.verify_zero_energy',

    // Skills & Certifications - Full access en su empresa
    'skills.view',
    'skills.create',
    'skills.edit',
    'skills.delete',
    'skills.assign',
    'skills.verify',
    'skills.requirements.manage',
    'certifications.view',
    'certifications.create',
    'certifications.edit',
    'certifications.delete',

    // Counters - Full access
    'counters.view',
    'counters.create',
    'counters.record_reading',
    'counters.edit',
    'counters.delete',
    'counters.manage_triggers',

    // QR Codes - Full access
    'qr.view',
    'qr.generate',
    'qr.print',

    // MOC - Full access
    'moc.view',
    'moc.create',
    'moc.edit',
    'moc.delete',
    'moc.review',
    'moc.approve',
    'moc.implement',

    // Calibration - Full access en su empresa
    'calibration.view',
    'calibration.create',
    'calibration.edit',
    'calibration.delete',
    'calibration.execute',
    'calibration.approve',

    // Lubrication - Full access en su empresa
    'lubrication.view',
    'lubrication.create',
    'lubrication.edit',
    'lubrication.delete',
    'lubrication.execute',

    // Contractors - Full access en su empresa
    'contractors.view',
    'contractors.create',
    'contractors.edit',
    'contractors.delete',
    'contractors.assign',
    'contractors.rate',

    // Condition Monitoring - Full access en su empresa
    'condition_monitoring.view',
    'condition_monitoring.create',
    'condition_monitoring.edit',
    'condition_monitoring.delete',
    'condition_monitoring.record',
    'condition_monitoring.alerts',

    // Knowledge Base - Full access en su empresa
    'knowledge.view',
    'knowledge.create',
    'knowledge.edit',
    'knowledge.delete',
    'knowledge.publish',
    'knowledge.review',

    // Producción - Full access en su empresa
    'produccion.ingresar',
    'produccion.dashboard.view',
    'produccion.ordenes.view',
    'produccion.ordenes.create',
    'produccion.ordenes.edit',
    'produccion.ordenes.delete',
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
    'produccion.paradas.delete',
    'produccion.paradas.create_workorder',
    'produccion.calidad.view',
    'produccion.calidad.create',
    'produccion.calidad.approve',
    'produccion.calidad.block_lot',
    'produccion.calidad.release_lot',
    'produccion.defectos.view',
    'produccion.defectos.create',
    'produccion.rutinas.view',
    'produccion.rutinas.execute',
    'produccion.rutinas.manage',
    'produccion.config.view',
    'produccion.config.edit',
    'produccion.config.work_centers',
    'produccion.config.reason_codes',
    'produccion.config.shifts',
    'produccion.config.routines',
    'produccion.reportes.view',
    'produccion.reportes.export'
  ],

  SUPERVISOR: [
    // Supervisor - gestión operativa y supervisión
    'users.view', // Solo usuarios de su empresa/área
    'machines.view',
    'machines.edit',
    'machines.maintain',
    'ingresar_tareas',
    'tasks.create',
    'tasks.edit',
    'tasks.assign',
    'tasks.complete',
    'tasks.view_all', // En su área
    'work_orders.view',
    'work_orders.create',
    'work_orders.edit',
    'work_orders.assign',
    'work_orders.approve', // Órdenes menores
    'preventive_maintenance.view',
    'preventive_maintenance.create',
    'preventive_maintenance.edit',
    'preventive_maintenance.complete',
    'tools.view',
    'tools.edit',
    'tools.manage_loans',
    'tools.approve_requests', // Solicitudes menores
    'panol.view_products',
    'panol.register_movement',
    'reports.view',
    'reports.export',
    'settings.view',
    'fixed_tasks.create',
    'fixed_tasks.edit',
    'fixed_tasks.delete',
    'ver_agenda',
    'ver_historial',
    'ver_estadisticas',
    // Permisos de sectores (Supervisores pueden editar)
    'sectors.edit',
    // Permisos de navegación
    'ingresar_administracion',
    'ingresar_mantenimiento',
    'ingresar_produccion',
    // Permisos básicos de ventas (Legacy)
    'VIEW_SALES_DASHBOARD',
    'VIEW_CLIENTS',
    'CREATE_CLIENT',
    'VIEW_PRODUCTS',
    'VIEW_QUOTES',
    'CREATE_QUOTE',
    'VIEW_SALES',
    // Permisos de Ventas Premium v2 - SUPERVISOR (operativo)
    'ventas.ingresar',
    'ventas.dashboard.view',
    // Cotizaciones (solo crear y editar propias)
    'ventas.cotizaciones.view',
    'ventas.cotizaciones.create',
    'ventas.cotizaciones.edit',
    'ventas.cotizaciones.send',
    'ventas.cotizaciones.duplicate',
    'ventas.cotizaciones.stats',
    // Órdenes de venta (solo ver y crear)
    'ventas.ordenes.view',
    'ventas.ordenes.create',
    'ventas.ordenes.edit',
    // Entregas (gestión operativa)
    'ventas.entregas.view',
    'ventas.entregas.create',
    'ventas.entregas.edit',
    'ventas.entregas.program',
    'ventas.entregas.dispatch',
    'ventas.entregas.complete',
    'ventas.entregas.evidence',
    // Remitos
    'ventas.remitos.view',
    'ventas.remitos.create',
    // Facturas (solo ver)
    'ventas.facturas.view',
    // Notas Cr/Db (solo ver)
    'ventas.notas.view',
    // Pagos y Cobranzas (ver y registrar)
    'ventas.pagos.view',
    'ventas.pagos.create',
    'ventas.cobranzas.view',
    // Cuenta Corriente (solo ver)
    'ventas.cuenta_corriente.view',
    // Listas de precios (solo ver)
    'ventas.listas_precios.view',
    // Descuentos (solo aplicar normales)
    'ventas.descuentos.apply',
    // Comisiones (solo propias)
    'ventas.comisiones.view_own',
    // Reportes (básicos)
    'ventas.reportes.view',
    // FiscalScope (solo T1 y T3)
    'ventas.fiscalscope.t1',
    'ventas.fiscalscope.t3',
    // Permisos de cargas - solo ver
    'cargas.view',
    // Permisos de Tesorería - SUPERVISOR solo puede ver
    'treasury.ingresar',
    'treasury.view',
    // Permisos de Pedidos de Compra - SUPERVISOR (operativo)
    'compras.pedidos.view',
    'compras.pedidos.create',
    'compras.pedidos.edit',
    'compras.pedidos.enviar',
    // Permisos de Cotizaciones de Compra - SUPERVISOR (cargar y seleccionar)
    'compras.cotizaciones.view',
    'compras.cotizaciones.create',
    'compras.cotizaciones.edit',
    'compras.cotizaciones.seleccionar',
    // Permisos de PTW - SUPERVISOR (puede crear, aprobar y cerrar)
    'ptw.view',
    'ptw.create',
    'ptw.edit',
    'ptw.approve',
    'ptw.reject',
    'ptw.activate',
    'ptw.close',
    'ptw.verify',
    // Permisos de LOTO - SUPERVISOR (puede ejecutar y liberar)
    'loto.view',
    'loto.execute',
    'loto.release',
    'loto.verify_zero_energy',

    // Skills & Certifications - SUPERVISOR (gestión de su equipo)
    'skills.view',
    'skills.assign',                    // Asignar skills a usuarios de su equipo
    'skills.verify',                    // Verificar skills de su equipo
    'certifications.view',
    'certifications.create',            // Registrar certificaciones de su equipo

    // Counters - SUPERVISOR (puede registrar lecturas y gestionar)
    'counters.view',
    'counters.create',
    'counters.record_reading',
    'counters.edit',
    'counters.manage_triggers',

    // QR Codes - SUPERVISOR
    'qr.view',
    'qr.generate',
    'qr.print',

    // MOC - SUPERVISOR (puede revisar e implementar)
    'moc.view',
    'moc.create',
    'moc.edit',
    'moc.review',
    'moc.implement',

    // Calibration - SUPERVISOR (operativo)
    'calibration.view',
    'calibration.create',
    'calibration.edit',
    'calibration.execute',

    // Lubrication - SUPERVISOR (operativo)
    'lubrication.view',
    'lubrication.create',
    'lubrication.edit',
    'lubrication.execute',

    // Contractors - SUPERVISOR (puede asignar y calificar)
    'contractors.view',
    'contractors.assign',
    'contractors.rate',

    // Condition Monitoring - SUPERVISOR (operativo)
    'condition_monitoring.view',
    'condition_monitoring.create',
    'condition_monitoring.edit',
    'condition_monitoring.record',
    'condition_monitoring.alerts',

    // Knowledge Base - SUPERVISOR (puede crear y editar)
    'knowledge.view',
    'knowledge.create',
    'knowledge.edit',

    // Producción - SUPERVISOR (operativo + supervisión + gestión rutinas)
    'produccion.ingresar',
    'produccion.dashboard.view',
    'produccion.ordenes.view',
    'produccion.ordenes.create',
    'produccion.ordenes.edit',
    'produccion.ordenes.start',
    'produccion.ordenes.complete',
    'produccion.partes.view',
    'produccion.partes.create',
    'produccion.partes.edit',
    'produccion.partes.confirm',
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
    'produccion.config.view',
    'produccion.config.routines',
    'produccion.reportes.view'
  ],

  USER: [
    // Usuario básico - operaciones limitadas
    'machines.view',
    'ingresar_tareas', // Solo sus tareas
    'tasks.edit', // Solo sus tareas
    'tasks.complete', // Solo sus tareas
    'work_orders.view', // Solo las asignadas
    'work_orders.edit', // Solo las asignadas
    'preventive_maintenance.view',
    'preventive_maintenance.complete', // Solo los asignados a él
    'tools.view',
    'tools.manage_loans', // Solo sus préstamos
    'panol.view_products',
    'reports.view', // Reportes básicos
    'settings.view', // Solo configuración personal
    // Permisos de Ventas Premium v2 - USER (muy limitado)
    'ventas.dashboard.view',
    'ventas.cotizaciones.view',
    'ventas.ordenes.view',
    'ventas.entregas.view',
    'ventas.facturas.view',
    'ventas.comisiones.view_own', // Solo sus propias comisiones
    'ventas.fiscalscope.t1',
    // Permisos de Pedidos de Compra - USER (solo ver y crear propios)
    'compras.pedidos.view',
    'compras.pedidos.create',
    // Permisos de Cotizaciones de Compra - USER (solo ver)
    'compras.cotizaciones.view',
    // Permisos de PTW - USER (solo ver y crear requests)
    'ptw.view',
    'ptw.create',
    // Permisos de LOTO - USER (solo ver y ejecutar asignados)
    'loto.view',
    'loto.execute',
    'loto.release',

    // Skills & Certifications - USER (solo ver)
    'skills.view',                      // Ver matriz de skills
    'certifications.view',              // Ver sus propias certificaciones

    // Counters - USER (solo ver y registrar lecturas)
    'counters.view',
    'counters.record_reading',

    // QR Codes - USER (solo ver)
    'qr.view',

    // MOC - USER (solo ver y crear solicitudes)
    'moc.view',
    'moc.create',

    // Calibration - USER (solo ver)
    'calibration.view',

    // Lubrication - USER (puede ver y ejecutar asignadas)
    'lubrication.view',
    'lubrication.execute',

    // Contractors - USER (solo ver)
    'contractors.view',

    // Condition Monitoring - USER (puede ver y registrar lecturas)
    'condition_monitoring.view',
    'condition_monitoring.record',

    // Knowledge Base - USER (solo ver artículos publicados)
    'knowledge.view',

    // Producción - USER (solo operaciones básicas)
    'produccion.dashboard.view',
    'produccion.ordenes.view',
    'produccion.partes.view',
    'produccion.partes.create',           // Crear sus propios partes
    'produccion.paradas.view',
    'produccion.paradas.create',          // Reportar paradas
    'produccion.calidad.view',
    'produccion.defectos.view',
    'produccion.defectos.create',         // Reportar defectos
    'produccion.rutinas.view',
    'produccion.rutinas.execute'          // Ejecutar rutinas asignadas
  ]
};

// Permisos de cargas - agregar a roles apropiados
export const CARGA_PERMISSIONS = {
  // Ver cargas y camiones, verlas e imprimirlas
  VIEW: 'cargas.view',
  // Crear/editar/eliminar camiones
  MANAGE_TRUCKS: 'cargas.manage_trucks',
  // Crear/editar/eliminar cargas
  MANAGE_LOADS: 'cargas.manage_loads'
};

// Permisos de Tesorería
export const TREASURY_PERMISSIONS = {
  INGRESAR: 'treasury.ingresar',
  VIEW: 'treasury.view',
  MANAGE_CASH: 'treasury.manage_cash',
  MANAGE_BANK: 'treasury.manage_bank',
  MANAGE_CHEQUE: 'treasury.manage_cheque',
  TRANSFER: 'treasury.transfer',
  RECONCILE: 'treasury.reconcile',
  REPORTS: 'treasury.reports',
} as const;

// Permisos de Pedidos de Compra
export const COMPRAS_PEDIDOS_PERMISSIONS = {
  VIEW: 'compras.pedidos.view',
  CREATE: 'compras.pedidos.create',
  EDIT: 'compras.pedidos.edit',
  DELETE: 'compras.pedidos.delete',
  ENVIAR: 'compras.pedidos.enviar',
  CANCELAR: 'compras.pedidos.cancelar',
  APROBAR: 'compras.pedidos.aprobar',
  RECHAZAR: 'compras.pedidos.rechazar',
} as const;

// Permisos de Cotizaciones de Compra
export const COMPRAS_COTIZACIONES_PERMISSIONS = {
  VIEW: 'compras.cotizaciones.view',
  CREATE: 'compras.cotizaciones.create',
  EDIT: 'compras.cotizaciones.edit',
  DELETE: 'compras.cotizaciones.delete',
  SELECCIONAR: 'compras.cotizaciones.seleccionar',
  CONVERTIR_OC: 'compras.cotizaciones.convertir_oc',
} as const;

// Permisos de PTW (Permit to Work)
export const PTW_PERMISSIONS = {
  VIEW: 'ptw.view',
  CREATE: 'ptw.create',
  EDIT: 'ptw.edit',
  DELETE: 'ptw.delete',
  APPROVE: 'ptw.approve',
  REJECT: 'ptw.reject',
  ACTIVATE: 'ptw.activate',
  SUSPEND: 'ptw.suspend',
  CLOSE: 'ptw.close',
  VERIFY: 'ptw.verify',
} as const;

// Permisos de LOTO (Lockout-Tagout)
export const LOTO_PERMISSIONS = {
  VIEW: 'loto.view',
  PROCEDURES: {
    CREATE: 'loto.procedures.create',
    EDIT: 'loto.procedures.edit',
    DELETE: 'loto.procedures.delete',
    APPROVE: 'loto.procedures.approve',
  },
  EXECUTE: 'loto.execute',
  RELEASE: 'loto.release',
  VERIFY_ZERO_ENERGY: 'loto.verify_zero_energy',
} as const;

// Permisos de Skills & Certifications
export const SKILLS_PERMISSIONS = {
  VIEW: 'skills.view',
  CREATE: 'skills.create',
  EDIT: 'skills.edit',
  DELETE: 'skills.delete',
  ASSIGN: 'skills.assign',
  VERIFY: 'skills.verify',
  REQUIREMENTS: {
    MANAGE: 'skills.requirements.manage',
  },
} as const;

// Permisos de Certifications
export const CERTIFICATIONS_PERMISSIONS = {
  VIEW: 'certifications.view',
  CREATE: 'certifications.create',
  EDIT: 'certifications.edit',
  DELETE: 'certifications.delete',
} as const;

// Permisos de Machine Counters (Usage-Based Maintenance)
export const COUNTERS_PERMISSIONS = {
  VIEW: 'counters.view',
  CREATE: 'counters.create',
  RECORD_READING: 'counters.record_reading',
  EDIT: 'counters.edit',
  DELETE: 'counters.delete',
  MANAGE_TRIGGERS: 'counters.manage_triggers',
} as const;

// Permisos de QR Codes
export const QR_PERMISSIONS = {
  VIEW: 'qr.view',
  GENERATE: 'qr.generate',
  PRINT: 'qr.print',
} as const;

// Permisos de MOC (Management of Change)
export const MOC_PERMISSIONS = {
  VIEW: 'moc.view',
  CREATE: 'moc.create',
  EDIT: 'moc.edit',
  DELETE: 'moc.delete',
  REVIEW: 'moc.review',
  APPROVE: 'moc.approve',
  IMPLEMENT: 'moc.implement',
} as const;

// Permisos de Calibration
export const CALIBRATION_PERMISSIONS = {
  VIEW: 'calibration.view',
  CREATE: 'calibration.create',
  EDIT: 'calibration.edit',
  DELETE: 'calibration.delete',
  EXECUTE: 'calibration.execute',
  APPROVE: 'calibration.approve',
} as const;

// Permisos de Lubrication
export const LUBRICATION_PERMISSIONS = {
  VIEW: 'lubrication.view',
  CREATE: 'lubrication.create',
  EDIT: 'lubrication.edit',
  DELETE: 'lubrication.delete',
  EXECUTE: 'lubrication.execute',
} as const;

// Permisos de Contractors
export const CONTRACTORS_PERMISSIONS = {
  VIEW: 'contractors.view',
  CREATE: 'contractors.create',
  EDIT: 'contractors.edit',
  DELETE: 'contractors.delete',
  ASSIGN: 'contractors.assign',
  RATE: 'contractors.rate',
} as const;

// Permisos de Condition Monitoring
export const CONDITION_MONITORING_PERMISSIONS = {
  VIEW: 'condition_monitoring.view',
  CREATE: 'condition_monitoring.create',
  EDIT: 'condition_monitoring.edit',
  DELETE: 'condition_monitoring.delete',
  RECORD: 'condition_monitoring.record',
  ALERTS: 'condition_monitoring.alerts',
} as const;

// Permisos de Knowledge Base
export const KNOWLEDGE_PERMISSIONS = {
  VIEW: 'knowledge.view',
  CREATE: 'knowledge.create',
  EDIT: 'knowledge.edit',
  DELETE: 'knowledge.delete',
  PUBLISH: 'knowledge.publish',
  REVIEW: 'knowledge.review',
} as const;

// Permisos de ventas Premium v2 - constantes para fácil referencia
export const VENTAS_PERMISSIONS = {
  // Navegación
  INGRESAR: 'ventas.ingresar',
  DASHBOARD_VIEW: 'ventas.dashboard.view',

  // Cotizaciones
  COTIZACIONES: {
    VIEW: 'ventas.cotizaciones.view',
    CREATE: 'ventas.cotizaciones.create',
    EDIT: 'ventas.cotizaciones.edit',
    DELETE: 'ventas.cotizaciones.delete',
    SEND: 'ventas.cotizaciones.send',
    APPROVE: 'ventas.cotizaciones.approve',
    CONVERT: 'ventas.cotizaciones.convert',
    DUPLICATE: 'ventas.cotizaciones.duplicate',
    VERSION: 'ventas.cotizaciones.version',
    EXPORT: 'ventas.cotizaciones.export',
    STATS: 'ventas.cotizaciones.stats',
  },

  // Órdenes de Venta
  ORDENES: {
    VIEW: 'ventas.ordenes.view',
    CREATE: 'ventas.ordenes.create',
    EDIT: 'ventas.ordenes.edit',
    DELETE: 'ventas.ordenes.delete',
    CONFIRM: 'ventas.ordenes.confirm',
    CANCEL: 'ventas.ordenes.cancel',
  },

  // Entregas (Delivery físico)
  ENTREGAS: {
    VIEW: 'ventas.entregas.view',
    CREATE: 'ventas.entregas.create',
    EDIT: 'ventas.entregas.edit',
    PROGRAM: 'ventas.entregas.program',
    DISPATCH: 'ventas.entregas.dispatch',
    COMPLETE: 'ventas.entregas.complete',
    EVIDENCE: 'ventas.entregas.evidence',
  },

  // Remitos (Documento fiscal)
  REMITOS: {
    VIEW: 'ventas.remitos.view',
    CREATE: 'ventas.remitos.create',
    EMIT: 'ventas.remitos.emit',
    VOID: 'ventas.remitos.void',
  },

  // Facturas
  FACTURAS: {
    VIEW: 'ventas.facturas.view',
    CREATE: 'ventas.facturas.create',
    EDIT: 'ventas.facturas.edit',
    EMIT: 'ventas.facturas.emit',
    VOID: 'ventas.facturas.void',
    SEND: 'ventas.facturas.send',
  },

  // Notas Cr/Db
  NOTAS: {
    VIEW: 'ventas.notas.view',
    CREATE: 'ventas.notas.create',
    EMIT: 'ventas.notas.emit',
    VOID: 'ventas.notas.void',
  },

  // Pagos y Cobranzas
  PAGOS: {
    VIEW: 'ventas.pagos.view',
    CREATE: 'ventas.pagos.create',
    EDIT: 'ventas.pagos.edit',
    CANCEL: 'ventas.pagos.cancel',
    APPLY: 'ventas.pagos.apply',
  },
  COBRANZAS: {
    VIEW: 'ventas.cobranzas.view',
    MANAGE: 'ventas.cobranzas.manage',
  },

  // Cuenta Corriente (Ledger)
  CUENTA_CORRIENTE: {
    VIEW: 'ventas.cuenta_corriente.view',
    ADJUST: 'ventas.cuenta_corriente.adjust',
    RECALCULATE: 'ventas.cuenta_corriente.recalculate',
    LEDGER_FULL: 'ventas.ledger.view_full',
  },

  // Listas de Precios
  LISTAS_PRECIOS: {
    VIEW: 'ventas.listas_precios.view',
    CREATE: 'ventas.listas_precios.create',
    EDIT: 'ventas.listas_precios.edit',
    DELETE: 'ventas.listas_precios.delete',
    ASSIGN: 'ventas.listas_precios.assign',
  },

  // Descuentos
  DESCUENTOS: {
    APPLY: 'ventas.descuentos.apply',
    APPROVE: 'ventas.descuentos.approve',
    UNLIMITED: 'ventas.descuentos.unlimited',
  },

  // Márgenes y Costos (SOLO SERVER-SIDE)
  MARGINS: {
    VIEW: 'ventas.margins.view',
    OVERRIDE: 'ventas.margins.override',
  },
  COSTS: {
    VIEW: 'ventas.costs.view',
  },

  // Comisiones
  COMISIONES: {
    VIEW_OWN: 'ventas.comisiones.view_own',
    VIEW_ALL: 'ventas.comisiones.view_all',
    CALCULATE: 'ventas.comisiones.calculate',
    PAY: 'ventas.comisiones.pay',
  },

  // Aprobaciones
  APROBACIONES: {
    VIEW: 'ventas.aprobaciones.view',
    APPROVE: 'ventas.aprobaciones.approve',
    REJECT: 'ventas.aprobaciones.reject',
  },

  // Reportes
  REPORTES: {
    VIEW: 'ventas.reportes.view',
    ADVANCED: 'ventas.reportes.advanced',
    RENTABILIDAD: 'ventas.reportes.rentabilidad',
    EXPORT: 'ventas.reportes.export',
    AGING: 'ventas.reportes.aging',
  },

  // Portal Cliente
  PORTAL: {
    CONFIG: 'ventas.portal.config',
    MANAGE_ACCESS: 'ventas.portal.manage_access',
  },

  // Configuración
  CONFIG: {
    VIEW: 'ventas.config.view',
    EDIT: 'ventas.config.edit',
    NUMERACION: 'ventas.config.numeracion',
  },

  // Auditoría
  AUDIT: {
    VIEW: 'ventas.audit.view',
    EXPORT: 'ventas.audit.export',
  },

  // FiscalScope
  FISCAL_SCOPE: {
    T1: 'ventas.fiscalscope.t1',
    T2: 'ventas.fiscalscope.t2',
    T3: 'ventas.fiscalscope.t3',
  },
} as const;

// Permisos de Producción - constantes para fácil referencia
export const PRODUCCION_PERMISSIONS = {
  // Navegación
  INGRESAR: 'produccion.ingresar',
  DASHBOARD_VIEW: 'produccion.dashboard.view',

  // Órdenes de Producción
  ORDENES: {
    VIEW: 'produccion.ordenes.view',
    CREATE: 'produccion.ordenes.create',
    EDIT: 'produccion.ordenes.edit',
    DELETE: 'produccion.ordenes.delete',
    RELEASE: 'produccion.ordenes.release',
    START: 'produccion.ordenes.start',
    COMPLETE: 'produccion.ordenes.complete',
  },

  // Partes Diarios
  PARTES: {
    VIEW: 'produccion.partes.view',
    CREATE: 'produccion.partes.create',
    EDIT: 'produccion.partes.edit',
    CONFIRM: 'produccion.partes.confirm',
    REVIEW: 'produccion.partes.review',
    VIEW_ALL: 'produccion.partes.view_all',
  },

  // Paradas
  PARADAS: {
    VIEW: 'produccion.paradas.view',
    CREATE: 'produccion.paradas.create',
    EDIT: 'produccion.paradas.edit',
    DELETE: 'produccion.paradas.delete',
    CREATE_WORKORDER: 'produccion.paradas.create_workorder',
  },

  // Calidad
  CALIDAD: {
    VIEW: 'produccion.calidad.view',
    CREATE: 'produccion.calidad.create',
    APPROVE: 'produccion.calidad.approve',
    BLOCK_LOT: 'produccion.calidad.block_lot',
    RELEASE_LOT: 'produccion.calidad.release_lot',
  },

  // Defectos
  DEFECTOS: {
    VIEW: 'produccion.defectos.view',
    CREATE: 'produccion.defectos.create',
  },

  // Rutinas
  RUTINAS: {
    VIEW: 'produccion.rutinas.view',
    EXECUTE: 'produccion.rutinas.execute',
    MANAGE: 'produccion.rutinas.manage',
  },

  // Configuración
  CONFIG: {
    VIEW: 'produccion.config.view',
    EDIT: 'produccion.config.edit',
    WORK_CENTERS: 'produccion.config.work_centers',
    REASON_CODES: 'produccion.config.reason_codes',
    SHIFTS: 'produccion.config.shifts',
    ROUTINES: 'produccion.config.routines',
  },

  // Reportes
  REPORTES: {
    VIEW: 'produccion.reportes.view',
    EXPORT: 'produccion.reportes.export',
  },
} as const;

// Contexto adicional para verificación de permisos
export interface PermissionContext {
  userId: number;
  userRole: UserRole;
  companyId?: number;
  targetUserId?: number;
  targetCompanyId?: number;
  resourceOwnerId?: number;
  isOwner?: boolean;
}

// Función principal para verificar permisos
export function hasPermission(permission: Permission, context: PermissionContext): boolean {
  const rolePermissions = ROLE_PERMISSIONS[context.userRole];
  
  console.log('🔍 DEBUG hasPermission:', {
    permission,
    userRole: context.userRole,
    rolePermissions,
    hasBasicPermission: rolePermissions.includes(permission),
    context
  });
  
  // Si el rol no tiene el permiso base, denegar
  if (!rolePermissions.includes(permission)) {
    console.log('❌ No tiene permiso básico');
    return false;
  }

  // Aplicar lógica contextual específica
  const contextualResult = applyContextualRules(permission, context);
  console.log('🔍 Resultado contextual:', contextualResult);
  
  return contextualResult;
}

// Función para aplicar reglas contextuales específicas
function applyContextualRules(permission: Permission, context: PermissionContext): boolean {
  const { userId, userRole, companyId, targetUserId, targetCompanyId, resourceOwnerId, isOwner } = context;

  switch (permission) {
    // Reglas para usuarios
    case 'users.edit':
    case 'users.delete':
      console.log('🔍 DEBUG users.edit/delete:', {
        userRole,
        userId,
        targetUserId,
        companyId,
        targetCompanyId,
        isSameUser: targetUserId === userId,
        isSameCompany: companyId === targetCompanyId
      });
      
      if (userRole === 'SUPERADMIN') {
        // SUPERADMIN puede editar/eliminar cualquiera excepto otros SUPERADMIN
        const result = targetUserId !== userId;
        console.log('🔍 SUPERADMIN result:', result);
        return result;
      }
      if (userRole === 'ADMIN') {
        // ADMIN puede editar usuarios de su empresa (incluyendo otros ADMIN)
        const result = companyId === targetCompanyId && targetUserId !== userId;
        console.log('🔍 ADMIN result:', result);
        return result;
      }
      if (userRole === 'ADMIN_ENTERPRISE') {
        // ADMIN_ENTERPRISE puede editar usuarios de su empresa (incluyendo otros ADMIN_ENTERPRISE y ADMIN)
        const result = companyId === targetCompanyId && targetUserId !== userId;
        console.log('🔍 ADMIN_ENTERPRISE result:', result);
        return result;
      }
      if (userRole === 'USER' || userRole === 'SUPERVISOR') {
        // Usuarios solo pueden editarse a sí mismos
        const result = userId === targetUserId;
        console.log('🔍 USER/SUPERVISOR result:', result);
        return result;
      }
      console.log('🔍 Default false');
      return false;

    case 'users.edit_role':
      if (userRole === 'SUPERADMIN') {
        return targetUserId !== userId; // No puede cambiar su propio rol
      }
      if (userRole === 'ADMIN') {
        // ADMIN puede cambiar roles a USER, SUPERVISOR y ADMIN en su empresa
        return companyId === targetCompanyId && targetUserId !== userId;
      }
      if (userRole === 'ADMIN_ENTERPRISE') {
        // ADMIN_ENTERPRISE puede cambiar roles a USER, SUPERVISOR, ADMIN_ENTERPRISE y ADMIN en su empresa
        return companyId === targetCompanyId && targetUserId !== userId;
      }
      return false;

    case 'users.view_all_companies':
      return userRole === 'SUPERADMIN';

    // Reglas para empresas
    case 'companies.create':
      // Solo ADMIN_ENTERPRISE puede crear empresas
      return userRole === 'ADMIN_ENTERPRISE';

    case 'companies.edit':
    case 'companies.delete':
      if (userRole === 'SUPERADMIN') return true;
      if (userRole === 'ADMIN') {
        return isOwner || companyId === targetCompanyId;
      }
      return false;

    case 'companies.manage_users':
      if (userRole === 'SUPERADMIN') return true;
      if (userRole === 'ADMIN' || userRole === 'ADMIN_ENTERPRISE') {
        return companyId === targetCompanyId;
      }
      return false;

    // Reglas para tareas
    case 'ingresar_tareas':
    case 'tasks.edit':
    case 'tasks.complete':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      if (userRole === 'SUPERVISOR') {
        // Supervisores pueden ver/editar tareas de su área
        return companyId === targetCompanyId;
      }
      if (userRole === 'USER') {
        // Usuarios solo sus propias tareas o las que les asignaron
        return userId === resourceOwnerId || userId === targetUserId;
      }
      return false;

    case 'tasks.view_all':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      if (userRole === 'SUPERVISOR') {
        return companyId === targetCompanyId;
      }
      return false;

    // Reglas para órdenes de trabajo
    case 'work_orders.view':
    case 'work_orders.edit':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN' || userRole === 'SUPERVISOR') return true;
      if (userRole === 'USER') {
        // Usuarios solo pueden ver/editar órdenes asignadas a ellos
        return userId === targetUserId;
      }
      return false;

    case 'work_orders.approve':
      // Solo ADMIN y SUPERVISOR pueden aprobar
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      if (userRole === 'SUPERVISOR') {
        return companyId === targetCompanyId;
      }
      return false;

    // Reglas para herramientas
    case 'tools.manage_loans':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN' || userRole === 'SUPERVISOR') return true;
      if (userRole === 'USER') {
        // Usuarios solo pueden gestionar sus propios préstamos
        return userId === resourceOwnerId;
      }
      return false;

    case 'tools.approve_requests':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      if (userRole === 'SUPERVISOR') {
        return companyId === targetCompanyId;
      }
      return false;

    // Reglas para reportes
    case 'reports.advanced':
      return userRole === 'SUPERADMIN' || userRole === 'ADMIN';

    // Reglas para configuración
    case 'settings.edit':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      return false;

    case 'settings.system':
      return userRole === 'SUPERADMIN';

    // Reglas para auditoría
    case 'audit.view':
    case 'audit.export':
      return userRole === 'SUPERADMIN' || userRole === 'ADMIN';

    // Reglas para notificaciones
    case 'notifications.manage':
      return userRole === 'SUPERADMIN' || userRole === 'ADMIN';

    case 'notifications.system':
      return userRole === 'SUPERADMIN';

    // Reglas para tareas fijas
    case 'fixed_tasks.create':
    case 'fixed_tasks.edit':
    case 'fixed_tasks.delete':
      if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return true;
      return false;

    default:
      // Para permisos sin reglas específicas, usar solo el permiso del rol
      return true;
  }
}

// Función utilitaria para verificar múltiples permisos
export function hasAnyPermission(permissions: Permission[], context: PermissionContext): boolean {
  return permissions.some(permission => hasPermission(permission, context));
}

// Función utilitaria para verificar todos los permisos
export function hasAllPermissions(permissions: Permission[], context: PermissionContext): boolean {
  return permissions.every(permission => hasPermission(permission, context));
}

// Función para obtener todos los permisos de un rol
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

// Función para verificar si un rol puede gestionar otro rol
export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  if (managerRole === 'SUPERADMIN') {
    return targetRole !== 'SUPERADMIN'; // SUPERADMIN no puede gestionar otros SUPERADMIN
  }
  
  if (managerRole === 'ADMIN') {
    return ['USER', 'SUPERVISOR', 'ADMIN_ENTERPRISE'].includes(targetRole);
  }
  
  if (managerRole === 'ADMIN_ENTERPRISE') {
    return ['USER', 'SUPERVISOR', 'ADMIN_ENTERPRISE', 'ADMIN'].includes(targetRole);
  }
  
  return false;
}

// Función para obtener roles que un usuario puede asignar
export function getAssignableRoles(userRole: UserRole): UserRole[] {
  switch (userRole) {
    case 'SUPERADMIN':
      return ['USER', 'SUPERVISOR', 'ADMIN', 'ADMIN_ENTERPRISE'];
    case 'ADMIN':
      return ['USER', 'SUPERVISOR', 'ADMIN_ENTERPRISE'];
    case 'ADMIN_ENTERPRISE':
      return ['USER', 'SUPERVISOR', 'ADMIN_ENTERPRISE', 'ADMIN'];
    default:
      return [];
  }
}

// Función para verificar jerarquía de roles
export function isHigherRole(role1: UserRole, role2: UserRole): boolean {
  const hierarchy = {
    'SUPERADMIN': 5,
    'ADMIN': 4,
    'ADMIN_ENTERPRISE': 3,
    'SUPERVISOR': 2,
    'USER': 1
  };
  
  return hierarchy[role1] > hierarchy[role2];
}

// Middleware helper para Express/Next.js
export function requirePermission(permission: Permission) {
  return (context: PermissionContext) => {
    if (!hasPermission(permission, context)) {
      throw new Error(`Permiso requerido: ${permission}`);
    }
    return true;
  };
}

// Función para generar contexto desde request
export function createPermissionContext(
  user: { id: number; role: UserRole },
  options: Partial<PermissionContext> = {}
): PermissionContext {
  return {
    userId: user.id,
    userRole: user.role,
    ...options
  };
}

// Si hay una exportación de lista de permisos o descripciones, agregar:
export const EXTRA_PERMISSIONS = [
  {
    name: 'ver_agenda',
    description: 'Permite ver la agenda personal y de tareas',
    category: 'agenda',
  },
  {
    name: 'ver_historial',
    description: 'Permite ver el historial de tareas',
    category: 'agenda',
  },
  {
    name: 'ver_estadisticas',
    description: 'Permite ver las estadísticas de tareas',
    category: 'agenda',
  },
]; 