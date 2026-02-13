import { useState, useEffect } from 'react';

interface RegistroMensual {
  id: number;
  name?: string;
  position?: string;
  salary?: number;
  amount?: number;
  units_sold?: number;
  unit_price?: number;
  total_amount?: number;
  quantity?: number;
  fecha_imputacion: string;
  status?: string;
  notes?: string;
  base_name?: string;
  category_name?: string;
  product_name?: string;
}

interface RegistrosMensualesData {
  sueldosEmpleados: RegistroMensual[];
  costosIndirectos: RegistroMensual[];
  registrosMensuales: RegistroMensual[];
  preciosInsumos: RegistroMensual[];
  ventas: RegistroMensual[];
  produccion: RegistroMensual[];
  totales: {
    sueldosEmpleados: number;
    costosIndirectos: number;
    registrosMensuales: number;
    preciosInsumos: number;
    ventas: number;
    produccion: number;
  };
}

interface UseRegistrosMensualesReturn {
  data: RegistrosMensualesData | null;
  loading: boolean;
  error: string | null;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  refreshData: () => Promise<void>;
}

export function useRegistrosMensuales(companyId: string): UseRegistrosMensualesReturn {
  const [data, setData] = useState<RegistrosMensualesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM por defecto
  );

  const fetchData = async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        companyId,
        ...(selectedMonth && { month: selectedMonth })
      });

      const response = await fetch(`/api/registros-mensuales?${params}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error obteniendo registros mensuales:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    await fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [companyId, selectedMonth]);

  return {
    data,
    loading,
    error,
    selectedMonth,
    setSelectedMonth,
    refreshData
  };
}
