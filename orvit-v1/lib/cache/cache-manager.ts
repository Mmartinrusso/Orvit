/**
 * Cache Manager
 * High-level caching utilities with TTL and invalidation support
 */

import { getRedisClient, isRedisAvailable } from './redis-client';
import { TTL } from './cache-keys';

// In-memory fallback cache for when Redis is unavailable
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();
const MEMORY_CACHE_MAX_SIZE = 1000;

/**
 * Get cached data or execute fetcher and cache result
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = TTL.MEDIUM
): Promise<T> {
  // Try Redis first
  if (await isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(key);

      if (cached) {
        return JSON.parse(cached) as T;
      }

      // Fetch and cache
      const data = await fetcher();
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
      return data;
    } catch {
      // Fall through to memory cache
    }
  }

  // Fallback to memory cache
  return cachedMemory(key, fetcher, ttlSeconds);
}

/**
 * Memory-only cache (fallback or for non-critical data)
 */
export async function cachedMemory<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = TTL.MEDIUM
): Promise<T> {
  const now = Date.now();
  const entry = memoryCache.get(key);

  if (entry && entry.expiresAt > now) {
    return entry.data as T;
  }

  const data = await fetcher();

  // Clean up if cache is too large
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    const keysToDelete: string[] = [];
    for (const [k, v] of memoryCache.entries()) {
      if (v.expiresAt < now) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach(k => memoryCache.delete(k));

    // If still too large, delete oldest entries
    if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
      const entries = Array.from(memoryCache.entries());
      entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      entries.slice(0, MEMORY_CACHE_MAX_SIZE / 2).forEach(([k]) => memoryCache.delete(k));
    }
  }

  memoryCache.set(key, {
    data,
    expiresAt: now + ttlSeconds * 1000,
  });

  return data;
}

/**
 * Set cache value directly
 */
export async function setCache(
  key: string,
  data: unknown,
  ttlSeconds: number = TTL.MEDIUM
): Promise<void> {
  if (await isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
      return;
    } catch {
      // Fall through to memory
    }
  }

  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Get cache value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (await isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) as T : null;
    } catch {
      // Fall through to memory
    }
  }

  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  return null;
}

/**
 * Invalidate cache keys
 */
export async function invalidateCache(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  if (await isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.del(...keys);
    } catch {
      // Fall through to memory
    }
  }

  // Always clear memory cache
  keys.forEach(key => memoryCache.delete(key));
}

/**
 * Invalidate cache by pattern (Redis wildcard)
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (await isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // Fall through to memory
    }
  }

  // Clear matching memory cache entries
  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  );
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  if (await isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.flushdb();
    } catch {
      // Continue to memory
    }
  }

  memoryCache.clear();
}

/**
 * Get cache stats
 */
export async function getCacheStats(): Promise<{
  redisAvailable: boolean;
  memoryCacheSize: number;
  redisKeys?: number;
}> {
  const stats = {
    redisAvailable: await isRedisAvailable(),
    memoryCacheSize: memoryCache.size,
    redisKeys: undefined as number | undefined,
  };

  if (stats.redisAvailable) {
    try {
      const redis = getRedisClient();
      stats.redisKeys = await redis.dbsize();
    } catch {
      // Ignore
    }
  }

  return stats;
}
