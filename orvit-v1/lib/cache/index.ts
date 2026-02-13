/**
 * Cache Module Exports
 */

export { getRedisClient, isRedisAvailable, closeRedisConnection } from './redis-client';
export type { Redis } from './redis-client';

export {
  cached,
  cachedMemory,
  setCache,
  getCache,
  invalidateCache,
  invalidateCachePattern,
  clearAllCache,
  getCacheStats,
} from './cache-manager';

export {
  companyKeys,
  roleKeys,
  permissionKeys,
  comprasKeys,
  ventasKeys,
  tesoreriaKeys,
  invalidationPatterns,
  TTL,
} from './cache-keys';
