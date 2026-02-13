import { useState, useEffect } from 'react';

interface CostoBase {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryType: string;
  createdAt: string;
  updatedAt: string;
  totalRecords: number;
  totalAmount: number;
  lastMonth: string;
  lastActivity: string;
}

interface RegistroMensual {
  id: string;
  costBaseId: string;
  costName: string;
  costDescription: string;
  month: string;
  amount: number;
  status: string;
  dueDate: string;
  notes: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  categoryName: string;
  categoryType: string;
}

interface HistorialCambio {
  id: string;
  costBaseId: string;
  costName: string;
  costDescription: string;
  monthlyRecordId: string;
  changeType: string;
  oldAmount: number;
  newAmount: number;
  oldStatus: string;
  newStatus: string;
  month: string;
  reason: string;
  companyId: string;
  createdAt: string;
  categoryName: string;
  categoryType: string;
}

interface Categoria {
  id: string;
  name: string;
  description: string;
  type: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

interface Estadisticas {
  general: {
    totalCostosBase: number;
    totalRegistrosMensuales: number;
    totalGeneral: number;
    promedioPorRegistro: number;
    totalCategorias: number;
  };
  distribucionPorCategoria: Array<{
    id: string;
    name: string;
    type: string;
    totalCostos: number;
    totalRegistros: number;
    totalAmount: number;
    porcentaje: number;
  }>;
  costosMasActivos: Array<{
    id: string;
    name: string;
    description: string;
    categoryName: string;
    totalRegistros: number;
    totalAmount: number;
    promedioMensual: number;
    ultimoMes: string;
    primerMes: string;
  }>;
  tendenciaMensual: Array<{
    month: string;
    totalRegistros: number;
    totalAmount: number;
    costosActivos: number;
  }>;
  tendencias: {
    tendencia: string;
    variacion: string;
  };
}

interface UseIndirectCostsProps {
  companyId: string;
}

export function useIndirectCostsNew({ companyId }: UseIndirectCostsProps) {
  const [costosBase, setCostosBase] = useState<CostoBase[]>([]);
  const [registrosMensuales, setRegistrosMensuales] = useState<RegistroMensual[]>([]);
  const [historial, setHistorial] = useState<HistorialCambio[]>([]);
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch categorías
  const fetchCategorias = async () => {
    if (!companyId) return;
    
    try {
      const response = await fetch(`/api/costos-indirectos/categorias?companyId=${companyId}`);
      if (!response.ok) {
        throw new Error('Error al obtener categorías');
      }
      const data = await response.json();
      setCategorias(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  // Fetch costos base (sin setLoading porque refreshData lo maneja)
  const fetchCostosBase = async () => {
    if (!companyId) return;

    try {
      const response = await fetch(`/api/costos-indirectos/costos-base?companyId=${companyId}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener costos base');
      }

      const data = await response.json();
      setCostosBase(data);
    } catch (err) {
      console.error('❌ Hook: Error obteniendo costos base:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err; // Re-throw para que Promise.all detecte el error
    }
  };

  // Fetch registros mensuales (sin setLoading porque refreshData lo maneja)
  const fetchRegistrosMensuales = async (costBaseId?: string, month?: string) => {
    if (!companyId) return;

    try {
      const params = new URLSearchParams({ companyId });
      if (costBaseId) params.append('costBaseId', costBaseId);
      if (month) params.append('month', month);
      
      const response = await fetch(`/api/costos-indirectos/registros-mensuales?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener registros mensuales');
      }

      const data = await response.json();
      setRegistrosMensuales(data);
    } catch (err) {
      console.error('❌ Hook: Error obteniendo registros mensuales:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  };

  // Fetch historial (sin setLoading porque refreshData lo maneja)
  const fetchHistorial = async (costBaseId?: string, month?: string) => {
    if (!companyId) return;

    try {
      const params = new URLSearchParams({ companyId });
      if (costBaseId) params.append('costBaseId', costBaseId);
      if (month) params.append('month', month);
      
      const response = await fetch(`/api/costos-indirectos/historial-cambios?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener historial');
      }

      const data = await response.json();
      setHistorial(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  };

  // Fetch estadísticas (sin setLoading porque refreshData lo maneja)
  const fetchEstadisticas = async () => {
    if (!companyId) return;

    try {
      const response = await fetch(`/api/costos-indirectos/estadisticas?companyId=${companyId}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener estadísticas');
      }

      const data = await response.json();
      setEstadisticas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  };

  // Create costo base
  const createCostoBase = async (costoData: { name: string; description: string; categoryId: string }) => {
    if (!companyId) return null;

    try {
      const response = await fetch('/api/costos-indirectos/costos-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...costoData, companyId })
      });

      if (!response.ok) {
        throw new Error('Error al crear costo base');
      }

      const newCosto = await response.json();
      setCostosBase(prev => [...prev, newCosto]);
      return newCosto;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return null;
    }
  };

  // Create registro mensual
  const createRegistroMensual = async (registroData: Omit<RegistroMensual, 'id' | 'costName' | 'costDescription' | 'categoryName' | 'categoryType' | 'companyId' | 'createdAt' | 'updatedAt'>) => {
    if (!companyId) return null;

    try {
      // Transformar month a fecha_imputacion para la API
      const apiData = {
        ...registroData,
        fecha_imputacion: registroData.month, // Convertir month a fecha_imputacion
        companyId
      };
      
      const response = await fetch('/api/costos-indirectos/registros-mensuales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      });

      if (!response.ok) {
        throw new Error('Error al crear registro mensual');
      }

      const newRegistro = await response.json();
      setRegistrosMensuales(prev => [newRegistro, ...prev]);
      return newRegistro;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return null;
    }
  };

  // Delete costo base
  const deleteCostoBase = async (costId: string) => {
    if (!companyId) return false;

    try {
      const response = await fetch(`/api/costos-indirectos/costos-base/${costId}?companyId=${companyId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar costo');
      }

      setCostosBase(prev => prev.filter(cost => cost.id !== costId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    }
  };

  // Delete registro mensual
  const deleteRegistroMensual = async (recordId: string) => {
    if (!companyId) return false;

    try {
      const response = await fetch(`/api/costos-indirectos/registros-mensuales/${recordId}?companyId=${companyId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar registro mensual');
      }

      setRegistrosMensuales(prev => prev.filter(record => record.id !== recordId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    }
  };

  // Update costo base
  const updateCostoBase = async (costId: string, data: { name: string; categoryId: string; description?: string }) => {
    if (!companyId) return false;

    try {
      const response = await fetch(`/api/costos-indirectos/costos-base`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: costId,
          ...data,
          companyId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar costo');
      }

      const updatedCost = await response.json();
      setCostosBase(prev => prev.map(cost => 
        cost.id === costId ? { ...cost, ...updatedCost } : cost
      ));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    }
  };

  // Delete historial entry
  const deleteHistorialEntry = async (historyId: string) => {
    if (!companyId) return false;

    try {
      const response = await fetch(`/api/costos-indirectos/historial/${historyId}?companyId=${companyId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar entrada del historial');
      }

      setHistorial(prev => prev.filter(entry => entry.id !== historyId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      // ✨ OPTIMIZADO: Hacer todos los fetches en paralelo, incluyendo categorías
      await Promise.all([
        fetchCostosBase(),
        fetchRegistrosMensuales(),
        fetchHistorial(),
        fetchEstadisticas(),
        fetchCategorias()
      ]);
    } catch (error) {
      console.error('❌ Hook: Error en refreshData:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      refreshData(); // ✨ Ahora fetchCategorias está incluido en refreshData
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return {
    costosBase,
    registrosMensuales,
    historial,
    estadisticas,
    categorias,
    loading,
    error,
    fetchCostosBase,
    fetchRegistrosMensuales,
    fetchHistorial,
    fetchCategorias,
    fetchEstadisticas,
    createCostoBase,
    createRegistroMensual,
    deleteCostoBase,
    deleteRegistroMensual,
    updateCostoBase,
    deleteHistorialEntry,
    refreshData
  };
}
