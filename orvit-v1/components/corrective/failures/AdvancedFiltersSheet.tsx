'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Check, ChevronsUpDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { FailureFilters } from './FailureFiltersBar';

interface AdvancedFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FailureFilters;
  onFiltersChange: (filters: FailureFilters) => void;
}

interface User {
  id: number;
  name: string;
}

interface Component {
  id: number;
  name: string;
  subcomponents?: { id: number; name: string }[];
}

/**
 * Sheet de filtros avanzados
 * Incluye: rango fechas, componente, reportado por, con/sin OT, con/sin duplicados
 */
export function AdvancedFiltersSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
}: AdvancedFiltersSheetProps) {
  const [localFilters, setLocalFilters] = useState<FailureFilters>(filters);
  const [userOpen, setUserOpen] = useState(false);
  const [componentOpen, setComponentOpen] = useState(false);

  const { currentCompany } = useCompany();

  // Sync local filters when sheet opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Cargar usuarios
  const { data: users } = useQuery<User[]>({
    queryKey: ['users-filter', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch('/api/users?limit=100');
      if (!res.ok) return [];
      const json = await res.json();
      return json.users || json.data || json;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Cargar componentes (si hay máquina seleccionada)
  const { data: components } = useQuery<Component[]>({
    queryKey: ['components-filter', filters.machineId],
    queryFn: async () => {
      if (!filters.machineId) return [];
      const res = await fetch(`/api/machines/${filters.machineId}/components`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json;
    },
    enabled: open && !!filters.machineId,
  });

  const handleApply = () => {
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const clearedAdvanced: Partial<FailureFilters> = {
      dateFrom: undefined,
      dateTo: undefined,
      componentId: undefined,
      subcomponentId: undefined,
      reportedById: undefined,
      hasWorkOrder: undefined,
      hasDuplicates: undefined,
    };
    setLocalFilters({ ...localFilters, ...clearedAdvanced });
  };

  const updateLocal = <K extends keyof FailureFilters>(
    key: K,
    value: FailureFilters[K]
  ) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const selectedUser = users?.find((u) => u.id === localFilters.reportedById);
  const selectedComponent = components?.find(
    (c) => c.id === localFilters.componentId
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros Avanzados</SheetTitle>
          <SheetDescription>
            Configure filtros adicionales para la búsqueda de fallas
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Rango de fechas */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Rango de Fechas</Label>
            <div className="grid grid-cols-2 gap-3">
              {/* Fecha desde */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'w-full justify-start text-left font-normal h-9',
                        !localFilters.dateFrom && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {localFilters.dateFrom
                        ? format(new Date(localFilters.dateFrom), 'PP', {
                            locale: es,
                          })
                        : 'Seleccionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        localFilters.dateFrom
                          ? new Date(localFilters.dateFrom)
                          : undefined
                      }
                      onSelect={(date) =>
                        updateLocal(
                          'dateFrom',
                          date ? date.toISOString() : undefined
                        )
                      }
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Fecha hasta */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        'w-full justify-start text-left font-normal h-9',
                        !localFilters.dateTo && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {localFilters.dateTo
                        ? format(new Date(localFilters.dateTo), 'PP', {
                            locale: es,
                          })
                        : 'Seleccionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        localFilters.dateTo
                          ? new Date(localFilters.dateTo)
                          : undefined
                      }
                      onSelect={(date) =>
                        updateLocal(
                          'dateTo',
                          date ? date.toISOString() : undefined
                        )
                      }
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Componente (solo si hay máquina) */}
          {filters.machineId && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Componente</Label>
              <Popover open={componentOpen} onOpenChange={setComponentOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    role="combobox"
                    className="w-full justify-between h-9"
                  >
                    <span className="truncate">
                      {selectedComponent?.name || 'Todos los componentes'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar componente..." />
                    <CommandList>
                      <CommandEmpty>Sin componentes</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            updateLocal('componentId', undefined);
                            updateLocal('subcomponentId', undefined);
                            setComponentOpen(false);
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Todos los componentes
                        </CommandItem>
                        {components?.map((comp) => (
                          <CommandItem
                            key={comp.id}
                            value={comp.name}
                            onSelect={() => {
                              updateLocal('componentId', comp.id);
                              setComponentOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                localFilters.componentId === comp.id
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            {comp.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Reportado por */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Reportado por</Label>
            <Popover open={userOpen} onOpenChange={setUserOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  role="combobox"
                  className="w-full justify-between h-9"
                >
                  <span className="truncate">
                    {selectedUser?.name || 'Todos los usuarios'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar usuario..." />
                  <CommandList>
                    <CommandEmpty>Sin usuarios</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          updateLocal('reportedById', undefined);
                          setUserOpen(false);
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Todos los usuarios
                      </CommandItem>
                      {users?.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.name}
                          onSelect={() => {
                            updateLocal('reportedById', user.id);
                            setUserOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              localFilters.reportedById === user.id
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {user.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Con/Sin OT */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Orden de Trabajo</Label>
            <Select
              value={
                localFilters.hasWorkOrder === undefined
                  ? 'all'
                  : localFilters.hasWorkOrder
                  ? 'with'
                  : 'without'
              }
              onValueChange={(val) => {
                if (val === 'all') updateLocal('hasWorkOrder', undefined);
                else if (val === 'with') updateLocal('hasWorkOrder', true);
                else updateLocal('hasWorkOrder', false);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="with">Con OT activa</SelectItem>
                <SelectItem value="without">Sin OT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Con/Sin duplicados */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Duplicados vinculados</Label>
            <Select
              value={
                localFilters.hasDuplicates === undefined
                  ? 'all'
                  : localFilters.hasDuplicates
                  ? 'with'
                  : 'without'
              }
              onValueChange={(val) => {
                if (val === 'all') updateLocal('hasDuplicates', undefined);
                else if (val === 'with') updateLocal('hasDuplicates', true);
                else updateLocal('hasDuplicates', false);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="with">Con duplicados</SelectItem>
                <SelectItem value="without">Sin duplicados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observación */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tipo de reporte</Label>
            <Select
              value={
                localFilters.isObservation === undefined
                  ? 'all'
                  : localFilters.isObservation
                  ? 'observation'
                  : 'failure'
              }
              onValueChange={(val) => {
                if (val === 'all') updateLocal('isObservation', undefined);
                else if (val === 'observation')
                  updateLocal('isObservation', true);
                else updateLocal('isObservation', false);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="failure">Solo fallas</SelectItem>
                <SelectItem value="observation">Solo observaciones</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClear}>
            Limpiar
          </Button>
          <Button onClick={handleApply}>Aplicar Filtros</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
