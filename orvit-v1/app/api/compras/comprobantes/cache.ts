// Caché compartido para comprobantes
const comprobantesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos - aumentado agresivamente

export function getCache(key: string) {
  const cached = comprobantesCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

export function setCache(key: string, data: any) {
  comprobantesCache.set(key, {
    data,
    timestamp: Date.now()
  });

  // Limpiar caché antiguo
  if (comprobantesCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of comprobantesCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        comprobantesCache.delete(k);
      }
    }
  }
}

export function invalidateCache(companyId: number) {
  const keysToDelete: string[] = [];
  for (const key of comprobantesCache.keys()) {
    if (key.includes(`${companyId}-`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => comprobantesCache.delete(key));
}

