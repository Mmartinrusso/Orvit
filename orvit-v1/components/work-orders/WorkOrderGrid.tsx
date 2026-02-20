'use client';

import Link from 'next/link';
import { WorkOrder, WorkOrderStatus, Priority, MaintenanceType } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Trash2, 
  Eye, 
  Clock, 
  User, 
  Wrench, 
  AlertTriangle,
  CheckCircle,
  Pause,
  X,
  Zap,
  Settings,
  Activity,
  Shield,
  Play,
  Square,
  Calendar,
  MoreHorizontal,
  Building2,
  MapPin,
  Timer,
  DollarSign,
  FileCheck
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { formatHours, cn } from '@/lib/utils';

interface WorkOrderGridProps {
  workOrders: WorkOrder[];
  onDelete?: (workOrder: WorkOrder) => Promise<void>;
  onSelect?: (workOrder: WorkOrder) => void;
  onStatusChange?: (workOrder: WorkOrder, newStatus: WorkOrderStatus) => Promise<void>;
  viewMode?: 'grid' | 'table';
  // 🔍 PERMISOS
  currentUser?: { id: string | number; role: string };
  canDeleteWorkOrder?: boolean;
}

export default function WorkOrderGrid({ 
  workOrders, 
  onDelete, 
  onSelect, 
  onStatusChange, 
  viewMode = 'grid',
  currentUser,
  canDeleteWorkOrder = false
}: WorkOrderGridProps) {
  const { user } = useAuth();
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Función para determinar si el usuario puede eliminar una orden específica
  const canUserDeleteWorkOrder = (workOrder: WorkOrder): boolean => {
    if (!currentUser || !onDelete) return false;
    
    // Es el creador de la orden
    const isCreator = workOrder.createdById === Number(currentUser.id);
    
    // Tiene permiso global de eliminación
    const hasDeletePermission = canDeleteWorkOrder;
    
    return isCreator || hasDeletePermission;
  };

  const getStatusBadge = (status: WorkOrderStatus) => {
    switch (status) {
      case WorkOrderStatus.PENDING:
        return <Badge variant="outline" className="border-warning-muted text-warning-muted-foreground bg-warning-muted">Pendiente</Badge>;
      case WorkOrderStatus.IN_PROGRESS:
        return <Badge variant="outline" className="border-info-muted text-info-muted-foreground bg-info-muted">En Proceso</Badge>;
      case WorkOrderStatus.COMPLETED:
        return <Badge variant="outline" className="border-success-muted text-success bg-success-muted">Completada</Badge>;
      case WorkOrderStatus.CANCELLED:
        return <Badge variant="outline" className="border-destructive/20 text-destructive bg-destructive/10">Cancelada</Badge>;
      case WorkOrderStatus.ON_HOLD:
        return <Badge variant="outline" className="border-border text-muted-foreground bg-muted">En Espera</Badge>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case Priority.URGENT:
        return <Badge className="bg-destructive text-destructive-foreground border-0">Urgente</Badge>;
      case Priority.HIGH:
        return <Badge className="bg-warning text-warning-foreground border-0">Alta</Badge>;
      case Priority.MEDIUM:
        return <Badge className="bg-warning-muted text-warning-muted-foreground border-0">Media</Badge>;
      case Priority.LOW:
        return <Badge className="bg-success-muted text-success border-0">Baja</Badge>;
      default:
        return null;
    }
  };

  const getMaintenanceTypeIcon = (type: MaintenanceType) => {
    switch (type) {
      case MaintenanceType.PREVENTIVE:
        return <Shield className="h-5 w-5 text-success" />;
      case MaintenanceType.CORRECTIVE:
        return <Wrench className="h-5 w-5 text-warning-muted-foreground" />;
      case MaintenanceType.PREDICTIVE:
        return <Activity className="h-5 w-5 text-info-muted-foreground" />;
      case MaintenanceType.EMERGENCY:
        return <Zap className="h-5 w-5 text-destructive" />;
      default:
        return <Settings className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getMaintenanceTypeLabel = (type: MaintenanceType) => {
    switch (type) {
      case MaintenanceType.PREVENTIVE:
        return 'Preventivo';
      case MaintenanceType.CORRECTIVE:
        return 'Correctivo';
      case MaintenanceType.PREDICTIVE:
        return 'Predictivo';
      case MaintenanceType.EMERGENCY:
        return 'Emergencia';
      default:
        return type;
    }
  };

  const handleDelete = async (workOrder: WorkOrder) => {
    if (onDelete) {
      await onDelete(workOrder);
    }
  };

  const handleStatusChange = async (workOrder: WorkOrder, newStatus: WorkOrderStatus) => {
    if (onStatusChange) {
      // Si el usuario actual está iniciando la orden, enviar notificación al solicitante
      if (newStatus === WorkOrderStatus.IN_PROGRESS && user && workOrder.createdById !== Number(user.id)) {
        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'work_order_status_change',
              title: '🚀 Orden de Trabajo Iniciada',
              message: `${user.name} ha iniciado el trabajo en la orden: "${workOrder.title}"`,
              userId: workOrder.createdById,
              workOrderId: workOrder.id,
              priority: workOrder.priority.toLowerCase(),
              metadata: {
                workOrderTitle: workOrder.title,
                startedBy: user.name,
                startedAt: new Date().toISOString()
              }
            })
          });
        } catch (error) {
          console.error('Error enviando notificación:', error);
        }
      }

      await onStatusChange(workOrder, newStatus);
    }
  };

  const getQuickActions = (workOrder: WorkOrder) => {
    const actions = [];

    switch (workOrder.status) {
      case WorkOrderStatus.PENDING:
        actions.push({
          label: 'Iniciar',
          icon: Play,
          status: WorkOrderStatus.IN_PROGRESS,
          color: 'bg-info hover:bg-info/90 text-info-foreground'
        });
        actions.push({
          label: 'En Espera',
          icon: Pause,
          status: WorkOrderStatus.ON_HOLD,
          color: 'bg-muted-foreground hover:bg-muted-foreground/90 text-background'
        });
        break;

      case WorkOrderStatus.IN_PROGRESS:
        actions.push({
          label: 'Completar',
          icon: CheckCircle,
          status: WorkOrderStatus.COMPLETED,
          color: 'bg-success hover:bg-success/90 text-success-foreground'
        });
        actions.push({
          label: 'Pausar',
          icon: Pause,
          status: WorkOrderStatus.ON_HOLD,
          color: 'bg-muted-foreground hover:bg-muted-foreground/90 text-background'
        });
        break;

      case WorkOrderStatus.ON_HOLD:
        actions.push({
          label: 'Reanudar',
          icon: Play,
          status: WorkOrderStatus.IN_PROGRESS,
          color: 'bg-info hover:bg-info/90 text-info-foreground'
        });
        actions.push({
          label: 'Cancelar',
          icon: X,
          status: WorkOrderStatus.CANCELLED,
          color: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
        });
        break;

      default:
        break;
    }

    return actions;
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Sin fecha específica';
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (date: Date | undefined) => {
    if (!date) return 'Sin registrar';
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = (workOrder: WorkOrder) => {
    if (!workOrder.scheduledDate || workOrder.status === WorkOrderStatus.COMPLETED) return false;
    return new Date(workOrder.scheduledDate) < new Date();
  };

  const getAssignedInfo = (workOrder: WorkOrder) => {
    // Verificar si está asignado a un usuario del sistema
    if (workOrder.assignedTo) {
      return {
        name: workOrder.assignedTo.name,
        type: 'user',
        color: 'text-info-muted-foreground',
        icon: User
      };
    }

    // Verificar si está asignado a un operario
    if (workOrder.assignedWorker) {
      return {
        name: workOrder.assignedWorker.name,
        type: 'worker',
        color: 'text-success',
        icon: User
      };
    }

    return null;
  };

  const handleShowDetails = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setIsDetailsOpen(true);
    onSelect && onSelect(workOrder);
  };

  // Handle empty state - removed to avoid duplication with parent page
  if (workOrders.length === 0) {
    return null; // Let parent handle empty state
  }

  // Render table view
  if (viewMode === 'table') {
    return (
      <>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Asignado a</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
              {workOrders.map((workOrder) => {
                const assignedInfo = getAssignedInfo(workOrder);
                
                return (
                  <TableRow 
                    key={workOrder.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('.action-button')) return;
                      handleShowDetails(workOrder);
                    }}
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{workOrder.title}</div>
                        <div className="text-xs text-muted-foreground">#{workOrder.id}</div>
                        {isOverdue(workOrder) && workOrder.status !== WorkOrderStatus.COMPLETED && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Vencida
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getMaintenanceTypeIcon(workOrder.type)}
                        <span className="text-sm">{getMaintenanceTypeLabel(workOrder.type)}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {getPriorityBadge(workOrder.priority)}
                    </TableCell>
                    
                    <TableCell>
                      {getStatusBadge(workOrder.status)}
                    </TableCell>
                    
                    <TableCell>
                      {assignedInfo ? (
                        <div className="flex items-center gap-2">
                          <assignedInfo.icon className="h-4 w-4 text-muted-foreground" />
                          <span className={cn('font-medium', assignedInfo.color)}>
                            {assignedInfo.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sin asignar</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      {workOrder.machine ? workOrder.machine.name : 'Sin máquina'}
                    </TableCell>
                    
                    <TableCell>
                      <span className={isOverdue(workOrder) ? "text-destructive font-medium" : ""}>
                        {formatDate(workOrder.scheduledDate)}
                      </span>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Botón ver detalles */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 action-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowDetails(workOrder);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {/* Dropdown con acciones rápidas */}
                        {onStatusChange && getQuickActions(workOrder).length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 action-button"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {getQuickActions(workOrder).map((action, actionIndex) => {
                                const IconComponent = action.icon;
                                return (
                                  <DropdownMenuItem
                                    key={actionIndex}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(workOrder, action.status);
                                    }}
                                  >
                                    <IconComponent className="h-4 w-4 mr-2" />
                                    {action.label}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {/* Botón eliminar */}
                        {canUserDeleteWorkOrder(workOrder) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 action-button"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará permanentemente la orden de trabajo &quot;{workOrder.title}&quot;.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDelete(workOrder)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

        {/* Modal de detalles completos */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent size="lg">
            {selectedWorkOrder && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="bg-muted p-2 rounded-lg">
                      {getMaintenanceTypeIcon(selectedWorkOrder.type)}
                    </div>
                    <div>
                      <div className="text-xl font-bold">{selectedWorkOrder.title}</div>
                      <div className="text-sm text-muted-foreground font-normal">
                        Orden #{selectedWorkOrder.id} • {getMaintenanceTypeLabel(selectedWorkOrder.type)}
                      </div>
                    </div>
                  </DialogTitle>
                  <DialogDescription>
                    <div className="flex items-center gap-2 mt-2">
                      {getPriorityBadge(selectedWorkOrder.priority)}
                      {getStatusBadge(selectedWorkOrder.status)}
                      {isOverdue(selectedWorkOrder) && selectedWorkOrder.status !== WorkOrderStatus.COMPLETED && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Vencida
                        </Badge>
                      )}
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <DialogBody>
                <div className="space-y-6">
                  {/* Descripción */}
                  {selectedWorkOrder.description && (
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Descripción</h3>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-foreground">{selectedWorkOrder.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Información principal en grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Información General</h3>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Fecha programada</div>
                            <div className={cn('font-medium', isOverdue(selectedWorkOrder) && 'text-destructive')}>
                              {formatDate(selectedWorkOrder.scheduledDate)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Creada</div>
                            <div className="font-medium">{formatDateTime(selectedWorkOrder.createdAt)}</div>
                          </div>
                        </div>

                        {selectedWorkOrder.machine && (
                          <div className="flex items-center gap-3">
                            <Wrench className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Máquina</div>
                              <div className="font-medium">{selectedWorkOrder.machine.name}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Asignación</h3>
                      
                      <div className="space-y-3">
                        {getAssignedInfo(selectedWorkOrder) ? (
                          <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Asignado a</div>
                              <div className={cn('font-medium', getAssignedInfo(selectedWorkOrder)?.color)}>
                                {getAssignedInfo(selectedWorkOrder)?.name}
                              </div>
                              <Badge variant="outline" className="text-xs mt-1">
                                {getAssignedInfo(selectedWorkOrder)?.type === 'user' ? 'Usuario del Sistema' : 'Operario'}
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Asignación</div>
                              <div className="font-medium text-muted-foreground">Sin asignar</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notas adicionales */}
                  {selectedWorkOrder.notes && (
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Notas Adicionales</h3>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-foreground">{selectedWorkOrder.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Acciones rápidas en el modal */}
                  {onStatusChange && getQuickActions(selectedWorkOrder).length > 0 && (
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Acciones Rápidas</h3>
                      <div className="flex gap-2 flex-wrap">
                        {getQuickActions(selectedWorkOrder).map((action, actionIndex) => {
                          const IconComponent = action.icon;
                          return (
                            <Button
                              key={actionIndex}
                              className={action.color}
                              onClick={() => {
                                handleStatusChange(selectedWorkOrder, action.status);
                                setIsDetailsOpen(false);
                              }}
                            >
                              <IconComponent className="h-4 w-4 mr-2" />
                              {action.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                </DialogBody>
              </>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Render grid view (existing implementation)
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workOrders.map((workOrder) => {
          const assignedInfo = getAssignedInfo(workOrder);
          
          return (
            <Card 
              key={workOrder.id}
              className="hover:shadow-lg transition-all duration-200 cursor-pointer border border-border bg-card"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('.action-button')) return;
                handleShowDetails(workOrder);
              }}
            >
              {/* Header */}
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted p-2 rounded-lg">
                      {getMaintenanceTypeIcon(workOrder.type)}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {getMaintenanceTypeLabel(workOrder.type)}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        {getPriorityBadge(workOrder.priority)}
                        {getStatusBadge(workOrder.status)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Indicador de vencimiento */}
                    {isOverdue(workOrder) && workOrder.status !== WorkOrderStatus.COMPLETED && (
                      <Badge variant="destructive" className="animate-pulse">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Vencida
                      </Badge>
                    )}
                    
                    {/* Botón eliminar integrado en el header */}
                    {canUserDeleteWorkOrder(workOrder) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 action-button opacity-60 hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará permanentemente la orden de trabajo &quot;{workOrder.title}&quot;.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(workOrder)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
                
                {/* Título */}
                <h3 className="font-semibold text-lg leading-tight text-foreground">
                  {workOrder.title}
                </h3>
              </CardHeader>

              {/* Contenido */}
              <CardContent className="pt-0 space-y-4">
                {/* Información principal */}
                <div className="space-y-3">
                  {workOrder.machine && (
                    <div className="flex items-center gap-2 text-sm">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{workOrder.machine.name}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className={isOverdue(workOrder) ? "text-destructive font-medium" : "text-foreground"}>
                      {formatDate(workOrder.scheduledDate)}
                    </span>
                  </div>
                  
                  {assignedInfo && (
                    <div className="flex items-center gap-2 text-sm">
                      <assignedInfo.icon className="h-4 w-4 text-muted-foreground" />
                      <span className={cn('font-medium', assignedInfo.color)}>
                        {assignedInfo.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {assignedInfo.type === 'user' ? 'Usuario' : 'Operario'}
                      </Badge>
                    </div>
                  )}

                  {!assignedInfo && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Sin asignar</span>
                    </div>
                  )}
                </div>

                {/* Descripción */}
                {workOrder.description && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-foreground line-clamp-3">
                      {workOrder.description}
                    </p>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="space-y-3 pt-3 border-t border-border">
                  {/* Botón Ver detalles principal */}
                  <Button
                    variant="outline"
                    className="w-full action-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShowDetails(workOrder);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver detalles
                  </Button>

                  {/* Acciones rápidas de estado */}
                  {onStatusChange && getQuickActions(workOrder).length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {getQuickActions(workOrder).map((action, actionIndex) => {
                        const IconComponent = action.icon;
                        return (
                          <Button
                            key={actionIndex}
                            size="sm"
                            className={cn('action-button', action.color)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(workOrder, action.status);
                            }}
                          >
                            <IconComponent className="h-4 w-4 mr-1" />
                            {action.label}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de detalles completos para grid view */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent size="lg">
          {selectedWorkOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="bg-muted p-2 rounded-lg">
                    {getMaintenanceTypeIcon(selectedWorkOrder.type)}
                  </div>
                  <div>
                    <div className="text-xl font-bold">{selectedWorkOrder.title}</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      Orden #{selectedWorkOrder.id} • {getMaintenanceTypeLabel(selectedWorkOrder.type)}
                    </div>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  <div className="flex items-center gap-2 mt-2">
                    {getPriorityBadge(selectedWorkOrder.priority)}
                    {getStatusBadge(selectedWorkOrder.status)}
                    {isOverdue(selectedWorkOrder) && selectedWorkOrder.status !== WorkOrderStatus.COMPLETED && (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Vencida
                      </Badge>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>

              <DialogBody>
              <div className="space-y-6">
                {/* Descripción */}
                {selectedWorkOrder.description && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Descripción</h3>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-foreground">{selectedWorkOrder.description}</p>
                    </div>
                  </div>
                )}

                {/* Información principal en grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Información de la máquina */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Información de Equipo</h3>
                    <div className="space-y-3">
                      {selectedWorkOrder.machine ? (
                        <div className="flex items-center gap-2">
                          <Wrench className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{selectedWorkOrder.machine.name}</div>
                            <div className="text-sm text-muted-foreground">Máquina</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Wrench className="h-5 w-5" />
                          <span>No asignada a máquina específica</span>
                        </div>
                      )}

                      {selectedWorkOrder.component && (
                        <div className="flex items-center gap-2">
                          <Settings className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{selectedWorkOrder.component.name}</div>
                            <div className="text-sm text-muted-foreground">Componente</div>
                          </div>
                        </div>
                      )}

                      {selectedWorkOrder.sector && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{selectedWorkOrder.sector.name}</div>
                            <div className="text-sm text-muted-foreground">Sector</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Información de asignación */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Asignación y Responsables</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{selectedWorkOrder.createdBy?.name || 'Sistema'}</div>
                          <div className="text-sm text-muted-foreground">Solicitado por</div>
                        </div>
                      </div>

                      {(() => {
                        const assignedInfo = getAssignedInfo(selectedWorkOrder);
                        if (assignedInfo) {
                          return (
                            <div className="flex items-center gap-2">
                              <assignedInfo.icon className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <div className={cn('font-medium', assignedInfo.color)}>
                                  {assignedInfo.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Asignado a ({assignedInfo.type === 'user' ? 'Usuario del sistema' : 'Operario'})
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="h-5 w-5" />
                              <div>
                                <div>Sin asignar</div>
                                <div className="text-sm">Disponible para cualquier técnico</div>
                              </div>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Fechas importantes */}
                <div>
                  <h3 className="font-semibold text-lg mb-4">Fechas y Tiempos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                         <div className="bg-muted/50 p-3 rounded-lg">
                       <div className="flex items-center gap-2 mb-1">
                         <Calendar className="h-4 w-4 text-muted-foreground" />
                         <span className="text-sm font-medium">Programada</span>
                       </div>
                       <div className={isOverdue(selectedWorkOrder) ? "text-destructive font-medium" : ""}>
                         {selectedWorkOrder.scheduledDate ? (
                           <>
                             {new Date(selectedWorkOrder.scheduledDate).toLocaleDateString('es-ES', {
                               day: '2-digit',
                               month: '2-digit',
                               year: 'numeric'
                             })}
                             <br />
                             <span className="text-xs text-muted-foreground">
                               {new Date(selectedWorkOrder.scheduledDate).toLocaleTimeString('es-ES', {
                                 hour: '2-digit',
                                 minute: '2-digit'
                               })}
                             </span>
                           </>
                         ) : (
                           'Cuando sea posible'
                         )}
                       </div>
                     </div>

                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Play className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Iniciada</span>
                      </div>
                      <div>{formatDateTime(selectedWorkOrder.startedDate)}</div>
                    </div>

                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Completada</span>
                      </div>
                      <div>{formatDateTime(selectedWorkOrder.completedDate)}</div>
                    </div>

                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <FileCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Creada</span>
                      </div>
                      <div>{formatDateTime(selectedWorkOrder.createdAt)}</div>
                    </div>
                  </div>
                </div>

                {/* Tiempo y costo */}
                {(selectedWorkOrder.estimatedHours || selectedWorkOrder.actualHours || selectedWorkOrder.cost) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-4">Tiempo y Costo</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {selectedWorkOrder.estimatedHours && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Timer className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Horas Estimadas</span>
                            </div>
                            <div className="text-lg font-semibold">{formatHours(selectedWorkOrder.estimatedHours)}</div>
                          </div>
                        )}

                        {selectedWorkOrder.actualHours && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Tiempo Real</span>
                            </div>
                            <div className="text-lg font-semibold">{formatHours(selectedWorkOrder.actualHours)}</div>
                          </div>
                        )}

                        {selectedWorkOrder.cost && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Costo</span>
                            </div>
                            <div className="text-lg font-semibold">${selectedWorkOrder.cost}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Notas */}
                {selectedWorkOrder.notes && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Notas</h3>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-foreground whitespace-pre-line">{selectedWorkOrder.notes}</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Acciones rápidas en el modal */}
                {onStatusChange && getQuickActions(selectedWorkOrder).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-4">Acciones Rápidas</h3>
                      <div className="flex gap-2 flex-wrap">
                        {getQuickActions(selectedWorkOrder).map((action, actionIndex) => {
                          const IconComponent = action.icon;
                          return (
                            <Button
                              key={actionIndex}
                              className={action.color}
                              onClick={() => {
                                handleStatusChange(selectedWorkOrder, action.status);
                                setIsDetailsOpen(false);
                              }}
                            >
                              <IconComponent className="h-4 w-4 mr-2" />
                              {action.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
} 