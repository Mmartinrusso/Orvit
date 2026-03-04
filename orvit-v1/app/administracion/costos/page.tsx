"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2, TrendingUp, Calculator, Plus, Edit, Trash2, History, BarChart3, FileSpreadsheet, User, BookOpen, DollarSign, RefreshCw } from "lucide-react";
import { NotesDialog } from "@/components/ui/NotesDialog";
import { useEmployeeCosts } from "@/hooks/use-employee-costs";
import type { EmployeeCategory, Employee } from "@/hooks/use-employee-costs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DatePicker } from '@/components/ui/date-picker';
import UploadPayroll from "@/components/empleados/UploadPayroll";
import { HistorialGlobal } from "@/components/costos/HistorialGlobal";
import { EstadisticasCostos } from "@/components/costos/EstadisticasCostos";
import { CostosIndirectosNew } from "@/components/costos/CostosIndirectosNew";
import { ComprasMensuales } from "@/components/costos/ComprasMensuales";
import EmployeeSalaries from "@/components/empleados/EmployeeSalaries";
import EmployeeDetail from "@/components/empleados/EmployeeDetail";
import Productos from "@/components/productos/Productos";
import Insumos from "@/components/insumos/Insumos";
import RecetasV2 from "@/components/recetas/RecetasV2";
import DistribucionCostos from "@/components/configuracion/DistribucionCostos";
import ProduccionMensual from "@/components/produccion/ProduccionMensual";
import VentasMensuales from "@/components/ventas/VentasMensuales";
import { ExecutiveDashboard } from "@/components/costos/ExecutiveDashboard";
import { CalculadoraCostosEmbedded } from "@/components/costos/CalculadoraCostosEmbedded";
import { CostVersionToggle } from "@/components/costos/CostVersionToggle";
import { useCompany } from '@/contexts/CompanyContext';
import { useRouter } from 'next/navigation';
import { useCostConfig } from '@/hooks/use-cost-consolidation';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { useViewMode } from '@/contexts/ViewModeContext';
import { toast } from 'sonner';

// V2 Components
import { ExecutiveDashboardV2 } from '@/components/costos/v2';

// Función helper para formatear números en formato argentino
const formatCurrency = (value: number | string | undefined): string => {
  if (value === undefined || value === null) return '0';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0';
  return numValue.toLocaleString('es-AR');
};

