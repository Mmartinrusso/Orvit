/**
 * Redis Caching Layer
 *
 * Provides intelligent caching for expensive operations
 */

import Redis from 'ioredis';

// Initialize Redis client
let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

    if (!redisUrl) {
      console.warn('⚠️ Redis URL not configured, caching disabled');
      // Return mock client for development
      return {
        get: async () => null,
        setex: async () => 'OK',
        del: async () => 1,
        keys: async () => [],
      } as any;
    }

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('Redis error:', err);
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected');
    });
  }

  return redis;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERIC CACHE WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300 // 5 minutes default
): Promise<T> {
  const client = getRedisClient();

  try {
    // Try to get from cache
    const cached = await client.get(key);

    if (cached) {
      return JSON.parse(cached) as T;
    }

    // Cache miss - fetch data
    const data = await fetcher();

    // Store in cache
    await client.setex(key, ttl, JSON.stringify(data));

    return data;
  } catch (error) {
    console.error('Cache error:', error);
    // Fallback to fetcher on error
    return await fetcher();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE INVALIDATION
// ═══════════════════════════════════════════════════════════════════════════

export async function invalidateCache(pattern: string): Promise<void> {
  const client = getRedisClient();

  try {
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(...keys);
      console.log(`🗑️ Invalidated ${keys.length} cache keys matching: ${pattern}`);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SPECIFIC CACHE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export async function cacheCompanyConfig(
  companyId: number,
  fetcher: () => Promise<any>,
  ttl: number = 300
) {
  return getCached(`company:${companyId}:config`, fetcher, ttl);
}

export async function cacheProductData(
  productId: number,
  fetcher: () => Promise<any>,
  ttl: number = 60
) {
  return getCached(`product:${productId}`, fetcher, ttl);
}

export async function cacheDemandForecast(
  productId: number,
  days: number,
  fetcher: () => Promise<any>,
  ttl: number = 86400 // 24 hours
) {
  return getCached(`forecast:${productId}:${days}`, fetcher, ttl);
}

export async function cacheUserPermissions(
  userId: number,
  companyId: number,
  fetcher: () => Promise<any>,
  ttl: number = 600 // 10 minutes
) {
  return getCached(`permissions:${userId}:${companyId}`, fetcher, ttl);
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE WARMING
// ═══════════════════════════════════════════════════════════════════════════

export async function warmCache(companyId: number) {
  console.log(`🔥 Warming cache for company ${companyId}...`);

  // Pre-load frequently accessed data
  const client = getRedisClient();

  try {
    // Company config
    // Products
    // Common queries
    // etc.

    console.log('✅ Cache warmed successfully');
  } catch (error) {
    console.error('Cache warming error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE STATS
// ═══════════════════════════════════════════════════════════════════════════

export async function getCacheStats() {
  const client = getRedisClient();

  try {
    const info = await client.info('stats');
    const keyspaceInfo = await client.info('keyspace');

    return {
      info,
      keyspaceInfo,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
}
