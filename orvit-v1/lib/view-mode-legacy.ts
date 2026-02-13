import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

/**
 * ViewMode - Sistema para filtrar documentos según visibilidad
 *
 * Standard: Solo documentos T1 (tipo fiscal estándar) y sin tipo definido
 * Extended: Todos los documentos (incluye T2, exportaciones, etc.)
 *
 * Nota: Las cotizaciones NO usan docType - solo se asigna al convertir a venta
 */

export type ViewMode = 'Standard' | 'Extended';

const VIEW_MODE_HEADER = 'x-view-mode';
const VIEW_MODE_COOKIE = 'viewMode';

/**
 * Obtiene el ViewMode desde la request (header o cookie)
 * Por defecto retorna 'Standard'
 */
export function getViewMode(request: NextRequest): ViewMode {
  // Primero buscar en header
  const headerMode = request.headers.get(VIEW_MODE_HEADER);
  if (headerMode === 'Extended' || headerMode === 'Standard') {
    return headerMode;
  }

  // Luego buscar en cookies
  const cookieMode = request.cookies.get(VIEW_MODE_COOKIE)?.value;
  if (cookieMode === 'Extended' || cookieMode === 'Standard') {
    return cookieMode;
  }

  // Default: Standard
  return 'Standard';
}

/**
 * Aplica filtro de ViewMode a un where de Prisma
 *
 * Para entidades con docType:
 * - Standard: docType IN ('T1', null) - Solo tipo estándar o sin definir
 * - Extended: Sin filtro adicional - Todos los documentos
 *
 * Para entidades sin docType (como Quote):
 * - No aplica ningún filtro
 */
export function applyViewMode<T extends Record<string, unknown>>(
  where: T,
  viewMode: ViewMode
): T {
  // Si el where ya tiene docType definido explícitamente, no sobreescribir
  if ('docType' in where) {
    return where;
  }

  // Solo aplicar filtro en modo Standard para entidades con docType
  // Nota: Las cotizaciones no tienen docType, así que este filtro no aplica
  if (viewMode === 'Standard') {
    // Para Quote, Sale, etc. que podrían tener docType
    // Solo filtrar si la entidad soporta docType
    // Por ahora retornamos el where sin modificar
    // ya que Quote no usa docType
    return where;
  }

  return where;
}

/**
 * Aplica filtro de ViewMode específicamente para entidades con docType
 * Usar esta función para Sale, SalesInvoice, etc.
 */
export function applyViewModeToDocType<T extends Record<string, unknown>>(
  where: T,
  viewMode: ViewMode
): T & { docType?: Prisma.StringNullableFilter | string | null } {
  // Si ya tiene docType definido, no sobreescribir
  if ('docType' in where) {
    return where as T & { docType?: Prisma.StringNullableFilter | string | null };
  }

  if (viewMode === 'Standard') {
    return {
      ...where,
      OR: [
        { docType: 'T1' },
        { docType: null }
      ]
    } as T & { docType?: Prisma.StringNullableFilter | string | null };
  }

  // Extended: sin filtro de docType
  return where as T & { docType?: Prisma.StringNullableFilter | string | null };
}

/**
 * Verifica si una entidad requiere filtro de ViewMode
 */
export function entityRequiresViewModeFilter(entity: string): boolean {
  // Entidades que NO requieren filtro de ViewMode
  const exemptEntities = ['quote', 'quoteItem', 'quoteVersion', 'client', 'product'];
  return !exemptEntities.includes(entity.toLowerCase());
}
