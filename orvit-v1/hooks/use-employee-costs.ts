import { useState, useEffect, useRef } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useCostosCategorias } from '@/hooks/use-costos-categorias';
import { useQueryClient } from '@tanstack/react-query';
import { costosCategoriasKey } from '@/hooks/use-costos-categorias';

export interface EmployeeCategory {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  grossSalary: number;
  payrollTaxes: number;
  active: boolean;
  categoryId?: number;
  categoryName?: string;
  totalCost: number;
  startDate: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeCompHistory {
  id: string;
  companyId: number;
  employeeId: string;
  effectiveFrom: string;
  grossSalary: number;
  payrollTaxes: number;
  changePct?: number;
  reason?: string;
  createdAt: string;
}

export function useEmployeeCosts(selectedMonth?: string) {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  
  // ✨ OPTIMIZADO: Usar React Query hook para categorías (elimina duplicados)
  const categoriesQuery = useCostosCategorias(
    currentCompany?.id,
    !!currentCompany
  );
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ✨ OPTIMIZADO: Flag para evitar múltiples fetches simultáneos
  const loadingRef = useRef(false);

  // Extraer datos de la query
  const categories = categoriesQuery.data || [];
  const loadingCategories = categoriesQuery.isLoading;

  // ✨ OPTIMIZADO: Cargar empleados con últimos sueldos (ahora se ejecuta en paralelo con categorías)
  const loadEmployees = async () => {
    if (!currentCompany) return;
    
    try {
      setError(null);
      
      // ✨ OPTIMIZADO: Hacer fetch de empleados y salaries en paralelo
      const salariesUrl = selectedMonth 
        ? `/api/employees/salaries?companyId=${currentCompany.id}&month=${selectedMonth}`
        : `/api/employees/salaries?companyId=${currentCompany.id}`;
      
      // Hacer ambos fetches en paralelo
      const [employeesResponse, salariesResponse] = await Promise.all([
        fetch(`/api/costos/empleados?companyId=${currentCompany.id}`),
        fetch(salariesUrl)
      ]);
      
      // Procesar respuestas en paralelo
      const [employeesData, salariesData] = await Promise.all([
        employeesResponse.ok ? employeesResponse.json() : Promise.reject(new Error('Error cargando empleados')),
        salariesResponse.ok ? salariesResponse.json() : Promise.reject(new Error('Error cargando sueldos'))
      ]);
      
      // Crear un mapa de los últimos sueldos por empleado
      const latestSalariesByEmployee = new Map();
      salariesData.forEach((salary: any) => {
        const employeeId = salary.employeeId;
        if (!latestSalariesByEmployee.has(employeeId) || 
            new Date(salary.fecha_imputacion) > new Date(latestSalariesByEmployee.get(employeeId).fecha_imputacion)) {
          latestSalariesByEmployee.set(employeeId, salary);
        }
      });
      
      // Actualizar empleados con sus últimos sueldos
      const updatedEmployees = employeesData.map((emp: any) => {
        const latestSalary = latestSalariesByEmployee.get(emp.id);
        if (latestSalary) {
          return {
            ...emp,
            grossSalary: latestSalary.grossSalary,
            payrollTaxes: latestSalary.payrollTaxes,
            totalCost: latestSalary.totalCost
          };
        }
        return emp;
      });
      
      setEmployees(updatedEmployees);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };
  
  // ✨ OPTIMIZADO: Función que carga todo en paralelo con protección contra duplicados
  const loadAllData = async () => {
    if (!currentCompany) return;
    
    // ✨ Prevenir múltiples fetches simultáneos
    if (loadingRef.current) {
      return; // Ya hay un fetch en progreso
    }
    
    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      
      // ✨ OPTIMIZADO: Categorías ya vienen de React Query, solo cargar empleados
      await loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Crear nueva categoría
  const createCategory = async (categoryData: {
    name: string;
    description?: string;
  }) => {
    if (!currentCompany) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch('/api/costos/categorias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...categoryData,
          companyId: currentCompany.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error creando categoría');
      }

      const newCategory = await response.json();
      
      // ✨ OPTIMIZADO: Invalidar query de React Query para refetch automático
      queryClient.invalidateQueries({ queryKey: costosCategoriasKey(currentCompany.id) });
      
      return newCategory;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  };

  // Crear nuevo empleado
  const createEmployee = async (employeeData: {
    name: string;
    role: string;
    grossSalary: number;
    payrollTaxes?: number;
    categoryId?: number;
    startDate: string;
  }) => {
    if (!currentCompany) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch('/api/costos/empleados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...employeeData,
          companyId: currentCompany.id,
          payrollTaxes: employeeData.payrollTaxes || 0,
          startDate: employeeData.startDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error creando empleado');
      }

      const newEmployee = await response.json();
      setEmployees(prev => [...prev, newEmployee]);
      return newEmployee;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  };

  // Actualizar empleado
  const updateEmployee = async (id: string, employeeData: {
    name: string;
    role: string;
    grossSalary: number;
    payrollTaxes?: number;
    categoryId?: number;
    active?: boolean;
  }) => {
    if (!currentCompany) throw new Error('No hay empresa seleccionada');
    
    const requestBody = {
      ...employeeData,
      companyId: currentCompany.id,
    };
    
    try {
      const response = await fetch(`/api/costos/empleados/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error actualizando empleado');
      }

      const updatedEmployee = await response.json();
      await loadEmployees(); // Cargar solo empleados después de actualizar
      return updatedEmployee;
    } catch (err) {
      throw err;
    }
  };

  // Obtener historial de salarios
  const getSalaryHistory = async (employeeId: string) => {
    if (!currentCompany) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/costos/empleados/${employeeId}/historial?companyId=${currentCompany.id}`);
      if (!response.ok) {
        throw new Error('Error cargando historial');
      }
      
      const data = await response.json();
      return data;
    } catch (err) {
      throw err;
    }
  };

  // Crear entrada manual en historial
  const createSalaryHistoryEntry = async (employeeId: string, historyData: {
    grossSalary: number;
    payrollTaxes?: number;
    changePct?: number;
    reason?: string;
    effectiveFrom?: string;
  }) => {
    if (!currentCompany) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/costos/empleados/${employeeId}/historial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(historyData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error creando entrada en historial');
      }

      const newEntry = await response.json();
      return newEntry;
    } catch (err) {
      throw err;
    }
  };

  // Actualizar categoría
  const updateCategory = async (id: number, categoryData: {
    name: string;
    description?: string;
  }) => {
    if (!currentCompany) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/costos/categorias/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...categoryData,
          companyId: currentCompany.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error actualizando categoría');
      }

      const updatedCategory = await response.json();
      // ✨ OPTIMIZADO: Invalidar query de React Query para refetch automático
      queryClient.invalidateQueries({ queryKey: costosCategoriasKey(currentCompany.id) });
      return updatedCategory;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  };

  // Eliminar categoría
  const deleteCategory = async (id: number) => {
    if (!currentCompany) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/costos/categorias/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyId: currentCompany.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error eliminando categoría');
      }

      // ✨ OPTIMIZADO: Invalidar query de React Query para refetch automático
      queryClient.invalidateQueries({ queryKey: costosCategoriasKey(currentCompany.id) });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  };

