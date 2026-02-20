'use client';

import { useRef, useCallback, useMemo } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheConfig {
  ttl?: number; // Time to live in milliseconds
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

class GlobalCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL: number;

  constructor(defaultTTL: number = DEFAULT_TTL) {
    this.defaultTTL = defaultTTL;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, config?: CacheConfig): void {
    const ttl = config?.ttl || this.defaultTTL;
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clear expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
const globalCache = new GlobalCache();

// Hook para usar el caché global
export function useGlobalCache() {
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup expired entries every minute
  const startCleanup = useCallback(() => {
    if (cleanupIntervalRef.current) return;
    cleanupIntervalRef.current = setInterval(() => {
      globalCache.cleanup();
    }, 60 * 1000);
  }, []);

  const get = useCallback(<T,>(key: string): T | null => {
    startCleanup();
    return globalCache.get<T>(key);
  }, [startCleanup]);

  const set = useCallback(<T,>(key: string, data: T, config?: CacheConfig): void => {
    startCleanup();
    globalCache.set(key, data, config);
  }, [startCleanup]);

  const has = useCallback((key: string): boolean => {
    startCleanup();
    return globalCache.has(key);
  }, [startCleanup]);

  const remove = useCallback((key: string): void => {
    globalCache.delete(key);
  }, []);

  const clear = useCallback((): void => {
    globalCache.clear();
  }, []);

  // Objeto estable: solo se recrea si alguna función interna cambia (nunca pasa)
  return useMemo(() => ({ get, set, has, remove, clear }), [get, set, has, remove, clear]);
}

// Helper para generar keys de caché consistentes
export function createCacheKey(prefix: string, ...params: (string | number | undefined)[]): string {
  return `${prefix}:${params.filter(p => p !== undefined).join(':')}`;
}

