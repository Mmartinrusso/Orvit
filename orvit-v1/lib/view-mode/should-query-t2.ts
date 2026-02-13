/**
 * Helper para determinar si se debe consultar la BD T2
 *
 * La BD T2 solo se consulta cuando:
 * 1. El usuario está en modo Extended (E)
 * 2. La variable DATABASE_URL_T2 está configurada
 * 3. El superadmin habilitó t2DbEnabled para la empresa
 */

import { prisma } from '@/lib/prisma';
import { isT2DatabaseConfigured } from '@/lib/prisma-t2';
import { ViewMode, MODE } from './types';

// Cache de configuración por empresa (5 minutos)
const configCache = new Map<number, { config: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene la configuración de ViewMode para una empresa (con cache)
 */
async function getViewConfigCached(companyId: number) {
  const cached = configCache.get(companyId);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.config;
  }

  const config = await prisma.companyViewConfig.findUnique({
    where: { companyId },
    select: {
      enabled: true,
      t2DbEnabled: true,
    },
  });

  configCache.set(companyId, { config, timestamp: now });
  return config;
}

/**
 * Invalida el cache de configuración para una empresa
 * Llamar cuando se actualiza la configuración desde /superadmin
 */
export function invalidateT2ConfigCache(companyId: number) {
  configCache.delete(companyId);
}

/**
 * Determina si se debe consultar la BD T2 para una request
 *
 * @param companyId - ID de la empresa
 * @param mode - Modo de vista actual (S o E)
 * @returns true si se debe consultar BD T2
 *
 * @example
 * const mode = await getViewMode(request);
 * if (await shouldQueryT2(companyId, mode)) {
 *   const t2Data = await prismaT2.t2PurchaseReceipt.findMany({ ... });
 * }
 */
export async function shouldQueryT2(
  companyId: number,
  mode: ViewMode
): Promise<boolean> {
  // 1. No está en modo Extended → no consultar T2
  if (mode !== MODE.EXTENDED) {
    return false;
  }

  // 2. BD T2 no configurada en servidor → no consultar
  if (!isT2DatabaseConfigured()) {
    return false;
  }

  // 3. Verificar configuración de la empresa
  const config = await getViewConfigCached(companyId);

  // No hay configuración o ViewMode deshabilitado
  if (!config?.enabled) {
    return false;
  }

  // BD T2 no habilitada por superadmin
  if (!config?.t2DbEnabled) {
    return false;
  }

  return true;
}

/**
 * Verifica si T2 está disponible para una empresa (sin requerir modo Extended)
 * Útil para mostrar/ocultar opciones en la UI
 */
export async function isT2AvailableForCompany(companyId: number): Promise<boolean> {
  if (!isT2DatabaseConfigured()) {
    return false;
  }

  const config = await getViewConfigCached(companyId);
  return !!config?.enabled && !!config?.t2DbEnabled;
}

/**
 * Resultado detallado de por qué T2 no está disponible
 * Útil para debugging y mensajes de error
 */
export async function getT2AvailabilityStatus(
  companyId: number,
  mode: ViewMode
): Promise<{
  available: boolean;
  reason?: 'not_extended_mode' | 'db_not_configured' | 'viewmode_disabled' | 't2db_disabled';
}> {
  if (mode !== MODE.EXTENDED) {
    return { available: false, reason: 'not_extended_mode' };
  }

  if (!isT2DatabaseConfigured()) {
    return { available: false, reason: 'db_not_configured' };
  }

  const config = await getViewConfigCached(companyId);

  if (!config?.enabled) {
    return { available: false, reason: 'viewmode_disabled' };
  }

  if (!config?.t2DbEnabled) {
    return { available: false, reason: 't2db_disabled' };
  }

  return { available: true };
}
