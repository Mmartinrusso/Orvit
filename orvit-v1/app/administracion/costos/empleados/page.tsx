"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2, Plus, Edit, Trash2, BookOpen } from "lucide-react";
import { NotesDialog } from "@/components/ui/NotesDialog";
import { useEmployeeCosts } from "@/hooks/use-employee-costs";
import type { EmployeeCategory, Employee } from "@/hooks/use-employee-costs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function EmpleadosPage() {
  const { 
    categories, 
    employees, 
    loading, 
    error, 
    stats, 
    createCategory, 
    createEmployee,
    refreshData 
  } = useEmployeeCosts();

  const [activeTab, setActiveTab] = useState("categorias");
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EmployeeCategory | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: ''
  });
  
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    role: '',
    grossSalary: '',
    payrollTaxes: '',
    categoryId: '',
    startDate: new Date().toISOString().split('T')[0] // Fecha actual en formato YYYY-MM-DD
  });

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
        grossSalary: parseFloat(newEmployee.grossSalary),
        payrollTaxes: newEmployee.payrollTaxes ? parseFloat(newEmployee.payrollTaxes) : 0,
        categoryId: newEmployee.categoryId ? parseInt(newEmployee.categoryId) : undefined,
        startDate: newEmployee.startDate || new Date().toISOString().split('T')[0]
      });
      setNewEmployee({ name: '', role: '', grossSalary: '', payrollTaxes: '', categoryId: '', startDate: new Date().toISOString().split('T')[0] });
      setShowEmployeeDialog(false);
      refreshData();
    } catch (error) {
      console.error('Error creando empleado:', error);
    }
  };

  const resetForms = () => {
    setNewCategory({ name: '', description: '' });
    setNewEmployee({ name: '', role: '', grossSalary: '', payrollTaxes: '', categoryId: '', startDate: new Date().toISOString().split('T')[0] });
    setEditingCategory(null);
    setEditingEmployee(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando empleados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Empleados</h1>
          <p className="text-muted-foreground">
            Administra categorías y empleados del sistema
          </p>
        </div>
        <Button 
          onClick={() => setShowNotesDialog(true)} 
          variant="outline" 
          className="text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Notas
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
        </TabsList>

        {/* Pestaña de Categorías */}
        <TabsContent value="categorias" className="space-y-6">
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
                    <Button onClick={resetForms}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nueva Categoría
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                                         <DialogHeader>
                       <DialogTitle>
                         {editingCategory ? 'Editar Categoría' : 'Crear Nueva Categoría'}
                       </DialogTitle>
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
                       <Button 
                         onClick={handleCreateCategory}
                         disabled={!newCategory.name.trim()}
                       >
                         {editingCategory ? 'Actualizar' : 'Crear'} Categoría
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
                    No hay categorías creadas. Crea la primera categoría para comenzar.
                  </p>
                ) : (
                  <div className="grid gap-4">
                    {categories.map((category: EmployeeCategory) => (
                      <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-semibold">{category.name}</h4>
                          <p className="text-sm text-muted-foreground">{category.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span>Empleados: {category.employeeCount}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingCategory(category);
                              setNewCategory({
                                name: category.name,
                                description: category.description || ''
                              });
                              setShowCategoryDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará la categoría &quot;{category.name}&quot;.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Empleados */}
        <TabsContent value="empleados" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Empleados</CardTitle>
                  <CardDescription>
                    Gestiona los empleados y sus costos laborales
                  </CardDescription>
                </div>
                <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={resetForms}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo Empleado
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingEmployee ? 'Editar Empleado' : 'Crear Nuevo Empleado'}
                      </DialogTitle>
                      <DialogDescription>
                        Registra un nuevo empleado con su información salarial
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="empName" className="text-right">Nombre</Label>
                        <Input
                          id="empName"
                          value={newEmployee.name}
                          onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                          className="col-span-3"
                          placeholder="Nombre completo"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">Rol</Label>
                        <Input
                          id="role"
                          value={newEmployee.role}
                          onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
                          className="col-span-3"
                          placeholder="Cargo o función"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="grossSalary" className="text-right">Salario Bruto</Label>
                        <Input
                          id="grossSalary"
                          type="number"
                          value={newEmployee.grossSalary}
                          onChange={(e) => setNewEmployee({...newEmployee, grossSalary: e.target.value})}
                          className="col-span-3"
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="payrollTaxes" className="text-right">Impuestos</Label>
                        <Input
                          id="payrollTaxes"
                          type="number"
                          value={newEmployee.payrollTaxes}
                          onChange={(e) => setNewEmployee({...newEmployee, payrollTaxes: e.target.value})}
                          className="col-span-3"
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="categoryId" className="text-right">Categoría</Label>
                        <Select value={newEmployee.categoryId} onValueChange={(value) => setNewEmployee({...newEmployee, categoryId: value})}>
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
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreateEmployee}>
                        {editingEmployee ? 'Actualizar' : 'Crear'} Empleado
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
                      <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-semibold">{employee.name}</h4>
                          <p className="text-sm text-muted-foreground">{employee.role}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span>Salario: ${employee.grossSalary.toLocaleString()}</span>
                            <span>Impuestos: ${employee.payrollTaxes.toLocaleString()}</span>
                            <span>Total: ${employee.totalCost.toLocaleString()}</span>
                            {employee.categoryName && <span>Categoría: {employee.categoryName}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingEmployee(employee);
                              setNewEmployee({
                                name: employee.name,
                                role: employee.role,
                                grossSalary: employee.grossSalary.toString(),
                                payrollTaxes: employee.payrollTaxes.toString(),
                                categoryId: employee.categoryId?.toString() || '',
                                startDate: employee.startDate || new Date().toISOString().split('T')[0]
                              });
                              setShowEmployeeDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará el empleado &quot;{employee.name}&quot;.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Notas */}
      <NotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        moduleName="Empleados"
        storageKey="empleados_gestion_notes"
      />
    </div>
  );
}
