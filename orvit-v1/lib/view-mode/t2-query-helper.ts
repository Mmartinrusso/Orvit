/**
 * T2 Query Helper
 *
 * Provides consistent error handling and status reporting for T2 database queries.
 * Use this wrapper to safely query T2 and get status information for UI feedback.
 */

import { getT2Client, isT2DatabaseConfigured } from '@/lib/prisma-t2';
import { shouldQueryT2 } from './should-query-t2';
import { MODE } from './types';

export interface T2QueryStatus {
  queried: boolean;       // Whether T2 was queried
  available: boolean;     // Whether T2 is available/responded successfully
  configured: boolean;    // Whether T2 database is configured
  error?: string;         // Error message if query failed
  errorCode?: string;     // Error code for programmatic handling
}

export interface T2QueryResult<T> {
  data: T;
  status: T2QueryStatus;
}

/**
 * Execute a T2 query with automatic error handling and status tracking
 *
 * @param companyId - Company ID to check T2 access
 * @param viewMode - Current view mode (STANDARD or EXTENDED)
 * @param queryFn - Function that executes the T2 query
 * @param fallbackData - Default data to return if T2 query fails or is skipped
 * @returns Query result with status information
 *
 * @example
 * const result = await executeT2Query(
 *   companyId,
 *   viewMode,
 *   async (prismaT2) => {
 *     return prismaT2.t2PurchaseReceipt.findMany({ where: { supplierId } });
 *   },
 *   [] // fallback empty array
 * );
 *
 * if (!result.status.available) {
 *   console.warn('T2 not available:', result.status.error);
 * }
 */
export async function executeT2Query<T>(
  companyId: number,
  viewMode: MODE,
  queryFn: (prismaT2: ReturnType<typeof getT2Client>) => Promise<T>,
  fallbackData: T
): Promise<T2QueryResult<T>> {
  const status: T2QueryStatus = {
    queried: false,
    available: true,
    configured: isT2DatabaseConfigured()
  };

  // Check if we should query T2
  const shouldQuery = await shouldQueryT2(companyId, viewMode);

  if (!shouldQuery) {
    return {
      data: fallbackData,
      status
    };
  }

  status.queried = true;

  // Check if T2 is configured
  if (!status.configured) {
    status.available = false;
    status.error = 'Base de datos T2 no configurada';
    status.errorCode = 'T2_NOT_CONFIGURED';
    return {
      data: fallbackData,
      status
    };
  }

  try {
    const prismaT2 = getT2Client();
    const data = await queryFn(prismaT2);
    return {
      data,
      status
    };
  } catch (error: any) {
    status.available = false;

    // Categorize error
    if (error.code === 'P1001' || error.message?.includes('connect')) {
      status.error = 'No se pudo conectar a la base de datos T2';
      status.errorCode = 'T2_CONNECTION_ERROR';
    } else if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      status.error = 'Tabla no encontrada en base de datos T2';
      status.errorCode = 'T2_TABLE_NOT_FOUND';
    } else if (error.code === 'P2002') {
      status.error = 'Error de unicidad en T2';
      status.errorCode = 'T2_UNIQUE_CONSTRAINT';
    } else {
      status.error = error.message || 'Error desconocido en base de datos T2';
      status.errorCode = 'T2_UNKNOWN_ERROR';
    }

    console.error('[T2 Query Helper] Error:', {
      errorCode: status.errorCode,
      error: error.message,
      prismaCode: error.code
    });

    return {
      data: fallbackData,
      status
    };
  }
}

/**
 * Combine T2 status from multiple queries
 */
export function combineT2Status(...statuses: T2QueryStatus[]): T2QueryStatus {
  const queried = statuses.some(s => s.queried);
  const available = statuses.filter(s => s.queried).every(s => s.available);
  const configured = statuses.some(s => s.configured);
  const errors = statuses.filter(s => s.error).map(s => s.error);

  return {
    queried,
    available,
    configured,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    errorCode: statuses.find(s => s.errorCode)?.errorCode
  };
}

/**
 * Create a T2 status response object for API responses
 */
export function createT2StatusResponse(status: T2QueryStatus) {
  if (!status.queried) {
    return undefined; // Don't include in response if T2 wasn't queried
  }

  return {
    available: status.available,
    ...(status.error && { error: status.error }),
    ...(status.errorCode && { code: status.errorCode })
  };
}
