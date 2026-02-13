/**
 * Utilidades de autorización para operaciones bulk/batch.
 *
 * Valida tenant isolation (companyId) por item individual en operaciones masivas
 * y construye respuestas parciales estándar.
 */

import { requireAuth, type AuthUser } from '@/lib/auth/shared-helpers';
import { NextResponse } from 'next/server';

// ============================================================================
// TIPOS
// ============================================================================

/** Resultado de validación de acceso bulk por tenant */
export interface BulkTenantValidation {
  /** IDs autorizados (pertenecen al tenant del usuario) */
  authorized: number[];
  /** IDs no autorizados (pertenecen a otro tenant) */
  unauthorized: number[];
}

/** Respuesta estándar de operación bulk */
export interface BulkOperationResponse {
  /** IDs procesados exitosamente */
  processed: number[];
  /** IDs rechazados por lógica de negocio (ej: OTs activas) */
  rejected: { id: number; reason: string }[];
  /** IDs no autorizados por tenant isolation */
  unauthorized: number[];
  /** Mensaje resumen */
  message: string;
}

// ============================================================================
// FUNCIONES
// ============================================================================

/**
 * Valida acceso de tenant para una lista de items en operación bulk.
 * Carga todos los items solicitados en una sola query y filtra
 * los que no pertenecen al companyId del usuario autenticado.
 *
 * @param items - Items cargados de BD con su companyId
 * @param requestedIds - IDs solicitados en la request
 * @param userCompanyId - companyId del usuario autenticado
 * @returns Objeto con arrays de IDs autorizados y no autorizados
 */
export function validateBulkTenantAccess(
  items: { id: number; companyId: number }[],
  requestedIds: number[],
  userCompanyId: number,
): BulkTenantValidation {
  const foundIds = new Set(items.map((i) => i.id));

  const authorized: number[] = [];
  const unauthorized: number[] = [];

  for (const id of requestedIds) {
    if (!foundIds.has(id)) {
      // Item no encontrado - tratar como no autorizado (no revelar existencia)
      unauthorized.push(id);
      continue;
    }

    const item = items.find((i) => i.id === id)!;
    if (item.companyId === userCompanyId) {
      authorized.push(id);
    } else {
      unauthorized.push(id);
    }
  }

  return { authorized, unauthorized };
}

/**
 * Construye respuesta estándar para operación bulk con resultado parcial.
 * Usa HTTP 207 (Multi-Status) cuando hay items mixtos (algunos exitosos, otros no).
 *
 * @param result - Resultado de la operación
 * @returns NextResponse con formato estándar
 */
export function buildBulkResponse(result: BulkOperationResponse): NextResponse {
  const total = result.processed.length + result.rejected.length + result.unauthorized.length;
  const hasFailures = result.rejected.length > 0 || result.unauthorized.length > 0;
  const allFailed = result.processed.length === 0 && total > 0;

  if (allFailed) {
    return NextResponse.json(result, { status: 403 });
  }

  // 207 Multi-Status si hay resultados mixtos, 200 si todo OK
  const status = hasFailures ? 207 : 200;

  return NextResponse.json(result, { status });
}

/**
 * Helper de autenticación para rutas bulk.
 * Wrapper sobre requireAuth() con tipado conveniente.
 */
export async function requireBulkAuth(): Promise<{
  user: AuthUser | null;
  error: NextResponse | null;
}> {
  return requireAuth();
}
