'use client';

import React, { useState } from 'react';
import { WorkOrder, WorkOrderStatus, Priority } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogBody,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  X,
  Edit,
  MoreVertical,
  Play,
  CheckCircle2,
  RotateCcw,
  Pause,
  Copy,
  Trash2,
  FileText,
  Download,
  Clock,
  User,
  Wrench,
  Calendar,
  DollarSign,
  AlertCircle,
  MessageSquare,
  History,
  FileCheck,
  ClipboardList,
  Target,
  Sparkles,
  Package,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { WorkOrderCommentsPanel } from './WorkOrderCommentsPanel';
import FailureOccurrenceDialog from '@/components/failures/FailureOccurrenceDialog';
import { ChecklistPanel } from '@/components/failures/ChecklistPanel';
import { RCADialog } from '@/components/failures/RCADialog';
import { AISuggestionsPanel } from '@/components/failures/AISuggestionsPanel';
import { FailureTimelineTab } from '@/components/failures/FailureTimelineTab';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  statusLabels,
  priorityLabels,
  maintenanceTypeLabels,
  statusColors,
  priorityColors,
  formatDate,
  formatDateTime,
  relativeTime,
  formatHours,
  formatCost,
  isOverdue,
  getDueText,
  getInitials,
} from './workOrders.helpers';

interface WorkOrderDetailDialogProps {
  workOrder: WorkOrder | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (workOrder: WorkOrder) => void;
  onStatusChange?: (workOrder: WorkOrder, newStatus: WorkOrderStatus) => Promise<void>;
  onDelete?: (workOrder: WorkOrder) => void;
  onDuplicate?: (workOrder: WorkOrder) => void;
  availableUsers?: Array<{ id: number; name: string; type: 'user' | 'worker' }>;
  canDelete?: boolean;
}

