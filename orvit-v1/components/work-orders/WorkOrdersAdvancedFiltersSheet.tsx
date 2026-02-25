'use client';

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetBody,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { MaintenanceType, WorkOrderStatus, Priority } from '@/lib/types';
import {
  type WorkOrderFilters,
  filterMaintenanceTypeLabels,
  sortByLabels,
} from './workOrders.helpers';

interface WorkOrdersAdvancedFiltersSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filters: WorkOrderFilters;
  onFiltersChange: (filters: WorkOrderFilters) => void;
  availableMachines: Array<{ id: number; name: string }>;
  availableUsers?: Array<{ id: number; name: string; type: 'user' | 'worker' }>;
  children?: React.ReactNode;
}

export function WorkOrdersAdvancedFiltersSheet({
  isOpen,
  onOpenChange,
  filters,
  onFiltersChange,
  availableMachines,
  availableUsers = [],
  children,
}: WorkOrdersAdvancedFiltersSheetProps) {
  const [localFilters, setLocalFilters] = useState<WorkOrderFilters>(filters);

  // Sincronizar cuando se abre el sheet
  useEffect(() => {
    if (isOpen) {
      setLocalFilters(filters);
    }
  }, [filters, isOpen]);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters: WorkOrderFilters = {
      ...filters,
      status: null,
      priority: null,
      assignee: 'all',
      machineId: null,
      maintenanceType: null,
      dateRange: {},
      tags: [],
      sortBy: undefined,
      onlyOverdue: false,
      onlyUnassigned: false,
    };
    setLocalFilters(resetFilters);
  };

  const hasAdvancedFilters = 
    localFilters.machineId !== null ||
    localFilters.maintenanceType !== null ||
    localFilters.dateRange?.from !== undefined ||
    localFilters.dateRange?.to !== undefined ||
    localFilters.sortBy !== undefined ||
    localFilters.onlyOverdue ||
    localFilters.onlyUnassigned;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent side="right" size="sm">
        <SheetHeader>
          <SheetTitle>Filtros avanzados</SheetTitle>
          <SheetDescription>
            Configura filtros adicionales para encontrar órdenes específicas
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
          {/* Estado, Prioridad, Responsable — solo en mobile (ocultos en desktop por estar en la barra) */}
          <div className="sm:hidden space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Estado</Label>
              <Select
                value={localFilters.status || 'ALL'}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, status: value === 'ALL' ? null : value as WorkOrderStatus })
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value={WorkOrderStatus.PENDING}>Pendiente</SelectItem>
                  <SelectItem value={WorkOrderStatus.IN_PROGRESS}>En proceso</SelectItem>
                  <SelectItem value={WorkOrderStatus.COMPLETED}>Completada</SelectItem>
                  <SelectItem value={WorkOrderStatus.CANCELLED}>Cancelada</SelectItem>
                  <SelectItem value={WorkOrderStatus.ON_HOLD}>En espera</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Prioridad</Label>
              <Select
                value={localFilters.priority || 'ALL'}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, priority: value === 'ALL' ? null : value as Priority })
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value={Priority.LOW}>Baja</SelectItem>
                  <SelectItem value={Priority.MEDIUM}>Media</SelectItem>
                  <SelectItem value={Priority.HIGH}>Alta</SelectItem>
                  <SelectItem value={Priority.URGENT}>Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {availableUsers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Responsable</Label>
                <Select
                  value={localFilters.assignee || 'all'}
                  onValueChange={(value) =>
                    setLocalFilters({ ...localFilters, assignee: value })
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                    {availableUsers.map((user) => (
                      <SelectItem key={`${user.type}-${user.id}`} value={`${user.type}-${user.id}`}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />
          </div>

          {/* Máquina */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Máquina</Label>
            <Select
              value={localFilters.machineId?.toString() || 'all'}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  machineId: value === 'all' ? null : parseInt(value),
                })
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todas las máquinas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las máquinas</SelectItem>
                {availableMachines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id.toString()}>
                    {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de mantenimiento */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de mantenimiento</Label>
            <Select
              value={localFilters.maintenanceType || 'ALL'}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  maintenanceType: value === 'ALL' ? null : value as MaintenanceType,
                })
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                <SelectItem value={MaintenanceType.PREVENTIVE}>Preventivo</SelectItem>
                <SelectItem value={MaintenanceType.CORRECTIVE}>Correctivo</SelectItem>
                <SelectItem value={MaintenanceType.PREDICTIVE}>Predictivo</SelectItem>
                <SelectItem value={MaintenanceType.EMERGENCY}>Emergencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Rango de fechas */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Rango de fechas (vencimiento)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <DatePicker
                  className="h-10"
                  value={
                    localFilters.dateRange?.from
                      ? new Date(localFilters.dateRange.from).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(date) =>
                    setLocalFilters({
                      ...localFilters,
                      dateRange: {
                        ...localFilters.dateRange,
                        from: date ? new Date(date) : undefined,
                      },
                    })
                  }
                  placeholder="Seleccionar fecha"
                  clearable
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <DatePicker
                  className="h-10"
                  value={
                    localFilters.dateRange?.to
                      ? new Date(localFilters.dateRange.to).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(date) =>
                    setLocalFilters({
                      ...localFilters,
                      dateRange: {
                        ...localFilters.dateRange,
                        to: date ? new Date(date) : undefined,
                      },
                    })
                  }
                  placeholder="Seleccionar fecha"
                  clearable
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Ordenar por */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Ordenar por</Label>
            <Select
              value={localFilters.sortBy || 'none'}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  sortBy: value === 'none' ? undefined : value as 'dueDate' | 'priority' | 'recent' | 'created',
                })
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Sin ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin ordenar</SelectItem>
                <SelectItem value="dueDate">Vence primero</SelectItem>
                <SelectItem value="priority">Mayor prioridad</SelectItem>
                <SelectItem value="recent">Más reciente</SelectItem>
                <SelectItem value="created">Fecha de creación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Toggles */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Filtros rápidos</Label>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm cursor-pointer" htmlFor="only-overdue">
                  Solo vencidas
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mostrar únicamente órdenes vencidas
                </p>
              </div>
              <Switch
                id="only-overdue"
                checked={localFilters.onlyOverdue || false}
                onCheckedChange={(checked) =>
                  setLocalFilters({
                    ...localFilters,
                    onlyOverdue: checked,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm cursor-pointer" htmlFor="only-unassigned">
                  Solo sin asignar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mostrar órdenes sin responsable
                </p>
              </div>
              <Switch
                id="only-unassigned"
                checked={localFilters.onlyUnassigned || false}
                onCheckedChange={(checked) =>
                  setLocalFilters({
                    ...localFilters,
                    onlyUnassigned: checked,
                  })
                }
              />
            </div>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex-1"
            disabled={!hasAdvancedFilters}
          >
            Restablecer
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
