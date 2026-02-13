'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  RefreshCw,
  ArrowLeft,
  MoreVertical,
  Pencil,
  CheckCircle,
  XCircle,
  Play,
  Send,
  Clock,
  FileText,
  History,
  ListTodo,
  AlertTriangle,
  User,
  Building2,
  Cog,
  MapPin,
  Calendar,
  Loader2,
} from 'lucide-react';
import { MOCStatusBadge, MOCTypeBadge, MOCPriorityBadge } from './MOCStatusBadge';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface MOCDetailProps {
  mocId: number;
}

type StatusAction = {
  status: string;
  label: string;
  icon: React.ElementType;
  color: string;
  requiresNotes?: boolean;
  notesLabel?: string;
};

const statusActions: Record<string, StatusAction[]> = {
  DRAFT: [
    { status: 'PENDING_REVIEW', label: 'Enviar a Revisión', icon: Send, color: 'blue' },
  ],
  PENDING_REVIEW: [
    { status: 'UNDER_REVIEW', label: 'Iniciar Revisión', icon: Play, color: 'purple' },
    { status: 'REJECTED', label: 'Rechazar', icon: XCircle, color: 'red', requiresNotes: true, notesLabel: 'Razón del rechazo' },
  ],
  UNDER_REVIEW: [
    { status: 'APPROVED', label: 'Aprobar', icon: CheckCircle, color: 'green', requiresNotes: true, notesLabel: 'Notas de aprobación' },
    { status: 'REJECTED', label: 'Rechazar', icon: XCircle, color: 'red', requiresNotes: true, notesLabel: 'Razón del rechazo' },
  ],
  APPROVED: [
    { status: 'IMPLEMENTING', label: 'Iniciar Implementación', icon: Play, color: 'amber' },
  ],
  IMPLEMENTING: [
    { status: 'COMPLETED', label: 'Marcar Completado', icon: CheckCircle, color: 'emerald' },
  ],
};

