import { useState, useEffect } from 'react';
import { useCostosHistorial, costosHistorialKey } from '@/hooks/use-costos-historial';
import { useQueryClient } from '@tanstack/react-query';

interface SalaryHistoryEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  oldSalary: number;
  newSalary: number;
  changeDate: string;
  changeReason: string;
  companyId: number;
}

interface UseGlobalHistorialProps {
  companyId: string;
}

export function useGlobalHistorial({ companyId }: UseGlobalHistorialProps) {
  const queryClient = useQueryClient();
  
  // ✨ OPTIMIZADO: Usar React Query hook para historial (elimina duplicados)
  const historialQuery = useCostosHistorial(
    companyId,
    null, // Sin filtro de empleado específico
    !!companyId
  );

  const [filteredHistorial, setFilteredHistorial] = useState<SalaryHistoryEntry[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  // Extraer datos de la query
  const historial: SalaryHistoryEntry[] = historialQuery.data || [];
  const loading = historialQuery.isLoading;
  const error = historialQuery.error?.message || null;

  // ✨ OPTIMIZADO: Actualizar historial filtrado cuando cambien los datos
  useEffect(() => {
    if (historial && historial.length > 0) {
      setFilteredHistorial(historial);
    }
  }, [historial]);

  // Función legacy para compatibilidad (ya no hace fetch)
  const fetchHistorial = async () => {
    // Ya no es necesario, React Query maneja el fetch automáticamente
    // Esta función se mantiene solo para compatibilidad con código existente
  };

  // Filtrar por empleado
  const filterByEmployee = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    
    if (employeeId === 'all') {
      setFilteredHistorial(historial);
    } else {
      const filtered = historial.filter(entry => entry.employeeId === employeeId);
      setFilteredHistorial(filtered);
    }
  };

  // Agregar nueva entrada al historial
  const addHistorialEntry = async (entry: {
    employeeId: string;
    oldSalary: number;
    newSalary: number;
    changeReason: string;
  }) => {
    try {
      const response = await fetch('/api/costos/historial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...entry,
          companyId: parseInt(companyId),
        }),
      });

      if (!response.ok) {
        throw new Error('Error al crear entrada en historial');
      }

      // ✨ OPTIMIZADO: Invalidar query de React Query para refetch automático
      queryClient.invalidateQueries({ queryKey: costosHistorialKey(companyId, null) });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    }
  };

  // Obtener lista única de empleados para el filtro
  const getUniqueEmployees = () => {
    // Usar la información del historial pero con nombres más legibles
    const employees = historial.reduce((acc, entry) => {
      if (!acc.find(emp => emp.id === entry.employeeId)) {
        // Extraer solo la parte del nombre si es muy largo
        let displayName = entry.employeeName;
        if (displayName.startsWith('Empleado ')) {
          displayName = displayName.replace('Empleado ', '');
          // Si es un UUID, mostrar solo los primeros 8 caracteres
          if (displayName.length > 20) {
            displayName = displayName.substring(0, 8) + '...';
          }
        }
        
        acc.push({
          id: entry.employeeId,
          name: displayName,
          role: entry.employeeRole === 'Sin rol' ? 'Empleado' : entry.employeeRole,
        });
      }
      return acc;
    }, [] as { id: string; name: string; role: string }[]);

    return employees.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Calcular estadísticas
  const getStats = () => {
    if (filteredHistorial.length === 0) return null;

    const totalChanges = filteredHistorial.length;
    const totalIncrease = filteredHistorial.reduce((sum, entry) => {
      const increase = entry.newSalary - entry.oldSalary;
      return sum + (increase > 0 ? increase : 0);
    }, 0);
    const totalDecrease = filteredHistorial.reduce((sum, entry) => {
      const decrease = entry.oldSalary - entry.newSalary;
      return sum + (decrease > 0 ? decrease : 0);
    }, 0);

    return {
      totalChanges,
      totalIncrease,
      totalDecrease,
      averageIncrease: totalIncrease / totalChanges,
      averageDecrease: totalDecrease / totalChanges,
    };
  };

  // ✨ OPTIMIZADO: React Query maneja el fetch automáticamente cuando cambia companyId
  // No necesitamos useEffect aquí

  return {
    historial: filteredHistorial,
    loading,
    error,
    selectedEmployee,
    filterByEmployee,
    addHistorialEntry,
    getUniqueEmployees,
    getStats,
    refreshHistorial: fetchHistorial,
  };
}
