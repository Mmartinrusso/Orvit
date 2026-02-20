'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
} from '@/components/ui/command';
import {
  Filter,
  X,
  Calendar,
  User,
  Save,
  RotateCcw,
  Check,
  ChevronsUpDown,
  Bookmark
} from 'lucide-react';
import { WorkOrderStatus, Priority, MaintenanceType } from '@/lib/types';

export interface FilterOptions {
  search: string;
  status: WorkOrderStatus[];
  priority: Priority[];
  type: MaintenanceType[];
  dateRange: {
    from?: Date;
    to?: Date;
  };
  overdue: boolean;
  unassigned: boolean;
}

interface AdvancedFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onReset: () => void;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: FilterOptions;
}

export default function AdvancedFilters({ filters, onFiltersChange, onReset }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = () => {
    const saved = localStorage.getItem('workOrderFilterPresets');
    if (saved) {
      try {
        const parsedPresets = JSON.parse(saved).map((preset: any) => ({
          ...preset,
          filters: {
            ...preset.filters,
            dateRange: {
              from: preset.filters.dateRange.from ? new Date(preset.filters.dateRange.from) : undefined,
              to: preset.filters.dateRange.to ? new Date(preset.filters.dateRange.to) : undefined,
            }
          }
        }));
        setPresets(parsedPresets);
      } catch (error) {
        console.error('Error loading presets:', error);
      }
    }
  };

  const savePresets = (newPresets: FilterPreset[]) => {
    localStorage.setItem('workOrderFilterPresets', JSON.stringify(newPresets));
    setPresets(newPresets);
  };

  const updateFilter = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const toggleArrayFilter = <K extends keyof FilterOptions>(
    key: K,
    value: any,
    currentArray: any[]
  ) => {
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilter(key, newArray as FilterOptions[K]);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status.length > 0) count++;
    if (filters.priority.length > 0) count++;
    if (filters.type.length > 0) count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.overdue) count++;
    if (filters.unassigned) count++;
    return count;
  };

  const saveCurrentAsPreset = () => {
    if (!newPresetName.trim()) return;

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      filters: { ...filters },
    };

    const updatedPresets = [...presets, newPreset];
    savePresets(updatedPresets);
    setNewPresetName('');
  };

  const applyPreset = (preset: FilterPreset) => {
    onFiltersChange(preset.filters);
    setIsOpen(false);
  };

  const deletePreset = (presetId: string) => {
    const updatedPresets = presets.filter(p => p.id !== presetId);
    savePresets(updatedPresets);
  };

  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const statusOptions = [
    { value: WorkOrderStatus.PENDING, label: 'Pendiente', color: 'bg-warning' },
    { value: WorkOrderStatus.IN_PROGRESS, label: 'En Proceso', color: 'bg-info' },
    { value: WorkOrderStatus.COMPLETED, label: 'Completada', color: 'bg-success' },
    { value: WorkOrderStatus.CANCELLED, label: 'Cancelada', color: 'bg-destructive' },
    { value: WorkOrderStatus.ON_HOLD, label: 'En Espera', color: 'bg-muted-foreground' },
  ];

  const priorityOptions = [
    { value: Priority.LOW, label: 'Baja', color: 'bg-success' },
    { value: Priority.MEDIUM, label: 'Media', color: 'bg-warning' },
    { value: Priority.HIGH, label: 'Alta', color: 'bg-warning' },
    { value: Priority.URGENT, label: 'Urgente', color: 'bg-destructive' },
  ];

  const typeOptions = [
    { value: MaintenanceType.PREVENTIVE, label: 'Preventivo', color: 'bg-success' },
    { value: MaintenanceType.CORRECTIVE, label: 'Correctivo', color: 'bg-warning' },
    { value: MaintenanceType.PREDICTIVE, label: 'Predictivo', color: 'bg-info' },
    { value: MaintenanceType.EMERGENCY, label: 'Emergencia', color: 'bg-destructive' },
  ];

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Filtros Avanzados
            {getActiveFiltersCount() > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {getActiveFiltersCount()}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-96 p-0" align="end">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros Avanzados
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Búsqueda */}
              <div className="space-y-2">
                <Label htmlFor="search">Búsqueda</Label>
                <Input
                  id="search"
                  placeholder="Buscar en título, descripción..."
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                />
              </div>

              {/* Estados */}
              <div className="space-y-2">
                <Label>Estados</Label>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <Badge
                      key={status.value}
                      variant={filters.status.includes(status.value) ? "default" : "outline"}
                      className={cn('cursor-pointer', filters.status.includes(status.value) ? [status.color, 'text-white'] : 'hover:bg-accent')}
                      onClick={() => toggleArrayFilter('status', status.value, filters.status)}
                    >
                      <div className={cn('w-2 h-2 rounded-full mr-1', status.color)}></div>
                      {status.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Prioridades */}
              <div className="space-y-2">
                <Label>Prioridades</Label>
                <div className="flex flex-wrap gap-2">
                  {priorityOptions.map((priority) => (
                    <Badge
                      key={priority.value}
                      variant={filters.priority.includes(priority.value) ? "default" : "outline"}
                      className={cn('cursor-pointer', filters.priority.includes(priority.value) ? [priority.color, 'text-white'] : 'hover:bg-accent')}
                      onClick={() => toggleArrayFilter('priority', priority.value, filters.priority)}
                    >
                      <div className={cn('w-2 h-2 rounded-full mr-1', priority.color)}></div>
                      {priority.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Tipos */}
              <div className="space-y-2">
                <Label>Tipos de Mantenimiento</Label>
                <div className="flex flex-wrap gap-2">
                  {typeOptions.map((type) => (
                    <Badge
                      key={type.value}
                      variant={filters.type.includes(type.value) ? "default" : "outline"}
                      className={cn('cursor-pointer', filters.type.includes(type.value) ? [type.color, 'text-white'] : 'hover:bg-accent')}
                      onClick={() => toggleArrayFilter('type', type.value, filters.type)}
                    >
                      <div className={cn('w-2 h-2 rounded-full mr-1', type.color)}></div>
                      {type.label}
                    </Badge>
                  ))}
                </div>
              </div>



              {/* Rango de fechas */}
              <div className="space-y-2">
                <Label>Rango de Fechas</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="dateFrom" className="text-xs">Desde</Label>
                    <DatePicker
                      value={formatDateForInput(filters.dateRange.from)}
                      onChange={(date) => updateFilter('dateRange', {
                        ...filters.dateRange,
                        from: date ? new Date(date) : undefined
                      })}
                      placeholder="Seleccionar"
                      clearable
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateTo" className="text-xs">Hasta</Label>
                    <DatePicker
                      value={formatDateForInput(filters.dateRange.to)}
                      onChange={(date) => updateFilter('dateRange', {
                        ...filters.dateRange,
                        to: date ? new Date(date) : undefined
                      })}
                      placeholder="Seleccionar"
                      clearable
                    />
                  </div>
                </div>
              </div>

              {/* Filtros especiales */}
              <div className="space-y-2">
                <Label>Filtros Especiales</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={filters.overdue ? "destructive" : "outline"}
                    className="cursor-pointer"
                    onClick={() => updateFilter('overdue', !filters.overdue)}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Vencidas
                  </Badge>
                  <Badge
                    variant={filters.unassigned ? "secondary" : "outline"}
                    className="cursor-pointer"
                    onClick={() => updateFilter('unassigned', !filters.unassigned)}
                  >
                    <User className="h-3 w-3 mr-1" />
                    Sin asignar
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Presets */}
              <div className="space-y-2">
                <Label>Filtros Guardados</Label>
                {presets.length > 0 && (
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {presets.map((preset) => (
                      <div key={preset.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <button
                          onClick={() => applyPreset(preset)}
                          className="flex items-center gap-2 text-sm hover:text-primary"
                        >
                          <Bookmark className="h-3 w-3" />
                          {preset.name}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePreset(preset.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre del filtro"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={saveCurrentAsPreset}
                    disabled={!newPresetName.trim()}
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Acciones */}
              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={onReset}>
                  <RotateCcw className="h-3 w-3 mr-2" />
                  Limpiar
                </Button>
                <Button size="sm" onClick={() => setIsOpen(false)}>
                  Aplicar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
} 