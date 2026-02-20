'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import { WorkOrder, WorkOrderStatus, Priority, MaintenanceType, Machine } from '@/lib/types';

interface WorkOrderFormSectionsProps {
  formData: Partial<WorkOrder>;
  onFieldChange: (field: keyof WorkOrder, value: any) => void;
  machines: Machine[];
  users: Array<{ id: number; name: string }>;
  components?: Array<{ id: number; name: string }>;
}

export function WorkOrderFormSections({
  formData,
  onFieldChange,
  machines,
  users,
  components = [],
}: WorkOrderFormSectionsProps) {
  const formatDateForInput = (date: Date | undefined | string) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
  };

  const handleDateChange = (field: keyof WorkOrder, value: string) => {
    onFieldChange(field, value ? new Date(value + 'T00:00:00') : null);
  };

  return (
    <div className="space-y-6">
      {/* Datos básicos */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Datos básicos</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-xs text-muted-foreground">
                Título *
              </Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => onFieldChange('title', e.target.value)}
                placeholder="Ej: Mantenimiento preventivo bomba principal"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs text-muted-foreground">
                Descripción
              </Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => onFieldChange('description', e.target.value)}
                placeholder="Describe los detalles del mantenimiento..."
                rows={3}
                className="resize-none text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type" className="text-xs text-muted-foreground">
                  Tipo de Mantenimiento *
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => onFieldChange('type', value as MaintenanceType)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MaintenanceType.PREVENTIVE}>Preventivo</SelectItem>
                    <SelectItem value={MaintenanceType.CORRECTIVE}>Correctivo</SelectItem>
                    <SelectItem value={MaintenanceType.PREDICTIVE}>Predictivo</SelectItem>
                    <SelectItem value={MaintenanceType.EMERGENCY}>Emergencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority" className="text-xs text-muted-foreground">
                  Prioridad *
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => onFieldChange('priority', value as Priority)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Seleccionar prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Priority.LOW}>Baja</SelectItem>
                    <SelectItem value={Priority.MEDIUM}>Media</SelectItem>
                    <SelectItem value={Priority.HIGH}>Alta</SelectItem>
                    <SelectItem value={Priority.CRITICAL}>Crítica</SelectItem>
                    <SelectItem value={Priority.URGENT}>Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.id && (
              <div className="space-y-2">
                <Label htmlFor="status" className="text-xs text-muted-foreground">
                  Estado
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => onFieldChange('status', value as WorkOrderStatus)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WorkOrderStatus.PENDING}>Pendiente</SelectItem>
                    <SelectItem value={WorkOrderStatus.IN_PROGRESS}>En Proceso</SelectItem>
                    <SelectItem value={WorkOrderStatus.ON_HOLD}>En Espera</SelectItem>
                    <SelectItem value={WorkOrderStatus.COMPLETED}>Completada</SelectItem>
                    <SelectItem value={WorkOrderStatus.CANCELLED}>Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Asignación */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Asignación</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="machine" className="text-xs text-muted-foreground">
                Máquina
              </Label>
              <Select
                value={formData.machineId?.toString() || 'none'}
                onValueChange={(value) =>
                  onFieldChange('machineId', value === 'none' ? null : Number(value))
                }
              >
                <SelectTrigger className="h-9 text-xs">
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
              <Label htmlFor="assignedTo" className="text-xs text-muted-foreground">
                Asignado a
              </Label>
              <Select
                value={formData.assignedToId?.toString() || 'unassigned'}
                onValueChange={(value) =>
                  onFieldChange('assignedToId', value === 'unassigned' ? null : Number(value))
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Seleccionar técnico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Componente (si hay máquina seleccionada) */}
          {formData.machineId && components.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="component" className="text-xs text-muted-foreground">
                Componente
              </Label>
              <Select
                value={formData.componentId?.toString() || 'none'}
                onValueChange={(value) =>
                  onFieldChange('componentId', value === 'none' ? null : Number(value))
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Seleccionar componente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {components.map((component) => (
                    <SelectItem key={component.id} value={component.id.toString()}>
                      {component.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Fechas */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Fechas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate" className="text-xs text-muted-foreground">
                Fecha Programada
              </Label>
              <DatePicker
                value={formatDateForInput(formData.scheduledDate)}
                onChange={(value) => handleDateChange('scheduledDate', value)}
                placeholder="dd/mm/yyyy"
                className="h-9 text-xs"
              />
            </div>

            {(formData.id || formData.status === WorkOrderStatus.IN_PROGRESS) && (
              <div className="space-y-2">
                <Label htmlFor="startedDate" className="text-xs text-muted-foreground">
                  Fecha de Inicio
                </Label>
                <DatePicker
                  value={formatDateForInput(formData.startedDate)}
                  onChange={(value) => handleDateChange('startedDate', value)}
                  placeholder="dd/mm/yyyy"
                  className="h-9 text-xs"
                />
              </div>
            )}

            {formData.status === WorkOrderStatus.COMPLETED && (
              <div className="space-y-2">
                <Label htmlFor="completedDate" className="text-xs text-muted-foreground">
                  Fecha de Finalización
                </Label>
                <DatePicker
                  value={formatDateForInput(formData.completedDate)}
                  onChange={(value) => handleDateChange('completedDate', value)}
                  placeholder="dd/mm/yyyy"
                  className="h-9 text-xs"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Tiempo y costo */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Tiempo y Costo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedMinutes" className="text-xs text-muted-foreground">
                Tiempo Estimado (minutos)
              </Label>
              <Input
                id="estimatedMinutes"
                type="number"
                step="5"
                min="0"
                value={formData.estimatedHours ? Math.round(formData.estimatedHours * 60) : ''}
                onChange={(e) =>
                  onFieldChange('estimatedHours', e.target.value ? Number(e.target.value) / 60 : null)
                }
                placeholder="Ej: 30"
                className="h-9 text-xs"
              />
            </div>

            {formData.id && (
              <div className="space-y-2">
                <Label htmlFor="actualMinutes" className="text-xs text-muted-foreground">
                  Tiempo Real (minutos)
                </Label>
                <Input
                  id="actualMinutes"
                  type="number"
                  step="5"
                  min="0"
                  value={formData.actualHours ? Math.round(formData.actualHours * 60) : ''}
                  onChange={(e) =>
                    onFieldChange('actualHours', e.target.value ? Number(e.target.value) / 60 : null)
                  }
                  placeholder="Ej: 45"
                  className="h-9 text-xs"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cost" className="text-xs text-muted-foreground">
                Costo Estimado ($)
              </Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost || ''}
                onChange={(e) => onFieldChange('cost', e.target.value ? Number(e.target.value) : null)}
                placeholder="Ej: 150.00"
                className="h-9 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Notas */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Notas Adicionales</h3>
          <div className="space-y-2">
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => onFieldChange('notes', e.target.value)}
              placeholder="Notas, instrucciones especiales, materiales necesarios..."
              rows={3}
              className="resize-none text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