export function WorkOrderDetailDialog({
  workOrder,
  isOpen,
  onOpenChange,
  onEdit,
  onStatusChange,
  onDelete,
  onDuplicate,
  availableUsers = [],
  canDelete = false,
}: WorkOrderDetailDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [showFailureOccurrenceDialog, setShowFailureOccurrenceDialog] = useState(false);
  const [showRCADialog, setShowRCADialog] = useState(false);

  // Verificar si es OT Correctiva (para mostrar tabs adicionales)
  const isCorrective = workOrder?.type === 'CORRECTIVE';

  const handleStatusChange = async (newStatus: WorkOrderStatus) => {
    if (!workOrder || !onStatusChange) return;

    try {
      setLoading(true);
      await onStatusChange(workOrder, newStatus);
      toast({
        title: 'Estado actualizado',
        description: `La orden se ha ${
          newStatus === WorkOrderStatus.IN_PROGRESS ? 'iniciado' :
          newStatus === WorkOrderStatus.COMPLETED ? 'completado' :
          newStatus === WorkOrderStatus.ON_HOLD ? 'pausado' :
          newStatus === WorkOrderStatus.PENDING ? 'reabierto' : 'actualizado'
        }`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Verificar si la OT viene de una ocurrencia de falla
  const isFromFailureOccurrence = () => {
    if (!workOrder) {
      return false;
    }

    if (workOrder.type !== 'CORRECTIVE') {
      return false;
    }

    try {
      const notes = typeof workOrder.notes === 'string' ? JSON.parse(workOrder.notes) : workOrder.notes;
      const result = !!(notes?.isOccurrenceSolution === true && notes?.relatedFailureId);
      return result;
    } catch (e) {
      return false;
    }
  };

  const getPrimaryAction = () => {
    if (!workOrder || !onStatusChange) return null;

    switch (workOrder.status) {
      case WorkOrderStatus.PENDING:
        // Si es una OT que viene de una ocurrencia de falla, mostrar diálogo de solución
        if (isFromFailureOccurrence()) {
          return {
            label: 'Iniciar',
            icon: Play,
            onClick: () => {
              setShowFailureOccurrenceDialog(true);
            },
            variant: 'default' as const,
          };
        }
        // Para otros tipos de mantenimiento (normales), cambiar estado normalmente
        return {
          label: 'Iniciar',
          icon: Play,
          onClick: () => {
            handleStatusChange(WorkOrderStatus.IN_PROGRESS);
          },
          variant: 'default' as const,
        };
      case WorkOrderStatus.IN_PROGRESS:
        return {
          label: 'Completar',
          icon: CheckCircle2,
          onClick: () => handleStatusChange(WorkOrderStatus.COMPLETED),
          variant: 'default' as const,
        };
      case WorkOrderStatus.COMPLETED:
        return {
          label: 'Reabrir',
          icon: RotateCcw,
          onClick: () => handleStatusChange(WorkOrderStatus.PENDING),
          variant: 'outline' as const,
        };
      case WorkOrderStatus.ON_HOLD:
        return {
          label: 'Reanudar',
          icon: Play,
          onClick: () => handleStatusChange(WorkOrderStatus.IN_PROGRESS),
          variant: 'default' as const,
        };
      default:
        return null;
    }
  };

  if (!workOrder) return null;

  const primaryAction = getPrimaryAction();
  const orderIsOverdue = isOverdue(workOrder.scheduledDate, workOrder.status);
  const dueText = getDueText(workOrder.scheduledDate, workOrder.status);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className="p-0 rounded-2xl border border-border bg-card shadow-xl [&>button:last-child]:hidden"
      >
        <div className="flex h-full flex-col">
          {/* Header sticky premium */}
          <div className="flex-shrink-0 border-b border-border bg-card px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              {/* Info izquierda */}
              <div className="flex-1 min-w-0 space-y-2">
                <h2 className="text-lg font-semibold text-foreground leading-tight line-clamp-2">
                  {workOrder.title}
                </h2>
                
                {/* Meta línea */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {workOrder.machine?.name && (
                    <>
                      <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        {workOrder.machine.name}
                      </span>
                      <span className="text-border">·</span>
                    </>
                  )}
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {workOrder.assignedTo?.name || 'Sin asignar'}
                  </span>
                  <span className="text-border">·</span>
                  <span>Creada {relativeTime(workOrder.createdAt)}</span>
                  {workOrder.scheduledDate && (
                    <>
                      <span className="text-border">·</span>
                      <span className={cn(
                        'flex items-center gap-1',
                        orderIsOverdue && 'text-destructive font-medium'
                      )}>
                        <Calendar className="h-3 w-3" />
                        {dueText || formatDate(workOrder.scheduledDate)}
                      </span>
                    </>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn('text-xs border', statusColors[workOrder.status])}
                  >
                    {statusLabels[workOrder.status]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn('text-xs border', priorityColors[workOrder.priority])}
                  >
                    {priorityLabels[workOrder.priority]}
                  </Badge>
                </div>
              </div>

              {/* Acciones derecha */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {primaryAction && (
                  <Button
                    variant={primaryAction.variant}
                    size="sm"
                    onClick={primaryAction.onClick}
                    disabled={loading}
                    className="gap-1.5"
                  >
                    <primaryAction.icon className="h-3 w-3" />
                    {primaryAction.label}
                  </Button>
                )}

                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(workOrder)}
                  >
                    <Edit className="h-3 w-3 mr-1.5" />
                    Editar
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-lg">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {onStatusChange && workOrder.status === WorkOrderStatus.IN_PROGRESS && (
                      <DropdownMenuItem onClick={() => handleStatusChange(WorkOrderStatus.ON_HOLD)}>
                        <Pause className="h-4 w-4 mr-2" />
                        Pausar
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
                      <Package className="h-4 w-4 mr-2" />
                      Solicitar Material
                    </DropdownMenuItem>
                    {onDuplicate && (
                      <DropdownMenuItem onClick={() => onDuplicate(workOrder)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar PDF
                    </DropdownMenuItem>
                    {onDelete && canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(workOrder)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs sticky */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="flex-shrink-0 px-6 py-3 bg-card border-b border-border">
              <TabsList className={cn(
                "w-full h-9 bg-muted/40 p-1 rounded-lg grid",
                isCorrective ? "grid-cols-5" : "grid-cols-3"
              )}>
                <TabsTrigger
                  value="summary"
                  className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <FileCheck className="h-3.5 w-3.5 mr-1.5" />
                  Resumen
                </TabsTrigger>
                {isCorrective && (
                  <TabsTrigger
                    value="checklists"
                    className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all"
                  >
                    <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                    Checklists
                  </TabsTrigger>
                )}
                {isCorrective && (
                  <TabsTrigger
                    value="timeline"
                    className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all"
                  >
                    <History className="h-3.5 w-3.5 mr-1.5" />
                    Timeline
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="comments"
                  className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Comentarios
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  {isCorrective ? 'Cambios' : 'Historial'}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Body con scroll único */}
            <div className="flex-1 overflow-y-auto">
              <TabsContent value="summary" className="m-0 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Main content */}
                  <div className="lg:col-span-8 space-y-4">
                    {/* Descripción */}
                    <div className="rounded-xl border border-border bg-background p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Descripción
                      </h3>
                      {workOrder.description ? (
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {workOrder.description}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Sin descripción</p>
                      )}
                    </div>

                    {/* Alerta de vencimiento */}
                    {orderIsOverdue && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-destructive">
                            Orden vencida
                          </p>
                          <p className="text-xs text-destructive/80">
                            {dueText}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sidebar unificada */}
                  <div className="lg:col-span-4">
                    <div className="rounded-xl border border-border bg-background p-4 space-y-4">
                      {/* Datos clave */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Datos clave
                        </h4>
                        <dl className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Estado</dt>
                            <dd>
                              <Badge variant="outline" className={cn('text-xs border', statusColors[workOrder.status])}>
                                {statusLabels[workOrder.status]}
                              </Badge>
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Prioridad</dt>
                            <dd>
                              <Badge variant="outline" className={cn('text-xs border', priorityColors[workOrder.priority])}>
                                {priorityLabels[workOrder.priority]}
                              </Badge>
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Tipo</dt>
                            <dd className="text-xs text-foreground">
                              {workOrder.type ? maintenanceTypeLabels[workOrder.type] : '—'}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Máquina</dt>
                            <dd className="text-xs text-foreground truncate max-w-[120px]">
                              {workOrder.machine?.name || '—'}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Responsable</dt>
                            <dd className="text-xs text-foreground truncate max-w-[120px]">
                              {workOrder.assignedTo?.name || (
                                <span className="text-warning-muted-foreground">Sin asignar</span>
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <Separator />

                      {/* Fechas */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          Fechas
                        </h4>
                        <dl className="space-y-2">
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Programada</dt>
                            <dd className="text-xs text-foreground">
                              {formatDate(workOrder.scheduledDate)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Inicio</dt>
                            <dd className="text-xs text-foreground">
                              {formatDate(workOrder.startedDate)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Fin</dt>
                            <dd className="text-xs text-foreground">
                              {formatDate(workOrder.completedDate)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Creada</dt>
                            <dd className="text-xs text-foreground">
                              {formatDate(workOrder.createdAt)}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <Separator />

                      {/* Tiempo y costo */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          Tiempo y costo
                        </h4>
                        <dl className="space-y-2">
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Horas estimadas</dt>
                            <dd className="text-xs text-foreground tabular-nums">
                              {formatHours(workOrder.estimatedHours)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Horas reales</dt>
                            <dd className="text-xs text-foreground tabular-nums">
                              {formatHours(workOrder.actualHours)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Costo estimado</dt>
                            <dd className="text-xs text-foreground tabular-nums">
                              {formatCost(workOrder.estimatedCost)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-xs text-muted-foreground">Costo real</dt>
                            <dd className="text-xs text-foreground tabular-nums">
                              {formatCost(workOrder.actualCost)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab Checklists (solo correctivas) */}
              {isCorrective && (
                <TabsContent value="checklists" className="m-0 p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Checklists */}
                    <div className="lg:col-span-8">
                      <ChecklistPanel
                        workOrderId={workOrder.id}
                        readOnly={workOrder.status === 'COMPLETED'}
                      />
                    </div>

                    {/* Sidebar con RCA y acciones */}
                    <div className="lg:col-span-4 space-y-4">
                      {/* Botón RCA */}
                      <div className="rounded-xl border border-border bg-background p-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Análisis de Causa Raíz
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          Utiliza la metodología de los 5 Por Qué para identificar la causa raíz del problema.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setShowRCADialog(true)}
                        >
                          <Target className="h-4 w-4 mr-2" />
                          Abrir RCA (5-Whys)
                        </Button>
                      </div>

                      {/* Sugerencias IA */}
                      <div className="rounded-xl border border-border bg-background p-4">
                        <AISuggestionsPanel
                          workOrderId={workOrder.id}
                          machineId={workOrder.machineId}
                          componentId={workOrder.componentId}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* Tab Timeline (solo correctivas) */}
              {isCorrective && (
                <TabsContent value="timeline" className="m-0">
                  <FailureTimelineTab
                    failureOccurrenceId={(() => {
                      try {
                        const notes = typeof workOrder.notes === 'string' ? JSON.parse(workOrder.notes) : workOrder.notes;
                        return notes?.relatedFailureId || 0;
                      } catch {
                        return 0;
                      }
                    })()}
                    workOrderId={workOrder.id}
                  />
                </TabsContent>
              )}

              <TabsContent value="comments" className="m-0 h-full">
                <WorkOrderCommentsPanel workOrderId={workOrder.id} />
              </TabsContent>

              <TabsContent value="history" className="m-0 p-6">
                <div className="rounded-xl border border-border bg-background p-8 text-center">
                  <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-foreground mb-1">Sin historial</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    El historial de cambios estará disponible próximamente
                  </p>
                  <Button variant="outline" size="sm" disabled>
                    Próximamente
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>

    {/* RCA Dialog (5-Whys) */}
    {isCorrective && (
      <RCADialog
        isOpen={showRCADialog}
        onClose={() => setShowRCADialog(false)}
        workOrderId={workOrder.id}
        workOrderTitle={workOrder.title}
        onSuccess={() => {
          setShowRCADialog(false);
          toast({
            title: 'RCA guardado',
            description: 'El análisis de causa raíz se ha guardado correctamente',
          });
        }}
      />
    )}

    {/* Diálogo para aplicar solución a órdenes que vienen de ocurrencias de fallas */}
    {workOrder && isFromFailureOccurrence() && (
      <FailureOccurrenceDialog
        isOpen={showFailureOccurrenceDialog}
        onClose={() => setShowFailureOccurrenceDialog(false)}
        onSuccess={() => {
          // Refrescar datos después de aplicar solución
          setShowFailureOccurrenceDialog(false);
          onOpenChange(false);
          window.location.reload();
        }}
        failure={(() => {
          try {
            const notes = typeof workOrder.notes === 'string' ? JSON.parse(workOrder.notes) : workOrder.notes;
            return {
              id: notes?.relatedFailureId || workOrder.id,
              title: workOrder.title,
              description: workOrder.description,
              machineId: workOrder.machineId,
              machineName: workOrder.machine?.name || null,
              componentId: workOrder.componentId,
              componentName: notes?.componentNames?.[0] || null,
              subcomponentId: workOrder.subcomponentId,
              subcomponentName: null,
              priority: workOrder.priority,
              failureType: notes?.failureType || 'MECANICA',
              affectedComponents: notes?.affectedComponents || [],
              componentNames: notes?.componentNames || []
            };
          } catch {
            return {
              id: workOrder.id,
              title: workOrder.title,
              description: workOrder.description,
              machineId: workOrder.machineId,
              machineName: workOrder.machine?.name || null,
              componentId: workOrder.componentId,
              componentName: null,
              subcomponentId: workOrder.subcomponentId,
              subcomponentName: null,
              priority: workOrder.priority,
              failureType: 'MECANICA',
              affectedComponents: [],
              componentNames: []
            };
          }
        })()}
        hideUnresolvedOption={true}
        workOrderId={workOrder.id}
      />
    )}
  </>
  );
}
