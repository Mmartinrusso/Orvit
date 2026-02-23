'use client';

import { formatNumber } from '@/lib/utils';
import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { Plus, Edit, Trash2, Settings, Users, DollarSign, Package, Save, X, Table, BookOpen, TrendingUp, PieChart, BarChart3, ArrowRight, Layers, Target, Activity, Percent, CheckCircle2 } from 'lucide-react';
import { NotesDialog } from '@/components/ui/NotesDialog';
import CostDistributionMatrix from './CostDistributionMatrix';
import EmployeeCostDistributionMatrix from './EmployeeCostDistributionMatrix';
import { useAdminCatalogs } from '@/hooks/use-admin-catalogs'; // ✨ OPTIMIZADO
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { toast } from 'sonner';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false; // Desactivado para mejor rendimiento
const log = DEBUG ? (...args: unknown[]) => { /* debug */ } : () => {};
const warn = DEBUG ? console.warn.bind(console) : () => {};

// Interfaz de colores de usuario




interface CostDistribution {
  id: number;
  cost_type: string;
  cost_name: string;
  product_category_id: number;
  productCategoryName: string;
  percentage: number;
  is_active: boolean;
  totalCost?: number; // Valor total del costo indirecto
}

interface EmployeeDistribution {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeLastName: string;
  productCategoryId: number;
  productCategoryName: string;
  percentage: number;
  isActive: boolean;
  totalSalary?: number; // Salario total del empleado
}

interface ProductCategory {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
  lastName: string;
  role: string;
}

interface IndirectCost {
  id: number;
  costType: string;
  costName: string;
  code: string;
}

