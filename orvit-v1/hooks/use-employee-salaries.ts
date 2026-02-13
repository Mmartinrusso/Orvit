import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';

export interface EmployeeSalary {
  id: string;
  employeeId: string;
  monthYear: string;
  fecha_imputacion: string;
  grossSalary: number;
  payrollTaxes: number;
  totalCost: number;
  notes?: string;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  employeeName: string;
  employeeRole: string;
  categoryName?: string;
}

export interface EmployeeSalaryForm {
  employeeId: string;
  fecha_imputacion: string;
  grossSalary: string;
  payrollTaxes: string;
  notes: string;
}

export function useEmployeeSalaries(selectedMonth?: string) {
  const { currentCompany } = useCompany();
  const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSalaries = async (employeeId?: string, month?: string) => {
    if (!currentCompany?.id) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        companyId: currentCompany.id.toString(),
      });

      if (employeeId) {
        params.append('employeeId', employeeId);
      }

      if (month) {
        params.append('month', month);
      }

      const response = await fetch(`/api/employees/salaries?${params}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSalaries(data);
    } catch (err) {
      console.error('Error obteniendo sueldos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const registerSalary = async (salaryData: EmployeeSalaryForm) => {
    if (!currentCompany?.id) {
      throw new Error('No hay empresa seleccionada');
    }

    const response = await fetch('/api/employees/salaries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...salaryData,
        companyId: currentCompany.id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al registrar sueldo');
    }

    const newSalary = await response.json();
    setSalaries(prev => [newSalary, ...prev]);
    return newSalary;
  };

  const updateSalary = async (id: string, salaryData: Partial<EmployeeSalaryForm>) => {
    const response = await fetch(`/api/employees/salaries/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(salaryData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al actualizar sueldo');
    }

    const updatedSalary = await response.json();
    setSalaries(prev => 
      prev.map(salary => 
        salary.id === id ? { ...salary, ...updatedSalary } : salary
      )
    );
    return updatedSalary;
  };

  const deleteSalary = async (id: string) => {
    const response = await fetch(`/api/employees/salaries/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al eliminar sueldo');
    }

    setSalaries(prev => prev.filter(salary => salary.id !== id));
  };

  const refreshData = () => {
    fetchSalaries(undefined, selectedMonth);
  };

  useEffect(() => {
    if (currentCompany?.id) {
      fetchSalaries(undefined, selectedMonth);
    }
  }, [currentCompany?.id, selectedMonth]);

  return {
    salaries,
    loading,
    error,
    registerSalary,
    updateSalary,
    deleteSalary,
    refreshData,
    fetchSalaries,
  };
}
