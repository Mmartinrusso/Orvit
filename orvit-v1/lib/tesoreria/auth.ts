/**
 * Auth helpers para módulo Tesorería
 *
 * Thin wrapper sobre shared-helpers.ts + constantes de permisos del módulo.
 * Re-exporta funciones centralizadas para retrocompatibilidad.
 */

export {
  getUserFromToken,
  requireAuth,
  requirePermission,
  requireAnyPermission,
  checkPermission,
} from '@/lib/auth/shared-helpers';

export type { AuthUser as TesoreriaUser, AuthResult } from '@/lib/auth/shared-helpers';

// Permission constants for tesoreria module
export const TESORERIA_PERMISSIONS = {
  // Dashboard / Posición
  POSICION_VIEW: 'tesoreria.posicion.view',

  // Cajas
  CAJAS_VIEW: 'tesoreria.cajas.view',
  CAJAS_CREATE: 'tesoreria.cajas.create',
  CAJAS_EDIT: 'tesoreria.cajas.edit',
  CAJAS_DELETE: 'tesoreria.cajas.delete',

  // Bancos
  BANCOS_VIEW: 'tesoreria.bancos.view',
  BANCOS_CREATE: 'tesoreria.bancos.create',
  BANCOS_EDIT: 'tesoreria.bancos.edit',
  BANCOS_DELETE: 'tesoreria.bancos.delete',

  // Movimientos
  MOVIMIENTOS_VIEW: 'tesoreria.movimientos.view',
  MOVIMIENTOS_CREATE: 'tesoreria.movimientos.create',
  MOVIMIENTOS_EDIT: 'tesoreria.movimientos.edit',
  MOVIMIENTOS_REVERSE: 'tesoreria.movimientos.reverse',

  // Cheques
  CHEQUES_VIEW: 'tesoreria.cheques.view',
  CHEQUES_CREATE: 'tesoreria.cheques.create',
  CHEQUES_EDIT: 'tesoreria.cheques.edit',
  CHEQUES_DEPOSIT: 'tesoreria.cheques.deposit',
  CHEQUES_ENDORSE: 'tesoreria.cheques.endorse',
  CHEQUES_REJECT: 'tesoreria.cheques.reject',
  CHEQUES_VOID: 'tesoreria.cheques.void',

  // Transferencias
  TRANSFERENCIAS_VIEW: 'tesoreria.transferencias.view',
  TRANSFERENCIAS_CREATE: 'tesoreria.transferencias.create',
  TRANSFERENCIAS_CONFIRM: 'tesoreria.transferencias.confirm',
  TRANSFERENCIAS_REVERSE: 'tesoreria.transferencias.reverse',

  // Depósitos
  DEPOSITOS_VIEW: 'tesoreria.depositos.view',
  DEPOSITOS_CREATE: 'tesoreria.depositos.create',
  DEPOSITOS_CONFIRM: 'tesoreria.depositos.confirm',
  DEPOSITOS_REJECT: 'tesoreria.depositos.reject',

  // Cierres de caja
  CIERRES_VIEW: 'tesoreria.cierres.view',
  CIERRES_CREATE: 'tesoreria.cierres.create',
  CIERRES_APPROVE: 'tesoreria.cierres.approve',

  // Conciliación bancaria
  CONCILIACION_VIEW: 'tesoreria.conciliacion.view',
  CONCILIACION_IMPORT: 'tesoreria.conciliacion.import',
  CONCILIACION_MATCH: 'tesoreria.conciliacion.match',
  CONCILIACION_CLOSE: 'tesoreria.conciliacion.close',

  // Reportes
  REPORTES_VIEW: 'tesoreria.reportes.view',
  REPORTES_EXPORT: 'tesoreria.reportes.export',

  // Configuración
  CONFIG_VIEW: 'tesoreria.config.view',
  CONFIG_EDIT: 'tesoreria.config.edit',
} as const;
