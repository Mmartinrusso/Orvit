import { useState, useEffect, useRef, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';

// Cache global para evitar múltiples fetches
const productosCache = new Map<string, { data: any; timestamp: number }>();
const pendingRequests = new Map<string, Promise<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de cache

// Helper para fetch con cache
async function fetchWithCache<T>(url: string, cacheKey: string, force = false): Promise<T> {
  if (!force) {
    const cached = productosCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data as T;
    }
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)! as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      productosCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export interface ProductCategory {
  id: number;
  name: string;
  description: string | null;
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  sku: string;
  categoryId: number;
  subcategoryId?: number;
  companyId: number;
  unitPrice: number;
  unitCost: number;
  stockQuantity: number;
  minStockLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categoryName: string;
  categoryDescription: string | null;
  subcategoryName?: string;
  subcategoryDescription?: string | null;
}

export function useProductos() {
  const { currentCompany } = useCompany();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);

  // Cargar categorías con cache
  const fetchCategories = useCallback(async (force = false) => {
    if (!currentCompany?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      const cacheKey = `categories-${currentCompany.id}`;
      const data = await fetchWithCache<ProductCategory[]>(
        `/api/productos/categorias?companyId=${currentCompany.id}`,
        cacheKey,
        force
      );
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error cargando categorías:', err);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  // Cargar productos con cache
  const fetchProducts = useCallback(async (force = false) => {
    if (!currentCompany?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      const cacheKey = `products-${currentCompany.id}`;
      const data = await fetchWithCache<Product[]>(
        `/api/productos/productos?companyId=${currentCompany.id}`,
        cacheKey,
        force
      );
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  // Crear categoría
  const createCategory = async (categoryData: { name: string; description?: string }) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch('/api/productos/categorias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...categoryData,
          companyId: currentCompany.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear categoría');
      }

      const newCategory = await response.json();
      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } catch (err) {
      console.error('Error creando categoría:', err);
      throw err;
    }
  };

  // Crear producto
  const createProduct = async (productData: {
    name: string;
    description?: string;
    sku: string;
    categoryId: number;
    subcategoryId?: number;
  }) => {
    if (!currentCompany?.id) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch('/api/productos/productos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...productData,
          companyId: currentCompany.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear producto');
      }

      const newProduct = await response.json();
      setProducts(prev => [...prev, newProduct]);
      return newProduct;
    } catch (err) {
      console.error('Error creando producto:', err);
      throw err;
    }
  };

  // Actualizar producto
  const updateProduct = async (productId: number, productData: {
    name: string;
    description?: string;
    sku: string;
    categoryId: number;
    subcategoryId?: number;
    isActive?: boolean;
  }) => {
    try {
      const response = await fetch(`/api/productos/productos/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar producto');
      }

      const updatedProduct = await response.json();
      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
      return updatedProduct;
    } catch (err) {
      console.error('Error actualizando producto:', err);
      throw err;
    }
  };

  // Eliminar producto
  const deleteProduct = async (productId: number) => {
    try {
      const response = await fetch(`/api/productos/productos/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar producto');
      }

      setProducts(prev => prev.filter(p => p.id !== productId));
      return true;
    } catch (err) {
      console.error('Error eliminando producto:', err);
      throw err;
    }
  };

  // Obtener producto por ID
  const getProductById = async (productId: number) => {
    try {
      const response = await fetch(`/api/productos/productos/${productId}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener producto');
      }
      
      return await response.json();
    } catch (err) {
      console.error('Error obteniendo producto:', err);
      throw err;
    }
  };

  // Refrescar datos (fuerza recarga)
  const refreshData = useCallback(() => {
    if (currentCompany?.id) {
      productosCache.delete(`categories-${currentCompany.id}`);
      productosCache.delete(`products-${currentCompany.id}`);
    }
    fetchCategories(true);
    fetchProducts(true);
  }, [currentCompany?.id, fetchCategories, fetchProducts]);

  // Cargar datos cuando cambie la empresa (solo una vez)
  useEffect(() => {
    if (currentCompany?.id && !initialLoadRef.current) {
      initialLoadRef.current = true;
      Promise.all([fetchCategories(), fetchProducts()]);
    }
  }, [currentCompany?.id, fetchCategories, fetchProducts]);

  // Reset cuando cambia la empresa
  useEffect(() => {
    initialLoadRef.current = false;
  }, [currentCompany?.id]);

  return {
    categories,
    products,
    loading,
    error,
    createCategory,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    refreshData,
  };
}
