'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  Download, 
  Edit, 
  Trash2, 
  Upload,
  Building2,
  Users,
  Clock,
  MoreVertical,
  Settings
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import InstructiveDialog from '@/components/mantenimiento/InstructiveDialog';
import WorkStationMachinesDialog from '@/components/mantenimiento/WorkStationMachinesDialog';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';


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

export default function WorkStationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  // 🔍 PERMISOS DE PUESTOS DE TRABAJO
  const { hasPermission: canEditPuestoTrabajo } = usePermissionRobust('editar_puesto_trabajo');
  
  const [workStation, setWorkStation] = useState<WorkStation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInstructiveDialogOpen, setIsInstructiveDialogOpen] = useState(false);
  const [editingInstructive, setEditingInstructive] = useState<Instructive | null>(null);
  const [isMachinesDialogOpen, setIsMachinesDialogOpen] = useState(false);

  const workStationId = params.id as string;

  useEffect(() => {
    if (workStationId) {
      fetchWorkStation();
    }
  }, [workStationId]);

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
        router.push('/mantenimiento/puestos-trabajo');
      }
    } catch (error) {
      console.error('Error cargando puesto de trabajo:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar el puesto de trabajo',
        variant: 'destructive'
      });
      router.push('/mantenimiento/puestos-trabajo');
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
    if (!confirm('¿Estás seguro de que quieres eliminar este instructivo?')) {
      return;
    }

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
        return <Badge className="bg-green-100 text-green-800">Activo</Badge>;
      case 'INACTIVE':
        return <Badge variant="secondary">Inactivo</Badge>;
      case 'MAINTENANCE':
        return <Badge className="bg-orange-100 text-orange-800">Mantenimiento</Badge>;
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
        return 'bg-green-100 text-green-800';
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800';
      case 'OUT_OF_SERVICE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="animate-pulse bg-gray-200 h-8 w-64 rounded"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!workStation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => router.push('/mantenimiento/puestos-trabajo')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Puesto de trabajo no encontrado</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => router.push('/mantenimiento/puestos-trabajo')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{workStation.name}</h1>
          <p className="text-muted-foreground">
            Código: {workStation.code} • Sector: {workStation.sector.name}
          </p>
        </div>
        <div className="ml-auto">
          {getStatusBadge(workStation.status)}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Información del puesto de trabajo */}
        <div className="md:col-span-2 space-y-6">
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
                    Creado: {new Date(workStation.createdAt).toLocaleDateString()}
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
                <Button onClick={handleCreateInstructive}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Instructivo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {workStation.instructives.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay instructivos</h3>
                  <p className="text-muted-foreground mb-4">
                    Agrega instructivos para este puesto de trabajo
                  </p>
                  <Button onClick={handleCreateInstructive}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar primer instructivo
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {workStation.instructives.map((instructive) => (
                    <div key={instructive.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{instructive.title}</h4>
                            {!instructive.isActive && (
                              <Badge variant="secondary">Inactivo</Badge>
                            )}
                          </div>
                          {instructive.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {instructive.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Creado por: {instructive.createdBy.name}</span>
                            <span>{new Date(instructive.createdAt).toLocaleDateString()}</span>
                            {instructive.fileSize && (
                              <span>{formatFileSize(instructive.fileSize)}</span>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {instructive.fileUrl && (
                              <DropdownMenuItem onClick={() => window.open(instructive.fileUrl, '_blank')}>
                                <Download className="h-4 w-4 mr-2" />
                                Descargar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleEditInstructive(instructive)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteInstructive(instructive.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
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
                <Button onClick={() => setIsMachinesDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Gestionar Máquinas
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {workStation.machines.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay máquinas asignadas</h3>
                  <p className="text-muted-foreground mb-4">
                    Asigna máquinas a este puesto de trabajo
                  </p>
                  <Button onClick={() => setIsMachinesDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Asignar primera máquina
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {workStation.machines.map((workStationMachine) => (
                    <div key={workStationMachine.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{workStationMachine.machine.name}</h4>
                          {workStationMachine.machine.nickname && (
                            <span className="text-sm text-gray-500">({workStationMachine.machine.nickname})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {workStationMachine.machine.type}
                          </Badge>
                          <Badge className={`text-xs ${getStatusColor(workStationMachine.machine.status)}`}>
                            {workStationMachine.machine.status}
                          </Badge>
                          {workStationMachine.isRequired && (
                            <Badge variant="destructive" className="text-xs">
                              Requerida
                            </Badge>
                          )}
                        </div>
                        {workStationMachine.notes && (
                          <p className="text-sm text-gray-600 mt-1">{workStationMachine.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canEditPuestoTrabajo && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => router.push(`/mantenimiento/puestos-trabajo/${workStation.id}/edit`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Puesto
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleCreateInstructive}
              >
                <Upload className="h-4 w-4 mr-2" />
                Subir Instructivo
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setIsMachinesDialogOpen(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Gestionar Máquinas
              </Button>
              
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estadísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Instructivos activos</span>
                <span className="font-medium">
                  {workStation.instructives.filter(i => i.isActive).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total instructivos</span>
                <span className="font-medium">{workStation.instructives.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog para crear/editar instructivo */}
      <InstructiveDialog
        open={isInstructiveDialogOpen}
        onOpenChange={setIsInstructiveDialogOpen}
        workStationId={workStation.id}
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
        workStationId={workStation.id}
        onSuccess={() => {
          setIsMachinesDialogOpen(false);
          fetchWorkStation();
        }}
      />

      
      
    </div>
  );
} 