/**
 * Tests for Cache Migration
 *
 * Covers:
 * 1. ServerCache (server-cache.ts) - get/set/getOrSet, TTL expiry, eviction, invalidation
 * 2. Stale Time Config (stale-time-config.ts) - correct values per category
 * 3. Query Keys (query-keys.ts) - correct key generation, hierarchical structure
 * 4. Cache Index (index.ts) - correct re-exports
 * 5. API Route cache wrappers (ordenes-pago/cache.ts, comprobantes/cache.ts) - prefix delegation
 * 6. Hook migration contracts (use-admin-catalogs, use-productos, use-recetas, use-insumos) - return shape
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: ServerCache - Pure unit tests (no mocks needed)
// ─────────────────────────────────────────────────────────────────────────────

// Import the class directly from the source file
import { serverCache, CACHE_TTL, getNamedCache } from '@/lib/cache/server-cache';

describe('ServerCache', () => {
  beforeEach(() => {
    serverCache.clear();
  });

  describe('CACHE_TTL constants', () => {
    it('should have correct TTL values in milliseconds', () => {
      expect(CACHE_TTL.SHORT).toBe(30_000);      // 30s
      expect(CACHE_TTL.MEDIUM).toBe(60_000);      // 1min
      expect(CACHE_TTL.LONG).toBe(300_000);       // 5min
      expect(CACHE_TTL.VERY_LONG).toBe(600_000);  // 10min
    });
  });

  describe('get / set', () => {
    it('should store and retrieve a value', () => {
      serverCache.set('test-key', { name: 'test' }, CACHE_TTL.LONG);
      const result = serverCache.get<{ name: string }>('test-key');
      expect(result).toEqual({ name: 'test' });
    });

    it('should return null for missing keys', () => {
      expect(serverCache.get('nonexistent')).toBeNull();
    });

    it('should return null for expired entries', () => {
      // Set with a very short TTL
      serverCache.set('expiring', 'value', 1); // 1ms
      // Wait for it to expire
      const start = Date.now();
      while (Date.now() - start < 5) { /* spin */ }
      expect(serverCache.get('expiring')).toBeNull();
    });

    it('should overwrite existing entries', () => {
      serverCache.set('key', 'v1', CACHE_TTL.LONG);
      serverCache.set('key', 'v2', CACHE_TTL.LONG);
      expect(serverCache.get('key')).toBe('v2');
    });

    it('should default to MEDIUM TTL when not specified', () => {
      serverCache.set('default-ttl', 'data');
      expect(serverCache.get('default-ttl')).toBe('data');
    });
  });

  describe('has', () => {
    it('should return true for existing, non-expired keys', () => {
      serverCache.set('exists', true, CACHE_TTL.LONG);
      expect(serverCache.has('exists')).toBe(true);
    });

    it('should return false for missing keys', () => {
      expect(serverCache.has('nope')).toBe(false);
    });

    it('should return false for expired keys', () => {
      serverCache.set('exp', true, 1);
      const start = Date.now();
      while (Date.now() - start < 5) { /* spin */ }
      expect(serverCache.has('exp')).toBe(false);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value without calling fetcher', async () => {
      serverCache.set('cached', 42, CACHE_TTL.LONG);
      const fetcher = vi.fn().mockResolvedValue(99);

      const result = await serverCache.getOrSet('cached', fetcher, CACHE_TTL.LONG);

      expect(result).toBe(42);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should call fetcher and cache result on miss', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });

      const result = await serverCache.getOrSet('miss', fetcher, CACHE_TTL.LONG);

      expect(result).toEqual({ data: 'fresh' });
      expect(fetcher).toHaveBeenCalledOnce();

      // Should be cached now
      const cached = serverCache.get('miss');
      expect(cached).toEqual({ data: 'fresh' });
    });

    it('should use default MEDIUM TTL when not specified', async () => {
      const fetcher = vi.fn().mockResolvedValue('data');
      await serverCache.getOrSet('default', fetcher);
      expect(serverCache.get('default')).toBe('data');
    });
  });

  describe('invalidate', () => {
    it('should remove a specific key', () => {
      serverCache.set('a', 1, CACHE_TTL.LONG);
      serverCache.set('b', 2, CACHE_TTL.LONG);
      serverCache.invalidate('a');

      expect(serverCache.get('a')).toBeNull();
      expect(serverCache.get('b')).toBe(2);
    });
  });

  describe('invalidatePattern', () => {
    it('should remove all keys matching a prefix', () => {
      serverCache.set('pedidos-kpis-1', 'a', CACHE_TTL.LONG);
      serverCache.set('pedidos-kpis-2', 'b', CACHE_TTL.LONG);
      serverCache.set('ordenes-data-1', 'c', CACHE_TTL.LONG);

      serverCache.invalidatePattern('pedidos-kpis-');

      expect(serverCache.get('pedidos-kpis-1')).toBeNull();
      expect(serverCache.get('pedidos-kpis-2')).toBeNull();
      expect(serverCache.get('ordenes-data-1')).toBe('c');
    });

    it('should handle no matching keys gracefully', () => {
      serverCache.set('keep', 1, CACHE_TTL.LONG);
      serverCache.invalidatePattern('nonexistent-');
      expect(serverCache.get('keep')).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      serverCache.set('a', 1, CACHE_TTL.LONG);
      serverCache.set('b', 2, CACHE_TTL.LONG);
      serverCache.clear();
      expect(serverCache.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should reflect current entry count', () => {
      expect(serverCache.size).toBe(0);
      serverCache.set('a', 1, CACHE_TTL.LONG);
      expect(serverCache.size).toBe(1);
      serverCache.set('b', 2, CACHE_TTL.LONG);
      expect(serverCache.size).toBe(2);
    });
  });

  describe('eviction', () => {
    it('should evict expired entries when at capacity', () => {
      // Create a small cache via getNamedCache
      const smallCache = getNamedCache('eviction-test', 5);

      // Fill it with expired entries
      for (let i = 0; i < 5; i++) {
        smallCache.set(`old-${i}`, i, 1); // 1ms TTL
      }

      // Wait for expiry
      const start = Date.now();
      while (Date.now() - start < 10) { /* spin */ }

      // Add a new entry - should trigger eviction of expired ones
      smallCache.set('new', 'fresh', CACHE_TTL.LONG);

      expect(smallCache.get('new')).toBe('fresh');
      // Expired entries should have been evicted
      expect(smallCache.get('old-0')).toBeNull();
    });

    it('should evict oldest entries when at capacity and none are expired', () => {
      const smallCache = getNamedCache('eviction-lru-test', 5);

      // Fill with non-expired entries
      for (let i = 0; i < 5; i++) {
        smallCache.set(`entry-${i}`, i, CACHE_TTL.LONG);
      }

      // Add one more - should evict some of the oldest
      smallCache.set('overflow', 'new', CACHE_TTL.LONG);

      // The new entry should exist
      expect(smallCache.get('overflow')).toBe('new');
      // At least one old entry should have been evicted (floor(5/4) = 1)
      const remaining = [0, 1, 2, 3, 4].filter(i => smallCache.get(`entry-${i}`) !== null);
      expect(remaining.length).toBeLessThan(5);
    });
  });

  describe('getNamedCache', () => {
    it('should return same instance for same name', () => {
      const a = getNamedCache('singleton-test');
      const b = getNamedCache('singleton-test');
      expect(a).toBe(b);
    });

    it('should return different instances for different names', () => {
      const a = getNamedCache('cache-a');
      const b = getNamedCache('cache-b');
      expect(a).not.toBe(b);
    });

    it('should isolate data between named caches', () => {
      const cache1 = getNamedCache('isolated-1');
      const cache2 = getNamedCache('isolated-2');

      cache1.set('key', 'from-1', CACHE_TTL.LONG);
      cache2.set('key', 'from-2', CACHE_TTL.LONG);

      expect(cache1.get('key')).toBe('from-1');
      expect(cache2.get('key')).toBe('from-2');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: Stale Time Config
// ─────────────────────────────────────────────────────────────────────────────

import { STALE_TIMES, GC_TIMES } from '@/lib/cache/stale-time-config';

describe('Stale Time Config', () => {
  describe('STALE_TIMES', () => {
    it('should have all required categories', () => {
      expect(STALE_TIMES).toHaveProperty('TRANSACTIONAL');
      expect(STALE_TIMES).toHaveProperty('DASHBOARD');
      expect(STALE_TIMES).toHaveProperty('COMPUTED');
      expect(STALE_TIMES).toHaveProperty('CATALOG');
      expect(STALE_TIMES).toHaveProperty('CONFIG');
    });

    it('should have correct values in milliseconds', () => {
      expect(STALE_TIMES.TRANSACTIONAL).toBe(15_000);    // 15s
      expect(STALE_TIMES.DASHBOARD).toBe(30_000);        // 30s
      expect(STALE_TIMES.COMPUTED).toBe(120_000);         // 2min
      expect(STALE_TIMES.CATALOG).toBe(300_000);          // 5min
      expect(STALE_TIMES.CONFIG).toBe(600_000);           // 10min
    });

    it('should be ordered from shortest to longest', () => {
      expect(STALE_TIMES.TRANSACTIONAL).toBeLessThan(STALE_TIMES.DASHBOARD);
      expect(STALE_TIMES.DASHBOARD).toBeLessThan(STALE_TIMES.COMPUTED);
      expect(STALE_TIMES.COMPUTED).toBeLessThan(STALE_TIMES.CATALOG);
      expect(STALE_TIMES.CATALOG).toBeLessThan(STALE_TIMES.CONFIG);
    });
  });

  describe('GC_TIMES', () => {
    it('should have all required categories', () => {
      expect(GC_TIMES).toHaveProperty('TRANSACTIONAL');
      expect(GC_TIMES).toHaveProperty('DASHBOARD');
      expect(GC_TIMES).toHaveProperty('COMPUTED');
      expect(GC_TIMES).toHaveProperty('CATALOG');
      expect(GC_TIMES).toHaveProperty('CONFIG');
    });

    it('should have correct values in milliseconds', () => {
      expect(GC_TIMES.TRANSACTIONAL).toBe(300_000);     // 5min
      expect(GC_TIMES.DASHBOARD).toBe(600_000);          // 10min
      expect(GC_TIMES.COMPUTED).toBe(900_000);            // 15min
      expect(GC_TIMES.CATALOG).toBe(1_800_000);           // 30min
      expect(GC_TIMES.CONFIG).toBe(3_600_000);            // 60min
    });

    it('gcTime should always be greater than staleTime for each category', () => {
      expect(GC_TIMES.TRANSACTIONAL).toBeGreaterThan(STALE_TIMES.TRANSACTIONAL);
      expect(GC_TIMES.DASHBOARD).toBeGreaterThan(STALE_TIMES.DASHBOARD);
      expect(GC_TIMES.COMPUTED).toBeGreaterThan(STALE_TIMES.COMPUTED);
      expect(GC_TIMES.CATALOG).toBeGreaterThan(STALE_TIMES.CATALOG);
      expect(GC_TIMES.CONFIG).toBeGreaterThan(STALE_TIMES.CONFIG);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 3: Query Keys
// ─────────────────────────────────────────────────────────────────────────────

import { queryKeys } from '@/lib/cache/query-keys';

describe('Query Keys', () => {
  const COMPANY_ID = 1;

  describe('admin module', () => {
    it('should generate correct catalogs key', () => {
      const key = queryKeys.admin.catalogs(COMPANY_ID);
      expect(key).toEqual(['admin', 'catalogs', 1]);
    });
  });

  describe('productos module', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.productos.all(COMPANY_ID)).toEqual(['productos', 1]);
    });

    it('should generate correct categories key', () => {
      expect(queryKeys.productos.categories(COMPANY_ID)).toEqual(['productos', 'categories', 1]);
    });

    it('should generate correct products key', () => {
      expect(queryKeys.productos.products(COMPANY_ID)).toEqual(['productos', 'products', 1]);
    });

    it('should generate correct detail key', () => {
      expect(queryKeys.productos.detail(42)).toEqual(['productos', 'detail', 42]);
    });

    it('categories and products keys should share the "productos" prefix for hierarchical invalidation', () => {
      const categories = queryKeys.productos.categories(COMPANY_ID);
      const products = queryKeys.productos.products(COMPANY_ID);
      expect(categories[0]).toBe('productos');
      expect(products[0]).toBe('productos');
    });
  });

  describe('insumos module', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.insumos.all(COMPANY_ID)).toEqual(['insumos', 1]);
    });

    it('should generate correct suppliers key', () => {
      expect(queryKeys.insumos.suppliers(COMPANY_ID)).toEqual(['insumos', 'suppliers', 1]);
    });

    it('should generate correct supplies key', () => {
      expect(queryKeys.insumos.supplies(COMPANY_ID)).toEqual(['insumos', 'supplies', 1]);
    });

    it('should generate correct prices key without supplyId', () => {
      expect(queryKeys.insumos.prices(COMPANY_ID)).toEqual(['insumos', 'prices', 1]);
    });

    it('should generate correct prices key with supplyId', () => {
      expect(queryKeys.insumos.prices(COMPANY_ID, 5)).toEqual(['insumos', 'prices', 1, 5]);
    });

    it('should generate correct history key without supplyId', () => {
      expect(queryKeys.insumos.history(COMPANY_ID)).toEqual(['insumos', 'history', 1]);
    });

    it('should generate correct history key with supplyId', () => {
      expect(queryKeys.insumos.history(COMPANY_ID, 3)).toEqual(['insumos', 'history', 1, 3]);
    });
  });

  describe('recetas module', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.recetas.all(COMPANY_ID)).toEqual(['recetas', 1]);
    });

    it('should generate correct detail key', () => {
      expect(queryKeys.recetas.detail(10, COMPANY_ID)).toEqual(['recetas', 'detail', 10, 1]);
    });
  });

  describe('hierarchical invalidation compatibility', () => {
    it('module keys should start with module name for prefix-based invalidation', () => {
      // TanStack Query matches queryKey prefixes, so ['insumos'] matches all insumos queries
      const allKeys = [
        queryKeys.insumos.suppliers(1),
        queryKeys.insumos.supplies(1),
        queryKeys.insumos.prices(1),
        queryKeys.insumos.history(1),
      ];

      for (const key of allKeys) {
        expect(key[0]).toBe('insumos');
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 4: Cache Index re-exports
// ─────────────────────────────────────────────────────────────────────────────

describe('Cache Index Exports', () => {
  it('should re-export serverCache from index', async () => {
    const cacheModule = await import('@/lib/cache/index');
    expect(cacheModule.serverCache).toBeDefined();
    expect(typeof cacheModule.serverCache.get).toBe('function');
    expect(typeof cacheModule.serverCache.set).toBe('function');
    expect(typeof cacheModule.serverCache.getOrSet).toBe('function');
  });

  it('should re-export CACHE_TTL from index', async () => {
    const cacheModule = await import('@/lib/cache/index');
    expect(cacheModule.CACHE_TTL).toBeDefined();
    expect(cacheModule.CACHE_TTL.SHORT).toBe(30_000);
  });

  it('should re-export getNamedCache from index', async () => {
    const cacheModule = await import('@/lib/cache/index');
    expect(typeof cacheModule.getNamedCache).toBe('function');
  });

  it('should re-export STALE_TIMES and GC_TIMES from index', async () => {
    const cacheModule = await import('@/lib/cache/index');
    expect(cacheModule.STALE_TIMES).toBeDefined();
    expect(cacheModule.GC_TIMES).toBeDefined();
  });

  it('should re-export queryKeys from index', async () => {
    const cacheModule = await import('@/lib/cache/index');
    expect(cacheModule.queryKeys).toBeDefined();
    expect(typeof cacheModule.queryKeys.admin.catalogs).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 5: API Route cache wrappers
// ─────────────────────────────────────────────────────────────────────────────

describe('API Route Cache Wrappers', () => {
  beforeEach(() => {
    serverCache.clear();
  });

  describe('ordenes-pago/cache', () => {
    // We test the wrapper by importing and checking it delegates to serverCache
    it('should set and get with ordenes-pago prefix', async () => {
      const opCache = await import('@/app/api/compras/ordenes-pago/cache');

      opCache.setCache('ordenes-1-page1', { items: [1, 2] });
      const result = opCache.getCache('ordenes-1-page1');
      expect(result).toEqual({ items: [1, 2] });
    });

    it('should use the prefix for storage', async () => {
      const opCache = await import('@/app/api/compras/ordenes-pago/cache');

      opCache.setCache('test-key', 'data');
      // Verify it's stored in serverCache with prefix
      const fromServer = serverCache.get('ordenes-pago:test-key');
      expect(fromServer).toBe('data');
    });

    it('invalidateCache should clear company-specific entries', async () => {
      const opCache = await import('@/app/api/compras/ordenes-pago/cache');

      // Set entries for company 1 and 2
      opCache.setCache('ordenes-1-page1', 'c1');
      opCache.setCache('ordenes-2-page1', 'c2');

      // Invalidate company 1
      opCache.invalidateCache(1);

      // Company 1 should be cleared, company 2 should remain
      expect(opCache.getCache('ordenes-1-page1')).toBeNull();
      expect(opCache.getCache('ordenes-2-page1')).toBe('c2');
    });
  });

  describe('comprobantes/cache', () => {
    it('should set and get with comprobantes prefix', async () => {
      const compCache = await import('@/app/api/compras/comprobantes/cache');

      compCache.setCache('1-page1', { items: [3, 4] });
      const result = compCache.getCache('1-page1');
      expect(result).toEqual({ items: [3, 4] });
    });

    it('should use the prefix for storage', async () => {
      const compCache = await import('@/app/api/compras/comprobantes/cache');

      compCache.setCache('test-key', 'comp-data');
      const fromServer = serverCache.get('comprobantes:test-key');
      expect(fromServer).toBe('comp-data');
    });

    it('invalidateCache should clear company-specific entries', async () => {
      const compCache = await import('@/app/api/compras/comprobantes/cache');

      compCache.setCache('1-page1', 'c1');
      compCache.setCache('2-page1', 'c2');

      compCache.invalidateCache(1);

      expect(compCache.getCache('1-page1')).toBeNull();
      expect(compCache.getCache('2-page1')).toBe('c2');
    });
  });

  describe('pedidos route uses serverCache', () => {
    it('should store and invalidate pedidos KPIs via serverCache', () => {
      // Simulate what the pedidos route does
      const companyId = 1;
      const kpisKey = `pedidos-kpis-${companyId}`;

      serverCache.set(kpisKey, { borradores: 5, enviadas: 3 }, CACHE_TTL.SHORT);
      expect(serverCache.get(kpisKey)).toEqual({ borradores: 5, enviadas: 3 });

      // Simulate invalidation after POST/PUT/DELETE
      serverCache.invalidate(kpisKey);
      expect(serverCache.get(kpisKey)).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 6: Hook migration return shape contracts
// These verify the EXPORTS and TYPES are correct without rendering React.
// ─────────────────────────────────────────────────────────────────────────────

describe('Hook Migration - Export Contracts', () => {
  describe('use-admin-catalogs', () => {
    it('should export useAdminCatalogs and derived hooks', async () => {
      const mod = await import('@/hooks/use-admin-catalogs');
      expect(typeof mod.useAdminCatalogs).toBe('function');
      expect(typeof mod.useProducts).toBe('function');
      expect(typeof mod.useProductCategories).toBe('function');
      expect(typeof mod.useSupplies).toBe('function');
      expect(typeof mod.useEmployeesFromCatalog).toBe('function');
      expect(typeof mod.useClientsFromCatalog).toBe('function');
      expect(typeof mod.useSuppliersFromCatalog).toBe('function');
    });
  });

  describe('use-productos', () => {
    it('should export useProductos hook and types', async () => {
      const mod = await import('@/hooks/use-productos');
      expect(typeof mod.useProductos).toBe('function');
    });
  });

  describe('use-recetas', () => {
    it('should export useRecetas hook and types', async () => {
      const mod = await import('@/hooks/use-recetas');
      expect(typeof mod.useRecetas).toBe('function');
    });
  });

  describe('use-insumos', () => {
    it('should export useInsumos hook and types', async () => {
      const mod = await import('@/hooks/use-insumos');
      expect(typeof mod.useInsumos).toBe('function');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 7: ServerCache getOrSet with null/falsy values
// Edge case: ensure null is treated as a cache miss (by design)
// ─────────────────────────────────────────────────────────────────────────────

describe('ServerCache edge cases', () => {
  beforeEach(() => {
    serverCache.clear();
  });

  it('getOrSet should re-fetch when cached value is null', async () => {
    // null is the sentinel for "cache miss" in this implementation
    // If someone caches null, getOrSet will treat it as a miss and re-fetch
    serverCache.set('null-val', null, CACHE_TTL.LONG);

    const fetcher = vi.fn().mockResolvedValue('refetched');
    const result = await serverCache.getOrSet('null-val', fetcher, CACHE_TTL.LONG);

    // BUG CHECK: If get() returns null for a cached null, fetcher WILL be called
    // This is a known design choice - document it, don't treat as bug
    expect(result).toBe('refetched');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('should handle caching 0, false, empty string correctly', () => {
    serverCache.set('zero', 0, CACHE_TTL.LONG);
    serverCache.set('false', false, CACHE_TTL.LONG);
    serverCache.set('empty', '', CACHE_TTL.LONG);

    // These are falsy but NOT null, so get() should return them
    // BUG CHECK: get() uses `!== null` check, so 0 and false should work
    expect(serverCache.get('zero')).toBe(0);
    expect(serverCache.get('false')).toBe(false);
    expect(serverCache.get('empty')).toBe('');
  });

  it('getOrSet should NOT re-fetch for falsy non-null cached values', async () => {
    serverCache.set('cached-zero', 0, CACHE_TTL.LONG);
    const fetcher = vi.fn().mockResolvedValue(99);

    const result = await serverCache.getOrSet('cached-zero', fetcher, CACHE_TTL.LONG);

    expect(result).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('getOrSet should NOT re-fetch for false', async () => {
    serverCache.set('cached-false', false, CACHE_TTL.LONG);
    const fetcher = vi.fn().mockResolvedValue(true);

    const result = await serverCache.getOrSet('cached-false', fetcher, CACHE_TTL.LONG);

    expect(result).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('getOrSet should NOT re-fetch for empty string', async () => {
    serverCache.set('cached-empty', '', CACHE_TTL.LONG);
    const fetcher = vi.fn().mockResolvedValue('new');

    const result = await serverCache.getOrSet('cached-empty', fetcher, CACHE_TTL.LONG);

    expect(result).toBe('');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
