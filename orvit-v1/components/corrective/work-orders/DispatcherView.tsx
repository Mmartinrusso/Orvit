'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { WaitingStateDialog } from './WaitingStateDialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DispatcherViewProps {
  onSelectWorkOrder?: (workOrderId: number) => void;
  machineId?: number;
  className?: string;
}

interface WorkOrderCard {
  id: number;
  title: string;
  priority: string;
  status: string;
  waitingReason?: string;
  waitingETA?: string;
  waitingDescription?: string;
  etaOverdue?: boolean;
  etaOverdueHours?: number;
  slaDueAt?: string;
  slaStatus?: string;
  slaOverdue?: boolean;
  slaHoursRemaining?: number;
  scheduledDate?: string;
  assignedAt?: string;
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
}

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

export function DispatcherView({
  onSelectWorkOrder,
  machineId,
  className
}: DispatcherViewProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'inProgress' | 'waiting'>('inProgress');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Dialogs
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [waitingDialogOpen, setWaitingDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderCard | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatcher', machineId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (machineId) params.set('machineId', String(machineId));
      params.set('take', '100');

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
      queryClient.invalidateQueries({ queryKey: ['dispatcher'] });
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
      queryClient.invalidateQueries({ queryKey: ['dispatcher'] });
    },
    onError: () => {
      toast.error('Error al reanudar OT');
    },
  });

  // Filtrar items
  const filterItems = (items: WorkOrderCard[] = []) => {
    return items.filter(wo => {
      const matchesSearch = !searchTerm ||
        wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.failure?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.machine?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPriority = priorityFilter === 'all' ||
        wo.priority === priorityFilter ||
        wo.failure?.priority === priorityFilter;

      return matchesSearch && matchesPriority;
    });
  };

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

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map(j => (
                    <Skeleton key={j} className="h-28 w-full" />
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
          <p className="text-destructive">Error al cargar dispatcher</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  const { buckets, summary } = data || {};

  const filteredEntrantes = filterItems(buckets?.entrantes?.items);
  const filteredAPlanificar = filterItems(buckets?.aPlanificar?.items);
  const filteredInProgress = filterItems(buckets?.enEjecucion?.inProgress);
  const filteredWaiting = filterItems(buckets?.enEjecucion?.waiting);

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
              className="pl-9 w-64"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36">
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
          <div className="flex gap-3 text-sm">
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
            {summary?.totalOverdueETA > 0 && (
              <Badge variant="outline" className="gap-1 border-destructive text-destructive">
                <Timer className="h-3 w-3" />
                {summary.totalOverdueETA} ETAs vencidas
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Resumen compacto */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Entrantes</p>
          <p className="text-2xl font-bold">{summary?.totalEntrantes || 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">A Planificar</p>
          <p className="text-2xl font-bold">{summary?.totalAPlanificar || 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">En Ejecución</p>
          <p className="text-2xl font-bold">{(summary?.totalEnEjecucion || 0) - (summary?.totalWaiting || 0)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Bloqueadas</p>
          <p className="text-2xl font-bold text-warning-muted-foreground">{summary?.totalWaiting || 0}</p>
        </div>
      </div>

      {/* Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bucket 1: Entrantes */}
        <Card className="border-l-4 border-l-info">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-info" />
              Entrantes
              <Badge variant="secondary" className="ml-auto">
                {filteredEntrantes.length}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Sin asignar o recién creadas</p>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[450px]">
              <div className="space-y-2 p-4 pt-0">
                {filteredEntrantes.length > 0 ? (
                  filteredEntrantes.map((wo) => (
                    <WorkOrderCardItem
                      key={wo.id}
                      workOrder={wo}
                      onClick={() => handleCardClick(wo.id)}
                      onAssign={() => handleAssign(wo)}
                      onStart={() => handleStart(wo)}
                      bucket="entrantes"
                    />
                  ))
                ) : (
                  <EmptyBucketState message="Sin órdenes entrantes" />
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Bucket 2: A Planificar */}
        <Card className="border-l-4 border-l-warning">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-warning" />
              A Planificar
              <Badge variant="secondary" className="ml-auto">
                {filteredAPlanificar.length}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Asignadas, pendientes de inicio</p>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[450px]">
              <div className="space-y-2 p-4 pt-0">
                {filteredAPlanificar.length > 0 ? (
                  filteredAPlanificar.map((wo) => (
                    <WorkOrderCardItem
                      key={wo.id}
                      workOrder={wo}
                      onClick={() => handleCardClick(wo.id)}
                      onAssign={() => handleAssign(wo)}
                      onStart={() => handleStart(wo)}
                      bucket="aPlanificar"
                    />
                  ))
                ) : (
                  <EmptyBucketState message="Sin órdenes a planificar" />
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Bucket 3: En Ejecución / Bloqueadas */}
        <Card className="border-l-4 border-l-success">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              En Ejecución
              <Badge variant="secondary" className="ml-auto">
                {filteredInProgress.length + filteredWaiting.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="w-full mx-4 mb-2" style={{ width: 'calc(100% - 2rem)' }}>
                <TabsTrigger value="inProgress" className="flex-1 text-xs">
                  <Play className="h-3 w-3 mr-1" />
                  Activas ({filteredInProgress.length})
                </TabsTrigger>
                <TabsTrigger value="waiting" className="flex-1 text-xs">
                  <Pause className="h-3 w-3 mr-1" />
                  Bloqueadas ({filteredWaiting.length})
                  {buckets?.enEjecucion?.waitingWithOverdueETA > 0 && (
                    <AlertTriangle className="h-3 w-3 ml-1 text-destructive" />
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inProgress" className="mt-0">
                <ScrollArea className="h-[380px]">
                  <div className="space-y-2 p-4 pt-0">
                    {filteredInProgress.length > 0 ? (
                      filteredInProgress.map((wo) => (
                        <WorkOrderCardItem
                          key={wo.id}
                          workOrder={wo}
                          onClick={() => handleCardClick(wo.id)}
                          onWaiting={() => handleWaiting(wo)}
                          bucket="inProgress"
                        />
                      ))
                    ) : (
                      <EmptyBucketState message="Sin órdenes en ejecución" />
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="waiting" className="mt-0">
                <ScrollArea className="h-[380px]">
                  <div className="space-y-2 p-4 pt-0">
                    {filteredWaiting.length > 0 ? (
                      filteredWaiting.map((wo) => (
                        <WorkOrderCardItem
                          key={wo.id}
                          workOrder={wo}
                          showWaiting
                          onClick={() => handleCardClick(wo.id)}
                          onResume={() => handleResume(wo)}
                          bucket="waiting"
                        />
                      ))
                    ) : (
                      <EmptyBucketState message="Sin órdenes bloqueadas" />
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
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
          queryClient.invalidateQueries({ queryKey: ['dispatcher'] });
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

// Empty state component
function EmptyBucketState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <CheckCircle2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// Card component mejorado
function WorkOrderCardItem({
  workOrder,
  showWaiting = false,
  onClick,
  onAssign,
  onStart,
  onWaiting,
  onResume,
  bucket,
}: {
  workOrder: WorkOrderCard;
  showWaiting?: boolean;
  onClick: () => void;
  onAssign?: () => void;
  onStart?: () => void;
  onWaiting?: () => void;
  onResume?: () => void;
  bucket: 'entrantes' | 'aPlanificar' | 'inProgress' | 'waiting';
}) {
  const priority = priorityConfig[workOrder.priority] || priorityConfig.MEDIUM;
  const slaConfig = workOrder.slaStatus ? slaStatusConfig[workOrder.slaStatus] : null;

  // Obtener info de la falla
  const failure = workOrder.failure || workOrder.failureOccurrences?.[0];
  const displayTitle = failure?.title || workOrder.title;

  // Obtener componente/subcomponente
  const componentInfo = workOrder.failureOccurrences?.[0];
  const componentName = componentInfo?.component?.name;
  const subcomponentName = componentInfo?.subcomponent?.name;

  return (
    <div
      className={cn(
        'p-3 border rounded-lg transition-all hover:shadow-md cursor-pointer bg-card',
        workOrder.etaOverdue && 'border-destructive bg-destructive/5',
        workOrder.slaStatus === 'BREACHED' && !workOrder.etaOverdue && 'border-destructive/50',
        workOrder.slaStatus === 'AT_RISK' && !workOrder.etaOverdue && 'border-warning-muted',
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn('text-xs font-bold', priority.bgColor, priority.color)}>
            {priority.label}
          </Badge>
          <span className="text-xs text-muted-foreground">#{workOrder.id}</span>
          {slaConfig && (
            <Badge variant="outline" className={cn('text-xs gap-1', slaConfig.bgColor, slaConfig.color)}>
              <Clock className="h-3 w-3" />
              {workOrder.slaHoursRemaining !== null && workOrder.slaHoursRemaining !== undefined
                ? workOrder.slaHoursRemaining > 0
                  ? `${workOrder.slaHoursRemaining}h`
                  : `${Math.abs(workOrder.slaHoursRemaining)}h vencido`
                : slaConfig.label}
            </Badge>
          )}
        </div>

        {/* Quick actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
              <Eye className="h-4 w-4 mr-2" />
              Ver detalle
            </DropdownMenuItem>

            {(bucket === 'entrantes' || bucket === 'aPlanificar') && onAssign && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAssign(); }}>
                <UserPlus className="h-4 w-4 mr-2" />
                Asignar y Planificar
              </DropdownMenuItem>
            )}

            {bucket === 'aPlanificar' && onStart && workOrder.assignedTo && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStart(); }}>
                <Play className="h-4 w-4 mr-2" />
                Iniciar
              </DropdownMenuItem>
            )}

            {bucket === 'inProgress' && onWaiting && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onWaiting(); }}>
                <Pause className="h-4 w-4 mr-2" />
                Poner en espera
              </DropdownMenuItem>
            )}

            {bucket === 'waiting' && onResume && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResume(); }}>
                <Play className="h-4 w-4 mr-2" />
                Reanudar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Título */}
      <p className="text-sm font-medium line-clamp-2 mb-2">
        {displayTitle}
      </p>

      {/* Info de máquina + componentes */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground mb-2">
        {workOrder.machine && (
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{workOrder.machine.name}</span>
          </span>
        )}
        {(componentName || subcomponentName) && (
          <span className="flex items-center gap-1 pl-4">
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {[componentName, subcomponentName].filter(Boolean).join(' > ')}
            </span>
          </span>
        )}
      </div>

      {/* Responsable + Fecha */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {workOrder.assignedTo?.name || (
            <span className="text-warning-muted-foreground font-medium">Sin asignar</span>
          )}
        </span>
        {workOrder.scheduledDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(workOrder.scheduledDate), 'dd/MM', { locale: es })}
          </span>
        )}
      </div>

      {/* Badges especiales */}
      <div className="flex flex-wrap gap-1 mt-2">
        {failure?.causedDowntime && (
          <Badge variant="destructive" className="text-xs gap-1 h-5">
            <Zap className="h-3 w-3" />
            Parada
          </Badge>
        )}
        {failure?.isSafetyRelated && (
          <Badge variant="destructive" className="text-xs gap-1 h-5">
            <Shield className="h-3 w-3" />
            Seguridad
          </Badge>
        )}
        {failure?.isObservation && (
          <Badge variant="outline" className="text-xs gap-1 h-5">
            <Eye className="h-3 w-3" />
            Observación
          </Badge>
        )}
        {workOrder.qualityAssurance?.isRequired && (
          <Badge variant="outline" className="text-xs h-5">
            QA: {workOrder.qualityAssurance.status}
          </Badge>
        )}
      </div>

      {/* Waiting info */}
      {showWaiting && workOrder.waitingReason && (
        <div className={cn(
          'mt-2 p-2 rounded text-xs',
          workOrder.etaOverdue ? 'bg-destructive/10 text-destructive' : 'bg-warning-muted text-warning-muted-foreground'
        )}>
          <div className="flex items-center gap-1 font-medium">
            <Timer className="h-3 w-3" />
            {waitingReasonLabels[workOrder.waitingReason] || workOrder.waitingReason}
          </div>
          {workOrder.waitingDescription && (
            <p className="mt-1 line-clamp-2">{workOrder.waitingDescription}</p>
          )}
          {workOrder.waitingETA && (
            <div className="mt-1 font-medium">
              ETA: {format(new Date(workOrder.waitingETA), 'dd/MM HH:mm', { locale: es })}
              {workOrder.etaOverdue && (
                <span className="ml-1 text-destructive font-bold">
                  ({workOrder.etaOverdueHours}h vencida)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick action button para entrantes */}
      {bucket === 'entrantes' && onAssign && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-3 h-8 text-xs"
          onClick={(e) => { e.stopPropagation(); onAssign(); }}
        >
          <UserPlus className="h-3 w-3 mr-1" />
          Asignar y Planificar
        </Button>
      )}

      {/* Quick action button para planificadas */}
      {bucket === 'aPlanificar' && onStart && workOrder.assignedTo && (
        <Button
          size="sm"
          className="w-full mt-3 h-8 text-xs bg-success hover:bg-success/90"
          onClick={(e) => { e.stopPropagation(); onStart(); }}
        >
          <Play className="h-3 w-3 mr-1" />
          Iniciar
        </Button>
      )}
    </div>
  );
}

export default DispatcherView;
