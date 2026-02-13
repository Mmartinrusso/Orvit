'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  CheckCircle2,
  Pause,
  Play,
  AlertTriangle,
  MessageSquare,
  ClipboardList,
  Bell,
  BellOff,
  Users,
  ExternalLink,
  MoreVertical,
  Pencil,
  Package,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { WaitingStateDialog } from './WaitingStateDialog';
import { ReturnToProductionDialog } from './ReturnToProductionDialog';
import { GuidedCloseDialog } from './GuidedCloseDialog';
import { WorkLogPanel } from './WorkLogPanel';
import { WorkOrderCommentsPanel } from '@/components/work-orders/WorkOrderCommentsPanel';
import { AssignAndPlanDialog } from '@/components/work-orders/AssignAndPlanDialog';

interface WorkOrderDetailSheetProps {
  workOrderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se abrió específicamente para una acción (close = completar, assign = asignar) */
  initialAction?: 'close' | 'assign' | null;
}

interface WorkOrderDetail {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  requiresReturnToProduction: boolean;
  returnToProductionConfirmed: boolean;
  waitingReason?: string;
  waitingDescription?: string;
  waitingETA?: string;
  createdAt: string;
  completedDate?: string;
  scheduledDate?: string;
  startedDate?: string;
  diagnosisNotes?: string;
  workPerformedNotes?: string;
  resultNotes?: string;
  rootCause?: string;
  solution?: string;
  machine?: {
    id: number;
    name: string;
  };
  component?: {
    id: number;
    name: string;
  };
  subcomponents?: Array<{
    id: number;
    name: string;
  }>;
  failureOccurrences: Array<{
    id: number;
    title: string;
    causedDowntime: boolean;
    subcomponents?: Array<{ id: number; name: string }>;
  }>;
  downtimeLogs: Array<{
    id: number;
    startedAt: string;
    endedAt?: string;
    totalMinutes?: number;
  }>;
  solutionsApplied?: Array<{
    id: number;
    diagnosis: string;
    solution: string;
    outcome: string;
    performedAt: string;
  }>;
  assignedTo?: {
    id: number;
    name: string;
  };
  watchers?: Array<{
    id: number;
    userId: number;
    user: { id: number; name: string };
    reason?: string;
  }>;
  _count?: {
    workLogs?: number;
    comments?: number;
  };
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  WAITING: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  PENDING: 'Pendiente',
  in_progress: 'En Progreso',
  IN_PROGRESS: 'En Progreso',
  waiting: 'En Espera',
  WAITING: 'En Espera',
  completed: 'Completada',
  COMPLETED: 'Completada',
  cancelled: 'Cancelada',
  CANCELLED: 'Cancelada',
};

const priorityLabels: Record<string, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

const outcomeLabels: Record<string, string> = {
  FUNCIONÓ: 'Funcionó Correctamente',
  PARCIAL: 'Funcionó Parcialmente',
  NO_FUNCIONÓ: 'No Resolvió el Problema',
};

const outcomeColors: Record<string, string> = {
  FUNCIONÓ: 'bg-green-100 text-green-800',
  PARCIAL: 'bg-yellow-100 text-yellow-800',
  NO_FUNCIONÓ: 'bg-red-100 text-red-800',
};

/**
 * Sheet de detalle de Work Order Correctiva
 *
 * Tabs:
 * - Resumen: Info + Acciones
 * - Cierre: GuidedCloseDialog
 * - Retorno: ReturnToProductionDialog (si causedDowntime)
 */
