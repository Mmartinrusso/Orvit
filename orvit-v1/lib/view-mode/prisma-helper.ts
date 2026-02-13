/**
 * Prisma Helper for ViewMode filtering
 * Central helper to apply view mode filters to queries
 */

import { ViewMode, MODE, DOC_TYPE } from './types';

interface ApplyViewModeOptions {
  forceStandard?: boolean;  // Force Standard mode (for fiscal reports)
  field?: string;           // Field name (default: 'docType')
}

/**
 * Apply view mode filter to Prisma where clause
 *
 * - Standard mode: T1 + null (legacy data without docType)
 * - Extended mode: All documents (T1 + T2 + null, no filter)
 * - forceStandard: Always T1 only (used for fiscal reports - excludes null)
 *
 * @example
 * const data = await prisma.purchaseReceipt.findMany({
 *   where: applyViewMode({ companyId }, mode),
 * });
 */
export function applyViewMode<T extends Record<string, any>>(
  where: T,
  mode: ViewMode,
  options?: ApplyViewModeOptions
): T {
  const fieldName = options?.field || 'docType';

  // Force Standard for fiscal reports (ARCA, Libro IVA, etc.)
  // Fiscal reports ONLY show T1 (excludes null/legacy)
  if (options?.forceStandard) {
    return { ...where, [fieldName]: DOC_TYPE.T1 };
  }

  // Standard mode: show T1 + null (legacy)
  // null = legacy data that hasn't been migrated yet, treated as T1
  // Usamos NOT T2 en lugar de OR(T1, null) porque Prisma groupBy no soporta bien OR
  // NOT T2 es equivalente a: T1 OR null OR cualquier otro valor que no sea T2
  if (mode === MODE.STANDARD) {
    const notT2Filter = { [fieldName]: DOC_TYPE.T2 };

    // Si el where original ya tiene un NOT, combinamos con AND
    if ('NOT' in where) {
      const existingNot = (where as any).NOT;
      const { NOT: _, ...restWhere } = where as any;
      return {
        ...restWhere,
        AND: [
          { NOT: existingNot },
          { NOT: notT2Filter }
        ]
      } as T;
    }

    return {
      ...where,
      NOT: notT2Filter
    } as T;
  }

  // Extended mode: show all documents (T1 + T2 + null, no filter)
  return where;
}

/**
 * Apply view mode to an array of OR conditions
 * Useful for complex queries with multiple OR clauses
 */
export function applyViewModeToOr<T extends Record<string, any>>(
  orConditions: T[],
  mode: ViewMode,
  options?: ApplyViewModeOptions
): T[] {
  return orConditions.map(condition => applyViewMode(condition, mode, options));
}

/**
 * Get docType filter value for direct use
 * Returns undefined in Extended mode (no filter)
 */
export function getDocTypeFilter(
  mode: ViewMode,
  options?: { forceStandard?: boolean }
): 'T1' | undefined {
  if (options?.forceStandard || mode === MODE.STANDARD) {
    return DOC_TYPE.T1;
  }
  return undefined;
}

/**
 * Build aggregation filter for stock calculations
 * Stock is calculated on-the-fly from StockMovement
 */
export function buildStockFilter(
  baseFilter: Record<string, any>,
  mode: ViewMode,
  options?: { forceStandard?: boolean }
): Record<string, any> {
  const docTypeFilter = getDocTypeFilter(mode, options);

  if (docTypeFilter) {
    return { ...baseFilter, docType: docTypeFilter };
  }

  return baseFilter;
}

/**
 * Format API response based on mode
 * In Standard mode: clean response without revealing Extended mode exists
 * In Extended mode: include metadata for UI
 */
export function formatViewModeResponse<T>(
  data: T[],
  mode: ViewMode,
  options?: {
    countField?: keyof T;
  }
): { data: T[]; _m?: ViewMode; _c?: { t1: number; t2: number } } {
  // Standard mode: clean response
  if (mode === MODE.STANDARD) {
    return { data };
  }

  // Extended mode: include metadata
  const field = (options?.countField || 'docType') as string;
  const t1Count = data.filter((item: any) => item[field] === DOC_TYPE.T1).length;
  const t2Count = data.filter((item: any) => item[field] === DOC_TYPE.T2).length;

  return {
    data,
    _m: MODE.EXTENDED,
    _c: { t1: t1Count, t2: t2Count },
  };
}
