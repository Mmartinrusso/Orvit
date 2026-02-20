/**
 * Auth helpers para módulo Ventas
 *
 * Thin wrapper sobre shared-helpers.ts + constantes de permisos del módulo.
 * Agrega auditoría de accesos denegados (logAccessDenied) sobre las funciones base.
 */

import {
  getUserFromToken,
  requireAuth as baseRequireAuth,
  requireAnyPermission as baseRequireAnyPermission,
  checkPermission,
  type AuthUser,
  type AuthResult,
} from '@/lib/auth/shared-helpers';
import { hasUserPermission } from '@/lib/permissions-helpers';
import { logAccessDenied } from '@/lib/ventas/audit-helper';
import { NextResponse } from 'next/server';

// Re-exportar funciones que no necesitan override
export { getUserFromToken, checkPermission };
export { baseRequireAuth as requireAuth };
export type { AuthUser as VentasUser, AuthResult };

/**
 * Verifica autenticación Y un permiso específico.
 * Registra en auditoría si el acceso es denegado.
 */
export async function requirePermission(permission: string): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  const has = await hasUserPermission(user.id, user.companyId, permission);

  if (!has) {
    logAccessDenied({
      companyId: user.companyId,
      userId: user.id,
      requiredPermission: permission,
      resource: permission.split('.').slice(0, 2).join('.'),
    }).catch(() => {});

    return {
      user: null,
      error: NextResponse.json(
        { error: 'Sin permisos para esta acción', requiredPermission: permission },
        { status: 403 },
      ),
    };
  }

  return { user, error: null };
}

/**
 * Verifica autenticación Y que tenga AL MENOS UNO de los permisos.
 * Registra en auditoría si el acceso es denegado.
 */
export async function requireAnyPermission(permissions: string[]): Promise<AuthResult> {
  const user = await getUserFromToken();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  for (const permission of permissions) {
    const has = await hasUserPermission(user.id, user.companyId, permission);
    if (has) {
      return { user, error: null };
    }
  }

  logAccessDenied({
    companyId: user.companyId,
    userId: user.id,
    requiredPermission: permissions.join(', '),
    resource: permissions[0]?.split('.').slice(0, 2).join('.') || 'unknown',
  }).catch(() => {});

  return {
    user: null,
    error: NextResponse.json(
      { error: 'Sin permisos para esta acción', requiredPermissions: permissions },
      { status: 403 },
    ),
  };
}

// Permission constants for ventas module
export const VENTAS_PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'ventas.dashboard.view',

  // Clientes
  CLIENTES_VIEW: 'VIEW_CLIENTS',
  CLIENTES_CREATE: 'CREATE_CLIENT',
  CLIENTES_EDIT: 'EDIT_CLIENT',
  CLIENTES_DELETE: 'DELETE_CLIENT',
  CLIENTES_BLOCK: 'ventas.clientes.block',
  CLIENTES_CREDIT_VIEW: 'ventas.cuenta_corriente.view',
  CLIENTES_CREDIT_ADJUST: 'ventas.cuenta_corriente.adjust',

  // Productos
  PRODUCTOS_VIEW: 'VIEW_PRODUCTS',
  PRODUCTOS_CREATE: 'CREATE_PRODUCT',
  PRODUCTOS_EDIT: 'EDIT_PRODUCT',
  PRODUCTOS_DELETE: 'DELETE_PRODUCT',

  // Cotizaciones
  COTIZACIONES_VIEW: 'ventas.cotizaciones.view',
  COTIZACIONES_CREATE: 'ventas.cotizaciones.create',
  COTIZACIONES_EDIT: 'ventas.cotizaciones.edit',
  COTIZACIONES_DELETE: 'ventas.cotizaciones.delete',
  COTIZACIONES_SEND: 'ventas.cotizaciones.send',
  COTIZACIONES_APPROVE: 'ventas.cotizaciones.approve',
  COTIZACIONES_CONVERT: 'ventas.cotizaciones.convert',
  COTIZACIONES_EXPORT: 'ventas.cotizaciones.export',

  // Ordenes de Venta
  ORDENES_VIEW: 'ventas.ordenes.view',
  ORDENES_CREATE: 'ventas.ordenes.create',
  ORDENES_EDIT: 'ventas.ordenes.edit',
  ORDENES_DELETE: 'ventas.ordenes.delete',
  ORDENES_CONFIRM: 'ventas.ordenes.confirm',
  ORDENES_CANCEL: 'ventas.ordenes.cancel',

  // Entregas
  ENTREGAS_VIEW: 'ventas.entregas.view',
  ENTREGAS_CREATE: 'ventas.entregas.create',
  ENTREGAS_EDIT: 'ventas.entregas.edit',
  ENTREGAS_COMPLETE: 'ventas.entregas.complete',

  // Remitos
  REMITOS_VIEW: 'ventas.remitos.view',
  REMITOS_CREATE: 'ventas.remitos.create',
  REMITOS_EMIT: 'ventas.remitos.emit',
  REMITOS_VOID: 'ventas.remitos.void',

  // Facturas
  FACTURAS_VIEW: 'ventas.facturas.view',
  FACTURAS_CREATE: 'ventas.facturas.create',
  FACTURAS_EDIT: 'ventas.facturas.edit',
  FACTURAS_EMIT: 'ventas.facturas.emit',
  FACTURAS_VOID: 'ventas.facturas.void',

  // Notas de Crédito/Débito
  NOTAS_VIEW: 'ventas.notas.view',
  NOTAS_CREATE: 'ventas.notas.create',
  NOTAS_EMIT: 'ventas.notas.emit',
  NOTAS_VOID: 'ventas.notas.void',

  // Pagos/Cobranzas
  PAGOS_VIEW: 'ventas.pagos.view',
  PAGOS_CREATE: 'ventas.pagos.create',
  PAGOS_EDIT: 'ventas.pagos.edit',
  PAGOS_CANCEL: 'ventas.pagos.cancel',
  COBRANZAS_VIEW: 'ventas.cobranzas.view',
  COBRANZAS_MANAGE: 'ventas.cobranzas.manage',

  // Listas de Precios
  LISTAS_PRECIOS_VIEW: 'ventas.listas_precios.view',
  LISTAS_PRECIOS_CREATE: 'ventas.listas_precios.create',
  LISTAS_PRECIOS_EDIT: 'ventas.listas_precios.edit',
  LISTAS_PRECIOS_DELETE: 'ventas.listas_precios.delete',

  // Reportes
  REPORTES_VIEW: 'ventas.reportes.view',
  REPORTES_ADVANCED: 'ventas.reportes.advanced',
  REPORTES_EXPORT: 'ventas.reportes.export',

  // Configuración
  CONFIG_VIEW: 'ventas.config.view',
  CONFIG_EDIT: 'ventas.config.edit',

  // Turnos de Retiro
  TURNOS_VIEW: 'ventas.turnos.view',
  TURNOS_CREATE: 'ventas.turnos.create',
  TURNOS_MANAGE: 'ventas.turnos.manage',
  TURNOS_RESERVE: 'ventas.turnos.reserve',
  TURNOS_COMPLETE: 'ventas.turnos.complete',

  // Permisos granulares de costos y márgenes
  COSTS_VIEW: 'ventas.costs.view',
  MARGINS_VIEW: 'ventas.margins.view',
  MARGINS_OVERRIDE: 'ventas.margins.override',
} as const;
