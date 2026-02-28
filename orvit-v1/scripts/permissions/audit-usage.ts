import { PrismaClient } from '@prisma/client';
import { PERMISSION_CATALOG } from '../../lib/permissions-catalog';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

// All permissions actually referenced in code (collected via grep)
const USED_IN_CODE = new Set([
  // === From hasPermission() in frontend components/hooks ===
  'certifications.view',
  'controles.create_records',
  'controles.manage',
  'ingresar_controles',
  'produccion.calidad.approve',
  'produccion.calidad.block_lot',
  'produccion.calidad.create',
  'produccion.calidad.release_lot',
  'produccion.dashboard.admin',
  'produccion.ordenes.complete',
  'produccion.ordenes.create',
  'produccion.ordenes.delete',
  'produccion.ordenes.edit',
  'produccion.ordenes.start',
  'produccion.paradas.create',
  'produccion.paradas.create_workorder',
  'produccion.paradas.delete',
  'produccion.paradas.edit',
  'produccion.rutinas.execute',
  'produccion.rutinas.manage',
  'skills.create',
  'skills.delete',
  'skills.edit',
  'skills.requirements.manage',
  'skills.view',
  'work_orders.assign',

  // === From PermissionGuard permission="" ===
  'ventas.productos.create',
  'ventas.productos.edit',
  'ventas.clientes.view',
  'ventas.productos.view',
  'VIEW_SALES',
  'cargas.view',
  'ingresar_administracion',
  'ingresar_almacen',
  'ingresar_compras',
  'ingresar_costos_modulo',
  'ingresar_dashboard_administracion',
  'ingresar_mantenimiento',
  'ingresar_nominas',
  'ingresar_ordenesdetrabajo',
  'ingresar_panol',
  'ingresar_permisos',
  'ingresar_produccion',
  'ingresar_tesoreria',
  'ingresar_usuarios',
  'loto.view',
  'moc.create',
  'moc.edit',
  'moc.view',
  'ptw.view',
  'ventas.clientes.view',
  'ventas.cobranzas.view',
  'ventas.config.edit',
  'ventas.cotizaciones.create',
  'ventas.cotizaciones.view',
  'ventas.dashboard.view',
  'ventas.entregas.view',
  'ventas.facturas.create',
  'ventas.facturas.view',
  'ventas.liquidaciones.create',
  'ventas.liquidaciones.view',
  'ventas.listas_precios.view',
  'ventas.notas.view',
  'ventas.ordenes.view',
  'ventas.pagos.edit',
  'ventas.pagos.view',
  'ventas.reportes.view',
  'ventas.vendedores.resumen',

  // === From navigation hook hasPermission() ===
  'almacen.dispatch.view',
  'almacen.request.view',
  'almacen.reservation.view',
  'almacen.return.view',
  'almacen.view',
  'almacen.view_dashboard',
  'almacen.view_inventory',
  'calibration.view',
  'contractors.view',
  'costos',
  'ingresar_auditoria',
  'ingresar_automatizaciones',
  'ingresar_clientes',
  'ingresar_configuracion',
  'ingresar_costos',
  'ingresar_cotizaciones',
  'ingresar_dashboard_ventas',
  'ingresar_personal',
  'ingresar_permisos_roles',
  'ingresar_productos',
  'ingresar_reportes',
  'ingresar_tareas',
  'ingresar_ventas',
  'ingresar_ventas_modulo',
  'mantenimientos',
  'maquinas_mantenimiento',
  'maquinas_produccion',
  'ordenes_de_trabajo',
  'panol',
  'plant.stop',
  'preventive_maintenance.view',
  'produccion.config.reason_codes',
  'produccion.config.shifts',
  'produccion.config.view',
  'produccion.config.work_centers',
  'produccion.dashboard.view',
  'produccion.ordenes.view',
  'produccion.paradas.view',
  'produccion.partes.view',
  'produccion.reportes.view',
  'produccion.rutinas.view',
  'puestos_trabajo',
  'reportes_mantenimiento',
  'unidades_moviles',
  'vehiculos_produccion',
  'ventas',

  // === From backend requirePermission() with direct strings ===
  'almacen.dispatch.create',
  'almacen.request.create',
  'almacen.return.create',
  'compras.facturas.create',

  // === From VENTAS_PERMISSIONS constants (resolved values) ===
  'ventas.clientes.block',
  'ventas.cuenta_corriente.view',
  'ventas.cuenta_corriente.adjust',
  'ventas.cotizaciones.edit',
  'ventas.cotizaciones.delete',
  'ventas.cotizaciones.send',
  'ventas.cotizaciones.approve',
  'ventas.cotizaciones.convert',
  'ventas.cotizaciones.export',
  'ventas.ordenes.create',
  'ventas.ordenes.edit',
  'ventas.ordenes.delete',
  'ventas.ordenes.confirm',
  'ventas.ordenes.cancel',
  'ventas.entregas.create',
  'ventas.entregas.edit',
  'ventas.entregas.complete',
  'ventas.remitos.view',
  'ventas.remitos.create',
  'ventas.remitos.emit',
  'ventas.remitos.void',
  'ventas.facturas.edit',
  'ventas.facturas.emit',
  'ventas.facturas.void',
  'ventas.notas.create',
  'ventas.notas.emit',
  'ventas.notas.void',
  'ventas.pagos.create',
  'ventas.pagos.cancel',
  'ventas.cobranzas.manage',
  'ventas.listas_precios.create',
  'ventas.listas_precios.edit',
  'ventas.listas_precios.delete',
  'ventas.reportes.advanced',
  'ventas.reportes.export',
  'ventas.config.view',
  'ventas.turnos.view',
  'ventas.turnos.create',
  'ventas.turnos.manage',
  'ventas.turnos.reserve',
  'ventas.turnos.complete',
  'ventas.costs.view',
  'ventas.margins.view',
  'ventas.margins.override',
  'ventas.liquidaciones.edit',
  'ventas.liquidaciones.delete',
  'ventas.liquidaciones.confirm',
  'ventas.liquidaciones.pay',

  // === From PRODUCCION_PERMISSIONS constants (resolved values) ===
  'produccion.calidad.view',
  'produccion.config.edit',
  'produccion.ordenes.view',
  'produccion.paradas.view',
  'produccion.partes.create',
  'produccion.partes.edit',
  'produccion.partes.view',
]);

async function main() {
  const catalogNames = Object.keys(PERMISSION_CATALOG);
  const usedCount = catalogNames.filter(n => USED_IN_CODE.has(n)).length;
  const unusedPerms = catalogNames.filter(n => !USED_IN_CODE.has(n));

  console.log(`\n📊 Auditoría de uso de permisos`);
  console.log(`   Total en catálogo: ${catalogNames.length}`);
  console.log(`   Usados en código:  ${usedCount}`);
  console.log(`   Sin usar:          ${unusedPerms.length}`);
  console.log(`   Cobertura:         ${Math.round((usedCount / catalogNames.length) * 100)}%\n`);

  // Group unused by category
  const byCategory: Record<string, string[]> = {};
  for (const p of unusedPerms) {
    const cat = PERMISSION_CATALOG[p]?.category || 'sin_categoria';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }

  console.log('=== Permisos sin usar por categoría ===\n');
  for (const [cat, perms] of Object.entries(byCategory).sort()) {
    console.log(`📁 ${cat} (${perms.length}):`);
    perms.forEach(p => console.log(`   - ${p}`));
    console.log();
  }
}
main().finally(() => prisma.$disconnect());
