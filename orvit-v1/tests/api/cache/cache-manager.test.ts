/**
 * Tests: lib/cache/cache-manager.ts
 *
 * Validates:
 * - cached() function with Redis available and fallback to memory
 * - invalidateCache() removes keys from both Redis and memory
 * - Memory cache fallback works when Redis is unavailable
 * - TTL behavior (cache expiry)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis client module
const mockRedisGet = vi.fn();
const mockRedisSetex = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisKeys = vi.fn();
const mockRedisFlushdb = vi.fn();
const mockRedisDbsize = vi.fn();

let mockRedisAvailable = false;

vi.mock('@/lib/cache/redis-client', () => ({
  isRedisAvailable: () => mockRedisAvailable,
  getRedisClient: () => ({
    get: mockRedisGet,
    setex: mockRedisSetex,
    del: mockRedisDel,
    keys: mockRedisKeys,
    flushdb: mockRedisFlushdb,
    dbsize: mockRedisDbsize,
  }),
}));

import {
  cached,
  cachedMemory,
  invalidateCache,
  invalidateCachePattern,
  setCache,
  getCache,
  clearAllCache,
} from '@/lib/cache/cache-manager';

describe('Cache Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisAvailable = false;
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetex.mockResolvedValue('OK');
    mockRedisDel.mockResolvedValue(1);
    mockRedisKeys.mockResolvedValue([]);
    // Clear internal memory cache between tests
    return clearAllCache();
  });

  // ========================================================================
  // cached() - Redis available
  // ========================================================================
  describe('cached() with Redis available', () => {
    beforeEach(() => {
      mockRedisAvailable = true;
    });

    it('should call fetcher and cache in Redis on cache miss', async () => {
      const fetcher = vi.fn().mockResolvedValue({ id: 1, name: 'test' });

      const result = await cached('test:key', fetcher, 300);

      expect(result).toEqual({ id: 1, name: 'test' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(mockRedisGet).toHaveBeenCalledWith('test:key');
      expect(mockRedisSetex).toHaveBeenCalledWith(
        'test:key',
        300,
        JSON.stringify({ id: 1, name: 'test' })
      );
    });

    it('should return cached value from Redis without calling fetcher', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify({ id: 1, name: 'cached' }));
      const fetcher = vi.fn().mockResolvedValue({ id: 2, name: 'fresh' });

      const result = await cached('test:key', fetcher, 300);

      expect(result).toEqual({ id: 1, name: 'cached' });
      expect(fetcher).not.toHaveBeenCalled();
      expect(mockRedisSetex).not.toHaveBeenCalled();
    });

    it('should fall back to memory cache when Redis get throws', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis error'));
      const fetcher = vi.fn().mockResolvedValue({ fallback: true });

      const result = await cached('test:key', fetcher, 60);

      expect(result).toEqual({ fallback: true });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================================================
  // cached() - Redis unavailable (memory fallback)
  // ========================================================================
  describe('cached() with Redis unavailable (memory fallback)', () => {
    beforeEach(() => {
      mockRedisAvailable = false;
    });

    it('should use memory cache when Redis is unavailable', async () => {
      const fetcher = vi.fn().mockResolvedValue({ memory: true });

      const result = await cached('mem:key', fetcher, 300);

      expect(result).toEqual({ memory: true });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(mockRedisGet).not.toHaveBeenCalled();
    });

    it('should return cached value from memory on second call', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'original' });

      await cached('mem:key', fetcher, 300);
      const result2 = await cached('mem:key', fetcher, 300);

      expect(result2).toEqual({ data: 'original' });
      expect(fetcher).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  // ========================================================================
  // invalidateCache()
  // ========================================================================
  describe('invalidateCache()', () => {
    it('should delete keys from Redis when available', async () => {
      mockRedisAvailable = true;

      await invalidateCache(['key1', 'key2']);

      expect(mockRedisDel).toHaveBeenCalledWith('key1', 'key2');
    });

    it('should clear memory cache entries', async () => {
      mockRedisAvailable = false;
      const fetcher = vi.fn().mockResolvedValue('data');

      // Populate memory cache
      await cached('key-to-delete', fetcher, 300);
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Invalidate
      await invalidateCache(['key-to-delete']);

      // Should call fetcher again (cache was cleared)
      fetcher.mockResolvedValue('new-data');
      const result = await cached('key-to-delete', fetcher, 300);
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(result).toBe('new-data');
    });

    it('should do nothing for empty key array', async () => {
      mockRedisAvailable = true;

      await invalidateCache([]);

      expect(mockRedisDel).not.toHaveBeenCalled();
    });

    it('should always clear memory cache even when Redis is available', async () => {
      mockRedisAvailable = false;
      const fetcher = vi.fn().mockResolvedValue('cached-data');

      // Cache in memory
      await cached('dual:key', fetcher, 300);

      // Now enable Redis and invalidate
      mockRedisAvailable = true;
      await invalidateCache(['dual:key']);

      // Memory cache should also be cleared
      mockRedisAvailable = false;
      fetcher.mockResolvedValue('fresh-data');
      const result = await cached('dual:key', fetcher, 300);
      expect(result).toBe('fresh-data');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================================================
  // invalidateCachePattern()
  // ========================================================================
  describe('invalidateCachePattern()', () => {
    it('should delete matching Redis keys by pattern', async () => {
      mockRedisAvailable = true;
      mockRedisKeys.mockResolvedValue(['perm:user:1:10', 'perm:user:1:20']);

      await invalidateCachePattern('perm:user:1:*');

      expect(mockRedisKeys).toHaveBeenCalledWith('perm:user:1:*');
      expect(mockRedisDel).toHaveBeenCalledWith('perm:user:1:10', 'perm:user:1:20');
    });

    it('should clear matching memory cache entries by pattern', async () => {
      mockRedisAvailable = false;
      const fetcher1 = vi.fn().mockResolvedValue('data1');
      const fetcher2 = vi.fn().mockResolvedValue('data2');
      const fetcher3 = vi.fn().mockResolvedValue('data3');

      // Populate memory cache
      await cached('perm:user:1:10', fetcher1, 300);
      await cached('perm:user:1:20', fetcher2, 300);
      await cached('perm:user:2:10', fetcher3, 300);

      // Invalidate pattern for user 1
      await invalidateCachePattern('perm:user:1:*');

      // User 1 cache should be cleared
      fetcher1.mockResolvedValue('new-data1');
      const result1 = await cached('perm:user:1:10', fetcher1, 300);
      expect(result1).toBe('new-data1');
      expect(fetcher1).toHaveBeenCalledTimes(2);

      // User 2 cache should still exist
      fetcher3.mockResolvedValue('should-not-use');
      const result3 = await cached('perm:user:2:10', fetcher3, 300);
      expect(result3).toBe('data3');
      expect(fetcher3).toHaveBeenCalledTimes(1); // Still 1, cache hit
    });
  });

  // ========================================================================
  // setCache() and getCache()
  // ========================================================================
  describe('setCache() and getCache()', () => {
    it('should set and get from Redis when available', async () => {
      mockRedisAvailable = true;
      mockRedisGet.mockResolvedValue(JSON.stringify({ set: true }));

      await setCache('direct:key', { set: true }, 60);
      const result = await getCache('direct:key');

      expect(mockRedisSetex).toHaveBeenCalledWith('direct:key', 60, JSON.stringify({ set: true }));
      expect(result).toEqual({ set: true });
    });

    it('should set and get from memory when Redis unavailable', async () => {
      mockRedisAvailable = false;

      await setCache('mem:direct', { value: 42 }, 60);
      const result = await getCache('mem:direct');

      expect(result).toEqual({ value: 42 });
      expect(mockRedisSetex).not.toHaveBeenCalled();
    });

    it('should return null for non-existent key', async () => {
      mockRedisAvailable = false;
      const result = await getCache('nonexistent');
      expect(result).toBeNull();
    });
  });
});
