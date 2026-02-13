'use client';

/**
 * Client-side cache utilities for CompanyContext and similar contexts.
 * Provides: TTL-based caching, custom event invalidation, cache hit/miss logging.
 */

// --- Cache Event System ---

export const CACHE_EVENTS = {
  AREAS_CHANGED: 'cache:areas-changed',
  SECTORS_CHANGED: 'cache:sectors-changed',
  COMPANY_CHANGED: 'cache:company-changed',
  FORCE_REFRESH: 'cache:force-refresh',
} as const;

export type CacheEventType = (typeof CACHE_EVENTS)[keyof typeof CACHE_EVENTS];

interface CacheEventDetail {
  source: string;
  companyId?: string | number;
  areaId?: number;
  timestamp: number;
}

/** Dispatch a cache invalidation event so listeners (e.g. CompanyContext) react.
 *  Also broadcasts to other tabs via localStorage so they can re-fetch. */
export function emitCacheEvent(event: CacheEventType, detail?: Partial<CacheEventDetail>) {
  if (typeof window === 'undefined') return;

  const payload = { timestamp: Date.now(), source: 'unknown', ...detail, event };

  // Local dispatch (same tab)
  window.dispatchEvent(new CustomEvent(event, { detail: payload }));

  // Cross-tab broadcast via storage event
  try {
    localStorage.setItem('cache_invalidation', JSON.stringify(payload));
    // Remove immediately so subsequent writes with the same value still fire `storage`
    localStorage.removeItem('cache_invalidation');
  } catch {
    // localStorage may be unavailable (private browsing, quota, etc.)
  }
}

// --- Client-side TTL Cache ---

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
}

// TTL values in milliseconds for client-side usage
export const CLIENT_TTL = {
  CRITICAL: 2 * 60 * 1000,   // 2 minutes — areas, sectors, company data
  STANDARD: 5 * 60 * 1000,   // 5 minutes — less critical data
} as const;

export class ClientCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
  private loggingEnabled: boolean;

  constructor(enableLogging = false) {
    this.loggingEnabled = enableLogging;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      this.log('MISS', key);
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.log('MISS (expired)', key);
      return null;
    }

    this.stats.hits++;
    this.log('HIT', key);
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number = CLIENT_TTL.CRITICAL): void {
    const now = Date.now();
    this.cache.set(key, { data, createdAt: now, expiresAt: now + ttlMs });
    this.stats.sets++;
    this.log('SET', key, `ttl=${ttlMs}ms`);
  }

  /** Returns how fresh the cached entry is (0 = just cached, 1 = about to expire). */
  getFreshness(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) return null;

    const totalLifetime = entry.expiresAt - entry.createdAt;
    const elapsed = now - entry.createdAt;
    return Math.min(elapsed / totalLifetime, 1);
  }

  invalidate(key: string): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.stats.invalidations++;
      this.log('INVALIDATE', key);
    }
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.stats.invalidations++;
      }
    }
    this.log('INVALIDATE_PATTERN', pattern);
  }

  invalidateAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += size;
    this.log('INVALIDATE_ALL', `${size} entries`);
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  private log(action: string, key: string, extra?: string) {
    if (!this.loggingEnabled) return;
    const rate = (this.getHitRate() * 100).toFixed(1);
    console.log(
      `[ClientCache] ${action} ${key}${extra ? ` (${extra})` : ''} | hit-rate: ${rate}%`
    );
  }
}

// Client-side cache key helpers
export const clientCacheKeys = {
  areas: (companyId: string | number) => `client:areas:${companyId}`,
  sectors: (areaId: number | string, variant?: string) =>
    variant ? `client:sectors:${variant}` : `client:sectors:area:${areaId}`,
  sectorsProduction: (companyId: number | string) => `client:sectors:production:${companyId}`,
};
