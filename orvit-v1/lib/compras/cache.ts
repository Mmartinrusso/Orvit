/**
 * Caché compartido para el módulo de compras
 * Permite invalidar cachés desde diferentes rutas API
 */

// Caché de órdenes de compra
export const ordenesCache = new Map<string, { data: any; timestamp: number }>();
export const ORDENES_CACHE_TTL = 2 * 60 * 1000; // 2 minutos

// Caché de recepciones
export const recepcionesCache = new Map<string, { data: any; timestamp: number }>();
export const RECEPCIONES_CACHE_TTL = 2 * 60 * 1000;

// Caché de proveedores items
export const proveedorItemsCache = new Map<string, { data: any; timestamp: number }>();
export const PROVEEDOR_ITEMS_CACHE_TTL = 5 * 60 * 1000;

// Caché de depósitos
export const depositosCache = new Map<string, { data: any; timestamp: number }>();
export const DEPOSITOS_CACHE_TTL = 5 * 60 * 1000;

// Caché de stock
export const stockCache = new Map<string, { data: any; timestamp: number }>();
export const STOCK_CACHE_TTL = 2 * 60 * 1000; // 2 minutos

/**
 * Invalidar caché de órdenes de compra para una empresa
 */
export function invalidarCacheOrdenes(companyId: number) {
  for (const key of ordenesCache.keys()) {
    if (key.startsWith(`ordenes-${companyId}`)) {
      ordenesCache.delete(key);
    }
  }
}

/**
 * Invalidar caché de recepciones para una empresa
 */
export function invalidarCacheRecepciones(companyId: number) {
  for (const key of recepcionesCache.keys()) {
    if (key.startsWith(`recepciones-${companyId}`)) {
      recepcionesCache.delete(key);
    }
  }
}

/**
 * Invalidar caché de stock para una empresa
 */
export function invalidarCacheStock(companyId: number) {
  for (const key of stockCache.keys()) {
    if (key.startsWith(`stock-${companyId}`) || key.includes(`-${companyId}-`)) {
      stockCache.delete(key);
    }
  }
}

/**
 * Invalidar todos los cachés de compras para una empresa
 */
export function invalidarTodosLosCachesCompras(companyId: number) {
  invalidarCacheOrdenes(companyId);
  invalidarCacheRecepciones(companyId);
  invalidarCacheStock(companyId);

  // Invalidar depositos
  for (const key of depositosCache.keys()) {
    if (key.startsWith(`depositos-${companyId}`)) {
      depositosCache.delete(key);
    }
  }
}
