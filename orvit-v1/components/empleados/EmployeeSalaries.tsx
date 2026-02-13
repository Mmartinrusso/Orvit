'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmployeeSalaries, EmployeeSalary, EmployeeSalaryForm } from '@/hooks/use-employee-salaries';
import { useEmployeeCosts } from '@/hooks/use-employee-costs';
import { Plus, Edit, Trash2, Eye, Users, DollarSign, Calendar, TrendingUp, Building2, Activity, BookOpen } from 'lucide-react';
import { NotesDialog } from '@/components/ui/NotesDialog';

interface EmployeeSalariesProps {
  selectedMonth: string;
}

export default function EmployeeSalaries({ selectedMonth }: EmployeeSalariesProps) {

  const {
    salaries,
    loading,
    error,
    registerSalary,
    updateSalary,
    deleteSalary,
    refreshData,
  } = useEmployeeSalaries(selectedMonth);

  const { employees } = useEmployeeCosts(selectedMonth);

  // Estados para formularios
  const [showSalaryDialog, setShowSalaryDialog] = useState(false);
  const [editingSalary, setEditingSalary] = useState<EmployeeSalary | null>(null);
  const [salaryForm, setSalaryForm] = useState<EmployeeSalaryForm>({
    employeeId: '',
    fecha_imputacion: new Date().toISOString().slice(0, 7),
    grossSalary: '',
    payrollTaxes: '',
    notes: ''
  });

  // Estados para filtros
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  
  // Estado para notas
  const [showNotesDialog, setShowNotesDialog] = useState(false);

  // Función para crear/actualizar sueldo
  const handleSubmitSalary = async () => {
    if (!salaryForm.employeeId || !salaryForm.grossSalary) {
      alert('Empleado y salario bruto son requeridos');
      return;
    }

    try {
      const salaryData = {
        ...salaryForm,
        fecha_imputacion: selectedMonth // Usar el mes seleccionado
      };

      if (editingSalary) {
        await updateSalary(editingSalary.id, salaryData);
      } else {
        await registerSalary(salaryData);
      }
      
      setSalaryForm({
        employeeId: '',
        fecha_imputacion: selectedMonth,
        grossSalary: '',
        payrollTaxes: '',
        notes: ''
      });
      setEditingSalary(null);
      setShowSalaryDialog(false);
    } catch (error) {
      alert(`Error al ${editingSalary ? 'actualizar' : 'registrar'} sueldo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para editar sueldo
  const handleEditSalary = (salary: EmployeeSalary) => {
    setEditingSalary(salary);
    setSalaryForm({
      employeeId: salary.employeeId,
      fecha_imputacion: salary.fecha_imputacion,
      grossSalary: salary.grossSalary.toString(),
      payrollTaxes: salary.payrollTaxes.toString(),
      notes: salary.notes || ''
    });
    setShowSalaryDialog(true);
  };

  // Función para eliminar sueldo
  const handleDeleteSalary = async (salaryId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este sueldo?')) return;

    try {
      await deleteSalary(salaryId);
    } catch (error) {
      alert(`Error al eliminar sueldo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para cerrar diálogos
  const closeDialogs = () => {
    setShowSalaryDialog(false);
    setEditingSalary(null);
    setSalaryForm({
      employeeId: '',
      fecha_imputacion: new Date().toISOString().slice(0, 7),
      grossSalary: '',
      payrollTaxes: '',
      notes: ''
    });
  };

  // Filtrar sueldos por empleado
  const filteredSalaries = selectedEmployee === 'all' 
    ? salaries 
    : salaries.filter(salary => salary.employeeId === selectedEmployee);

  // Estadísticas basadas en los sueldos del mes seleccionado
  const totalSalaries = salaries.length;
  const totalCost = salaries.reduce((sum, salary) => sum + salary.totalCost, 0);
  const averageSalary = salaries.length > 0 ? totalCost / salaries.length : 0;
  const uniqueEmployees = new Set(salaries.map(salary => salary.employeeId)).size;

  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Función para formatear fecha
  const formatDate = (dateString: string) => {
    try {
      if (dateString.includes('-')) {
        const [year, month] = dateString.split('-');
        if (year && month) {
          const monthNum = parseInt(month);
          const yearNum = parseInt(year);
          const date = new Date(yearNum, monthNum - 1, 1);
          return date.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long'
          });
        }
      }
      return 'Fecha inválida';
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando sueldos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sueldos Mensuales</h1>
          <p className="text-muted-foreground">
            Gestiona los sueldos mensuales de los empleados - {formatDate(selectedMonth)}
          </p>
        </div>
        <Button onClick={() => setShowSalaryDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Registrar Sueldo
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sueldos</p>
                <p className="text-2xl font-bold">{totalSalaries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Costo Total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Promedio</p>
                <p className="text-2xl font-bold">{formatCurrency(averageSalary)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Empleados</p>
                <p className="text-2xl font-bold">{uniqueEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Filtrar por empleado:</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los empleados</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} - {employee.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Sueldos */}
      <Card>
        <CardHeader>
          <CardTitle>Sueldos Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSalaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay sueldos registrados. Registra el primer sueldo para comenzar.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSalaries.map((salary) => (
                <div key={salary.id} className="flex items-center justify-between p-4 border rounded-lg group">
                  <div>
                    <h4 className="font-medium">{salary.employeeName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {salary.employeeRole} • {salary.categoryName || 'Sin categoría'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(salary.fecha_imputacion)} • {salary.notes || 'Sin notas'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(salary.totalCost)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bruto: {formatCurrency(salary.grossSalary)} | Impuestos: {formatCurrency(salary.payrollTaxes)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditSalary(salary)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSalary(salary.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Registrar Sueldo */}
      <Dialog open={showSalaryDialog} onOpenChange={setShowSalaryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSalary ? 'Editar Sueldo' : 'Registrar Sueldo Mensual'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Empleado *</label>
              <Select 
                value={salaryForm.employeeId} 
                onValueChange={(value) => setSalaryForm({ ...salaryForm, employeeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.active).map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Mes seleccionado:</strong> {selectedMonth}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Salario Bruto *</label>
              <Input
                type="number"
                value={salaryForm.grossSalary}
                onChange={(e) => setSalaryForm({ ...salaryForm, grossSalary: e.target.value })}
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Impuestos</label>
              <Input
                type="number"
                value={salaryForm.payrollTaxes}
                onChange={(e) => setSalaryForm({ ...salaryForm, payrollTaxes: e.target.value })}
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Notas</label>
              <Textarea
                value={salaryForm.notes}
                onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })}
                placeholder="Notas adicionales sobre el sueldo"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmitSalary} className="flex-1">
                {editingSalary ? 'Actualizar Sueldo' : 'Registrar Sueldo'}
              </Button>
              <Button variant="outline" onClick={closeDialogs}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Notas */}
      <NotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        moduleName="Empleados"
        storageKey="empleados_notes"
      />
    </div>
  );
}
