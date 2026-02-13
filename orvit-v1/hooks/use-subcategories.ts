import { useState, useEffect, useCallback } from 'react';

export interface ProductSubcategory {
  id: number;
  name: string;
  description?: string;
  categoryId: number;
  companyId: number;
  categoryName: string;
}

export function useSubcategories(companyId?: number, categoryId?: number) {
  const [subcategories, setSubcategories] = useState<ProductSubcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubcategories = useCallback(async (specificCategoryId?: number) => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ companyId: companyId.toString() });
      const targetCategoryId = specificCategoryId || categoryId;
      if (targetCategoryId) {
        params.append('categoryId', targetCategoryId.toString());
      }

      const response = await fetch(`/api/productos/subcategorias?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar subcategorías');
      }

      const data = await response.json();
      setSubcategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [companyId, categoryId]);

  const createSubcategory = async (subcategory: {
    name: string;
    description?: string;
    categoryId: number;
    companyId: number;
  }) => {
    try {
      const response = await fetch('/api/productos/subcategorias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subcategory),
      });

      if (!response.ok) {
        throw new Error('Error al crear subcategoría');
      }

      const newSubcategory = await response.json();
      setSubcategories(prev => [...prev, newSubcategory]);
      return newSubcategory;
    } catch (err) {
      throw err;
    }
  };

  // Solo cargar subcategorías cuando hay una categoría específica
  useEffect(() => {
    if (companyId && categoryId) {
      fetchSubcategories(categoryId);
    } else {
      setSubcategories([]);
    }
  }, [companyId, categoryId, fetchSubcategories]);

  return {
    subcategories,
    loading,
    error,
    fetchSubcategories,
    createSubcategory,
  };
}
