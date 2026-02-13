/**
 * Sistema de cache en memoria simple con TTL
 * Para datos que no cambian frecuentemente como KPIs, estadísticas, etc.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpieza automática cada 5 minutos
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * Obtener valor del cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Verificar si expiró
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Guardar valor en cache
   * @param key - Clave única
   * @param data - Datos a cachear
   * @param ttlSeconds - Tiempo de vida en segundos (default: 60)
   */
  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  /**
   * Invalidar una clave específica
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidar todas las claves que coincidan con un patrón
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidar todo el cache
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Limpiar entradas expiradas
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Obtener o calcular valor (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 60
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttlSeconds);
    return data;
  }

  /**
   * Estadísticas del cache
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton global
export const cache = new MemoryCache();

// Helpers para claves de cache específicas
export const CacheKeys = {
  purchaseRequestKPIs: (companyId: number) => `pr_kpis_${companyId}`,
  purchaseQuotationKPIs: (companyId: number) => `pq_kpis_${companyId}`,
  supplierStats: (companyId: number) => `supplier_stats_${companyId}`,
};

// TTLs recomendados (en segundos)
export const CacheTTL = {
  KPIs: 30,           // 30 segundos para KPIs (balance entre frescura y performance)
  STATS: 60,          // 1 minuto para estadísticas
  LISTS: 10,          // 10 segundos para listas (muy dinámicas)
  CONFIG: 300,        // 5 minutos para configuraciones
};
