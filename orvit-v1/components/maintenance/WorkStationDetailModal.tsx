'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { 
  Building2, 
  FileText, 
  Settings, 
  Users, 
  Clock, 
  Download,
  Edit,
  Trash2,
  Plus,
  MoreVertical,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import InstructiveDialog from '@/components/mantenimiento/InstructiveDialog';
import WorkStationMachinesDialog from '@/components/mantenimiento/WorkStationMachinesDialog';

interface WorkStation {
  id: number;
  name: string;
  description?: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  sectorId: number;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  sector: {
    id: number;
    name: string;
  };
  instructives: Instructive[];
  machines: WorkStationMachine[];
}

interface WorkStationMachine {
  id: number;
  workStationId: number;
  machineId: number;
  isRequired: boolean;
  notes?: string;
  machine: {
    id: number;
    name: string;
    nickname?: string;
    type: string;
    brand?: string;
    model?: string;
    status: string;
    photo?: string;
    logo?: string;
  };
}

interface Instructive {
  id: number;
  title: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  isActive: boolean;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
  };
}

interface WorkStationDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workStationId: number | null;
  onSuccess: () => void;
}

export default function WorkStationDetailModal({
  open,
  onOpenChange,
  workStationId,
  onSuccess
}: WorkStationDetailModalProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [workStation, setWorkStation] = useState<WorkStation | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInstructiveDialogOpen, setIsInstructiveDialogOpen] = useState(false);
  const [editingInstructive, setEditingInstructive] = useState<Instructive | null>(null);
  const [isMachinesDialogOpen, setIsMachinesDialogOpen] = useState(false);

  useEffect(() => {
    if (open && workStationId) {
      fetchWorkStation();
    }
  }, [open, workStationId]);

  const fetchWorkStation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/work-stations/${workStationId}`);
      if (response.ok) {
        const data = await response.json();
        setWorkStation(data);
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo cargar el puesto de trabajo',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error cargando puesto de trabajo:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar el puesto de trabajo',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstructive = () => {
    setEditingInstructive(null);
    setIsInstructiveDialogOpen(true);
  };

  const handleEditInstructive = (instructive: Instructive) => {
    setEditingInstructive(instructive);
    setIsInstructiveDialogOpen(true);
  };

  const handleDeleteInstructive = async (id: number) => {
    const ok = await confirm({
      title: 'Eliminar instructivo',
      description: '¿Estás seguro de que quieres eliminar este instructivo?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/work-stations/${workStationId}/instructives/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Instructivo eliminado correctamente'
        });
        fetchWorkStation();
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo eliminar el instructivo',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error eliminando instructivo:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el instructivo',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-success-muted text-success">Activo</Badge>;
      case 'INACTIVE':
        return <Badge variant="secondary">Inactivo</Badge>;
      case 'MAINTENANCE':
        return <Badge className="bg-warning-muted text-warning-muted-foreground">Mantenimiento</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-success-muted text-success';
      case 'MAINTENANCE':
        return 'bg-warning-muted text-warning-muted-foreground';
      case 'OUT_OF_SERVICE':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-foreground';
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Cargando puesto de trabajo...</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    );
  }

  if (!workStation) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Puesto de trabajo no encontrado</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="text-center py-8">
              <p className="text-muted-foreground">No se pudo cargar el puesto de trabajo</p>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold">{workStation.name}</DialogTitle>
                <DialogDescription>
                  Código: {workStation.code} • Sector: {workStation.sector.name}
                </DialogDescription>
              </div>
              <div>
                {getStatusBadge(workStation.status)}
              </div>
            </div>
          </DialogHeader>

          <DialogBody>
            {/* Información del puesto de trabajo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Información del Puesto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {workStation.description && (
                  <div>
                    <h4 className="font-medium mb-2">Descripción</h4>
                    <p className="text-muted-foreground">{workStation.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Sector: {workStation.sector.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Creado: {formatDate(workStation.createdAt)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Instructivos */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Instructivos ({workStation.instructives.length})
                  </CardTitle>
                  <Button onClick={handleCreateInstructive} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {workStation.instructives.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No hay instructivos</p>
                    <p className="text-xs text-muted-foreground mt-1">Haz clic en &quot;Agregar&quot; para crear el primer instructivo</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workStation.instructives.map((instructive) => (
                      <div key={instructive.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm">{instructive.title}</h4>
                              {!instructive.isActive && (
                                <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                              )}
                            </div>
                            {instructive.description && (
                              <p className="text-xs text-muted-foreground mb-1">
                                {instructive.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>Creado por: {instructive.createdBy.name}</span>
                              <span>{formatDate(instructive.createdAt)}</span>
                              {instructive.fileSize && (
                                <span>{formatFileSize(instructive.fileSize)}</span>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {instructive.fileUrl && (
                                <DropdownMenuItem onClick={() => window.open(instructive.fileUrl, '_blank')}>
                                  <Download className="h-3 w-3 mr-2" />
                                  Descargar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleEditInstructive(instructive)}>
                                <Edit className="h-3 w-3 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteInstructive(instructive.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Máquinas */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Máquinas ({workStation.machines.length})
                  </CardTitle>
                  <Button onClick={() => setIsMachinesDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Gestionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {workStation.machines.length === 0 ? (
                  <div className="text-center py-6">
                    <Settings className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No hay máquinas asignadas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {workStation.machines.map((workStationMachine) => (
                      <div key={workStationMachine.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{workStationMachine.machine.name}</h4>
                            {workStationMachine.machine.nickname && (
                              <span className="text-xs text-muted-foreground">({workStationMachine.machine.nickname})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {workStationMachine.machine.type}
                            </Badge>
                            <Badge className={cn('text-xs', getStatusColor(workStationMachine.machine.status))}>
                              {workStationMachine.machine.status}
                            </Badge>
                            {workStationMachine.isRequired && (
                              <Badge variant="destructive" className="text-xs">
                                Requerida
                              </Badge>
                            )}
                          </div>
                          {workStationMachine.notes && (
                            <p className="text-xs text-foreground mt-1">{workStationMachine.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              size="default"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear/editar instructivo */}
      <InstructiveDialog
        open={isInstructiveDialogOpen}
        onOpenChange={setIsInstructiveDialogOpen}
        workStationId={workStation?.id || 0}
        instructive={editingInstructive}
        onSuccess={() => {
          setIsInstructiveDialogOpen(false);
          fetchWorkStation();
        }}
      />

      {/* Dialog para gestionar máquinas */}
      <WorkStationMachinesDialog
        open={isMachinesDialogOpen}
        onOpenChange={setIsMachinesDialogOpen}
        workStationId={workStation?.id || 0}
        onSuccess={() => {
          setIsMachinesDialogOpen(false);
          fetchWorkStation();
        }}
      />
    </>
  );
} 