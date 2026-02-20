'use client';

import { useState, useRef, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Clock,
  AlertTriangle,
  FileText,
  ExternalLink,
  Send,
  Loader2,
  CheckCircle2,
  ImageIcon,
  Bell,
  BellOff,
  RotateCcw,
  MessageSquare,
  Info,
  RefreshCw,
  Users,
  MoreVertical,
  Pencil,
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
import { formatDistanceToNow, format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ReturnToProductionDialog } from './ReturnToProductionDialog';
import { ImmediateCloseDialog } from './ImmediateCloseDialog';
import { RecurrencePanel } from './RecurrencePanel';
import { ReopenFailureDialog } from './ReopenFailureDialog';

interface Comment {
  id: number;
  content: string;
  type?: string;
  createdAt: string;
  author?: {
    id: number;
    name: string;
    email?: string;
  };
}

interface FailureDetailSheetProps {
  failureId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tab to open by default (info, recurrence, duplicates, downtime, solutions, comments) */
  initialTab?: string;
}

interface FailureDetail {
  id: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  causedDowntime: boolean;
  isIntermittent: boolean;
  isObservation: boolean;
  isSafetyRelated?: boolean;
  reportedAt: string;
  resolvedAt?: string;
  // Síntomas expandidos
  symptomsList?: Array<{ id: number; label: string }>;
  // Fotos adjuntas
  photos?: Array<{ url: string; uploadedAt?: string }>;
  machine?: {
    id: number;
    name: string;
  };
  component?: {
    id: number;
    name: string;
  };
  subcomponent?: {
    id: number;
    name: string;
  };
  // Múltiples componentes/subcomponentes
  components?: Array<{ id: number; name: string }>;
  subcomponents?: Array<{ id: number; name: string }>;
  reportedBy?: {
    id: number;
    name: string;
  };
  workOrders?: Array<{
    id: number;
    status: string;
    title: string;
  }>;
  downtimeLogs?: Array<{
    id: number;
    startedAt: string;
    endedAt?: string | null;
    totalMinutes?: number;
    workOrderId?: number | null;
    machine?: {
      id: number;
      name: string;
    };
  }>;
  linkedDuplicates?: Array<{
    id: number;
    reportedAt: string;
    reportedBy?: { id?: number; name: string };
  }>;
  solutionsApplied?: Array<{
    id: number;
    diagnosis: string;
    solution: string;
    performedAt: string;
    performedBy?: { id?: number; name: string };
    workOrderId?: number;
  }>;
}

const priorityColors: Record<string, string> = {
  P1: 'bg-destructive',
  P2: 'bg-warning',
  P3: 'bg-warning',
  P4: 'bg-info',
  URGENT: 'bg-destructive',
  HIGH: 'bg-warning',
  MEDIUM: 'bg-warning',
  LOW: 'bg-info',
};

const statusLabels: Record<string, string> = {
  REPORTED: 'Reportada',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Solucionada',
  RESOLVED_IMMEDIATE: 'Solucionada',
  CLOSED: 'Cerrada',
};

const statusColors: Record<string, string> = {
  REPORTED: 'bg-warning-muted text-warning-muted-foreground',
  IN_PROGRESS: 'bg-info-muted text-info-muted-foreground',
  RESOLVED: 'bg-success-muted text-success',
  RESOLVED_IMMEDIATE: 'bg-success-muted text-success',
  CLOSED: 'bg-muted text-foreground',
};

const commentTypeConfig: Record<string, { label: string; icon: typeof MessageSquare; badgeClass: string }> = {
  comment: {
    label: 'Comentario',
    icon: MessageSquare,
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
  update: {
    label: 'Actualización',
    icon: Info,
    badgeClass: 'bg-success-muted text-success border-success-muted',
  },
  issue: {
    label: 'Problema',
    icon: AlertTriangle,
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  system: {
    label: 'Sistema',
    icon: Info,
    badgeClass: 'bg-info-muted text-info-muted-foreground border-info-muted',
  },
};

/**
 * Sheet de detalle de falla con tabs
 */
export function FailureDetailSheet({
  failureId,
  open,
  onOpenChange,
  initialTab,
}: FailureDetailSheetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [chatMessage, setChatMessage] = useState('');
  const [commentType, setCommentType] = useState<'comment' | 'update' | 'issue'>('comment');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [immediateCloseOpen, setImmediateCloseOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || 'info');

  // Update active tab when initialTab changes (e.g., from URL)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [selectedDowntimeLog, setSelectedDowntimeLog] = useState<{
    id: number;
    startedAt: string;
    endedAt?: string | null;
    workOrderId?: number | null;
    machine?: { id: number; name: string };
  } | null>(null);

  const { data: failure, isLoading } = useQuery<FailureDetail>({
    queryKey: ['failure-detail', failureId],
    queryFn: async () => {
      if (!failureId) throw new Error('No failure ID');
      const res = await fetch(`/api/failure-occurrences/${failureId}`);
      if (!res.ok) throw new Error('Error al cargar falla');
      const json = await res.json();
      return json.data || json;
    },
    enabled: !!failureId && open,
  });

  // Query para comentarios
  const { data: commentsData, isLoading: isLoadingComments } = useQuery<{
    data: Comment[];
    count: number;
  }>({
    queryKey: ['failure-comments', failureId],
    queryFn: async () => {
      if (!failureId) throw new Error('No failure ID');
      const res = await fetch(`/api/failure-occurrences/${failureId}/comments`);
      if (!res.ok) throw new Error('Error al cargar comentarios');
      return res.json();
    },
    enabled: !!failureId && open,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  const comments = commentsData?.data || [];

  // Query para watchers
  const { data: watchersData } = useQuery<{
    isWatching: boolean;
    count: number;
    watchers: Array<{ id: number; user: { id: number; name: string } }>;
  }>({
    queryKey: ['failure-watchers', failureId],
    queryFn: async () => {
      if (!failureId) throw new Error('No failure ID');
      const res = await fetch(`/api/failure-occurrences/${failureId}/watchers`);
      if (!res.ok) throw new Error('Error al cargar watchers');
      return res.json();
    },
    enabled: !!failureId && open,
  });

  const isWatching = watchersData?.isWatching ?? false;
  const watchersList = watchersData?.watchers ?? [];

  // Mutation para watch/unwatch
  const watchMutation = useMutation({
    mutationFn: async (action: 'watch' | 'unwatch') => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/watchers`, {
        method: action === 'watch' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error');
      }
      return res.json();
    },
    onSuccess: (_, action) => {
      toast.success(action === 'watch' ? 'Siguiendo falla' : 'Dejaste de seguir');
      queryClient.invalidateQueries({ queryKey: ['failure-watchers', failureId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation para enviar comentario
  const sendCommentMutation = useMutation({
    mutationFn: async ({ content, type }: { content: string; type: 'comment' | 'update' | 'issue' }) => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al enviar comentario');
      }
      return res.json();
    },
    onSuccess: () => {
      setChatMessage('');
      setCommentType('comment');
      queryClient.invalidateQueries({ queryKey: ['failure-comments', failureId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Scroll al fondo cuando hay nuevos comentarios
  useEffect(() => {
    if (chatScrollRef.current && comments.length > 0) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const handleSendComment = () => {
    if (!chatMessage.trim()) return;
    sendCommentMutation.mutate({ content: chatMessage.trim(), type: commentType });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  // Obtener iniciales del nombre
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Navegar a la orden de trabajo existente
  const handleGoToWorkOrder = (woId: number) => {
    onOpenChange(false);
    router.push(`/mantenimiento/ordenes?workOrderId=${woId}`);
  };

  // Navegar al mantenimiento correctivo (para soluciones)
  const handleGoToMaintenance = (woId: number) => {
    onOpenChange(false);
    router.push(`/mantenimiento/mantenimientos?correctiveId=${woId}`);
  };

  // Navegar a crear nueva OT (si no existe)
  const handleCreateWorkOrder = () => {
    onOpenChange(false);
    router.push(`/mantenimiento/ordenes?newFromFailure=${failureId}`);
  };

  const hasWorkOrder = (failure?.workOrders?.length ?? 0) > 0;

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="lg" className="overflow-y-auto px-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-64" />
            </div>
          ) : failure ? (
            <>
              {/* Header */}
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2">
                    <div
                      className={cn('h-3 w-3 rounded-full', priorityColors[failure.priority] || 'bg-muted-foreground')}
                    />
                    {failure.title || 'Sin título'}
                  </SheetTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[failure.status] || 'bg-muted text-foreground'}>
                      {statusLabels[failure.status] || failure.status}
                    </Badge>
                    <Button
                      variant={isWatching ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => watchMutation.mutate(isWatching ? 'unwatch' : 'watch')}
                      disabled={watchMutation.isPending}
                      className="h-8"
                    >
                      {watchMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isWatching ? (
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
                        <DropdownMenuItem onClick={() => router.push(`/mantenimiento/fallas/${failure.id}/editar`)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar Falla
                        </DropdownMenuItem>
                        {(failure.status === 'RESOLVED' || failure.status === 'RESOLVED_IMMEDIATE') && (
                          <DropdownMenuItem onClick={() => setReopenDialogOpen(true)}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reabrir Falla
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <SheetDescription className="flex flex-wrap gap-2">
                    Falla #{failure.id}
                    {failure.causedDowntime && (
                      <Badge variant="destructive" className="ml-2">
                        <Clock className="mr-1 h-3 w-3" />
                        Parada
                      </Badge>
                    )}
                    {failure.isIntermittent && (
                      <Badge variant="outline" className="ml-1">Intermitente</Badge>
                    )}
                    {failure.isObservation && (
                      <Badge variant="secondary" className="ml-1">Observación</Badge>
                    )}
                    {failure.isSafetyRelated && (
                      <Badge variant="destructive" className="ml-1">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Seguridad
                      </Badge>
                    )}
                  </SheetDescription>
                  {(watchersData?.count ?? 0) > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                            <Users className="h-3 w-3" />
                            {watchersData?.count} {watchersData?.count === 1 ? 'seguidor' : 'seguidores'}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="text-xs">
                            <p className="font-medium mb-1">Seguidores:</p>
                            {watchersList.map((w) => (
                              <p key={w.id}>{w.user.name}</p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </SheetHeader>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2 -mx-6 px-6">
                <TabsList className="w-full justify-start overflow-x-auto h-9">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="recurrence">Reincidencia</TabsTrigger>
                  <TabsTrigger value="duplicates">
                    Duplicados
                    {(failure.linkedDuplicates?.length ?? 0) > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1">
                        {failure.linkedDuplicates?.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="downtime">
                    Paradas
                    {(failure.downtimeLogs?.filter(d => !d.endedAt).length ?? 0) > 0 && (
                      <span className="ml-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="solutions">Soluciones</TabsTrigger>
                  <TabsTrigger value="comments">Chat</TabsTrigger>
                </TabsList>

                {/* Tab: Información */}
                <TabsContent value="info" className="space-y-3 mt-4">
                  <div className="rounded-lg border p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                      <p className="text-sm">{failure.description || 'Sin descripción'}</p>
                    </div>

                    {/* Síntomas */}
                    {failure.symptomsList && failure.symptomsList.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Síntomas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {failure.symptomsList.map((symptom) => (
                            <Badge
                              key={symptom.id}
                              variant="secondary"
                              className="bg-info-muted text-info-muted-foreground hover:bg-info-muted"
                            >
                              {symptom.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fotos adjuntas */}
                    {failure.photos && failure.photos.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Fotos ({failure.photos.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {failure.photos.map((photo, idx) => (
                            <a
                              key={idx}
                              href={photo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                            >
                              <img
                                src={photo.url}
                                alt={`Foto ${idx + 1}`}
                                className="h-20 w-20 object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ubicación del equipo */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Máquina</p>
                      <p className="text-sm font-medium">{failure.machine?.name || '-'}</p>
                    </div>
                    {/* Componentes */}
                    {(failure.components?.length || failure.component) && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Componentes</p>
                        <p className="text-sm">
                          {failure.components?.length
                            ? failure.components.map(c => c.name).join(', ')
                            : failure.component?.name}
                        </p>
                      </div>
                    )}
                    {/* Subcomponentes */}
                    {(failure.subcomponents?.length || failure.subcomponent) && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Subcomponentes</p>
                        <p className="text-sm text-muted-foreground">
                          {failure.subcomponents?.length
                            ? failure.subcomponents.map(s => s.name).join(', ')
                            : failure.subcomponent?.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Info adicional */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">Reportada por</p>
                      <p className="text-sm font-medium">{failure.reportedBy?.name || '-'}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">Fecha</p>
                      <p className="text-sm font-medium">
                        {format(new Date(failure.reportedAt), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>

                  {/* Work Orders asociadas */}
                  {hasWorkOrder && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Órdenes de Trabajo ({failure.workOrders?.length})
                      </p>
                      <div className="space-y-2">
                        {failure.workOrders?.map((wo) => {
                          const statusLabels: Record<string, string> = {
                            PENDING: 'Pendiente',
                            IN_PROGRESS: 'En Progreso',
                            COMPLETED: 'Completada',
                            CANCELLED: 'Cancelada',
                            ON_HOLD: 'En Espera',
                          };
                          const statusLabel = statusLabels[wo.status] || wo.status;

                          return (
                            <div
                              key={wo.id}
                              className="rounded-lg border p-3 flex items-center justify-between hover:bg-accent/50 cursor-pointer transition-colors"
                              onClick={() => handleGoToWorkOrder(wo.id)}
                            >
                              <div>
                                <p className="text-sm font-medium">{wo.title}</p>
                                <p className="text-xs text-muted-foreground">OT #{wo.id}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={wo.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                  {statusLabel}
                                </Badge>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Reincidencia */}
                <TabsContent value="recurrence" className="mt-4">
                  {failureId && <RecurrencePanel failureId={failureId} />}
                </TabsContent>

                {/* Tab: Duplicados */}
                <TabsContent value="duplicates" className="space-y-3 mt-4">
                  {(failure.linkedDuplicates?.length ?? 0) === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                      <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No hay reportes duplicados vinculados
                      </p>
                    </div>
                  ) : (
                    failure.linkedDuplicates?.map((dup, idx) => (
                      <div key={dup.id} className="rounded-lg border bg-muted/20 p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Reporte #{idx + 1}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Por {dup.reportedBy?.name || 'Usuario'} •{' '}
                              {format(
                                new Date(dup.reportedAt),
                                "d 'de' MMMM, HH:mm",
                                { locale: es }
                              )}
                            </p>
                          </div>
                          <Badge variant="outline">Duplicado</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* Tab: Paradas */}
                <TabsContent value="downtime" className="space-y-3 mt-4">
                  {(failure.downtimeLogs?.length ?? 0) === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                      <Clock className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Esta falla no causó paradas de producción
                      </p>
                    </div>
                  ) : (
                    failure.downtimeLogs?.map((log) => {
                      const isActive = !log.endedAt;
                      const activeMinutes = isActive
                        ? differenceInMinutes(new Date(), new Date(log.startedAt))
                        : log.totalMinutes || 0;
                      const hours = Math.floor(activeMinutes / 60);
                      const mins = activeMinutes % 60;
                      const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

                      return (
                        <div
                          key={log.id}
                          className={cn('rounded-lg border p-4', isActive ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/20')}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <Badge
                              variant={isActive ? 'destructive' : 'secondary'}
                              className={isActive ? 'animate-pulse' : ''}
                            >
                              {isActive ? (
                                <>
                                  <Clock className="mr-1 h-3 w-3" />
                                  Planta Parada
                                </>
                              ) : (
                                'Finalizada'
                              )}
                            </Badge>
                            <span className={cn('text-lg font-bold', isActive ? 'text-destructive' : 'text-muted-foreground')}>
                              {timeDisplay}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Inicio</p>
                              <p className="font-medium">
                                {format(new Date(log.startedAt), 'Pp', { locale: es })}
                              </p>
                            </div>
                            {log.endedAt && (
                              <div>
                                <p className="text-xs text-muted-foreground">Fin</p>
                                <p className="font-medium">
                                  {format(new Date(log.endedAt), 'Pp', { locale: es })}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Botón Retorno a Producción si está activo */}
                          {isActive && (
                            <Button
                              className="w-full mt-4 bg-success hover:bg-success/90"
                              onClick={() => {
                                setSelectedDowntimeLog({
                                  id: log.id,
                                  startedAt: log.startedAt,
                                  endedAt: log.endedAt,
                                  workOrderId: log.workOrderId,
                                  machine: log.machine || failure.machine,
                                });
                                setReturnDialogOpen(true);
                              }}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Confirmar Retorno a Producción
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                {/* Tab: Soluciones */}
                <TabsContent value="solutions" className="space-y-3 mt-4">
                  {(failure.solutionsApplied?.length ?? 0) === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Aún no se han aplicado soluciones
                      </p>
                    </div>
                  ) : (
                    failure.solutionsApplied?.map((solution, idx) => (
                      <div
                        key={solution.id}
                        className={cn('rounded-lg border bg-success-muted/50 p-4', solution.workOrderId && 'cursor-pointer hover:bg-success-muted transition-colors')}
                        onClick={() => {
                          if (solution.workOrderId) {
                            handleGoToMaintenance(solution.workOrderId);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Badge className="bg-success">Solución #{idx + 1}</Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {format(
                                new Date(solution.performedAt),
                                "d 'de' MMM, HH:mm",
                                { locale: es }
                              )}
                            </span>
                            {solution.workOrderId && (
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Diagnóstico</p>
                            <p className="text-sm">{solution.diagnosis}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Solución aplicada</p>
                            <p className="text-sm">{solution.solution}</p>
                          </div>
                          <p className="text-xs text-muted-foreground pt-2 border-t">
                            Por {solution.performedBy?.name || 'Técnico'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* Tab: Chat/Comentarios */}
                <TabsContent value="comments" className="mt-4">
                  <div className="flex flex-col h-[400px]">
                    {/* Composer sticky */}
                    <div className="flex-shrink-0 border rounded-t-lg bg-card p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">U</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <ToggleGroup
                            type="single"
                            value={commentType}
                            onValueChange={(value) => value && setCommentType(value as typeof commentType)}
                            className="border border-border rounded-md"
                          >
                            <ToggleGroupItem value="comment" aria-label="Comentario" className="h-8 px-3 text-xs">
                              <MessageSquare className="h-3 w-3 mr-1.5" />
                              Comentario
                            </ToggleGroupItem>
                            <ToggleGroupItem value="update" aria-label="Actualización" className="h-8 px-3 text-xs">
                              <Info className="h-3 w-3 mr-1.5" />
                              Actualización
                            </ToggleGroupItem>
                            <ToggleGroupItem value="issue" aria-label="Problema" className="h-8 px-3 text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1.5" />
                              Problema
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                      </div>

                      <div className="flex gap-2 items-end">
                        <Textarea
                          placeholder="Escribe un mensaje... (Enter para enviar)"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="min-h-[40px] max-h-[120px] resize-none text-sm"
                          disabled={sendCommentMutation.isPending}
                          rows={1}
                        />
                        <Button
                          onClick={handleSendComment}
                          disabled={!chatMessage.trim() || sendCommentMutation.isPending}
                          size="icon"
                          className="h-10 w-10 shrink-0"
                        >
                          {sendCommentMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Separator className="flex-shrink-0" />

                    {/* Timeline */}
                    <div className="flex-1 min-h-0 overflow-y-auto border border-t-0 rounded-b-lg" ref={chatScrollRef}>
                      <div className="p-3">
                        {isLoadingComments ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : comments.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
                            <p className="text-sm text-muted-foreground">No hay comentarios aún</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Sé el primero en agregar un comentario
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {comments.map((comment) => {
                              const typeKey = comment.type || 'comment';
                              const config = commentTypeConfig[typeKey] || commentTypeConfig.comment;
                              const Icon = config.icon;

                              return (
                                <div key={comment.id} className="flex gap-3">
                                  <Avatar className="h-8 w-8 flex-shrink-0">
                                    <AvatarFallback className="text-xs">
                                      {comment.author?.name ? getInitials(comment.author.name) : '??'}
                                    </AvatarFallback>
                                  </Avatar>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-medium text-foreground">
                                        {comment.author?.name || 'Usuario'}
                                      </span>
                                      <Badge variant="outline" className={cn('text-xs border', config.badgeClass)}>
                                        <Icon className="h-3 w-3 mr-1" />
                                        {config.label}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground ml-auto">
                                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: es })}
                                      </span>
                                    </div>

                                    <p className="text-sm text-foreground whitespace-pre-wrap">
                                      {comment.content}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Actions - Solo mostrar para fallas abiertas */}
              {failure.status !== 'RESOLVED' && failure.status !== 'RESOLVED_IMMEDIATE' && (
                <div className="mt-6 border-t pt-4 pb-2">
                  <div className="flex gap-2">
                    {/* Resolver Ahora - siempre visible para fallas abiertas */}
                    <Button
                      variant="outline"
                      className="flex-1 border-success text-success hover:bg-success-muted"
                      onClick={() => setImmediateCloseOpen(true)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Resolver Ahora
                    </Button>

                    {hasWorkOrder ? (
                      <Button
                        className="flex-1"
                        onClick={() => handleGoToWorkOrder(failure.workOrders![0].id)}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver OT
                      </Button>
                    ) : (
                      <Button
                        className="flex-1"
                        onClick={handleCreateWorkOrder}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Crear OT
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Falla no encontrada
            </p>
          )}
      </SheetContent>
    </Sheet>

    {/* Dialog de Retorno a Producción */}
    {selectedDowntimeLog && failureId && (
      <ReturnToProductionDialog
        open={returnDialogOpen}
        onOpenChange={(open) => {
          setReturnDialogOpen(open);
          if (!open) setSelectedDowntimeLog(null);
        }}
        downtimeLog={selectedDowntimeLog}
        failureId={failureId}
      />
    )}

    {/* Dialog de Cierre Inmediato */}
    {failureId && failure && (
      <ImmediateCloseDialog
        open={immediateCloseOpen}
        onOpenChange={setImmediateCloseOpen}
        failureId={failureId}
        failureTitle={failure.title}
        hasActiveDowntime={failure.downtimeLogs?.some((d) => !d.endedAt) || false}
        onSuccess={() => onOpenChange(false)}
      />
    )}

    {/* Dialog de Reabrir Falla */}
    {failureId && failure && (
      <ReopenFailureDialog
        open={reopenDialogOpen}
        onOpenChange={setReopenDialogOpen}
        failureId={failureId}
        failureTitle={failure.title}
        onSuccess={() => onOpenChange(false)}
      />
    )}
  </>
  );
}
