import { useState, useEffect } from 'react';

interface CategoriaCostoIndirecto {
  id: string;
  name: string;
  description: string;
  type: 'fixed' | 'variable' | 'periodic';
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

interface CostoIndirecto {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  month: string;
  description: string;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

interface HistorialEntry {
  id: string;
  costId: string;
  costName: string;
  categoryName: string;
  oldAmount: number | null;
  newAmount: number;
  changeType: 'created' | 'updated' | 'status_changed' | 'deleted';
  reason: string;
  createdAt: string;
  month: string;
  status: string;
}

interface UseIndirectCostsProps {
  companyId: string;
}

export function useIndirectCosts({ companyId }: UseIndirectCostsProps) {
  const [categories, setCategories] = useState<CategoriaCostoIndirecto[]>([]);
  const [costs, setCosts] = useState<CostoIndirecto[]>([]);
  const [history, setHistory] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories
  const fetchCategories = async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/costos-indirectos/categorias?companyId=${companyId}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener categorías');
      }

      const data = await response.json();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Fetch costs
  const fetchCosts = async (month?: string) => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const url = month 
        ? `/api/costos-indirectos/costos?companyId=${companyId}&month=${month}`
        : `/api/costos-indirectos/costos?companyId=${companyId}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Error al obtener costos');
      }

      const data = await response.json();
      setCosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Fetch history
  const fetchHistory = async (month?: string, categoryId?: string) => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ companyId });
      if (month) params.append('month', month);
      if (categoryId) params.append('categoryId', categoryId);
      
      const response = await fetch(`/api/costos-indirectos/historial?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener historial');
      }

      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Create category
  const createCategory = async (categoryData: Omit<CategoriaCostoIndirecto, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!companyId) return null;

    try {
      const response = await fetch('/api/costos-indirectos/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...categoryData, companyId })
      });

      if (!response.ok) {
        throw new Error('Error al crear categoría');
      }

      const newCategory = await response.json();
      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return null;
    }
  };

  // Create cost
  const createCost = async (costData: Omit<CostoIndirecto, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!companyId) return null;

    try {
      const response = await fetch('/api/costos-indirectos/costos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...costData, companyId })
      });

      if (!response.ok) {
        throw new Error('Error al crear costo');
      }

      const newCost = await response.json();
      setCosts(prev => [newCost, ...prev]);
      return newCost;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return null;
    }
  };

  // Refresh all data
  const refreshData = async () => {
    await Promise.all([
      fetchCategories(),
      fetchCosts(),
      fetchHistory()
    ]);
  };

  useEffect(() => {
    if (companyId) {
      refreshData();
    }
  }, [companyId]);

  return {
    categories,
    costs,
    history,
    loading,
    error,
    fetchCategories,
    fetchCosts,
    fetchHistory,
    createCategory,
    createCost,
    refreshData
  };
}
