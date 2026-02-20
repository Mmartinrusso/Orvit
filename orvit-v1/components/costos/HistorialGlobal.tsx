'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Clock, TrendingUp, TrendingDown, Filter, Plus, Calendar, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGlobalHistorial } from '@/hooks/use-global-historial';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface HistorialGlobalProps {
  companyId: string;
}

export function HistorialGlobal({ companyId }: HistorialGlobalProps) {
  const {
    historial,
    loading,
    error,
    selectedEmployee,
    filterByEmployee,
    getUniqueEmployees,
    getStats,
    refreshHistorial,
  } = useGlobalHistorial({ companyId });

  // Empleados reales para el modal
  const { data: employees = [] } = useQuery({
    queryKey: ['costos-empleados', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/costos/empleados?companyId=${companyId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.map((emp: any) => ({
        id: emp.id,
        name: emp.name || 'Sin nombre',
        role: emp.role || 'Sin rol',
      }));
    },
    staleTime: 3 * 60 * 1000,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    employeeId: '',
    oldSalary: 0,
    newSalary: 0,
    changeReason: ''
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculatePercentage = (oldSalary: number, newSalary: number) => {
    const change = ((newSalary - oldSalary) / oldSalary) * 100;
    return change.toFixed(1);
  };

  const handleAddEntry = async () => {
    if (!newEntry.employeeId || newEntry.newSalary === newEntry.oldSalary) {
      toast.warning('Selecciona un empleado y asegúrate de que el nuevo salario sea diferente al anterior');
      return;
    }

    try {
      const success = await addHistorialEntry(newEntry);
      if (success) {
        setNewEntry({
          employeeId: '',
          oldSalary: 0,
          newSalary: 0,
          changeReason: ''
        });
        setShowAddModal(false);
      }
    } catch (error) {
      console.error('Error agregando entrada:', error);
    }
  };

  const stats = getStats();
  const uniqueEmployees = getUniqueEmployees();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-destructive">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Historial de Sueldos
          </h2>
          <p className="text-muted-foreground mt-1">
            {selectedEmployee === 'all' 
              ? 'Registro de todos los cambios salariales de la empresa'
              : `Registro de cambios salariales para ${uniqueEmployees.find(emp => emp.id === selectedEmployee)?.name || 'empleado seleccionado'}`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshHistorial} variant="outline">
            <Clock className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-black hover:bg-foreground/90">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Cambio
          </Button>
        </div>
      </div>

      {/* Filtros y Estadísticas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filtro por empleado */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtrar por Empleado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedEmployee} onValueChange={filterByEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar empleado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">👥 Todos los empleados</SelectItem>
                {uniqueEmployees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    👤 {employee.name} - {employee.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEmployee !== 'all' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => filterByEmployee('all')}
                className="w-full mt-2"
              >
                Ver todos
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Estadísticas */}
        {stats && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  Aumentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {formatCurrency(stats.totalIncrease)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Promedio: {formatCurrency(stats.averageIncrease)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Disminuciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(stats.totalDecrease)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Promedio: {formatCurrency(stats.averageDecrease)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Lista del historial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Cambios Salariales ({historial.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p>No hay cambios salariales registrados</p>
              {selectedEmployee !== 'all' && (
                <p className="text-sm">Intenta cambiar el filtro o agregar un cambio</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {historial.map((entry) => {
                const isIncrease = entry.newSalary > entry.oldSalary;
                const percentage = calculatePercentage(entry.oldSalary, entry.newSalary);
                
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 p-4 bg-muted rounded-lg hover:bg-accent transition-colors"
                  >
                    {/* Icono */}
                    <div className={cn('p-3 rounded-full',
                      isIncrease ? 'bg-success-muted text-success' : 'bg-destructive/10 text-destructive'
                    )}>
                      {isIncrease ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                    </div>

                    {/* Información del cambio */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="text-lg font-semibold">
                          {formatCurrency(entry.oldSalary)} → {formatCurrency(entry.newSalary)}
                        </div>
                        <Badge variant={isIncrease ? 'default' : 'destructive'}>
                          {isIncrease ? '+' : ''}{percentage}%
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.employeeName}</span>
                          <span className="text-muted-foreground">•</span>
                          <span>{entry.employeeRole}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(entry.changeDate)}
                          </div>
                          {entry.changeReason && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {entry.changeReason}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para agregar cambio */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Agregar Cambio Salarial</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Empleado *
                </label>
                                 <Select value={newEntry.employeeId} onValueChange={(value) => setNewEntry({...newEntry, employeeId: value})}>
                   <SelectTrigger>
                     <SelectValue placeholder="Seleccionar empleado" />
                   </SelectTrigger>
                   <SelectContent>
                     {employees.length > 0 ? employees.map((employee) => (
                       <SelectItem key={employee.id} value={employee.id}>
                         {employee.name} - {employee.role}
                       </SelectItem>
                     )) : (
                       <SelectItem value="" disabled>
                         Cargando empleados...
                       </SelectItem>
                     )}
                   </SelectContent>
                 </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Salario Anterior *
                </label>
                <Input
                  type="number"
                  value={newEntry.oldSalary}
                  onChange={(e) => setNewEntry({...newEntry, oldSalary: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                  step="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Nuevo Salario *
                </label>
                <Input
                  type="number"
                  value={newEntry.newSalary}
                  onChange={(e) => setNewEntry({...newEntry, newSalary: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                  step="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Motivo del Cambio
                </label>
                <Input
                  value={newEntry.changeReason}
                  onChange={(e) => setNewEntry({...newEntry, changeReason: e.target.value})}
                  placeholder="Ej: Aumento por desempeño, Promoción, etc."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddEntry}>
                Agregar Cambio
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
