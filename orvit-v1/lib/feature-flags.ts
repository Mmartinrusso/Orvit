/**
 * Feature Flags - Sistema simple de feature toggles
 *
 * Resolución jerárquica: user-level > company-level > global
 * Si existe un flag a nivel de usuario, ese tiene prioridad.
 * Si no, se busca a nivel de empresa. Si tampoco, se busca global.
 * Si no existe ninguno, retorna false (feature deshabilitada por defecto).
 */

import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { featureFlagKeys, invalidationPatterns, TTL } from '@/lib/cache/cache-keys';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

interface FeatureFlagContext {
  companyId?: number;
  userId?: number;
}

/**
 * Verifica si un feature flag está habilitado.
 * Resolución jerárquica: user > company > global.
 *
 * @param name - Nombre del feature flag (ej: 'new-dashboard')
 * @param context - Contexto con companyId y/o userId opcionales
 * @returns true si la feature está habilitada, false si no
 */
export async function isFeatureEnabled(
  name: string,
  context: FeatureFlagContext = {}
): Promise<boolean> {
  const { companyId, userId } = context;

  // 1. Buscar flag a nivel de usuario (mayor prioridad)
  if (companyId && userId) {
    const cacheKey = featureFlagKeys.user(name, companyId, userId);
    const userFlag = await cached(
      cacheKey,
      async () => {
        const flag = await prisma.featureFlag.findFirst({
          where: { name, companyId, userId },
          select: { enabled: true },
        });
        return flag;
      },
      TTL.MEDIUM
    );

    if (userFlag !== null) {
      return userFlag.enabled;
    }
  }

  // 2. Buscar flag a nivel de empresa
  if (companyId) {
    const cacheKey = featureFlagKeys.company(name, companyId);
    const companyFlag = await cached(
      cacheKey,
      async () => {
        const flag = await prisma.featureFlag.findFirst({
          where: { name, companyId, userId: null },
          select: { enabled: true },
        });
        return flag;
      },
      TTL.MEDIUM
    );

    if (companyFlag !== null) {
      return companyFlag.enabled;
    }
  }

  // 3. Buscar flag global (menor prioridad)
  const cacheKey = featureFlagKeys.global(name);
  const globalFlag = await cached(
    cacheKey,
    async () => {
      const flag = await prisma.featureFlag.findFirst({
        where: { name, companyId: null, userId: null },
        select: { enabled: true },
      });
      return flag;
    },
    TTL.MEDIUM
  );

  if (globalFlag !== null) {
    return globalFlag.enabled;
  }

  // 4. No existe el flag → deshabilitado por defecto
  return false;
}

/**
 * Wrapper para Server Components: extrae userId y companyId del JWT
 * automáticamente desde las cookies de la request.
 *
 * Uso:
 *   const enabled = await isFeatureEnabledForCurrentUser('new-dashboard');
 *   if (!enabled) return <OldDashboard />;
 */
export async function isFeatureEnabledForCurrentUser(
  name: string
): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get('accessToken')?.value ||
      cookieStore.get('token')?.value;

    if (!token) {
      return isFeatureEnabled(name);
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const userId = payload.userId as number | undefined;
    const companyId = payload.companyId as number | undefined;

    return isFeatureEnabled(name, { companyId, userId });
  } catch {
    // Si falla la verificación del token, buscar solo flag global
    return isFeatureEnabled(name);
  }
}

/**
 * Invalida el cache de un feature flag en todos sus scopes.
 * Llamar después de crear/actualizar/eliminar un flag.
 */
export async function invalidateFeatureFlagCache(
  name: string,
  companyId?: number,
  userId?: number
): Promise<void> {
  const keys = invalidationPatterns.featureFlag(name, companyId, userId);
  await invalidateCache(keys);
}
