'use client';

import { Dashboard } from '../dashboard/Dashboard';
import { ConsolidatedDashboardV2 } from './ConsolidatedDashboardV2';
import { useState, useEffect } from 'react';
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics';
import { useCostConfig } from '@/hooks/use-cost-consolidation';

interface ExecutiveDashboardProps {
  data?: any[];
  selectedMonth?: string;
  companyId?: string;
  version?: 'V1' | 'V2' | 'HYBRID';  // Opcional, si no se pasa se lee de config
}

export function ExecutiveDashboard({
  data,
  selectedMonth,
  companyId,
  version: propVersion
}: ExecutiveDashboardProps) {
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(selectedMonth || new Date().toISOString().slice(0, 7));

  // Obtener configuración de versión
  const { data: configData, isLoading: configLoading } = useCostConfig();

  // Determinar versión: prop > config > V1
  const version = propVersion || configData?.config?.version || 'V1';
  const useV2Dashboard = version === 'V2' || version === 'HYBRID';

  // ✨ OPTIMIZADO: Usar React Query para evitar fetches duplicados (solo V1)
  const { data: metricsData, isLoading, isError: hasError } = useDashboardMetrics(
    companyId || "1",
    currentMonth,
    !useV2Dashboard && (!data || data.length === 0) // Solo fetch para V1
  );

  useEffect(() => {
    // Si usamos V2, no necesitamos dashboardData
    if (useV2Dashboard) return;

    // Si hay data proporcionada, usarla directamente
    if (data && data.length > 0) {
      setDashboardData(data);
      return;
    }

    // Si hay metricsData, convertir al formato esperado
    if (metricsData && metricsData.dailyData) {
      const historicalData = metricsData.dailyData.map((day: any) => ({
        month: day.date,
        ventas: day.value,
        costos: 0,
        total: day.value
      }));
      setDashboardData(historicalData);
    } else if (metricsData) {
      setDashboardData([]);
    }
  }, [data, metricsData, useV2Dashboard]);

  // Loading state
  if (configLoading || (!useV2Dashboard && isLoading)) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const handleMonthChange = (newMonth: string) => {
    setCurrentMonth(newMonth);
  };

  // Renderizar V2 o HYBRID dashboard
  if (useV2Dashboard) {
    return (
      <ConsolidatedDashboardV2
        selectedMonth={currentMonth}
        companyId={companyId || "1"}
        onMonthChange={handleMonthChange}
      />
    );
  }

  // Renderizar V1 dashboard (comportamiento original)
  return (
    <Dashboard
      data={dashboardData}
      selectedMonth={currentMonth}
      companyId={companyId}
      hasError={hasError}
      onMonthChange={handleMonthChange}
    />
  );
}