export default function DistribucionCostos() {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);

  // ✨ OPTIMIZADO: Usar catálogos consolidados para categorías de productos
  const { data: catalogsData, isLoading: catalogsLoading } = useAdminCatalogs(currentCompany?.id);

  // 🎨 Colores de usuario
  const [userColors, setUserColors] = useState<UserColorPreferences>(DEFAULT_COLORS);

  // Cargar colores del usuario
  useEffect(() => {
    const loadColorPreferences = async () => {
      if (!currentCompany?.id) return;
      try {
        const response = await fetch(`/api/costos/color-preferences?companyId=${currentCompany.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.colors) {
            setUserColors(data.colors);
          }
        }
      } catch (error) {
        console.error('Error loading color preferences:', error);
      }
    };
    loadColorPreferences();
  }, [currentCompany?.id]);
  
  // Datos
  const [costDistributions, setCostDistributions] = useState<CostDistribution[]>([]);
  const [employeeDistributions, setEmployeeDistributions] = useState<EmployeeDistribution[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [indirectCosts, setIndirectCosts] = useState<IndirectCost[]>([]);
  
  // Estados para modales
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showMatrixDialog, setShowMatrixDialog] = useState(false);
  const [showEmployeeMatrixDialog, setShowEmployeeMatrixDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [editingCost, setEditingCost] = useState<CostDistribution | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeDistribution | null>(null);
  
  // Estado para filtro por categoría
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  
  // Funciones de filtrado
  const filteredCostDistributions = selectedCategoryFilter === 'all' 
    ? costDistributions 
    : costDistributions.filter(cost => cost.product_category_id.toString() === selectedCategoryFilter);
    
  const filteredEmployeeDistributions = selectedCategoryFilter === 'all' 
    ? employeeDistributions 
    : employeeDistributions.filter(emp => emp.productCategoryId.toString() === selectedCategoryFilter);
  
  // Formularios
  const [costForm, setCostForm] = useState({
    costType: '',
    costName: '',
    productCategoryId: '',
    percentage: ''
  });
  
  const [employeeForm, setEmployeeForm] = useState({
    employeeId: '',
    productCategoryId: '',
    percentage: ''
  });

  useEffect(() => {
    if (currentCompany && !catalogsLoading) {
      loadData();
    }
  }, [currentCompany, catalogsLoading]);

  // Debug: mostrar estados después de la carga
  useEffect(() => {
    if (!loading) {
      log('📊 Estados después de la carga:', {
        costDistributions: costDistributions.length,
        employeeDistributions: employeeDistributions.length,
        productCategories: productCategories.length,
        employees: employees.length,
        indirectCosts: indirectCosts.length
      });
    }
  }, [loading, costDistributions, employeeDistributions, productCategories, employees, indirectCosts]);

  const loadData = async () => {
    if (!currentCompany) return;
    
    log('🚀 Iniciando carga de datos para empresa:', currentCompany.id, currentCompany.name);
    setLoading(true);
    try {
      // ✨ OPTIMIZADO: Hacer todos los fetches independientes en paralelo
      const [
        costResponse,
        indirectItemsResponse,
        empResponse,
        salariesResponse,
        indirectCostsResponse,
        employeeResponse,
        matrixResponse,
        categoriesResponse
      ] = await Promise.all([
        fetch(`/api/cost-distribution?companyId=${currentCompany.id}`),
        fetch(`/api/indirect-items?companyId=${currentCompany.id}`),
        fetch(`/api/employee-distribution?companyId=${currentCompany.id}`),
        fetch(`/api/employee-categories/salaries?companyId=${currentCompany.id}`), // ✨ Una sola vez, no duplicado
        fetch(`/api/indirect-costs?companyId=${currentCompany.id}`).catch(() => null), // Puede fallar, usar catch
        fetch(`/api/employee-categories?companyId=${currentCompany.id}`),
        fetch(`/api/employee-cost-distribution/bulk?companyId=${currentCompany.id}`),
        // ✨ OPTIMIZADO: Usar catalogsData si está disponible, sino hacer fetch
        catalogsData?.categories ? Promise.resolve(null) : fetch(`/api/productos/categorias?companyId=${currentCompany.id}`)
      ]);
      
      // Procesar respuestas en paralelo
      const [
        costData,
        indirectItemsData,
        empData,
        salariesData,
        indirectCostsData,
        employeeData,
        matrixData,
        categoriesData
      ] = await Promise.all([
        costResponse.ok ? costResponse.json() : Promise.resolve([]),
        indirectItemsResponse.ok ? indirectItemsResponse.json() : Promise.resolve({ indirectItems: [] }),
        empResponse.ok ? empResponse.json() : Promise.resolve([]),
        salariesResponse.ok ? salariesResponse.json() : Promise.resolve([]),
        indirectCostsResponse && indirectCostsResponse.ok ? indirectCostsResponse.json() : Promise.resolve(null),
        employeeResponse.ok ? employeeResponse.json() : Promise.resolve([]),
        matrixResponse.ok ? matrixResponse.json() : Promise.resolve([]),
        categoriesResponse && categoriesResponse.ok ? categoriesResponse.json() : Promise.resolve(catalogsData?.categories || [])
      ]);
      
      // Procesar cost distributions con totales
      if (costData.length > 0) {
        const costDistributionsWithTotals = costData.map((cost: any) => {
          let matchingIndirectCost = indirectItemsData.indirectItems.find((ic: any) => 
            ic.label === cost.cost_name
          );
          
          if (!matchingIndirectCost) {
            matchingIndirectCost = indirectItemsData.indirectItems.find((ic: any) => 
              ic.category === cost.cost_type
            );
          }
          
          return {
            ...cost,
            totalCost: matchingIndirectCost?.currentPrice || 0
          };
        });
        
        setCostDistributions(costDistributionsWithTotals);
      }
      
      // Procesar employee distributions con salarios
      if (empData.length > 0) {
        const categorySalaries: { [key: number]: number } = {};
        salariesData.forEach((cat: any) => {
          categorySalaries[cat.category_id] = parseFloat(cat.total_salary || 0);
        });
        
        const employeeDistributionsWithSalaries = empData.map((emp: any) => ({
          ...emp,
          totalSalary: categorySalaries[emp.employeeId] || 0
        }));
        
        setEmployeeDistributions(employeeDistributionsWithSalaries);
      }
      
      // Procesar costos indirectos
      if (indirectCostsData) {
        const indirectCosts = indirectCostsData.indirectItems.map((item: any) => ({
          id: item.id,
          costType: item.costType,
          costName: item.costName,
          code: item.code
        }));
        setIndirectCosts(indirectCosts);
      } else {
        // Fallback: usar indirectItems si indirect-costs falló
        const fallbackCosts = indirectItemsData.indirectItems.map((item: any) => ({
          id: item.id,
          costType: item.category,
          costName: item.label,
          code: item.code
        }));
        setIndirectCosts(fallbackCosts);
      }
      
      // Procesar categorías de empleados
      if (employeeData.length > 0) {
        const employeeCategories = employeeData.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          lastName: cat.description || '',
          role: 'Categoría'
        }));
        setEmployees(employeeCategories);
      }
      
      // Procesar matriz de empleados
      if (matrixData.length > 0) {
        const categorySalaries: { [key: number]: number } = {};
        salariesData.forEach((cat: any) => {
          categorySalaries[cat.category_id] = parseFloat(cat.total_salary || 0);
        });
        
        const matrixDistributions = matrixData.map((item: any, index: number) => {
          const categorySalary = categorySalaries[item.employeeCategoryId] || 0;
          
          return {
            id: `matrix-${item.employeeCategoryId}-${item.productCategoryId}-${index}`,
            employeeId: item.employeeCategoryId,
            employeeName: item.employeeCategoryName,
            employeeLastName: '',
            productCategoryId: item.productCategoryId,
            productCategoryName: item.productCategoryName,
            percentage: item.percentage,
            isActive: true,
            totalSalary: categorySalary,
            costName: null,
            isMatrixDistribution: true
          };
        });
        
        setEmployeeDistributions(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newDistributions = matrixDistributions.filter(item => !existingIds.has(item.id));
          return [...prev, ...newDistributions];
        });
      }
      
      // ✨ OPTIMIZADO: Usar catalogsData para categorías de productos
      const finalCategories = catalogsData?.categories || categoriesData || [];
      setProductCategories(finalCategories);

    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Funciones para costos indirectos
  const handleCreateCost = async () => {
    if (!currentCompany) return;

    try {
      const response = await fetch('/api/cost-distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompany.id,
          costType: costForm.costType,
          costName: costForm.costName,
          productCategoryId: parseInt(costForm.productCategoryId),
          percentage: parseFloat(costForm.percentage)
        })
      });

      if (response.ok) {
        await loadData();
        setShowCostDialog(false);
        resetCostForm();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creando configuración de costo:', error);
      toast.error('Error al crear la configuración');
    }
  };

  const handleUpdateCost = async () => {
    if (!currentCompany || !editingCost) return;

    try {
      const response = await fetch(`/api/cost-distribution/${editingCost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          costType: costForm.costType,
          costName: costForm.costName,
          productCategoryId: parseInt(costForm.productCategoryId),
          percentage: parseFloat(costForm.percentage)
        })
      });

      if (response.ok) {
        await loadData();
        setShowCostDialog(false);
        resetCostForm();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error actualizando configuración de costo:', error);
      toast.error('Error al actualizar la configuración');
    }
  };

  const handleDeleteCost = async (id: number) => {
    const ok = await confirm({
      title: 'Eliminar configuración',
      description: '¿Estás seguro de que quieres eliminar esta configuración?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      log('Eliminando configuración con ID:', id);
      const response = await fetch(`/api/cost-distribution/${id}`, {
        method: 'DELETE'
      });

      log('Respuesta de eliminación:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        log('Eliminación exitosa:', result);
        await loadData();
        toast.success('Configuración eliminada exitosamente');
      } else {
        const errorText = await response.text();
        console.error('Error en respuesta:', errorText);
        try {
          const error = JSON.parse(errorText);
          toast.error(`Error: ${error.error}`);
        } catch {
          toast.error(`Error: ${response.status} - ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error eliminando configuración de costo:', error);
      toast.error('Error al eliminar la configuración');
    }
  };

  const resetCostForm = () => {
    setCostForm({
      costType: '',
      costName: '',
      productCategoryId: '',
      percentage: ''
    });
    setEditingCost(null);
  };

  // Funciones para empleados
  const handleCreateEmployee = async () => {
    if (!currentCompany) return;

    try {
      const response = await fetch('/api/employee-distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompany.id,
          employeeId: parseInt(employeeForm.employeeId),
          productCategoryId: parseInt(employeeForm.productCategoryId),
          percentage: parseFloat(employeeForm.percentage)
        })
      });

      if (response.ok) {
        await loadData();
        setShowEmployeeDialog(false);
        resetEmployeeForm();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creando configuración de empleado:', error);
      toast.error('Error al crear la configuración');
    }
  };

  const handleUpdateEmployee = async () => {
    if (!currentCompany || !editingEmployee) return;

    try {
      const response = await fetch(`/api/employee-distribution/${editingEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: parseInt(employeeForm.employeeId),
          productCategoryId: parseInt(employeeForm.productCategoryId),
          percentage: parseFloat(employeeForm.percentage)
        })
      });

      if (response.ok) {
        await loadData();
        setShowEmployeeDialog(false);
        resetEmployeeForm();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error actualizando configuración de empleado:', error);
      toast.error('Error al actualizar la configuración');
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    const ok = await confirm({
      title: 'Eliminar configuración',
      description: '¿Estás seguro de que quieres eliminar esta configuración?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      log('Eliminando configuración de empleado con ID:', id);
      const response = await fetch(`/api/employee-distribution/${id}`, {
        method: 'DELETE'
      });

      log('Respuesta de eliminación:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        log('Eliminación exitosa:', result);
        await loadData();
        toast.success('Configuración eliminada exitosamente');
      } else {
        const errorText = await response.text();
        console.error('Error en respuesta:', errorText);
        try {
          const error = JSON.parse(errorText);
          toast.error(`Error: ${error.error}`);
        } catch {
          toast.error(`Error: ${response.status} - ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error eliminando configuración de empleado:', error);
      toast.error('Error al eliminar la configuración');
    }
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({
      employeeId: '',
      productCategoryId: '',
      percentage: ''
    });
    setEditingEmployee(null);
  };

  const handleMatrixSave = async (distributions: any[]) => {
    if (!currentCompany) return;

    try {
      const response = await fetch('/api/cost-distribution/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributions,
          companyId: currentCompany.id
        })
      });

      if (response.ok) {
        await loadData(); // Recargar datos para mostrar los cambios
        log('✅ Distribuciones guardadas exitosamente');
      } else {
        const error = await response.json();
        console.error('Error guardando distribuciones:', error);
        toast.error(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error guardando distribuciones:', error);
      toast.error('Error al guardar las distribuciones');
    }
  };

  const handleEmployeeMatrixSave = async (distributions: any[]) => {
    if (!currentCompany) return;

    try {
      const response = await fetch('/api/employee-cost-distribution/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributions,
          companyId: currentCompany.id
        })
      });

      if (response.ok) {
        await loadData(); // Recargar datos para mostrar los cambios
        log('✅ Distribuciones de empleados guardadas exitosamente');
      } else {
        const error = await response.json();
        console.error('Error guardando distribuciones de empleados:', error);
        toast.error(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error guardando distribuciones de empleados:', error);
      toast.error('Error al guardar las distribuciones de empleados');
    }
  };

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Selecciona una empresa para continuar</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Cargando configuraciones...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-foreground">Distribución de Costos</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowNotesDialog(true)}
            variant="outline"
            size="sm"
            className="text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Notas
          </Button>
          <Badge variant="outline" className="text-sm">
            {currentCompany.name}
          </Badge>
        </div>
      </div>

      {/* Filtro por categoría */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtrar por categoría:</span>
            </div>
            <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {productCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategoryFilter !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {productCategories.find(cat => cat.id.toString() === selectedCategoryFilter)?.name}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs Mejorados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: userColors.chart1 }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Costos Indirectos</p>
                <p className="text-3xl font-bold mt-1" style={{ color: userColors.chart1 }}>{costDistributions.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  configuraciones activas
                </p>
              </div>
              <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: userColors.chart1 + '20' }}>
                <DollarSign className="h-6 w-6" style={{ color: userColors.chart1 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: userColors.chart2 }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Empleados</p>
                <p className="text-3xl font-bold mt-1" style={{ color: userColors.chart2 }}>{employeeDistributions.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  distribuciones
                </p>
              </div>
              <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: userColors.chart2 + '20' }}>
                <Users className="h-6 w-6" style={{ color: userColors.chart2 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: userColors.chart4 }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Categorías</p>
                <p className="text-3xl font-bold mt-1" style={{ color: userColors.chart4 }}>{productCategories.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  productos destino
                </p>
              </div>
              <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: userColors.chart4 + '20' }}>
                <Package className="h-6 w-6" style={{ color: userColors.chart4 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: userColors.chart3 }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Distribuido</p>
                <p className="text-2xl font-bold mt-1" style={{ color: userColors.chart3 }}>
                  ${(() => {
                    const totalIndirectos = costDistributions.reduce((sum, cost) => {
                      const distributedAmount = cost.totalCost ? (cost.totalCost * cost.percentage) / 100 : 0;
                      return sum + distributedAmount;
                    }, 0);
                    const totalEmpleados = employeeDistributions.reduce((sum, emp) => {
                      const distributedAmount = emp.totalSalary ? (emp.totalSalary * emp.percentage) / 100 : 0;
                      return sum + distributedAmount;
                    }, 0);
                    return (totalIndirectos + totalEmpleados).toLocaleString('es-AR', { maximumFractionDigits: 0 });
                  })()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  costos asignados
                </p>
              </div>
              <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: userColors.chart3 + '20' }}>
                <Target className="h-6 w-6" style={{ color: userColors.chart3 }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen por Categorías - Montos Totales con visualización mejorada */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-base">
              <PieChart className="h-5 w-5" style={{ color: userColors.chart2 }} />
              <span>Distribución por Categoría de Producto</span>
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Vista consolidada
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            // Calcular el total global para porcentajes
            const categoryData = productCategories.map((category) => {
              const categoryCostDistributions = costDistributions.filter(
                cost => cost.product_category_id === category.id
              );
              const totalIndirectCosts = categoryCostDistributions.reduce((sum, cost) => {
                const distributedAmount = cost.totalCost ? (cost.totalCost * cost.percentage) / 100 : 0;
                return sum + distributedAmount;
              }, 0);

              const categoryEmployeeDistributions = employeeDistributions.filter(
                emp => emp.productCategoryId === category.id
              );
              const totalEmployeeCosts = categoryEmployeeDistributions.reduce((sum, emp) => {
                const distributedAmount = emp.totalSalary ? (emp.totalSalary * emp.percentage) / 100 : 0;
                return sum + distributedAmount;
              }, 0);

              return {
                ...category,
                totalIndirectCosts,
                totalEmployeeCosts,
                total: totalIndirectCosts + totalEmployeeCosts,
                configCount: categoryCostDistributions.length + categoryEmployeeDistributions.length
              };
            });

            const grandTotal = categoryData.reduce((sum, cat) => sum + cat.total, 0);
            // Usar colores del usuario
            const categoryColors = [userColors.donut1, userColors.donut2, userColors.donut3, userColors.donut4, userColors.donut5, userColors.chart1, userColors.chart2, userColors.chart3];

            return (
              <div className="space-y-4">
                {/* Barra de distribución visual */}
                {grandTotal > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Distribución proporcional</span>
                      <span className="font-medium">Total: ${grandTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="h-4 rounded-full overflow-hidden bg-muted flex">
                      {categoryData
                        .filter(cat => cat.total > 0)
                        .map((cat, i) => {
                          const percentage = (cat.total / grandTotal) * 100;
                          return (
                            <div
                              key={cat.id}
                              className="transition-all duration-500 relative group"
                              style={{ width: `${percentage}%`, backgroundColor: categoryColors[i % categoryColors.length] }}
                              title={`${cat.name}: ${formatNumber(percentage, 1)}%`}
                            >
                              <div className="absolute inset-0 flex items-center justify-center">
                                {percentage > 8 && (
                                  <span className="text-xs font-bold text-white">
                                    {formatNumber(percentage, 0)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {categoryData
                        .filter(cat => cat.total > 0)
                        .map((cat, i) => (
                          <div key={cat.id} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[i % categoryColors.length] }} />
                            <span className="text-xs text-muted-foreground">{cat.name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Cards de categorías */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {categoryData.map((category, i) => {
                    const percentage = grandTotal > 0 ? (category.total / grandTotal) * 100 : 0;
                    const indirectPercentage = category.total > 0 ? (category.totalIndirectCosts / category.total) * 100 : 0;
                    const catColor = categoryColors[i % categoryColors.length];

                    return (
                      <div
                        key={category.id}
                        className="p-4 border rounded-lg border-l-4 hover:shadow-md transition-all"
                        style={{ borderLeftColor: catColor, backgroundColor: catColor + '10' }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: catColor }} />
                            <h3 className="font-semibold text-sm text-foreground">{category.name}</h3>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {category.configCount} configs
                            </Badge>
                            {percentage > 0 && (
                              <Badge className="text-xs px-1.5 py-0 text-white" style={{ backgroundColor: catColor }}>
                                {formatNumber(percentage, 1)}%
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* Costos Indirectos */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                Indirectos
                              </span>
                              <span className="font-semibold" style={{ color: userColors.chart1 }}>
                                ${category.totalIndirectCosts.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${indirectPercentage}%`, backgroundColor: userColors.chart1 }}
                              />
                            </div>
                          </div>

                          {/* Empleados */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Empleados
                              </span>
                              <span className="font-semibold" style={{ color: userColors.chart4 }}>
                                ${category.totalEmployeeCosts.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${100 - indirectPercentage}%`, backgroundColor: userColors.chart4 }}
                              />
                            </div>
                          </div>

                          {/* Total */}
                          <div className="pt-2 border-t border-border flex justify-between items-center">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Total
                            </span>
                            <span className="text-lg font-bold" style={{ color: catColor }}>
                              ${category.total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Distribución de Costos Indirectos */}
      <Card className="border-t-4" style={{ borderTopColor: userColors.chart1 }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: userColors.chart1 + '20' }}>
                <DollarSign className="h-5 w-5" style={{ color: userColors.chart1 }} />
              </div>
              <div>
                <CardTitle className="text-base">Costos Indirectos</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {costDistributions.length} configuraciones • Distribución a categorías de productos
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMatrixDialog(true)}
                className="bg-success-muted hover:bg-success-muted border-success-muted"
              >
                <Table className="h-4 w-4 mr-1" />
                Matriz Excel
              </Button>
              <Button size="sm" onClick={() => setShowCostDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredCostDistributions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay configuraciones de costos indirectos</p>
                <p className="text-sm">Agrega una configuración para comenzar</p>
              </div>
            ) : (
              filteredCostDistributions.map((cost, index) => {
                const distributedAmount = cost.totalCost ? (cost.totalCost * cost.percentage) / 100 : 0;
                const progressColors = [userColors.chart1, userColors.chart2, userColors.chart3, userColors.chart4];
                const progressColor = progressColors[index % progressColors.length];
                return (
                  <div key={cost.id} className="p-4 border rounded-lg hover:shadow-md transition-all bg-card group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="secondary" className="text-xs uppercase tracking-wider">{cost.cost_type}</Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge className="text-xs" style={{ backgroundColor: userColors.chart1 + '20', color: userColors.chart1 }}>{cost.productCategoryName}</Badge>
                        </div>

                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-base">{cost.cost_name}</span>
                          <span className="text-2xl font-bold" style={{ color: userColors.kpiPositive }}>
                            ${distributedAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                          </span>
                        </div>

                        {/* Progress bar visual */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Porcentaje asignado: <strong>{cost.percentage}%</strong></span>
                            {cost.totalCost && (
                              <span>de ${cost.totalCost.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                            )}
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${cost.percentage}%`, backgroundColor: progressColor }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingCost(cost);
                            setCostForm({
                              costType: cost.cost_type,
                              costName: cost.cost_name,
                              productCategoryId: cost.product_category_id.toString(),
                              percentage: cost.percentage.toString()
                            });
                            setShowCostDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteCost(cost.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Distribución de Empleados */}
      <Card className="border-t-4" style={{ borderTopColor: userColors.chart4 }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: userColors.chart4 + '20' }}>
                <Users className="h-5 w-5" style={{ color: userColors.chart4 }} />
              </div>
              <div>
                <CardTitle className="text-base">Categorías de Empleados</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {employeeDistributions.length} distribuciones • Asignación de mano de obra
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmployeeMatrixDialog(true)}
                className="bg-success-muted hover:bg-success-muted border-success-muted"
              >
                <Table className="h-4 w-4 mr-1" />
                Matriz Excel
              </Button>
              <Button size="sm" onClick={() => setShowEmployeeDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredEmployeeDistributions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay configuraciones de empleados</p>
                <p className="text-sm">Agrega una configuración para comenzar</p>
              </div>
            ) : (
              filteredEmployeeDistributions.map((emp, index) => {
                const distributedSalary = emp.totalSalary ? (emp.totalSalary * emp.percentage) / 100 : 0;
                const empProgressColors = [userColors.chart4, userColors.chart5, userColors.donut3, userColors.donut4];
                const progressColor = empProgressColors[index % empProgressColors.length];
                return (
                  <div key={emp.id} className="p-4 border rounded-lg hover:shadow-md transition-all bg-card group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant={emp.isMatrixDistribution ? 'secondary' : 'outline'} className="text-xs uppercase tracking-wider">
                            {emp.isMatrixDistribution ? 'Matriz' : 'Individual'}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge className="text-xs" style={{ backgroundColor: userColors.chart4 + '20', color: userColors.chart4 }}>{emp.productCategoryName}</Badge>
                        </div>

                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: userColors.chart4 + '20' }}>
                              <Users className="h-4 w-4" style={{ color: userColors.chart4 }} />
                            </div>
                            <span className="font-semibold text-base">{emp.employeeName} {emp.employeeLastName}</span>
                          </div>
                          <span className="text-2xl font-bold" style={{ color: userColors.chart3 }}>
                            ${distributedSalary.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                          </span>
                        </div>

                        {/* Progress bar visual */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Porcentaje asignado: <strong>{emp.percentage}%</strong></span>
                            {emp.totalSalary && (
                              <span>
                                de ${emp.totalSalary.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                {emp.isMatrixDistribution && ' (Cat.)'}
                              </span>
                            )}
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${emp.percentage}%`, backgroundColor: progressColor }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingEmployee(emp);
                            setEmployeeForm({
                              employeeId: emp.employeeId.toString(),
                              productCategoryId: emp.productCategoryId.toString(),
                              percentage: emp.percentage.toString()
                            });
                            setShowEmployeeDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteEmployee(emp.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal para configurar costos */}
      <Dialog open={showCostDialog} onOpenChange={setShowCostDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {editingCost ? 'Editar Costo' : 'Agregar Nuevo Costo'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Costo Indirecto</label>
              <Select
                value={costForm.costName}
                onValueChange={(value) => {
                  const selectedCost = indirectCosts.find(c => c.costName === value);
                  setCostForm({
                    ...costForm,
                    costType: selectedCost?.costType || '',
                    costName: value
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un costo indirecto" />
                </SelectTrigger>
                <SelectContent>
                  {indirectCosts.map((cost) => (
                    <SelectItem key={cost.id} value={cost.costName}>
                      {cost.costName} ({cost.costType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Categoría de Producto</label>
              <Select
                value={costForm.productCategoryId}
                onValueChange={(value) => setCostForm({...costForm, productCategoryId: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {productCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Porcentaje (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={costForm.percentage}
                onChange={(e) => setCostForm({...costForm, percentage: e.target.value})}
                placeholder="Ej: 50"
              />
            </div>
          </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCostDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={editingCost ? handleUpdateCost : handleCreateCost}>
              <Save className="h-4 w-4 mr-2" />
              {editingCost ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para configurar empleados */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Editar Empleado' : 'Agregar Nuevo Empleado'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Categoría de Empleado</label>
              <Select
                value={employeeForm.employeeId}
                onValueChange={(value) => setEmployeeForm({...employeeForm, employeeId: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría de empleado" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.name} {emp.lastName} ({emp.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Categoría de Producto</label>
              <Select
                value={employeeForm.productCategoryId}
                onValueChange={(value) => setEmployeeForm({...employeeForm, productCategoryId: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {productCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Porcentaje (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={employeeForm.percentage}
                onChange={(e) => setEmployeeForm({...employeeForm, percentage: e.target.value})}
                placeholder="Ej: 50"
              />
            </div>
          </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}>
              <Save className="h-4 w-4 mr-2" />
              {editingEmployee ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Matriz Tipo Excel */}
      <CostDistributionMatrix
        isOpen={showMatrixDialog}
        onClose={() => setShowMatrixDialog(false)}
        onSave={handleMatrixSave}
      />

      {/* Modal de Matriz Tipo Excel para Empleados */}
      <EmployeeCostDistributionMatrix
        isOpen={showEmployeeMatrixDialog}
        onClose={() => setShowEmployeeMatrixDialog(false)}
        onSave={handleEmployeeMatrixSave}
      />

      {/* Dialog: Notas */}
      <NotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        moduleName="Distribución de Costos"
        storageKey="distribucion_costos_notes"
      />
    </div>
  );
}
