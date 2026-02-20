import { useState, useEffect, useRef } from 'react';
import { useCompany } from '@/contexts/CompanyContext';

export interface RecipeIngredient {
  id?: number;
  supplyId: number;
  supplyName?: string;
  quantity: number;
  unitMeasure: string;
  currentPrice?: number;
  supplyActive?: boolean;
  pulsos?: number;
  kgPorPulso?: number;
  testPrice?: number;
}

export interface Recipe {
  id: number;
  name: string;
  productId?: string;
  productName?: string;
  subcategoryId?: number;
  subcategoryName?: string;
  baseType: 'PER_BATCH' | 'PER_M3' | 'PER_BANK';
  version: string;
  description?: string;
  notes?: string;
  outputQuantity: number;
  outputUnitLabel: string;
  intermediateQuantity?: number;
  intermediateUnitLabel?: string;
  unitsPerItem?: number; // Unidades por placa/pastón/etc
  metrosUtiles?: number; // Metros útiles del banco (solo para PER_BANK)
  cantidadPastones?: number; // Cantidad de pastones del banco (solo para PER_BANK)
  isActive: boolean;
  ingredientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeDetail extends Recipe {
  ingredients: RecipeIngredient[];
  bankIngredients?: RecipeIngredient[]; // Ingredientes del banco (opcional)
  totalBatchCost: number;
  costPerUnit: number;
}

export function useRecetas() {
  const companyContext = useCompany();
  const currentCompany = companyContext?.currentCompany;
  
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ✨ OPTIMIZADO: Flag para evitar múltiples fetches simultáneos
  const fetchingRef = useRef(false);

  // ✅ OPTIMIZADO: Obtener todas las recetas con ingredientes en una sola llamada
  const fetchRecipes = async (includeIngredients = false) => {
    if (!currentCompany?.id) return;
    
    // ✨ Prevenir múltiples fetches simultáneos
    if (fetchingRef.current) {
      return; // Ya hay un fetch en progreso
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const url = `/api/recetas?companyId=${currentCompany.id}${includeIngredients ? '&includeIngredients=true' : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener recetas');
      }

      const data = await response.json();
      setRecipes(data);
      return data; // Retornar datos para uso directo
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return [];
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  // Obtener detalles de una receta específica
  const fetchRecipeDetail = async (recipeId: number): Promise<RecipeDetail | null> => {
    if (!currentCompany?.id) return null;

    try {
      const response = await fetch(`/api/recetas/${recipeId}?companyId=${currentCompany.id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener detalles de la receta');
      }

      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return null;
    }
  };

  // Crear nueva receta
  const createRecipe = async (recipeData: {
    name: string;
    productId?: string;
    subcategoryId?: number;
    baseType: 'PER_BATCH' | 'PER_M3' | 'PER_BANK';
    version: string;
    description?: string;
    notes?: string;
    outputQuantity?: number;
    outputUnitLabel?: string;
    intermediateQuantity?: number;
    intermediateUnitLabel?: string;
    unitsPerItem?: number;
    metrosUtiles?: number;
    cantidadPastones?: number;
    ingredients: RecipeIngredient[];
    bankIngredients?: RecipeIngredient[];
  }): Promise<boolean> => {
    if (!currentCompany?.id) return false;

    try {
      const response = await fetch('/api/recetas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...recipeData,
          companyId: currentCompany.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear receta');
      }

      // Refrescar la lista de recetas
      await fetchRecipes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    }
  };

  // Actualizar receta existente
  const updateRecipe = async (recipeId: number, recipeData: {
    name: string;
    productId?: string;
    subcategoryId?: number;
    baseType: 'PER_BATCH' | 'PER_M3' | 'PER_BANK';
    version: string;
    description?: string;
    notes?: string;
    outputQuantity: number;
    outputUnitLabel: string;
    intermediateQuantity?: number;
    intermediateUnitLabel?: string;
    unitsPerItem?: number;
    metrosUtiles?: number;
    cantidadPastones?: number;
    ingredients: RecipeIngredient[];
    bankIngredients?: RecipeIngredient[];
    isActive?: boolean;
  }): Promise<boolean> => {
    if (!currentCompany?.id) return false;

    try {
      const response = await fetch(`/api/recetas/${recipeId}?companyId=${currentCompany.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recipeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar receta');
      }

      // Refrescar la lista de recetas
      await fetchRecipes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    }
  };

  // Eliminar receta
  const deleteRecipe = async (recipeId: number): Promise<boolean> => {
    if (!currentCompany?.id) return false;

    try {
      const response = await fetch(`/api/recetas/${recipeId}?companyId=${currentCompany.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar receta');
      }

      // Refrescar la lista de recetas
      await fetchRecipes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    }
  };

  // Refrescar datos
  const refreshData = () => {
    fetchRecipes();
  };

  // Cargar datos cuando cambie la empresa
  useEffect(() => {
    if (currentCompany?.id) {
      fetchRecipes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id]);

  return {
    recipes,
    loading,
    error,
    fetchRecipes,
    fetchRecipeDetail,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    refreshData,
  };
}
