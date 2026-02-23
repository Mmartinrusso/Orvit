'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  Clock,
  User,
  Wrench,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Play,
  Pause,
  MoreHorizontal,
  UserPlus,
  Search,
  Shield,
  Zap,
  Timer,
  Eye,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AssignAndPlanDialog } from '@/components/work-orders/AssignAndPlanDialog';
import { WaitingStateDialog } from '@/components/corrective/work-orders/WaitingStateDialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePresetFilters, PresetFilters } from './WorkOrdersSavedViewsBar';

interface WorkOrdersDispatcherBoardProps {
  onSelectWorkOrder?: (workOrderId: number) => void;
  className?: string;
}

interface WorkOrderCard {
  id: number;
  title: string;
  priority: string;
  status: string;
  waitingReason?: string;
  waitingDescription?: string;
  waitingETA?: string;
  etaOverdue?: boolean;
  etaOverdueHours?: number;
  slaDueAt?: string;
  slaStatus?: string;
  slaOverdue?: boolean;
  slaHoursRemaining?: number;
  scheduledDate?: string;
  assignedAt?: string;
  maintenanceType?: string;
  machine?: { id: number; name: string };
  assignedTo?: { id: number; name: string };
  failure?: {
    id: number;
    title: string;
    priority: string;
    causedDowntime: boolean;
    isSafetyRelated: boolean;
    isObservation?: boolean;
  };
  failureOccurrences?: Array<{
    id: number;
    title: string;
    priority: string;
    causedDowntime?: boolean;
    isSafetyRelated?: boolean;
    isObservation?: boolean;
    subcomponent?: { id: number; name: string };
    component?: { id: number; name: string };
  }>;
  qualityAssurance?: {
    isRequired: boolean;
    status: string;
  };
  createdAt: string;
  completedDate?: string;
}

// Lane (columna) configuration
interface Lane {
  id: string;
  title: string;
  description: string;
  color: string;
  collapsed?: boolean;
}

const LANES: Lane[] = [
  { id: 'entrantes', title: 'Entrantes', description: 'Sin asignar o recién creadas', color: 'blue' },
  { id: 'a_planificar', title: 'A planificar', description: 'Asignadas, pendientes de inicio', color: 'yellow' },
  { id: 'listas', title: 'Listas', description: 'Programadas y listas para ejecutar', color: 'cyan' },
  { id: 'en_ejecucion', title: 'En ejecución', description: 'Trabajos en curso', color: 'green' },
  { id: 'en_espera', title: 'En espera', description: 'Bloqueadas por algún motivo', color: 'amber' },
  { id: 'bloqueadas', title: 'Bloqueadas', description: 'Requieren intervención', color: 'red' },
  { id: 'finalizadas_hoy', title: 'Finalizadas (hoy)', description: 'Completadas hoy', color: 'emerald', collapsed: true },
];

const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  P1: { label: 'P1', color: 'text-destructive-foreground', bgColor: 'bg-destructive' },
  P2: { label: 'P2', color: 'text-warning-foreground', bgColor: 'bg-warning' },
  P3: { label: 'P3', color: 'text-warning-foreground', bgColor: 'bg-warning' },
  P4: { label: 'P4', color: 'text-success-foreground', bgColor: 'bg-success' },
  URGENT: { label: 'P1', color: 'text-destructive-foreground', bgColor: 'bg-destructive' },
  HIGH: { label: 'P2', color: 'text-warning-foreground', bgColor: 'bg-warning' },
  MEDIUM: { label: 'P3', color: 'text-warning-foreground', bgColor: 'bg-warning' },
  LOW: { label: 'P4', color: 'text-success-foreground', bgColor: 'bg-success' },
};

const waitingReasonLabels: Record<string, string> = {
  SPARE_PART: 'Esperando repuesto',
  VENDOR: 'Esperando proveedor',
  PRODUCTION: 'Esperando producción',
  APPROVAL: 'Esperando aprobación',
  RESOURCES: 'Falta de recursos',
  OTHER: 'Otro motivo',
};

const slaStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  OK: { label: 'OK', color: 'text-success', bgColor: 'bg-success-muted' },
  AT_RISK: { label: 'En riesgo', color: 'text-warning-muted-foreground', bgColor: 'bg-warning-muted' },
  BREACHED: { label: 'Vencido', color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

const laneColorMap: Record<string, string> = {
  blue: 'border-l-info',
  yellow: 'border-l-warning',
  cyan: 'border-l-info',
  green: 'border-l-success',
  amber: 'border-l-warning',
  red: 'border-l-destructive',
  emerald: 'border-l-success',
};

const laneDotColorMap: Record<string, string> = {
  blue: 'bg-info',
  yellow: 'bg-warning',
  cyan: 'bg-info',
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-destructive',
  emerald: 'bg-success',
};

export function WorkOrdersDispatcherBoard({
  onSelectWorkOrder,
  className
}: WorkOrdersDispatcherBoardProps) {
  const queryClient = useQueryClient();
  const presetFilters = usePresetFilters();
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({
    finalizadas_hoy: true, // Collapsed by default
  });

  // Dialogs
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [waitingDialogOpen, setWaitingDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderCard | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatcher-board', presetFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('take', '200');

      const res = await fetch(`/api/work-orders/dispatcher?${params}`);
      if (!res.ok) throw new Error('Error al cargar dispatcher');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Mutation para iniciar OT
  const startMutation = useMutation({
    mutationFn: async (workOrderId: number) => {
      const res = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS', startedDate: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Error al iniciar OT');
      return res.json();
    },
    onSuccess: () => {
      toast.success('OT iniciada');
      queryClient.invalidateQueries({ queryKey: ['dispatcher-board'] });
    },
    onError: () => {
      toast.error('Error al iniciar OT');
    },
  });

  // Mutation para reanudar OT
  const resumeMutation = useMutation({
    mutationFn: async (workOrderId: number) => {
      const res = await fetch(`/api/work-orders/${workOrderId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Error al reanudar OT');
      return res.json();
    },
    onSuccess: () => {
      toast.success('OT reanudada');
      queryClient.invalidateQueries({ queryKey: ['dispatcher-board'] });
    },
    onError: () => {
      toast.error('Error al reanudar OT');
    },
  });

  // Filter items by preset and search
  const filterItems = (items: WorkOrderCard[] = []) => {
    return items.filter(wo => {
      // Preset filter
      if (presetFilters.type && wo.maintenanceType !== presetFilters.type) {
        return false;
      }

      // Search filter
      const matchesSearch = !searchTerm ||
        wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.failure?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.machine?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      // Priority filter
      const matchesPriority = priorityFilter === 'all' ||
        wo.priority === priorityFilter ||
        wo.failure?.priority === priorityFilter;

      return matchesSearch && matchesPriority;
    });
  };

  // Organize work orders into lanes
  const laneData = useMemo(() => {
    if (!data?.buckets) return {};

    const { buckets, summary } = data;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all items
    const entrantes = filterItems(buckets?.entrantes?.items || []);
    const aPlanificar = filterItems(buckets?.aPlanificar?.items || []);
    const inProgress = filterItems(buckets?.enEjecucion?.inProgress || []);
    const waiting = filterItems(buckets?.enEjecucion?.waiting || []);

    // Separate "listas" from "a_planificar" (those with scheduledDate)
    const listas = aPlanificar.filter(wo => wo.scheduledDate);
    const aPlanificarFiltered = aPlanificar.filter(wo => !wo.scheduledDate);

    // Separate blocked (ON_HOLD status) from waiting
    const bloqueadas = waiting.filter(wo => wo.status === 'ON_HOLD');
    const enEspera = waiting.filter(wo => wo.status !== 'ON_HOLD');

    // Completed today (if available in API response)
    const completedToday = filterItems(buckets?.completedToday?.items || []);

    return {
      entrantes,
      a_planificar: aPlanificarFiltered,
      listas,
      en_ejecucion: inProgress,
      en_espera: enEspera,
      bloqueadas,
      finalizadas_hoy: completedToday,
    };
  }, [data, searchTerm, priorityFilter, presetFilters]);

  const handleCardClick = (workOrderId: number) => {
    onSelectWorkOrder?.(workOrderId);
  };

  const handleAssign = (wo: WorkOrderCard) => {
    setSelectedWorkOrder(wo);
    setAssignDialogOpen(true);
  };

  const handleWaiting = (wo: WorkOrderCard) => {
    setSelectedWorkOrder(wo);
    setWaitingDialogOpen(true);
  };

  const handleStart = (wo: WorkOrderCard) => {
    if (!wo.assignedTo) {
      toast.error('Debe asignar un responsable antes de iniciar');
      return;
    }
    startMutation.mutate(wo.id);
  };

  const handleResume = (wo: WorkOrderCard) => {
    resumeMutation.mutate(wo.id);
  };

  const toggleLaneCollapse = (laneId: string) => {
    setCollapsedLanes(prev => ({
      ...prev,
      [laneId]: !prev[laneId]
    }));
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {LANES.map(lane => (
            <Card key={lane.id}>
              <CardHeader className="py-3">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[1, 2].map(j => (
                    <Skeleton key={j} className="h-24 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-destructive">Error al cargar el board</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  const { summary } = data || {};

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header con filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar OT, falla, máquina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64 h-9"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="URGENT">P1 - Urgente</SelectItem>
              <SelectItem value="HIGH">P2 - Alta</SelectItem>
              <SelectItem value="MEDIUM">P3 - Media</SelectItem>
              <SelectItem value="LOW">P4 - Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          {/* KPIs */}
          <div className="flex gap-2 text-sm">
            {summary?.slaBreached > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {summary.slaBreached} SLA vencidos
              </Badge>
            )}
            {summary?.slaAtRisk > 0 && (
              <Badge variant="outline" className="gap-1 border-warning-muted text-warning-muted-foreground">
                <Clock className="h-3 w-3" />
                {summary.slaAtRisk} en riesgo
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Board de columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {LANES.map(lane => {
          const items = laneData[lane.id as keyof typeof laneData] || [];
          const isCollapsed = collapsedLanes[lane.id];

          return (
            <Card
              key={lane.id}
              className={cn(
                'border-l-4 flex flex-col min-h-[200px]',
                laneColorMap[lane.color]
              )}
            >
              <CardHeader
                className="py-2 px-3 cursor-pointer hover:bg-muted/50"
                onClick={() => toggleLaneCollapse(lane.id)}
              >
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', laneDotColorMap[lane.color])} />
                  <span className="truncate">{lane.title}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {items.length}
                  </Badge>
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground truncate">{lane.description}</p>
              </CardHeader>

              {!isCollapsed && (
                <CardContent className="p-0 flex-1">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 p-2">
                      {items.length > 0 ? (
                        items.map((wo) => (
                          <DispatcherCard
                            key={wo.id}
                            workOrder={wo}
                            laneId={lane.id}
                            onClick={() => handleCardClick(wo.id)}
                            onAssign={() => handleAssign(wo)}
                            onStart={() => handleStart(wo)}
                            onWaiting={() => handleWaiting(wo)}
                            onResume={() => handleResume(wo)}
                          />
                        ))
                      ) : (
                        <EmptyLaneState />
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Dialogs */}
      <AssignAndPlanDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        workOrder={selectedWorkOrder ? {
          id: selectedWorkOrder.id,
          title: selectedWorkOrder.failure?.title || selectedWorkOrder.title,
          priority: selectedWorkOrder.priority,
          status: selectedWorkOrder.status,
          machine: selectedWorkOrder.machine,
          assignedTo: selectedWorkOrder.assignedTo,
        } : null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dispatcher-board'] });
        }}
      />

      {selectedWorkOrder && (
        <WaitingStateDialog
          workOrderId={selectedWorkOrder.id}
          open={waitingDialogOpen}
          onOpenChange={setWaitingDialogOpen}
        />
      )}
    </div>
  );
}

// Empty state for lanes
function EmptyLaneState() {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <CheckCircle2 className="h-6 w-6 text-muted-foreground/50 mb-1" />
      <p className="text-xs text-muted-foreground">Sin órdenes</p>
    </div>
  );
}

// Card component
interface DispatcherCardProps {
  workOrder: WorkOrderCard;
  laneId: string;
  onClick: () => void;
  onAssign?: () => void;
  onStart?: () => void;
  onWaiting?: () => void;
  onResume?: () => void;
}

function DispatcherCard({
  workOrder,
  laneId,
  onClick,
  onAssign,
  onStart,
  onWaiting,
  onResume,
}: DispatcherCardProps) {
  const priority = priorityConfig[workOrder.priority] || priorityConfig.MEDIUM;
  const slaConfig = workOrder.slaStatus ? slaStatusConfig[workOrder.slaStatus] : null;

  const failure = workOrder.failure || workOrder.failureOccurrences?.[0];
  const displayTitle = failure?.title || workOrder.title;

  const componentInfo = workOrder.failureOccurrences?.[0];
  const componentName = componentInfo?.component?.name;
  const subcomponentName = componentInfo?.subcomponent?.name;

  const showWaiting = laneId === 'en_espera' || laneId === 'bloqueadas';

  return (
    <div
      className={cn(
        'p-2 border rounded-lg transition-all hover:shadow-md cursor-pointer bg-card text-xs',
        workOrder.etaOverdue && 'border-destructive bg-destructive/5',
        workOrder.slaStatus === 'BREACHED' && !workOrder.etaOverdue && 'border-destructive/50',
        workOrder.slaStatus === 'AT_RISK' && !workOrder.etaOverdue && 'border-warning-muted',
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1 flex-wrap">
          <Badge className={cn('text-xs font-bold px-1 py-0', priority.bgColor, priority.color)}>
            {priority.label}
          </Badge>
          <span className="text-xs text-muted-foreground">#{workOrder.id}</span>
          {slaConfig && (
            <Badge variant="outline" className={cn('text-xs gap-0.5 px-1 py-0', slaConfig.bgColor, slaConfig.color)}>
              <Clock className="h-2.5 w-2.5" />
              {workOrder.slaHoursRemaining !== null && workOrder.slaHoursRemaining !== undefined
                ? workOrder.slaHoursRemaining > 0
                  ? `${workOrder.slaHoursRemaining}h`
                  : `${Math.abs(workOrder.slaHoursRemaining)}h`
                : slaConfig.label}
            </Badge>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
              <Eye className="h-3 w-3 mr-2" />
              Ver detalle
            </DropdownMenuItem>

            {(laneId === 'entrantes' || laneId === 'a_planificar') && onAssign && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAssign(); }}>
                <UserPlus className="h-3 w-3 mr-2" />
                Asignar
              </DropdownMenuItem>
            )}

            {(laneId === 'a_planificar' || laneId === 'listas') && onStart && workOrder.assignedTo && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStart(); }}>
                <Play className="h-3 w-3 mr-2" />
                Iniciar
              </DropdownMenuItem>
            )}

            {laneId === 'en_ejecucion' && onWaiting && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onWaiting(); }}>
                <Pause className="h-3 w-3 mr-2" />
                Poner en espera
              </DropdownMenuItem>
            )}

            {(laneId === 'en_espera' || laneId === 'bloqueadas') && onResume && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResume(); }}>
                <Play className="h-3 w-3 mr-2" />
                Reanudar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <p className="font-medium line-clamp-2 mb-1">
        {displayTitle}
      </p>

      {/* Machine */}
      {workOrder.machine && (
        <div className="flex items-center gap-1 text-muted-foreground mb-1">
          <Wrench className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="truncate">{workOrder.machine.name}</span>
        </div>
      )}

      {/* Assignee */}
      <div className="flex items-center gap-1 text-muted-foreground">
        <User className="h-2.5 w-2.5" />
        {workOrder.assignedTo?.name || (
          <span className="text-warning-muted-foreground font-medium">Sin asignar</span>
        )}
      </div>

      {/* Special badges */}
      {(failure?.causedDowntime || failure?.isSafetyRelated) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {failure?.causedDowntime && (
            <Badge variant="destructive" className="text-xs gap-0.5 px-1 py-0">
              <Zap className="h-2.5 w-2.5" />
              Parada
            </Badge>
          )}
          {failure?.isSafetyRelated && (
            <Badge variant="destructive" className="text-xs gap-0.5 px-1 py-0">
              <Shield className="h-2.5 w-2.5" />
              Seguridad
            </Badge>
          )}
        </div>
      )}

      {/* Waiting info */}
      {showWaiting && workOrder.waitingReason && (
        <div className={cn(
          'mt-1.5 p-1.5 rounded text-xs',
          workOrder.etaOverdue ? 'bg-destructive/10 text-destructive' : 'bg-warning-muted text-warning-muted-foreground'
        )}>
          <div className="flex items-center gap-1 font-medium">
            <Timer className="h-2.5 w-2.5" />
            {waitingReasonLabels[workOrder.waitingReason] || workOrder.waitingReason}
          </div>
          {workOrder.waitingETA && (
            <div className="mt-0.5">
              ETA: {format(new Date(workOrder.waitingETA), 'dd/MM HH:mm', { locale: es })}
              {workOrder.etaOverdue && (
                <span className="text-destructive font-bold ml-1">
                  ({workOrder.etaOverdueHours}h)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick action button */}
      {laneId === 'entrantes' && onAssign && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-2 h-6 text-xs"
          onClick={(e) => { e.stopPropagation(); onAssign(); }}
        >
          <UserPlus className="h-2.5 w-2.5 mr-1" />
          Asignar
        </Button>
      )}

      {(laneId === 'listas') && onStart && workOrder.assignedTo && (
        <Button
          size="sm"
          className="w-full mt-2 h-6 text-xs bg-success hover:bg-success/90"
          onClick={(e) => { e.stopPropagation(); onStart(); }}
        >
          <Play className="h-2.5 w-2.5 mr-1" />
          Iniciar
        </Button>
      )}
    </div>
  );
}

export default WorkOrdersDispatcherBoard;