export default function CostosPage() {
  const confirm = useConfirm();
  const { currentArea, currentCompany } = useCompany();
  const router = useRouter();
  
  // Estado para el mes seleccionado (por defecto mes actual)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const {
    categories,
    employees,
    loading,
    error,
    stats,
    createCategory,
    createEmployee,
    updateEmployee,
    refreshData
  } = useEmployeeCosts(selectedMonth);

  // View Mode - Costos requiere T2 (Extended)
  const { mode: viewMode, isLoading: vmLoading } = useViewMode();

  // Redirigir si no está en T2
  useEffect(() => {
    if (!vmLoading && viewMode !== 'E') {
      router.replace('/administracion');
    }
  }, [vmLoading, viewMode, router]);

  // V2 Config - determina qué versión mostrar
  const { data: configData, isLoading: configLoading } = useCostConfig();
  const costVersion = configData?.config?.version || 'V1';
  const isV2Mode = costVersion === 'V2' || costVersion === 'HYBRID';

  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showEditEmployeeDialog, setShowEditEmployeeDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEmployeeDetail, setShowEmployeeDetail] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: ''
  });
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    role: '',
    categoryId: '',
    startDate: new Date().toISOString().slice(0, 10) // YYYY-MM-DD por defecto
  });

  // Tipo de cambio USD de reposición
  const [tipoCambioUSD, setTipoCambioUSD] = useState('');
  const [tipoCambioUpdatedAt, setTipoCambioUpdatedAt] = useState<string | null>(null);
  const [tipoCambioLoading, setTipoCambioLoading] = useState(false);
  const [tipoCambioSaving, setTipoCambioSaving] = useState(false);

  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        setTipoCambioLoading(true);
        const res = await fetch('/api/costs/config/exchange-rate');
        if (res.ok) {
          const data = await res.json();
          if (data.tipoCambioUSD) setTipoCambioUSD(String(data.tipoCambioUSD));
          if (data.updatedAt) setTipoCambioUpdatedAt(data.updatedAt);
        }
      } catch {
        // silently fail
      } finally {
        setTipoCambioLoading(false);
      }
    };
    fetchExchangeRate();
  }, []);

  const handleSaveExchangeRate = async () => {
    const value = parseFloat(tipoCambioUSD);
    if (!value || value <= 0) {
      toast.error('Ingresá un tipo de cambio válido');
      return;
    }
    try {
      setTipoCambioSaving(true);
      toast.loading('Actualizando tipo de cambio...', { id: 'tc' });
      const res = await fetch('/api/costs/config/exchange-rate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoCambioUSD: value }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      const data = await res.json();
      setTipoCambioUpdatedAt(new Date().toISOString());
      toast.success(data.message || 'Tipo de cambio actualizado', { id: 'tc' });
    } catch {
      toast.error('Error al actualizar el tipo de cambio', { id: 'tc' });
    } finally {
      setTipoCambioSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    try {
      await createCategory({
        name: newCategory.name,
        description: newCategory.description || undefined
      });
      setNewCategory({ name: '', description: '' });
      setShowCategoryDialog(false);
      refreshData();
    } catch (error) {
      console.error('Error creando categoría:', error);
    }
  };

  const handleCreateEmployee = async () => {
    try {
      await createEmployee({
        name: newEmployee.name,
        role: newEmployee.role,
        grossSalary: 0, // Salario inicial en 0, se registrará por mes
        payrollTaxes: 0,
        categoryId: newEmployee.categoryId ? parseInt(newEmployee.categoryId) : undefined,
        startDate: newEmployee.startDate
      });
      setNewEmployee({ name: '', role: '', categoryId: '', startDate: new Date().toISOString().slice(0, 10) });
      setShowEmployeeDialog(false);
      refreshData();
    } catch (error) {
      console.error('Error creando empleado:', error);
    }
  };

  const handleEditEmployee = async () => {
    if (!editingEmployee) return;
    
    try {
      // Obtener el empleado actual para comparar salarios
      const currentEmployee = employees.find(emp => emp.id === editingEmployee.id);
      const oldSalary = currentEmployee?.grossSalary || 0;
      const newSalary = editingEmployee.grossSalary;
      
      // Actualizar empleado
      await updateEmployee(editingEmployee.id, {
        name: editingEmployee.name,
        role: editingEmployee.role,
        grossSalary: editingEmployee.grossSalary,
        payrollTaxes: editingEmployee.payrollTaxes,
        categoryId: editingEmployee.categoryId,
        active: editingEmployee.active
      });

      // Si el salario cambió, guardar en historial
      if (oldSalary !== newSalary) {
        try {
          await fetch(`/api/costos/empleados/${editingEmployee.id}/historial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              oldSalary: oldSalary,
              newSalary: newSalary,
              changeReason: 'Actualización individual de sueldo',
              companyId: currentCompany?.id || 1
            })
          });
        } catch (historyError) {
          console.error('Error guardando en historial:', historyError);
        }
      }

      setEditingEmployee(null);
      setShowEditEmployeeDialog(false);
      refreshData();
    } catch (error) {
      console.error('Error actualizando empleado:', error);
    }
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee({ ...employee });
    setShowEditEmployeeDialog(true);
  };

  const openEmployeeDetail = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeDetail(true);
  };

  const openEditCategoryDialog = (category: EmployeeCategory) => {
    // TODO: Implementar edición de categorías
  };

  const handleDeleteCategory = async (categoryId: number) => {
    const ok = await confirm({
      title: 'Eliminar categoría',
      description: '¿Estás seguro de que quieres eliminar esta categoría?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (ok) {
      try {
        // TODO: Implementar eliminación de categorías
        refreshData();
      } catch (error) {
        console.error('Error eliminando categoría:', error);
      }
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    const ok = await confirm({
      title: 'Eliminar empleado',
      description: '¿Estás seguro de que quieres eliminar este empleado? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (ok) {
      try {
        const response = await fetch(`/api/employees/delete?employeeId=${employeeId}&companyId=${currentCompany?.id || 1}`, {
          method: 'DELETE',
        });

      if (response.ok) {
          const result = await response.json();
          alert(result.message);
          refreshData(); // Recargar la lista de empleados
        } else {
          const error = await response.json();
          alert(`Error al eliminar empleado: ${error.error}`);
      }
    } catch (error) {
        console.error('Error eliminando empleado:', error);
        alert('Error al eliminar empleado. Verifica la conexión.');
      }
    }
  };

  if (loading || configLoading || vmLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando costos...</p>
          </div>
        </div>
      </div>
    );
  }

  // T2 GATE - redirigir si no está en modo Extendido (manejado por useEffect)
  if (viewMode !== 'E') return null;

  // ========================================
  // V2 MODE - Centro de Costos completo
  // ========================================
  if (isV2Mode) {
    return (
      <ExecutiveDashboardV2
        selectedMonth={selectedMonth}
        companyId={currentCompany?.id?.toString() || "1"}
        onMonthChange={setSelectedMonth}
      />
    );
  }

  // ========================================
  // V1 MODE - Vista tradicional con todos los tabs
  // ========================================
  return (
    <div className="w-full p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
        {/* Header con tabs */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Módulo de Costos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {currentCompany?.name || 'Empresa'} - {currentArea?.name || 'Área'}
              </p>
            </div>
            <CostVersionToggle companyId={currentCompany?.id?.toString() || "1"} />
          </div>
          <TabsList className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger value="dashboard" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="empleados" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Empleados
            </TabsTrigger>
            <TabsTrigger value="costos" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Costos Indirectos
            </TabsTrigger>
            <TabsTrigger value="compras" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Compras
            </TabsTrigger>
            <TabsTrigger value="distribucion" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Distribución
            </TabsTrigger>
            <TabsTrigger value="calculadora" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Calculadora
            </TabsTrigger>
            <TabsTrigger value="produccion" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Producción
            </TabsTrigger>
            <TabsTrigger value="ventas" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Ventas
            </TabsTrigger>
            <TabsTrigger value="productos" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Productos
            </TabsTrigger>
            <TabsTrigger value="insumos" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Insumos
            </TabsTrigger>
            <TabsTrigger value="recetas" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Recetas
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Pestaña de Dashboard */}
        <TabsContent value="dashboard" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <ExecutiveDashboard 
            selectedMonth={selectedMonth}
            companyId={currentCompany?.id?.toString() || "1"}
          />
        </TabsContent>

        {/* Pestaña de Empleados */}
        <TabsContent value="empleados" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <>
          {/* Header con selector de mes */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-foreground">Gestión de Empleados</h2>
              <p className="text-sm text-muted-foreground">
                Administra empleados y categorías - {(() => {
                  const [year, month] = selectedMonth.split('-');
                  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                  return date.toLocaleDateString('es-AR', { 
                    year: 'numeric', 
                    month: 'long' 
                  });
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="month-selector">Mes:</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40">
                  <SelectValue>
                    {(() => {
                      const [year, month] = selectedMonth.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                      return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const now = new Date();
                    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                    return (
                      <SelectItem key={monthValue} value={monthValue}>
                        {monthName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                onClick={() => setShowNotesDialog(true)}
                variant="outline"
                size="sm"
                className="text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Notas
              </Button>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Empleados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEmployees}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Categorías</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCategories}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Costos</CardTitle>
                <Calculator className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalCosts?.toLocaleString('es-AR') || '0'}</div>
              </CardContent>
            </Card>
          </div>

          {/* Sub-pestañas después de las estadísticas */}
          <Tabs defaultValue="gestion" className="w-full">
            <TabsList className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-auto flex flex-wrap gap-1">
              <TabsTrigger value="gestion" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Gestión</TabsTrigger>
              <TabsTrigger value="sueldos" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Sueldos Mensuales</TabsTrigger>
              <TabsTrigger value="cargar-planilla" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Cargar Planilla</TabsTrigger>
              <TabsTrigger value="historial" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Historial</TabsTrigger>
              <TabsTrigger value="estadisticas" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Estadísticas</TabsTrigger>
            </TabsList>

            {/* Sub-pestaña: Gestión de Empleados */}
            <TabsContent value="gestion" className="space-y-4 mt-4">
              {/* Gestión de Categorías */}
              <Card>
                <CardHeader>
      <div className="flex items-center justify-between">
        <div>
                      <CardTitle>Categorías de Empleados</CardTitle>
                      <CardDescription>
                        Gestiona las categorías y niveles jerárquicos
                      </CardDescription>
        </div>
                    <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Nueva Categoría
        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Crear Nueva Categoría</DialogTitle>
                          <DialogDescription>
                            Define una nueva categoría de empleados para organizar tu equipo
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Nombre *</Label>
                            <div className="col-span-3 space-y-2">
                              <Input
                                id="name"
                                value={newCategory.name}
                                onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                                placeholder="Ej: Operario, Supervisor, Técnico"
                                required
                              />
                              <p className="text-xs text-muted-foreground">
                                El nombre es obligatorio y debe ser único
                              </p>
      </div>
            </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">Descripción</Label>
                            <div className="col-span-3 space-y-2">
                              <Textarea
                                id="description"
                                value={newCategory.description}
                                onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                                placeholder="Descripción opcional de la categoría"
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground">
                                Agrega detalles sobre las responsabilidades o requisitos
                              </p>
              </div>
            </div>
                      </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleCreateCategory}>
                            Crear Categoría
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                        </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categories.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No hay categorías registradas. Crea la primera categoría para comenzar.
                      </p>
                    ) : (
                      <div className="grid gap-4">
                        {categories.map((category: EmployeeCategory) => (
                          <div key={category.id} className="group relative flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all duration-200">
                            <div>
                              <h4 className="font-semibold">{category.name}</h4>
                              {category.description && (
                                <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                              )}
                              <p className="text-sm text-muted-foreground mt-2">
                                Empleados: {category.employeeCount || 0}
                              </p>
                    </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openEditCategoryDialog(category)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Editar
                        </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteCategory(category.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Eliminar
                        </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
                </CardContent>
              </Card>

              {/* Gestión de Empleados */}
              <Card>
                <CardHeader>
      <div className="flex items-center justify-between">
        <div>
                      <CardTitle>Empleados</CardTitle>
                      <CardDescription>
                        Gestiona la información de los empleados y sus costos
                      </CardDescription>
        </div>
                    <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Nuevo Empleado
            </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Crear Nuevo Empleado</DialogTitle>
                          <DialogDescription>
                            Registra un nuevo empleado en el sistema
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="employeeName" className="text-right">Nombre *</Label>
                <Input
                              id="employeeName"
                              value={newEmployee.name}
                              onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                              className="col-span-3"
                              placeholder="Nombre completo"
                              required
                            />
              </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="employeeRole" className="text-right">Rol *</Label>
                <Input
                              id="employeeRole"
                              value={newEmployee.role}
                              onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
                              className="col-span-3"
                              placeholder="Cargo o función"
                              required
                            />
              </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="employeeCategory" className="text-right">Categoría</Label>
                            <Select 
                              value={newEmployee.categoryId} 
                              onValueChange={(value) => setNewEmployee({...newEmployee, categoryId: value})}
                            >
                              <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Seleccionar categoría" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category: EmployeeCategory) => (
                                  <SelectItem key={category.id} value={category.id.toString()}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
            </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="employeeStartDate" className="text-right">Fecha de Inicio *</Label>
                            <div className="col-span-3">
                              <DatePicker
                                value={newEmployee.startDate}
                                onChange={(date) => setNewEmployee({...newEmployee, startDate: date})}
                                placeholder="Seleccionar fecha"
                              />
                            </div>
                          </div>
                          <div className="col-span-4 text-sm text-muted-foreground">
                            <p>💡 <strong>Nota:</strong> Los sueldos se registrarán por separado en la pestaña &quot;Sueldos Mensuales&quot;</p>
            </div>
              </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleCreateEmployee}>
                            Crear Empleado
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
            </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    {employees.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No hay empleados registrados. Registra el primer empleado para comenzar.
                      </p>
                    ) : (
                      <div className="grid gap-4">
                        {employees.map((employee: Employee) => (
                          <div key={employee.id} className="group relative flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all duration-200">
                            <div>
                              <h4 className="font-semibold">{employee.name || 'Sin nombre'}</h4>
                              <p className="text-sm text-muted-foreground">{employee.role || 'Sin rol'}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                {employee.categoryName && <span>Categoría: {employee.categoryName}</span>}
                                <span className="text-info-muted-foreground">💡 Sueldos se registran mensualmente</span>
                              </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button
                                variant="outline" 
                                size="sm"
                                onClick={() => openEmployeeDetail(employee)}
                                className="text-info-muted-foreground hover:text-info-muted-foreground hover:bg-info-muted"
                              >
                                <User className="h-4 w-4 mr-1" />
                                Ver Detalle
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openEditDialog(employee)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Editar
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteEmployee(employee.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Eliminar
              </Button>
            </div>
                          </div>
                        ))}
          </div>
        )}
      </div>
                </CardContent>
              </Card>


            </TabsContent>

            {/* Sub-pestaña: Sueldos Mensuales */}
            <TabsContent value="sueldos" className="space-y-4 mt-4">
              <EmployeeSalaries selectedMonth={selectedMonth} />
            </TabsContent>

            {/* Sub-pestaña: Cargar Planilla */}
            <TabsContent value="cargar-planilla" className="space-y-4 mt-4">
              <UploadPayroll />
            </TabsContent>

            {/* Sub-pestaña: Historial */}
            <TabsContent value="historial" className="space-y-4 mt-4">
              <HistorialGlobal companyId={currentCompany?.id?.toString() || "1"} />
            </TabsContent>

            {/* Sub-pestaña: Estadísticas */}
            <TabsContent value="estadisticas" className="space-y-4 mt-4">
              <EstadisticasCostos companyId={currentCompany?.id?.toString() || "1"} />
            </TabsContent>
          </Tabs>
          </>
        </TabsContent>

        {/* Modal de Edición de Empleado */}
        <Dialog open={showEditEmployeeDialog} onOpenChange={setShowEditEmployeeDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Empleado</DialogTitle>
              <DialogDescription>
                Modifica la información del empleado. Los cambios de salario se registrarán automáticamente en el historial.
              </DialogDescription>
            </DialogHeader>
            {editingEmployee && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editName" className="text-right">Nombre</Label>
                  <Input
                    id="editName"
                    value={editingEmployee.name}
                    onChange={(e) => setEditingEmployee({...editingEmployee, name: e.target.value})}
                    className="col-span-3"
                    placeholder="Nombre completo"
                  />
        </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editRole" className="text-right">Rol</Label>
                  <Input
                    id="editRole"
                    value={editingEmployee.role}
                    onChange={(e) => setEditingEmployee({...editingEmployee, role: e.target.value})}
                    className="col-span-3"
                    placeholder="Cargo o función"
                  />
        </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editGrossSalary" className="text-right">Salario Bruto</Label>
                  <Input
                    id="editGrossSalary"
                    type="number"
                    value={editingEmployee.grossSalary}
                    onChange={(e) => setEditingEmployee({...editingEmployee, grossSalary: parseFloat(e.target.value) || 0})}
                    className="col-span-3"
                    placeholder="0.00"
                    step="0.01"
                  />
      </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editPayrollTaxes" className="text-right">Impuestos</Label>
          <Input
                    id="editPayrollTaxes"
                    type="number"
                    value={editingEmployee.payrollTaxes}
                    onChange={(e) => setEditingEmployee({...editingEmployee, payrollTaxes: parseFloat(e.target.value) || 0})}
                    className="col-span-3"
                    placeholder="0.00"
                    step="0.01"
          />
        </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editCategoryId" className="text-right">Categoría</Label>
                  <Select 
                    value={editingEmployee.categoryId?.toString() || ''} 
                    onValueChange={(value) => setEditingEmployee({...editingEmployee, categoryId: value ? parseInt(value) : undefined})}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category: EmployeeCategory) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
            </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editActive" className="text-right">Estado</Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <input
                      id="editActive"
                      type="checkbox"
                      checked={editingEmployee.active}
                      onChange={(e) => setEditingEmployee({...editingEmployee, active: e.target.checked})}
                      className="rounded border-border"
                    />
                    <Label htmlFor="editActive" className="text-sm">Empleado activo</Label>
              </div>
          </div>
        </div>
      )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditEmployeeDialog(false)}>
                Cancelar
            </Button>
              <Button 
                onClick={handleEditEmployee}
                disabled={!editingEmployee?.name?.trim() || !editingEmployee?.role?.trim()}
              >
                Guardar Cambios
            </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>





        {/* Pestaña de Costos Indirectos */}
        <TabsContent value="costos" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <CostosIndirectosNew companyId={currentCompany?.id?.toString() || "1"} />
        </TabsContent>

        {/* Pestaña de Compras */}
        <TabsContent value="compras" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          {/* Tipo de Cambio USD */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Tipo de Cambio USD (Reposición)
              </CardTitle>
              <CardDescription className="text-xs">
                Valor del dólar para calcular el costo de reposición de insumos comprados en USD
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="space-y-1.5 flex-1 max-w-[200px]">
                  <Label htmlFor="tipoCambioUSD" className="text-xs">ARS por 1 USD</Label>
                  <Input
                    id="tipoCambioUSD"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={tipoCambioLoading ? 'Cargando...' : 'Ej: 1300'}
                    value={tipoCambioUSD}
                    onChange={(e) => setTipoCambioUSD(e.target.value)}
                    disabled={tipoCambioLoading}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveExchangeRate}
                  disabled={tipoCambioSaving || tipoCambioLoading || !tipoCambioUSD}
                  className="gap-1.5"
                >
                  {tipoCambioSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
                  Guardar
                </Button>
              </div>
              {tipoCambioUpdatedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Última actualización: {new Date(tipoCambioUpdatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </CardContent>
          </Card>

          <ComprasMensuales
            companyId={currentCompany?.id?.toString() || "1"}
            selectedMonth={selectedMonth}
          />
        </TabsContent>

        {/* Pestaña de Distribución */}
        <TabsContent value="distribucion" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <DistribucionCostos />
          </TabsContent>

        {/* Pestaña de Calculadora */}
        <TabsContent value="calculadora" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <CalculadoraCostosEmbedded />
        </TabsContent>


        {/* Pestaña de Producción */}
        <TabsContent value="produccion" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <ProduccionMensual />
        </TabsContent>

        {/* Pestaña de Ventas */}
        <TabsContent value="ventas" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <VentasMensuales />
        </TabsContent>

        {/* Pestaña de Productos */}
        <TabsContent value="productos" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <Productos />
          </TabsContent>

        <TabsContent value="insumos" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <Insumos />
          </TabsContent>

        {/* Pestaña de Recetas */}
        <TabsContent value="recetas" className="space-y-4 px-4 md:px-6 pb-6 mt-0">
          <RecetasV2 />
          </TabsContent>

        </Tabs>

      {/* Modal de Detalle del Empleado */}
      {selectedEmployee && (
        <EmployeeDetail
          employee={selectedEmployee}
          isOpen={showEmployeeDetail}
          onClose={() => {
            setShowEmployeeDetail(false);
            setSelectedEmployee(null);
          }}
          companyId={currentCompany?.id?.toString() || "1"}
        />
      )}

      {/* Dialog: Notas de Empleados */}
      <NotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        moduleName="Empleados"
        storageKey="empleados_notes"
      />
    </div>
  );
} 
