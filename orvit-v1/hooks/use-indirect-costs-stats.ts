import { useState, useEffect } from 'react';

interface IndirectCostsStats {
  general: {
    totalCostos: number;
    totalCategorias: number;
    totalGeneral: number;
    promedioCosto: number;
    totalPagados: number;
    totalPendientes: number;
    totalVencidos: number;
  };
  distribucionPorCategoria: Array<{
    id: string;
    name: string;
    type: string;
    costoCount: number;
    totalCost: number;
    porcentaje: number;
  }>;
  distribucionPorMes: Array<{
    month: string;
    costoCount: number;
    totalCost: number;
    porcentaje: number;
  }>;
  costosMasAltos: Array<{
    id: string;
    name: string;
    categoryName: string;
    amount: number;
    month: string;
    status: string;
  }>;
  tendencias: {
    mesActual: number;
    mesAnterior: number;
    variacion: number;
    tendencia: 'incremento' | 'decremento' | 'estable';
  };
}

interface UseIndirectCostsStatsProps {
  companyId: string;
  month?: string;
}

export function useIndirectCostsStats({ companyId, month }: UseIndirectCostsStatsProps) {
  const [stats, setStats] = useState<IndirectCostsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ companyId });
      if (month) params.append('month', month);
      
      const response = await fetch(`/api/costos-indirectos/stats?${params}`);

      if (!response.ok) {
        throw new Error('Error al obtener estadísticas');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [companyId, month]);

  return {
    stats,
    loading,
    error,
    refreshStats: fetchStats,
  };
}