  // Eliminar empleado
  const deleteEmployee = async (id: string) => {
    if (!currentCompany) throw new Error('No hay empresa seleccionada');
    
    try {
      const response = await fetch(`/api/costos/empleados/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyId: currentCompany.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error eliminando empleado');
      }

      await loadEmployees(); // Cargar solo empleados después de eliminar
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  };

  // ✨ OPTIMIZADO: Cargar datos iniciales en paralelo
  useEffect(() => {
    if (currentCompany) {
      loadAllData();
    }
  }, [currentCompany?.id, selectedMonth]); // Incluir selectedMonth en las dependencias

  // Calcular estadísticas usando solo empleados activos con sus últimos sueldos
  const activeEmployees = employees.filter(emp => emp.active);
  
  const stats = {
    totalEmployees: activeEmployees.length,
    totalCategories: categories.length,
    totalCosts: activeEmployees.reduce((sum, emp) => {
      // Usar totalCost que ya incluye sueldo + impuestos del último registro
      return sum + (Number(emp.totalCost) || 0);
    }, 0),
    averageSalary: activeEmployees.length > 0 
      ? activeEmployees.reduce((sum, emp) => sum + (Number(emp.grossSalary) || 0), 0) / activeEmployees.length 
      : 0,
  };
  

  // Función para exportar empleados a Excel
  const exportEmployees = async () => {
    try {
      const response = await fetch(`/api/costos/empleados/export?companyId=${currentCompany?.id}`);
      if (!response.ok) throw new Error('Error exportando empleados');
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error exportando empleados:', error);
      throw error;
    }
  };

  // Función para importar empleados desde Excel
  const importEmployees = async (employees: any[]) => {
    try {
      const response = await fetch('/api/costos/empleados/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees, companyId: currentCompany?.id })
      });
      
      if (!response.ok) throw new Error('Error importando empleados');
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error importando empleados:', error);
      throw error;
    }
  };

  return {
    categories,
    employees,
    loading: loading || loadingCategories,
    error: error || categoriesQuery.error?.message || null,
    stats,
    loadEmployees,
    createCategory,
    createEmployee,
    updateEmployee,
    updateCategory,
    deleteCategory,
    deleteEmployee,
    getSalaryHistory,
    createSalaryHistoryEntry,
    exportEmployees,
    importEmployees,
    refreshData: () => {
      loadAllData();
    },
  };
}