export function WorkOrderDetailSheet({
  workOrderId,
  open,
  onOpenChange,
  initialAction,
}: WorkOrderDetailSheetProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [waitingDialogOpen, setWaitingDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [initialActionHandled, setInitialActionHandled] = useState(false);

  // Get current user from cookie/session
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setCurrentUserId(data.userId || data.id);
        }
      } catch (e) {
        console.warn('Could not fetch current user');
      }
    };
    fetchCurrentUser();
  }, []);

  const { data: workOrder, isLoading } = useQuery<WorkOrderDetail>({
    queryKey: ['work-order', workOrderId],
    queryFn: async () => {
      if (!workOrderId) throw new Error('No work order ID');
      const res = await fetch(`/api/work-orders/${workOrderId}?include=watchers,counts,downtimeLogs,failureOccurrences`);
      if (!res.ok) throw new Error('Error al cargar orden');
      const json = await res.json();
      return json.data || json;
    },
    enabled: !!workOrderId && open,
  });

  // Check if current user is following
  useEffect(() => {
    if (workOrder?.watchers && currentUserId) {
      const isWatching = workOrder.watchers.some(w => w.userId === currentUserId);
      setIsFollowing(isWatching);
    }
  }, [workOrder?.watchers, currentUserId]);

  // Handle initial action (e.g., auto-open close dialog when clicking "Completar")
  useEffect(() => {
    if (!open) {
      // Reset when sheet closes
      setInitialActionHandled(false);
      return;
    }

    if (workOrder && initialAction && !initialActionHandled) {
      if (initialAction === 'close') {
        // Verificar si hay downtime abierto (bloquea el cierre)
        const hasOpenDowntime = workOrder.downtimeLogs?.some((log: any) => !log.endedAt);

        // Si requiere retorno a producción y no está confirmado, o hay downtime abierto
        if (workOrder.requiresReturnToProduction && (!workOrder.returnToProductionConfirmed || hasOpenDowntime)) {
          toast.error('Debe confirmar Retorno a Producción antes de cerrar la orden', {
            description: hasOpenDowntime
              ? 'Hay un registro de downtime abierto que debe cerrarse primero.'
              : 'La orden requiere confirmación de retorno a producción.',
            duration: 5000,
          });
          setActiveTab('downtime');
          setInitialActionHandled(true);
          return;
        }
        // Solo abrir si está en progreso o en espera
        const canClose = workOrder.status === 'in_progress' || workOrder.status === 'IN_PROGRESS' ||
                        workOrder.status === 'waiting' || workOrder.status === 'WAITING';
        if (canClose) {
          setCloseDialogOpen(true);
        }
      } else if (initialAction === 'assign') {
        setAssignDialogOpen(true);
      }
      setInitialActionHandled(true);
    }
  }, [open, workOrder, initialAction, initialActionHandled]);

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/watchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'MANUAL' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al seguir');
      }
      return res.json();
    },
    onSuccess: () => {
      setIsFollowing(true);
      toast.success('Ahora sigues esta OT');
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/watchers`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al dejar de seguir');
      }
      return res.json();
    },
    onSuccess: () => {
      setIsFollowing(false);
      toast.success('Ya no sigues esta OT');
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleToggleFollow = () => {
    if (isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  const openDowntime = workOrder?.downtimeLogs?.find((log: any) => !log.endedAt);
  const watcherCount = workOrder?.watchers?.length || 0;

  // Mutation para INICIAR OT (cambiar a IN_PROGRESS)
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          startedDate: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al iniciar');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('OT iniciada correctamente');
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation para REANUDAR OT (cambiar de waiting a in_progress)
  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al reanudar');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('OT reanudada correctamente');
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Check if OT can be started
  const canStart = workOrder &&
    (workOrder.status === 'pending' || workOrder.status === 'PENDING' || workOrder.status === 'SCHEDULED') &&
    workOrder.assignedTo;

  const needsAssignment = workOrder &&
    (workOrder.status === 'pending' || workOrder.status === 'PENDING' || workOrder.status === 'INCOMING') &&
    !workOrder.assignedTo;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:w-[700px] sm:max-w-4xl overflow-y-auto px-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-64" />
            </div>
          ) : workOrder ? (
            <>
              {/* Header */}
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle>OT #{workOrder.id}</SheetTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[workOrder.status] || 'bg-gray-100 text-gray-800'}>
                      {statusLabels[workOrder.status] || workOrder.status}
                    </Badge>
                    <Button
                      variant={isFollowing ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={handleToggleFollow}
                      disabled={followMutation.isPending || unfollowMutation.isPending}
                      className="h-8"
                    >
                      {isFollowing ? (
                        <>
                          <BellOff className="h-4 w-4 mr-1" />
                          Dejar de seguir
                        </>
                      ) : (
                        <>
                          <Bell className="h-4 w-4 mr-1" />
                          Seguir
                        </>
                      )}
                    </Button>
                    {/* Menú de acciones */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {needsAssignment && (
                          <DropdownMenuItem onClick={() => setAssignDialogOpen(true)}>
                            <Play className="mr-2 h-4 w-4" />
                            Asignar e Iniciar
                          </DropdownMenuItem>
                        )}
                        {canStart && (
                          <DropdownMenuItem onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                            <Play className="mr-2 h-4 w-4" />
                            Iniciar OT
                          </DropdownMenuItem>
                        )}
                        {(workOrder.status === 'in_progress' || workOrder.status === 'IN_PROGRESS') && (
                          <DropdownMenuItem onClick={() => setWaitingDialogOpen(true)}>
                            <Pause className="mr-2 h-4 w-4" />
                            Poner en Espera
                          </DropdownMenuItem>
                        )}
                        {(workOrder.status === 'waiting' || workOrder.status === 'WAITING') && (
                          <DropdownMenuItem onClick={() => resumeMutation.mutate()} disabled={resumeMutation.isPending}>
                            <Play className="mr-2 h-4 w-4" />
                            Reanudar Trabajo
                          </DropdownMenuItem>
                        )}
                        {(workOrder.status === 'in_progress' || workOrder.status === 'IN_PROGRESS' ||
                          workOrder.status === 'waiting' || workOrder.status === 'WAITING') && (
                          <DropdownMenuItem
                            onClick={() => setCloseDialogOpen(true)}
                            disabled={workOrder.requiresReturnToProduction && !workOrder.returnToProductionConfirmed}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Cerrar Orden
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            const params = new URLSearchParams({
                              workOrderId: String(workOrder.id),
                              workOrderTitle: encodeURIComponent(workOrder.title),
                            });
                            router.push(`/almacen/solicitudes/nueva?${params.toString()}`);
                            onOpenChange(false);
                          }}
                        >
                          <Package className="mr-2 h-4 w-4" />
                          Solicitar Material
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/mantenimiento/ordenes-trabajo/${workOrder.id}/editar`)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar OT
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <SheetDescription>{workOrder.title}</SheetDescription>
                  {watcherCount > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                            <Users className="h-3 w-3" />
                            {watcherCount} {watcherCount === 1 ? 'seguidor' : 'seguidores'}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="text-xs">
                            <p className="font-medium mb-1">Seguidores:</p>
                            {workOrder.watchers?.map((w) => (
                              <p key={w.id}>{w.user.name}</p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </SheetHeader>

              {/* Alerta de Retorno a Producción */}
              {workOrder.requiresReturnToProduction &&
                !workOrder.returnToProductionConfirmed && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Acción Requerida:</strong> Debe confirmar Retorno
                      a Producción antes de cerrar esta orden.
                    </AlertDescription>
                  </Alert>
                )}

              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2 -mx-6 px-6">
                <TabsList className="!w-full grid grid-cols-4 h-9">
                  <TabsTrigger value="summary">Resumen</TabsTrigger>
                  <TabsTrigger value="logs">Registros</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="downtime">
                    Paradas
                    {(workOrder.downtimeLogs?.length || 0) > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {workOrder.downtimeLogs?.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Resumen */}
                <TabsContent value="summary" className="space-y-4 mt-4">
                  {/* Descripción - estilo igual que Fallas */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                      <p className="text-sm">{workOrder.description || 'Sin descripción'}</p>
                    </div>
                  </div>

                  {/* Ubicación del equipo - estilo igual que Fallas */}
                  {(workOrder.machine || workOrder.component) && (
                    <div className="rounded-lg border p-3 space-y-2">
                      {workOrder.machine && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Máquina</p>
                          <p className="text-sm font-medium">{workOrder.machine.name}</p>
                        </div>
                      )}
                      {workOrder.component && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Componentes</p>
                          <p className="text-sm">{workOrder.component.name}</p>
                        </div>
                      )}
                      {/* Subcomponentes */}
                      {(workOrder.subcomponents?.length || workOrder.failureOccurrences?.some(f => f.subcomponents?.length)) && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Subcomponentes</p>
                          <p className="text-sm text-muted-foreground">
                            {workOrder.subcomponents?.length
                              ? workOrder.subcomponents.map(s => s.name).join(', ')
                              : workOrder.failureOccurrences
                                  ?.flatMap(f => f.subcomponents || [])
                                  .map(s => s.name)
                                  .filter((v, i, a) => a.indexOf(v) === i)
                                  .join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info Grid */}
                  <div className="rounded-lg border bg-card">
                    <div className="grid grid-cols-2">
                      <div className="p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Prioridad</p>
                        <p className="text-sm font-medium">{priorityLabels[workOrder.priority] || workOrder.priority}</p>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Estado</p>
                        <Badge className={`${statusColors[workOrder.status] || 'bg-gray-100'} text-xs`}>
                          {statusLabels[workOrder.status] || workOrder.status}
                        </Badge>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Asignado a</p>
                        <p className="text-sm font-medium">{workOrder.assignedTo?.name || 'Sin asignar'}</p>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Creada</p>
                        <p className="text-sm">
                          {format(new Date(workOrder.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                        </p>
                      </div>
                      {workOrder.completedDate && (
                        <div className="p-3 col-span-2 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Completada</p>
                          <p className="text-sm">
                            {format(new Date(workOrder.completedDate), "d MMM yyyy, HH:mm", { locale: es })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Diagnóstico, Solución y Resultado - Solo si OT está completada */}
                  {(workOrder.status === 'COMPLETED' || workOrder.status === 'completed') && (
                    <div className="space-y-3">
                      {workOrder.diagnosisNotes && (
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Diagnóstico</p>
                          <p className="text-sm whitespace-pre-wrap">{workOrder.diagnosisNotes}</p>
                        </div>
                      )}
                      {workOrder.workPerformedNotes && (
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Solución Aplicada</p>
                          <p className="text-sm whitespace-pre-wrap">{workOrder.workPerformedNotes}</p>
                        </div>
                      )}
                      {workOrder.resultNotes && (
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Resultado</p>
                          <Badge className={`${outcomeColors[workOrder.resultNotes] || 'bg-gray-100'} text-xs`}>
                            {outcomeLabels[workOrder.resultNotes] || workOrder.resultNotes}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Falla Asociada y Solución Asociada */}
                  {(workOrder.failureOccurrences?.length || 0) > 0 && (
                    <div className="space-y-3">
                      {/* Falla Asociada */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">Falla Asociada</h4>
                        {workOrder.failureOccurrences?.slice(0, 1).map((failure) => (
                          <div
                            key={failure.id}
                            className="rounded-lg border p-3 flex items-center justify-between hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => {
                              onOpenChange(false);
                              router.push(`/mantenimiento/fallas?failure=${failure.id}`);
                            }}
                          >
                            <div>
                              <p className="text-sm font-medium">{failure.title}</p>
                              <p className="text-xs text-muted-foreground">Falla #{failure.id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {failure.causedDowntime && (
                                <Badge variant="destructive">
                                  <Clock className="mr-1 h-3 w-3" />
                                  Parada
                                </Badge>
                              )}
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Solución Asociada - Navega a mantenimientos */}
                      {workOrder.solutionsApplied && workOrder.solutionsApplied.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Solución Asociada</h4>
                          {workOrder.solutionsApplied.slice(0, 1).map((solution) => (
                            <div
                              key={solution.id}
                              className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900/30 p-3 hover:bg-green-100/50 dark:hover:bg-green-900/30 cursor-pointer transition-colors"
                              onClick={() => {
                                onOpenChange(false);
                                router.push(`/mantenimiento/mantenimientos?correctiveId=${workOrder.id}`);
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-2 flex-1">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Diagnóstico:</p>
                                    <p className="text-sm">{solution.diagnosis}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Solución:</p>
                                    <p className="text-sm">{solution.solution}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-muted-foreground">Resultado:</p>
                                    <Badge className={`${outcomeColors[solution.outcome] || 'bg-gray-100'} text-xs`}>
                                      {outcomeLabels[solution.outcome] || solution.outcome}
                                    </Badge>
                                  </div>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Registros */}
                <TabsContent value="logs" className="space-y-4 mt-4">
                  <WorkLogPanel workOrderId={workOrder.id} />
                </TabsContent>

                {/* Tab: Chat */}
                <TabsContent value="chat" className="mt-4">
                  <div className="rounded-lg border overflow-hidden" style={{ height: '500px' }}>
                    <WorkOrderCommentsPanel
                      workOrderId={workOrder.id}
                      isOpen={activeTab === 'chat'}
                    />
                  </div>
                </TabsContent>

                {/* Tab: Paradas */}
                <TabsContent value="downtime" className="space-y-3 mt-4">
                  {(!workOrder.downtimeLogs || workOrder.downtimeLogs.length === 0) ? (
                    <div className="text-center py-8 border rounded-lg bg-muted/20">
                      <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Esta orden no tiene paradas registradas
                      </p>
                    </div>
                  ) : (
                    <>
                      {workOrder.downtimeLogs?.map((log) => {
                        const isOpen = !log.endedAt;
                        return (
                          <div key={log.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <Badge
                                variant={isOpen ? 'destructive' : 'secondary'}
                              >
                                {isOpen ? 'Abierto' : 'Cerrado'}
                              </Badge>
                              {log.totalMinutes && (
                                <span className="text-sm font-medium">
                                  {log.totalMinutes} min
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>
                                Inicio:{' '}
                                {format(new Date(log.startedAt), 'Pp', {
                                  locale: es,
                                })}
                              </p>
                              {log.endedAt && (
                                <p>
                                  Fin:{' '}
                                  {format(new Date(log.endedAt), 'Pp', {
                                    locale: es,
                                  })}
                                </p>
                              )}
                            </div>
                            {/* Botón de cerrar downtime - dentro de cada tarjeta abierta */}
                            {isOpen && (
                              <Button
                                className="w-full mt-3 bg-green-600 hover:bg-green-700"
                                onClick={() => setReturnDialogOpen(true)}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Confirmar Retorno a Producción
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Botón de Retorno a Producción - si no hay downtimes pero se requiere confirmación */}
                  {(!workOrder.downtimeLogs || workOrder.downtimeLogs.length === 0) &&
                    workOrder.requiresReturnToProduction &&
                    !workOrder.returnToProductionConfirmed && (
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => setReturnDialogOpen(true)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirmar Retorno a Producción
                      </Button>
                    )}
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Orden no encontrada
            </p>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      {workOrderId && (
        <>
          <WaitingStateDialog
            workOrderId={workOrderId}
            open={waitingDialogOpen}
            onOpenChange={setWaitingDialogOpen}
          />

          {/* ReturnToProductionDialog - disponible si hay downtime abierto o se requiere confirmación */}
          {(openDowntime || (workOrder?.requiresReturnToProduction && !workOrder?.returnToProductionConfirmed)) && (
            <ReturnToProductionDialog
              downtimeLogId={openDowntime?.id || null}
              workOrderId={workOrderId}
              open={returnDialogOpen}
              onOpenChange={setReturnDialogOpen}
            />
          )}

          <GuidedCloseDialog
            workOrderId={workOrderId}
            requiresReturnToProduction={
              workOrder?.requiresReturnToProduction || false
            }
            returnToProductionConfirmed={
              workOrder?.returnToProductionConfirmed || false
            }
            open={closeDialogOpen}
            onOpenChange={setCloseDialogOpen}
          />

          <AssignAndPlanDialog
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            workOrder={workOrder ? {
              id: workOrder.id,
              title: workOrder.title,
              priority: workOrder.priority,
              status: workOrder.status,
              assignedTo: workOrder.assignedTo,
            } : null}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
              queryClient.invalidateQueries({ queryKey: ['work-orders'] });
            }}
          />
        </>
      )}
    </>
  );
}
