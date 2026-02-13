// Caché compartido para órdenes de pago
const ordenesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export function getCache(key: string) {
  const cached = ordenesCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

export function setCache(key: string, data: any) {
  ordenesCache.set(key, {
    data,
    timestamp: Date.now()
  });

  // Limpiar caché antiguo
  if (ordenesCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of ordenesCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        ordenesCache.delete(k);
      }
    }
  }
}

export function invalidateCache(companyId: number) {
  const keysToDelete: string[] = [];
  for (const key of ordenesCache.keys()) {
    if (key.includes(`ordenes-${companyId}-`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => ordenesCache.delete(key));
}

