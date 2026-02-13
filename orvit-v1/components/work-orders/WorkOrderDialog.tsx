'use client';

import { useState, useEffect } from 'react';
import { WorkOrder, WorkOrderStatus, Priority, MaintenanceType, Machine } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Edit, Calendar, User, Wrench, MessageSquare, Settings } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import WorkOrderComments from './WorkOrderComments';
import { useMachinesInitial } from '@/hooks/use-machines-initial';

interface WorkOrderDialogProps {
  workOrder?: WorkOrder;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave: (workOrder: Partial<WorkOrder>) => Promise<void>;
  trigger?: React.ReactNode;
}

export default function WorkOrderDialog({ 
  workOrder, 
  isOpen, 
  onOpenChange, 
  onSave, 
  trigger 
}: WorkOrderDialogProps) {
  const { currentCompany, currentSector } = useCompany();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<Partial<WorkOrder>>({
    title: '',
    description: '',
    priority: Priority.MEDIUM,
    type: MaintenanceType.CORRECTIVE,
    scheduledDate: undefined,
    estimatedHours: undefined,
    cost: undefined,
    notes: '',
  });
  
  // ✨ OPTIMIZADO: Usar hook con React Query para máquinas
  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const { data: machinesData } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: dialogOpen && !!companyIdNum }
  );
  const machines = (machinesData?.machines || []) as Machine[];
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Control del estado del diálogo
  const dialogOpen = isOpen !== undefined ? isOpen : open;
  const setDialogOpen = onOpenChange || setOpen;

  useEffect(() => {
    if (workOrder) {
      setFormData({
        ...workOrder,
        scheduledDate: workOrder.scheduledDate ? new Date(workOrder.scheduledDate) : undefined,
      });
    } else {
      // Reset form for new work order
      setFormData({
        title: '',
        description: '',
        priority: Priority.MEDIUM,
        type: MaintenanceType.CORRECTIVE,
        scheduledDate: undefined,
        estimatedHours: undefined,
        cost: undefined,
        notes: '',
        companyId: currentCompany?.id ? Number(currentCompany.id) : undefined,
        sectorId: currentSector?.id ? Number(currentSector.id) : undefined,
        createdById: user?.id ? Number(user.id) : undefined,
      });
    }
  }, [workOrder, currentCompany, currentSector, user]);

  // ✨ OPTIMIZADO: Máquinas vienen del hook, solo cargar usuarios
  useEffect(() => {
    if (dialogOpen && currentCompany) {
      fetchUsers();
    }
  }, [dialogOpen, currentCompany]);

  const fetchUsers = async () => {
    try {
      // Por ahora usamos datos mock, después se puede conectar a una API real
      setUsers([
        { id: 1, name: 'Juan Pérez', email: 'juan@empresa.com' },
        { id: 2, name: 'María García', email: 'maria@empresa.com' },
        { id: 3, name: 'Carlos López', email: 'carlos@empresa.com' },
      ]);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleInputChange = (field: keyof WorkOrder, value: any) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };

      // Auto-completar fechas según el estado
      if (field === 'status') {
        if (value === WorkOrderStatus.IN_PROGRESS && !newData.startedDate) {
          newData.startedDate = new Date();
        }
        if (value === WorkOrderStatus.COMPLETED && !newData.completedDate) {
          newData.completedDate = new Date();
        }
      }

      return newData;
    });
  };

  const validateForm = () => {
    const errors: string[] = [];

    if (!formData.title?.trim()) {
      errors.push('El título es requerido');
    }
    if (!formData.type) {
      errors.push('El tipo de mantenimiento es requerido');
    }
    if (!formData.priority) {
      errors.push('La prioridad es requerida');
    }
    if (!formData.createdById && !workOrder) {
      errors.push('El creador es requerido');
    }
    if (!formData.companyId && !workOrder) {
      errors.push('La empresa es requerida');
    }

    // Validaciones de fechas
    if (formData.startedDate && formData.scheduledDate && formData.startedDate < formData.scheduledDate) {
      errors.push('La fecha de inicio no puede ser anterior a la fecha programada');
    }
    if (formData.completedDate && formData.startedDate && formData.completedDate < formData.startedDate) {
      errors.push('La fecha de finalización no puede ser anterior a la fecha de inicio');
    }

    // Validaciones de horas
    if (formData.actualHours && formData.estimatedHours && formData.actualHours > formData.estimatedHours * 2) {
      // Advertencia si las horas reales superan el doble de las estimadas
      console.warn('Las horas reales superan significativamente las estimadas');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      alert('Errores de validación:\n' + validationErrors.join('\n'));
      return;
    }

    setLoading(true);

    try {
      await onSave(formData);
      setDialogOpen(false);
      
      // Reset form if creating new
      if (!workOrder) {
        setFormData({
          title: '',
          description: '',
          priority: Priority.MEDIUM,
          type: MaintenanceType.CORRECTIVE,
          scheduledDate: undefined,
          estimatedHours: undefined,
          cost: undefined,
          notes: '',
          companyId: currentCompany?.id ? Number(currentCompany.id) : undefined,
          sectorId: currentSector?.id ? Number(currentSector.id) : undefined,
          createdById: user?.id ? Number(user.id) : undefined,
        });
      }
    } catch (error) {
      console.error('Error saving work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      
      <DialogContent size="sm" className="max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {workOrder ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {workOrder ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}
          </DialogTitle>
          <DialogDescription>
            {workOrder 
              ? 'Modifica los detalles de la orden de trabajo.' 
              : 'Crea una nueva orden de trabajo para programar mantenimiento.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="form" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">Formulario</TabsTrigger>
            {workOrder && (
              <TabsTrigger value="comments">Comentarios</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="form">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Ej: Mantenimiento preventivo bomba principal"
                  required
                />
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe los detalles del mantenimiento..."
                  rows={3}
                />
              </div>

              {/* Fila 1: Tipo, Prioridad y Estado (solo para edición) */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Mantenimiento *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => handleInputChange('type', value as MaintenanceType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MaintenanceType.PREVENTIVE}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          Preventivo
                        </div>
                      </SelectItem>
                      <SelectItem value={MaintenanceType.CORRECTIVE}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          Correctivo
                        </div>
                      </SelectItem>
                      <SelectItem value={MaintenanceType.PREDICTIVE}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          Predictivo
                        </div>
                      </SelectItem>
                      <SelectItem value={MaintenanceType.EMERGENCY}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          Emergencia
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad *</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => handleInputChange('priority', value as Priority)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={Priority.LOW}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          Baja
                        </div>
                      </SelectItem>
                      <SelectItem value={Priority.MEDIUM}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          Media
                        </div>
                      </SelectItem>
                      <SelectItem value={Priority.HIGH}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          Alta
                        </div>
                      </SelectItem>
                      <SelectItem value={Priority.URGENT}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          Urgente
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Estado - solo para órdenes existentes */}
                {workOrder && (
                  <div className="space-y-2">
                    <Label htmlFor="status">Estado</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => handleInputChange('status', value as WorkOrderStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={WorkOrderStatus.PENDING}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            Pendiente
                          </div>
                        </SelectItem>
                        <SelectItem value={WorkOrderStatus.IN_PROGRESS}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            En Proceso
                          </div>
                        </SelectItem>
                        <SelectItem value={WorkOrderStatus.ON_HOLD}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                            En Espera
                          </div>
                        </SelectItem>
                        <SelectItem value={WorkOrderStatus.COMPLETED}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Completada
                          </div>
                        </SelectItem>
                        <SelectItem value={WorkOrderStatus.CANCELLED}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            Cancelada
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Fila 2: Máquina y Asignado a */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="machine">Máquina</Label>
                  <Select
                    value={formData.machineId?.toString() || 'none'}
                    onValueChange={(value) => handleInputChange('machineId', value === 'none' ? null : Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar máquina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      {machines.map((machine) => (
                        <SelectItem key={machine.id} value={machine.id.toString()}>
                          {machine.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Asignado a</Label>
                  <Select
                    value={formData.assignedToId?.toString() || 'unassigned'}
                    onValueChange={(value) => handleInputChange('assignedToId', value === 'unassigned' ? null : Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sin asignar</SelectItem>
                      {Array.isArray(users) && users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fila 3: Fechas */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700 border-b pb-2">Fechas</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">Fecha Programada</Label>
                    <DatePicker
                      value={formatDateForInput(formData.scheduledDate)}
                      onChange={(date) => handleInputChange('scheduledDate', date ? new Date(date) : null)}
                      placeholder="Seleccionar fecha"
                      clearable
                    />
                  </div>

                  {/* Fecha de inicio - solo para órdenes existentes o en proceso */}
                  {(workOrder || formData.status === WorkOrderStatus.IN_PROGRESS) && (
                    <div className="space-y-2">
                      <Label htmlFor="startedDate">Fecha de Inicio</Label>
                      <DatePicker
                        value={formatDateForInput(formData.startedDate)}
                        onChange={(date) => handleInputChange('startedDate', date ? new Date(date) : null)}
                        placeholder="Seleccionar fecha"
                        clearable
                      />
                    </div>
                  )}

                  {/* Fecha de finalización - solo para órdenes completadas */}
                  {(workOrder && formData.status === WorkOrderStatus.COMPLETED) && (
                    <div className="space-y-2">
                      <Label htmlFor="completedDate">Fecha de Finalización</Label>
                      <DatePicker
                        value={formatDateForInput(formData.completedDate)}
                        onChange={(date) => handleInputChange('completedDate', date ? new Date(date) : null)}
                        placeholder="Seleccionar fecha"
                        clearable
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Fila 4: Horas y Costo */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700 border-b pb-2">Tiempo y Costo</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimatedHours">Horas Estimadas</Label>
                    <Input
                      id="estimatedHours"
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.estimatedHours || ''}
                      onChange={(e) => handleInputChange('estimatedHours', e.target.value ? Number(e.target.value) : null)}
                      placeholder="Ej: 2.5"
                    />
                  </div>

                  {/* Horas reales - solo para órdenes en proceso o completadas */}
                  {workOrder && (formData.status === WorkOrderStatus.IN_PROGRESS || formData.status === WorkOrderStatus.COMPLETED) && (
                    <div className="space-y-2">
                      <Label htmlFor="actualHours">Horas Reales</Label>
                      <Input
                        id="actualHours"
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.actualHours || ''}
                        onChange={(e) => handleInputChange('actualHours', e.target.value ? Number(e.target.value) : null)}
                        placeholder="Ej: 3.0"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="cost">Costo Estimado (€)</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost || ''}
                      onChange={(e) => handleInputChange('cost', e.target.value ? Number(e.target.value) : null)}
                      placeholder="Ej: 150.00"
                    />
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notas Adicionales</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Notas, instrucciones especiales, materiales necesarios..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Guardando...' : (workOrder ? 'Actualizar' : 'Crear Orden')}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
          {workOrder && (
            <TabsContent value="comments">
              <WorkOrderComments workOrderId={workOrder.id} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 