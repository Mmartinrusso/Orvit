'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar as CalendarIcon,
  Wrench,
  Building,
  Cog,
  Settings,
  User,
  PlayCircle,
  SquarePen,
  Trash2,
  Copy,
  CalendarDays,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useMaintenancePending } from '@/hooks/maintenance';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { stripHtmlTags } from '@/lib/utils';

interface PreventivoHoyViewProps {
  className?: string;
  onViewMaintenance?: (maintenance: any) => void;
  onEditMaintenance?: (maintenance: any) => void;
  onExecuteMaintenance?: (maintenance: any) => void;
  onDeleteMaintenance?: (maintenance: any) => void;
  onDuplicateMaintenance?: (maintenance: any) => void;
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

const translateExecutionWindow = (window: string) => {
  const normalized = (window || '').toUpperCase().trim();
  switch (normalized) {
    case 'NONE':
    case '':
      return 'Sin especificar';
    case 'MORNING': return 'Mañana';
    case 'AFTERNOON': return 'Tarde';
    case 'NIGHT': return 'Noche';
    case 'EVENING': return 'Tarde-Noche';
    case 'ANY':
    case 'ANYTIME':
    case 'ANY_TIME':
    case 'ANY TIME':
      return 'Cualquier momento';
    case 'BEFORE_PRODUCTION':
    case 'BEFORE PRODUCTION':
      return 'Antes de producción';
    case 'AFTER_PRODUCTION':
    case 'AFTER PRODUCTION':
      return 'Después de producción';
    case 'DURING_PRODUCTION':
    case 'DURING PRODUCTION':
      return 'Durante producción';
    default:
      return 'Cualquier momento';
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
 * Vista "Hoy" del Preventivo - Muestra tareas vencidas + hoy + próximos 7 días
 * Usa datos reales de la base de datos
 */
export function PreventivoHoyView({
  className,
  onViewMaintenance,
  onEditMaintenance,
  onExecuteMaintenance,
  onDeleteMaintenance,
  onDuplicateMaintenance,
}: PreventivoHoyViewProps) {
  const { currentCompany, currentSector } = useCompany();
  const [groupBy, setGroupBy] = useState<'none' | 'machine' | 'date'>('none');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'today' | 'week' | 'future'>('all');

  const companyId = currentCompany?.id ? parseInt(currentCompany.id.toString()) : null;
  const sectorId = currentSector?.id ? parseInt(currentSector.id.toString()) : null;

  // Fetch de mantenimientos pendientes
  const { data, isLoading, error } = useMaintenancePending({
    companyId,
    sectorId,
    type: 'PREVENTIVE',
    enabled: !!companyId,
  });

  // Filtrar solo preventivos y calcular KPIs
  const { maintenances, kpis } = useMemo(() => {
    const allMaintenances = data?.maintenances || [];
    const preventiveMaintenances = allMaintenances.filter(
      (m: any) => m.type === 'PREVENTIVE' || m.isPreventive
    );

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    let overdue = 0;
    let dueToday = 0;
    let next7Days = 0;
    let backlog = 0;

    preventiveMaintenances.forEach((maintenance: any) => {
      const maintenanceDate = maintenance.nextMaintenanceDate
        ? new Date(maintenance.nextMaintenanceDate)
        : maintenance.scheduledDate
        ? new Date(maintenance.scheduledDate)
        : null;

      if (!maintenanceDate || isNaN(maintenanceDate.getTime())) {
        backlog++;
        return;
      }

      maintenanceDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor(
        (maintenanceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff < 0) {
        overdue++;
      } else if (daysDiff === 0) {
        dueToday++;
      } else if (daysDiff <= 7) {
        next7Days++;
      } else {
        backlog++;
      }
    });

    return {
      maintenances: preventiveMaintenances,
      kpis: { overdue, dueToday, next7Days, backlog },
    };
  }, [data]);

  // Filtrar mantenimientos según el filtro de estado seleccionado
  const filteredMaintenances = useMemo(() => {
    if (statusFilter === 'all') return maintenances;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return maintenances.filter((m: any) => {
      const maintenanceDate = m.nextMaintenanceDate
        ? new Date(m.nextMaintenanceDate)
        : m.scheduledDate
        ? new Date(m.scheduledDate)
        : null;

      if (!maintenanceDate || isNaN(maintenanceDate.getTime())) {
        return statusFilter === 'future'; // Sin fecha va a "Programados"
      }

      maintenanceDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor(
        (maintenanceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      switch (statusFilter) {
        case 'overdue': return daysDiff < 0;
        case 'today': return daysDiff === 0;
        case 'week': return daysDiff > 0 && daysDiff <= 7;
        case 'future': return daysDiff > 7;
        default: return true;
      }
    });
  }, [maintenances, statusFilter]);

  // Agrupar mantenimientos por máquina o fecha
  const groupedMaintenances = useMemo(() => {
    if (groupBy === 'none') return null;

    if (groupBy === 'machine') {
      const groups: Record<string, any[]> = {};
      filteredMaintenances.forEach((m: any) => {
        const machineName = m.unidadMovil?.nombre || m.machine?.name || 'Sin equipo asignado';
        if (!groups[machineName]) groups[machineName] = [];
        groups[machineName].push(m);
      });
      // Ordenar grupos alfabéticamente, pero "Sin equipo" al final
      return Object.entries(groups).sort(([a], [b]) => {
        if (a === 'Sin equipo asignado') return 1;
        if (b === 'Sin equipo asignado') return -1;
        return a.localeCompare(b);
      });
    }

    if (groupBy === 'date') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const groups: Record<string, any[]> = {
        'Vencidos': [],
        'Hoy': [],
        'Mañana': [],
        'Esta semana': [],
        'Próximamente': [],
      };

      filteredMaintenances.forEach((m: any) => {
        const maintenanceDate = m.nextMaintenanceDate
          ? new Date(m.nextMaintenanceDate)
          : m.scheduledDate
          ? new Date(m.scheduledDate)
          : null;

        if (!maintenanceDate || isNaN(maintenanceDate.getTime())) {
          groups['Próximamente'].push(m);
          return;
        }

        maintenanceDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor(
          (maintenanceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff < 0) groups['Vencidos'].push(m);
        else if (daysDiff === 0) groups['Hoy'].push(m);
        else if (daysDiff === 1) groups['Mañana'].push(m);
        else if (daysDiff <= 7) groups['Esta semana'].push(m);
        else groups['Próximamente'].push(m);
      });

      // Filtrar grupos vacíos
      return Object.entries(groups).filter(([_, items]) => items.length > 0);
    }

    return null;
  }, [filteredMaintenances, groupBy]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
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
              No se pudieron cargar los mantenimientos preventivos
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
              Selecciona una empresa para ver los mantenimientos preventivos
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header con toggle de KPIs y agrupación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {statusFilter !== 'all' ? (
              <>
                {filteredMaintenances.length} de {maintenances.length} mantenimiento{maintenances.length !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                {maintenances.length} mantenimiento{maintenances.length !== 1 ? 's' : ''} pendiente{maintenances.length !== 1 ? 's' : ''}
              </>
            )}
          </p>
          {statusFilter !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter('all')}
              className="h-6 px-2 text-xs"
            >
              Limpiar filtro ×
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle de agrupación */}
          <Button
            variant={groupBy === 'none' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setGroupBy('none')}
          >
            Lista
          </Button>
          <Button
            variant={groupBy === 'machine' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setGroupBy('machine')}
          >
            <Wrench className="h-3 w-3 mr-1" />
            Máquina
          </Button>
          <Button
            variant={groupBy === 'date' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setGroupBy('date')}
          >
            <CalendarIcon className="h-3 w-3 mr-1" />
            Fecha
          </Button>
        </div>
      </div>

      {/* KPIs de Pendientes (clickeables como filtros) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Vencidos */}
        <Card
          className={cn(
            "hover:shadow-md transition-all cursor-pointer",
            statusFilter === 'overdue'
              ? "ring-2 ring-red-500 border-red-500 bg-red-50"
              : "border-red-200 bg-red-50/50"
          )}
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-red-600">{kpis.overdue}</p>
              </div>
              <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vencen Hoy */}
        <Card
          className={cn(
            "hover:shadow-md transition-all cursor-pointer",
            statusFilter === 'today' && "ring-2 ring-primary border-primary"
          )}
          onClick={() => setStatusFilter(statusFilter === 'today' ? 'all' : 'today')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Vencen Hoy</p>
                <p className="text-2xl font-bold text-foreground">{kpis.dueToday}</p>
              </div>
              <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Próximos 7 días */}
        <Card
          className={cn(
            "hover:shadow-md transition-all cursor-pointer",
            statusFilter === 'week' && "ring-2 ring-primary border-primary"
          )}
          onClick={() => setStatusFilter(statusFilter === 'week' ? 'all' : 'week')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Próximos 7 días</p>
                <p className="text-2xl font-bold text-foreground">{kpis.next7Days}</p>
              </div>
              <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Programados (antes Backlog) */}
        <Card
          className={cn(
            "hover:shadow-md transition-all cursor-pointer",
            statusFilter === 'future' && "ring-2 ring-primary border-primary"
          )}
          onClick={() => setStatusFilter(statusFilter === 'future' ? 'all' : 'future')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Programados</p>
                <p className="text-2xl font-bold text-foreground">{kpis.backlog}</p>
              </div>
              <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                <ListTodo className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de mantenimientos */}
      <div className="space-y-4">
        {filteredMaintenances.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              {maintenances.length === 0 ? (
                <>
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sin tareas pendientes</h3>
                  <p className="text-sm text-muted-foreground">
                    No hay mantenimientos preventivos pendientes
                  </p>
                </>
              ) : (
                <>
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sin resultados</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    No hay mantenimientos que coincidan con el filtro seleccionado
                  </p>
                  <Button variant="outline" onClick={() => setStatusFilter('all')}>
                    Ver todos
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : groupedMaintenances ? (
          // Vista agrupada
          <div className="space-y-6">
            {groupedMaintenances.map(([groupName, items]) => (
              <div key={groupName}>
                {/* Header del grupo */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                  {groupBy === 'machine' ? (
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  ) : groupName === 'Vencidos' ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : (
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className={cn(
                    "font-medium text-sm",
                    groupName === 'Vencidos' && "text-red-600"
                  )}>
                    {groupName}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                </div>
                {/* Cards del grupo */}
                <div className="space-y-3">
                  {items.map((maintenance: any) => (
                    <MaintenanceCard
                      key={maintenance.id}
                      maintenance={maintenance}
                      onView={onViewMaintenance}
                      onEdit={onEditMaintenance}
                      onExecute={onExecuteMaintenance}
                      onDelete={onDeleteMaintenance}
                      onDuplicate={onDuplicateMaintenance}
                      hideEquipo={groupBy === 'machine'}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Vista lista normal
          <div className="space-y-3">
            {filteredMaintenances.map((maintenance: any) => (
              <MaintenanceCard
                key={maintenance.id}
                maintenance={maintenance}
                onView={onViewMaintenance}
                onEdit={onEditMaintenance}
                onExecute={onExecuteMaintenance}
                onDelete={onDeleteMaintenance}
                onDuplicate={onDuplicateMaintenance}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de tarjeta de mantenimiento extraído
interface MaintenanceCardProps {
  maintenance: any;
  onView?: (m: any) => void;
  onEdit?: (m: any) => void;
  onExecute?: (m: any) => void;
  onDelete?: (m: any) => void;
  onDuplicate?: (m: any) => void;
  hideEquipo?: boolean;
}

function MaintenanceCard({
  maintenance,
  onView,
  onEdit,
  onExecute,
  onDelete,
  onDuplicate,
  hideEquipo = false,
}: MaintenanceCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow w-full overflow-hidden"
      onClick={() => onView?.(maintenance)}
    >
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Título y prioridad */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-sm font-medium break-words">
                {maintenance.title || 'Sin título'}
              </h3>
              <Badge className={cn('text-xs shrink-0', getPriorityColor(maintenance.priority))}>
                {getPriorityLabel(maintenance.priority)}
              </Badge>
            </div>

            {/* Descripción */}
            <p className="text-xs text-muted-foreground mb-2 break-words line-clamp-2">
              {stripHtmlTags(maintenance.description) || 'Sin descripción'}
            </p>

            {/* Ventana de ejecución */}
            <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  Ventana: {translateExecutionWindow(maintenance.executionWindow)}
                </span>
              </div>
            </div>

            {/* Badges de activo - colores neutros */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {!hideEquipo && (
                <Badge variant="outline" className="text-xs">
                  <Wrench className="h-3 w-3 mr-1" />
                  {maintenance.unidadMovil?.nombre ||
                    maintenance.machine?.name ||
                    'Sin equipo'}
                </Badge>
              )}
              {maintenance.machine?.sector && (
                <Badge variant="outline" className="text-xs">
                  <Building className="h-3 w-3 mr-1" />
                  {maintenance.machine.sector.name}
                </Badge>
              )}
              {/* Componentes */}
              {(maintenance.componentNames || []).map((name: string, idx: number) => (
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
              {(maintenance.subcomponentNames || []).map((name: string, idx: number) => (
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
              {maintenance.frequency && (
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  <span>{formatFrequency(maintenance.frequency)}</span>
                </div>
              )}
              {/* Duración */}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getDurationDisplay(maintenance)}
              </div>
              {/* Próxima fecha */}
              {maintenance.nextMaintenanceDate && (
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  <span>Próximo: {formatDate(maintenance.nextMaintenanceDate)}</span>
                </div>
              )}
              {/* Asignado */}
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {maintenance.assignedTo?.name ||
                  maintenance.assignedWorker?.name ||
                  maintenance.assignedToName || (
                    <span className="text-amber-600">Sin asignar</span>
                  )}
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2 ml-4">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(maintenance);
                }}
                title="Editar"
              >
                <SquarePen className="h-3.5 w-3.5" />
              </Button>
            )}
            {onExecute && (
              <Button
                variant="default"
                size="sm"
                className="h-8 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={(e) => {
                  e.stopPropagation();
                  onExecute(maintenance);
                }}
                title="Realizar mantenimiento"
              >
                <PlayCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(maintenance);
                }}
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(maintenance);
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
  );
}

export default PreventivoHoyView;
