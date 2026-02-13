import { useState, useEffect } from 'react';

interface CostosStats {
  totalGeneral: number;
  totalEmpleados: number;
  totalCategorias: number;
  promedioSalario: number;
  empleadoMasCostoso: {
    id: string;
    name: string;
    totalCost: number;
  } | null;
  categoriaMasCostosa: {
    id: string;
    name: string;
    totalCost: number;
    empleadoCount: number;
  } | null;
  distribucionPorCategoria: Array<{
    id: string;
    name: string;
    totalCost: number;
    empleadoCount: number;
    porcentaje: number;
  }>;
  distribucionPorEmpleado: Array<{
    id: string;
    name: string;
    role: string;
    grossSalary: number;
    payrollTaxes: number;
    totalCost: number;
    porcentaje: number;
  }>;
  tendencias: {
    totalCostosUltimoMes: number;
    variacionUltimoMes: number;
    empleadosNuevos: number;
  };
}

interface UseCostosStatsProps {
  companyId: string;
}

export function useCostosStats({ companyId }: UseCostosStatsProps) {
  const [stats, setStats] = useState<CostosStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!companyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/costos/stats?companyId=${companyId}`);
      
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
  }, [companyId]);

  return {
    stats,
    loading,
    error,
    refreshStats: fetchStats,
  };
}
