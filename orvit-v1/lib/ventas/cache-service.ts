/**
 * Cache Service para Órdenes de Venta
 * Usa memoria en desarrollo, Redis en producción
 */

// Simple in-memory cache para desarrollo
const cache = new Map<string, { data: any; expiry: number }>();

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const now = Date.now();

  // Verificar si existe en caché y no está expirado
  if (cache.has(key)) {
    const cached = cache.get(key)!;
    if (cached.expiry > now) {
      return cached.data as T;
    } else {
      cache.delete(key);
    }
  }

  // Fetch fresh data
  const data = await fetcher();

  // Guardar en caché
  cache.set(key, {
    data,
    expiry: now + ttlSeconds * 1000,
  });

  return data;
}

export async function invalidateCache(patterns: string[]) {
  for (const pattern of patterns) {
    // Simple pattern matching con *
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      const keysToDelete: string[] = [];

      for (const key of cache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => cache.delete(key));
    } else {
      cache.delete(pattern);
    }
  }
}

export async function clearAllCache() {
  cache.clear();
}

// Cache keys helpers
export const CacheKeys = {
  ordenList: (filters: string) => `ordenes:list:${filters}`,
  ordenDetail: (id: number) => `ordenes:detail:${id}`,
  ordenStats: () => 'ordenes:stats',
  ordenAnalytics: (params: string) => `ordenes:analytics:${params}`,
};

// Invalidation patterns
export const InvalidationPatterns = {
  ordenCreated: ['ordenes:list:*', 'ordenes:stats', 'ordenes:analytics:*'],
  ordenUpdated: (id: number) => [`ordenes:detail:${id}`, 'ordenes:list:*', 'ordenes:stats'],
  ordenDeleted: (id: number) => [`ordenes:detail:${id}`, 'ordenes:list:*', 'ordenes:stats'],
  ordenConfirmed: (id: number) => [`ordenes:detail:${id}`, 'ordenes:stats', 'ordenes:analytics:*'],
};
