'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Wrench,
  Calendar as CalendarIcon,
  User,
  Clock,
  AlertTriangle,
  Building,
  Cog,
  Settings,
  PlayCircle,
  SquarePen,
  Trash2,
  Copy,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useMaintenancePending } from '@/hooks/maintenance';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { stripHtmlTags } from '@/lib/utils';

interface PreventivoPlanesViewProps {
  className?: string;
  onCreatePlan?: () => void;
  onViewPlan?: (plan: any) => void;
  onEditPlan?: (plan: any) => void;
  onExecutePlan?: (plan: any) => void;
  onDeletePlan?: (plan: any) => void;
  onDuplicatePlan?: (plan: any) => void;
  hideCreateButton?: boolean;
}

// Helpers
const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'HIGH': return 'Alta';
    case 'MEDIUM': return 'Media';
    case 'LOW': return 'Baja';
    case 'CRITICAL': return 'Crítica';
    default: return priority;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
    case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatFrequency = (frequency: number | string) => {
  if (typeof frequency === 'string') {
    switch (frequency.toUpperCase()) {
      case 'DAILY': return 'Diario';
      case 'WEEKLY': return 'Semanal';
      case 'BIWEEKLY': return 'Quincenal';
      case 'MONTHLY': return 'Mensual';
      case 'QUARTERLY': return 'Trimestral';
      case 'YEARLY': return 'Anual';
      default: return frequency;
    }
  }
  if (frequency === 1) return 'Diario';
  if (frequency === 7) return 'Semanal';
  if (frequency === 14) return 'Quincenal';
  if (frequency === 30) return 'Mensual';
  if (frequency === 90) return 'Trimestral';
  if (frequency === 365) return 'Anual';
  return `Cada ${frequency} días`;
};

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Sin fecha';
    return format(date, 'dd/MM/yyyy', { locale: es });
  } catch {
    return 'Sin fecha';
  }
};

const getDurationDisplay = (maintenance: any) => {
  if (maintenance.timeValue && maintenance.timeUnit) {
    const unitLabel = maintenance.timeUnit === 'HOURS' ? 'h' : 'min';
    return `${maintenance.timeValue}${unitLabel}`;
  }
  if (maintenance.estimatedHours) {
    return `${maintenance.estimatedHours}h`;
  }
  if (maintenance.estimatedMinutes) {
    return `${maintenance.estimatedMinutes}min`;
  }
  return 'Sin estimar';
};

/**
 * Vista "Planes" del Preventivo
 * Lista de planes de mantenimiento preventivo (templates activos)
 * Cada plan define: máquina, frecuencia, checklist, responsable
 */