export function MOCDetail({ mocId }: MOCDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusDialog, setStatusDialog] = useState<StatusAction | null>(null);
  const [statusNotes, setStatusNotes] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['moc', mocId],
    queryFn: async () => {
      const res = await fetch(`/api/moc/${mocId}`);
      if (!res.ok) throw new Error('Error fetching MOC');
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      const body: any = { status, statusNotes: notes };
      if (status === 'APPROVED') body.approvalNotes = notes;
      if (status === 'REJECTED') body.rejectionReason = notes;

      const res = await fetch(`/api/moc/${mocId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error updating status');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Estado actualizado');
      queryClient.invalidateQueries({ queryKey: ['moc', mocId] });
      queryClient.invalidateQueries({ queryKey: ['mocs'] });
      setStatusDialog(null);
      setStatusNotes('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const moc = data?.moc;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !moc) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-2" />
          <p className="text-muted-foreground">Error al cargar el MOC</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            Volver
          </Button>
        </CardContent>
      </Card>
    );
  }

  const availableActions = statusActions[moc.status] || [];

  const handleStatusChange = (action: StatusAction) => {
    if (action.requiresNotes) {
      setStatusDialog(action);
    } else {
      statusMutation.mutate({ status: action.status });
    }
  };

  const confirmStatusChange = () => {
    if (statusDialog) {
      statusMutation.mutate({ status: statusDialog.status, notes: statusNotes });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push('/mantenimiento/moc')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    <CardTitle>{moc.mocNumber}</CardTitle>
                    <MOCStatusBadge status={moc.status} />
                  </div>
                  <CardDescription className="mt-1">{moc.title}</CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {availableActions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        Cambiar Estado
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {availableActions.map((action) => (
                        <DropdownMenuItem
                          key={action.status}
                          onClick={() => handleStatusChange(action)}
                        >
                          <action.icon className="h-4 w-4 mr-2" />
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {moc.status === 'DRAFT' && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/mantenimiento/moc/${mocId}/editar`)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center gap-2">
                <MOCTypeBadge type={moc.changeType} />
              </div>
              <div className="flex items-center gap-2">
                <MOCPriorityBadge priority={moc.priority} />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                {moc.requestedBy.name}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {format(new Date(moc.requestedDate), 'dd/MM/yyyy', { locale: es })}
              </div>
            </div>

            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">
                  <FileText className="h-4 w-4 mr-2" />
                  Detalles
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  <ListTodo className="h-4 w-4 mr-2" />
                  Tareas ({moc.tasks?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FileText className="h-4 w-4 mr-2" />
                  Documentos ({moc.documents?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History className="h-4 w-4 mr-2" />
                  Historial
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6 mt-4">
                {/* Description */}
                <div>
                  <h4 className="font-medium mb-2">Descripción</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {moc.description}
                  </p>
                </div>

                {/* Location */}
                {(moc.area || moc.sector || moc.machine || moc.component) && (
                  <div>
                    <h4 className="font-medium mb-2">Ubicación / Activo</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {moc.area && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{moc.area.name}</span>
                        </div>
                      )}
                      {moc.sector && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{moc.sector.name}</span>
                        </div>
                      )}
                      {moc.machine && (
                        <div className="flex items-center gap-2">
                          <Cog className="h-4 w-4 text-muted-foreground" />
                          <span>{moc.machine.name}</span>
                        </div>
                      )}
                      {moc.component && (
                        <div className="flex items-center gap-2">
                          <Cog className="h-4 w-4 text-muted-foreground" />
                          <span>{moc.component.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Justification */}
                {moc.justification && (
                  <div>
                    <h4 className="font-medium mb-2">Justificación</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {moc.justification}
                    </p>
                  </div>
                )}

                {/* Scope */}
                {moc.scope && (
                  <div>
                    <h4 className="font-medium mb-2">Alcance</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {moc.scope}
                    </p>
                  </div>
                )}

                {/* Impact Assessment */}
                {moc.impactAssessment && (
                  <div>
                    <h4 className="font-medium mb-2">Evaluación de Impacto</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {moc.impactAssessment}
                    </p>
                  </div>
                )}

                {/* Risk Assessment */}
                {moc.riskAssessment && (
                  <div>
                    <h4 className="font-medium mb-2">Evaluación de Riesgos</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {moc.riskAssessment}
                    </p>
                  </div>
                )}

                {/* Planning */}
                <div>
                  <h4 className="font-medium mb-2">Planificación</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {moc.plannedStartDate && (
                      <div>
                        <span className="text-muted-foreground">Inicio planificado:</span>
                        <p>{format(new Date(moc.plannedStartDate), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                    {moc.plannedEndDate && (
                      <div>
                        <span className="text-muted-foreground">Fin planificado:</span>
                        <p>{format(new Date(moc.plannedEndDate), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                    {moc.actualStartDate && (
                      <div>
                        <span className="text-muted-foreground">Inicio real:</span>
                        <p>{format(new Date(moc.actualStartDate), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                    {moc.actualEndDate && (
                      <div>
                        <span className="text-muted-foreground">Fin real:</span>
                        <p>{format(new Date(moc.actualEndDate), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Flags */}
                <div className="flex gap-4">
                  {moc.isTemporary && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Cambio Temporal
                      {moc.temporaryUntil && ` (hasta ${format(new Date(moc.temporaryUntil), 'dd/MM/yyyy')})`}
                    </Badge>
                  )}
                  {moc.requiresTraining && (
                    <Badge variant="outline" className={moc.trainingCompleted ? 'border-green-500' : 'border-amber-500'}>
                      {moc.trainingCompleted ? 'Capacitación Completada' : 'Requiere Capacitación'}
                    </Badge>
                  )}
                </div>

                {/* Approval/Rejection */}
                {moc.status === 'APPROVED' && moc.approvalNotes && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-1">Notas de Aprobación</h4>
                    <p className="text-sm text-green-700">{moc.approvalNotes}</p>
                    {moc.approvedBy && (
                      <p className="text-xs text-green-600 mt-2">
                        Aprobado por {moc.approvedBy.name} el {format(new Date(moc.approvalDate), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                )}

                {moc.status === 'REJECTED' && moc.rejectionReason && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-1">Razón del Rechazo</h4>
                    <p className="text-sm text-red-700">{moc.rejectionReason}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                {moc.tasks?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListTodo className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay tareas de implementación</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {moc.tasks?.map((task: any) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-4 p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{task.description}</p>
                          {task.assignedTo && (
                            <p className="text-sm text-muted-foreground">
                              Asignado a: {task.assignedTo.name}
                            </p>
                          )}
                        </div>
                        <Badge variant={task.completedAt ? 'default' : 'secondary'}>
                          {task.completedAt ? 'Completada' : 'Pendiente'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                {moc.documents?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay documentos adjuntos</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {moc.documents?.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-4 p-3 border rounded-lg"
                      >
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Subido por {doc.uploadedBy.name} {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true, locale: es })}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            Ver
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {moc.history?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay historial de cambios</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {moc.history?.map((entry: any) => (
                      <div
                        key={entry.id}
                        className="flex gap-4 pb-4 border-b last:border-0"
                      >
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <History className="h-4 w-4 text-gray-500" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <MOCStatusBadge status={entry.fromStatus} size="sm" />
                            <span className="text-muted-foreground">→</span>
                            <MOCStatusBadge status={entry.toStatus} size="sm" />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {entry.changedBy.name} · {formatDistanceToNow(new Date(entry.changedAt), { addSuffix: true, locale: es })}
                          </p>
                          {entry.notes && (
                            <p className="text-sm mt-1">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusDialog?.label}</DialogTitle>
            <DialogDescription>
              {statusDialog?.notesLabel || 'Ingrese una nota para este cambio de estado'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            placeholder="Escriba sus notas aquí..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmStatusChange}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MOCDetail;
