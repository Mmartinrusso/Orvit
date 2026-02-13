import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

export interface EmployeeCategory {
  id: number;
  name: string;
  description?: string;
  hierarchyLevel: number;
  baseSalary?: number;
  maxSalary?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  companyId: number;
  createdById: number;
  employeeCount?: number;
  totalCost?: number;
  averageSalary?: number;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  hierarchyLevel: number;
  baseSalary?: number;
  maxSalary?: number;
}

export interface UpdateCategoryData {
  id: number;
  name?: string;
  description?: string;
  hierarchyLevel?: number;
  baseSalary?: number;
  maxSalary?: number;
  isActive?: boolean;
}

export function useEmployeeCategories() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [categories, setCategories] = useState<EmployeeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar categorías
  const fetchCategories = async () => {
    if (!currentCompany?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/costs/employee-categories?companyId=${currentCompany.id}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar las categorías');
      }

      const data = await response.json();
      setCategories(data.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error fetching employee categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Crear nueva categoría
  const createCategory = async (categoryData: CreateCategoryData): Promise<EmployeeCategory | null> => {
    if (!currentCompany?.id || !user?.id) {
      setError('Empresa o usuario no disponible');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/costs/employee-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...categoryData,
          companyId: currentCompany.id,
          createdById: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear la categoría');
      }

      const data = await response.json();
      const newCategory = data.category;
      
      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error creating employee category:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Actualizar categoría
  const updateCategory = async (categoryData: UpdateCategoryData): Promise<EmployeeCategory | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/costs/employee-categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoryData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar la categoría');
      }

      const data = await response.json();
      const updatedCategory = data.category;
      
      setCategories(prev => 
        prev.map(cat => 
          cat.id === updatedCategory.id ? updatedCategory : cat
        )
      );
      
      return updatedCategory;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error updating employee category:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Eliminar categoría
  const deleteCategory = async (categoryId: number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/costs/employee-categories?id=${categoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar la categoría');
      }

      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error deleting employee category:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Cambiar estado de categoría
  const toggleCategoryStatus = async (categoryId: number, isActive: boolean): Promise<boolean> => {
    return updateCategory({ id: categoryId, isActive }) !== null;
  };

  // Cargar categorías cuando cambie la empresa
  useEffect(() => {
    if (currentCompany?.id) {
      fetchCategories();
    }
  }, [currentCompany?.id]);

  return {
    categories,
    isLoading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
  };
}