export function PreventivoPlanesView({
  className,
  onCreatePlan,
  onViewPlan,
  onEditPlan,
  onExecutePlan,
  onDeletePlan,
  onDuplicatePlan,
  hideCreateButton = false,
}: PreventivoPlanesViewProps) {
  const { currentCompany, currentSector } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [isDateFromOpen, setIsDateFromOpen] = useState(false);
  const [isDateToOpen, setIsDateToOpen] = useState(false);

  // Opciones de filtro
  const priorityOptions = [
    { value: 'CRITICAL', label: 'Critica' },
    { value: 'HIGH', label: 'Alta' },
    { value: 'MEDIUM', label: 'Media' },
    { value: 'LOW', label: 'Baja' },
  ];

  const frequencyOptions = [
    { value: 'DAILY', label: 'Diario' },
    { value: 'WEEKLY', label: 'Semanal' },
    { value: 'BIWEEKLY', label: 'Quincenal' },
    { value: 'MONTHLY', label: 'Mensual' },
    { value: 'QUARTERLY', label: 'Trimestral' },
    { value: 'YEARLY', label: 'Anual' },
  ];

  const togglePriorityFilter = (value: string) => {
    setPriorityFilter(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const toggleFrequencyFilter = (value: string) => {
    setFrequencyFilter(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const clearFilters = () => {
    setPriorityFilter([]);
    setFrequencyFilter([]);
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = priorityFilter.length > 0 || frequencyFilter.length > 0 || dateFrom || dateTo;
  const activeFiltersCount = priorityFilter.length + frequencyFilter.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const companyId = currentCompany?.id ? parseInt(currentCompany.id.toString()) : null;
  const sectorId = currentSector?.id ? parseInt(currentSector.id.toString()) : null;

  // Fetch de mantenimientos pendientes (incluye templates)
  const { data, isLoading, error } = useMaintenancePending({
    companyId,
    sectorId,
    type: 'PREVENTIVE',
    enabled: !!companyId,
  });

  // Filtrar y procesar planes
  const { planes, stats } = useMemo(() => {
    const allMaintenances = data?.maintenances || [];
    const preventivePlans = allMaintenances.filter(
      (m: any) => m.type === 'PREVENTIVE' || m.isPreventive
    );

    // Filtrar por término de búsqueda
    let filteredPlans = searchTerm
      ? preventivePlans.filter((plan: any) => {
          const search = searchTerm.toLowerCase();
          return (
            (plan.title || '').toLowerCase().includes(search) ||
            (plan.machine?.name || '').toLowerCase().includes(search) ||
            (plan.unidadMovil?.nombre || '').toLowerCase().includes(search)
          );
        })
      : preventivePlans;

    // Filtrar por prioridad
    if (priorityFilter.length > 0) {
      filteredPlans = filteredPlans.filter((plan: any) => {
        const priority = (plan.priority || '').toUpperCase();
        return priorityFilter.includes(priority);
      });
    }

    // Filtrar por frecuencia
    if (frequencyFilter.length > 0) {
      filteredPlans = filteredPlans.filter((plan: any) => {
        const freq = typeof plan.frequency === 'string'
          ? plan.frequency.toUpperCase()
          : '';
        return frequencyFilter.includes(freq);
      });
    }

    // Filtrar por rango de fechas
    if (dateFrom || dateTo) {
      filteredPlans = filteredPlans.filter((plan: any) => {
        const planDate = plan.nextMaintenanceDate
          ? new Date(plan.nextMaintenanceDate)
          : plan.scheduledDate
          ? new Date(plan.scheduledDate)
          : null;

        if (!planDate || isNaN(planDate.getTime())) return false;

        if (dateFrom && dateTo) {
          return planDate >= dateFrom && planDate <= dateTo;
        } else if (dateFrom) {
          return planDate >= dateFrom;
        } else if (dateTo) {
          return planDate <= dateTo;
        }
        return true;
      });
    }

    // Calcular estadísticas
    const activos = filteredPlans.filter((p: any) => p.status === 'PENDING').length;
    const sinResponsable = filteredPlans.filter(
      (p: any) => !p.assignedTo && !p.assignedWorker && !p.assignedToName
    ).length;

    return {
      planes: filteredPlans,
      stats: {
        total: filteredPlans.length,
        activos,
        sinResponsable,
      },
    };
  }, [data, searchTerm, priorityFilter, frequencyFilter, dateFrom, dateTo]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('space-y-4', className)}>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error al cargar datos</h3>
            <p className="text-sm text-muted-foreground">
              No se pudieron cargar los planes de mantenimiento
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No company selected
  if (!companyId) {
    return (
      <div className={cn('space-y-4', className)}>
        <Card>
          <CardContent className="p-8 text-center">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin empresa seleccionada</h3>
            <p className="text-sm text-muted-foreground">
              Selecciona una empresa para ver los planes de mantenimiento
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header con búsqueda y acciones */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar planes..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className={cn("relative", hasActiveFilters && "border-primary text-primary")}>
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-white flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Filtros</h4>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFilters}>
                      <X className="h-3 w-3 mr-1" />
                      Limpiar
                    </Button>
                  )}
                </div>

                {/* Filtro por rango de fechas */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Rango de fechas</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8 text-xs justify-start font-normal",
                            !dateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {dateFrom ? format(dateFrom, 'dd/MM/yy', { locale: es }) : 'Desde'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={(date) => {
                            setDateFrom(date);
                            setIsDateFromOpen(false);
                          }}
                          locale={es}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover open={isDateToOpen} onOpenChange={setIsDateToOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8 text-xs justify-start font-normal",
                            !dateTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {dateTo ? format(dateTo, 'dd/MM/yy', { locale: es }) : 'Hasta'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={(date) => {
                            setDateTo(date);
                            setIsDateToOpen(false);
                          }}
                          locale={es}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Separator />

                {/* Filtro por prioridad */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Prioridad</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {priorityOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`priority-${option.value}`}
                          checked={priorityFilter.includes(option.value)}
                          onCheckedChange={() => togglePriorityFilter(option.value)}
                          className="h-3.5 w-3.5"
                        />
                        <label
                          htmlFor={`priority-${option.value}`}
                          className="text-xs cursor-pointer"
                        >
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Filtro por frecuencia */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Frecuencia</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {frequencyOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`freq-${option.value}`}
                          checked={frequencyFilter.includes(option.value)}
                          onCheckedChange={() => toggleFrequencyFilter(option.value)}
                          className="h-3.5 w-3.5"
                        />
                        <label
                          htmlFor={`freq-${option.value}`}
                          className="text-xs cursor-pointer"
                        >
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {!hideCreateButton && onCreatePlan && (
          <Button onClick={onCreatePlan}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Plan
          </Button>
        )}
      </div>

      {/* Stats rápidas */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          <FileText className="h-3 w-3" />
          {stats.total} planes
        </Badge>
        <Badge variant="outline" className="gap-1 text-green-600 border-green-500">
          {stats.activos} activos
        </Badge>
        {stats.sinResponsable > 0 && (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500">
            {stats.sinResponsable} sin responsable
          </Badge>
        )}
      </div>

      {/* Filtros activos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {dateFrom && (
            <Badge variant="secondary" className="text-xs gap-1">
              Desde: {format(dateFrom, 'dd/MM/yy', { locale: es })}
              <button onClick={() => setDateFrom(undefined)} className="hover:text-destructive ml-1">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {dateTo && (
            <Badge variant="secondary" className="text-xs gap-1">
              Hasta: {format(dateTo, 'dd/MM/yy', { locale: es })}
              <button onClick={() => setDateTo(undefined)} className="hover:text-destructive ml-1">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {priorityFilter.map(p => (
            <Badge key={p} variant="secondary" className="text-xs gap-1">
              {priorityOptions.find(o => o.value === p)?.label}
              <button onClick={() => togglePriorityFilter(p)} className="hover:text-destructive ml-1">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {frequencyFilter.map(f => (
            <Badge key={f} variant="secondary" className="text-xs gap-1">
              {frequencyOptions.find(o => o.value === f)?.label}
              <button onClick={() => toggleFrequencyFilter(f)} className="hover:text-destructive ml-1">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Lista de planes */}
      <div className="space-y-4">
        {planes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sin planes</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm
                  ? 'No se encontraron planes con ese criterio de búsqueda'
                  : 'No hay planes de mantenimiento preventivo configurados'}
              </p>
              {onCreatePlan && !searchTerm && (
                <Button onClick={onCreatePlan}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer plan
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          planes.map((plan: any) => (
            <Card
              key={plan.id}
              className="cursor-pointer hover:shadow-md transition-shadow w-full overflow-hidden"
              onClick={() => onViewPlan?.(plan)}
            >
              <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Título y prioridad */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-sm font-medium break-words">
                        {plan.title || 'Sin título'}
                      </h3>
                      <Badge className={cn('text-xs shrink-0', getPriorityColor(plan.priority))}>
                        {getPriorityLabel(plan.priority)}
                      </Badge>
                    </div>

                    {/* Descripción */}
                    <p className="text-xs text-muted-foreground mb-2 break-words line-clamp-2">
                      {stripHtmlTags(plan.description) || 'Sin descripción'}
                    </p>

                    {/* Badges de activo - colores neutros */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        <Wrench className="h-3 w-3 mr-1" />
                        {plan.unidadMovil?.nombre || plan.machine?.name || 'Sin equipo'}
                      </Badge>
                      {plan.machine?.sector && (
                        <Badge variant="outline" className="text-xs">
                          <Building className="h-3 w-3 mr-1" />
                          {plan.machine.sector.name}
                        </Badge>
                      )}
                      {/* Componentes */}
                      {(plan.componentNames || []).map((name: string, idx: number) => (
                        <Badge
                          key={`component-${idx}`}
                          variant="outline"
                          className="text-xs"
                        >
                          <Cog className="h-3 w-3 mr-1" />
                          {name}
                        </Badge>
                      ))}
                      {/* Subcomponentes */}
                      {(plan.subcomponentNames || []).map((name: string, idx: number) => (
                        <Badge
                          key={`subcomponent-${idx}`}
                          variant="secondary"
                          className="text-xs"
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          {name}
                        </Badge>
                      ))}
                    </div>

                    {/* Info adicional */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {/* Frecuencia */}
                      {plan.frequency && (
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          <span>{formatFrequency(plan.frequency)}</span>
                        </div>
                      )}
                      {/* Duración */}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getDurationDisplay(plan)}
                      </div>
                      {/* Próxima ejecución */}
                      {plan.nextMaintenanceDate && (
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          <span>Próximo: {formatDate(plan.nextMaintenanceDate)}</span>
                        </div>
                      )}
                      {/* Responsable */}
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {plan.assignedTo?.name ||
                          plan.assignedWorker?.name ||
                          plan.assignedToName || (
                            <span className="text-amber-600">Sin asignar</span>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex gap-2 ml-4">
                    {onEditPlan && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPlan(plan);
                        }}
                        title="Editar"
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onExecutePlan && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExecutePlan(plan);
                        }}
                        title="Ejecutar ahora"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDeletePlan && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePlan(plan);
                        }}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDuplicatePlan && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicatePlan(plan);
                        }}
                        title="Duplicar"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default PreventivoPlanesView;
