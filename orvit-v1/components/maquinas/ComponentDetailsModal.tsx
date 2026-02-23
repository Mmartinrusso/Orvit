'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MachineComponent } from '@/lib/types';
import { stripHtmlTags, cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Wrench, Info, FileText, History, Settings, X, Plus, Eye, FilePlus, Trash2, Pencil, Loader2, AlertTriangle, ChevronRight, ChevronDown, ChevronUp, Layers, BarChart3, Shield, Activity, Gauge, Copy, Check, ClipboardList, Cog, Power, PowerOff, MoreVertical, Box, Sparkles, Search, Globe, Link2, Lightbulb } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ComponentDialog from './ComponentDialog';
import ComponentOverviewTab from './tabs/ComponentOverviewTab';
import PromoteToMachineDialog from './PromoteToMachineDialog';
import MachineMaintenanceTab from '@/components/maintenance/MachineMaintenanceTab';
import PreventiveMaintenanceDialog from '../work-orders/PreventiveMaintenanceDialog';
import WorkOrderWizard from '../work-orders/WorkOrderWizard';
import { FailureQuickReportDialog } from '@/components/corrective/failures/FailureQuickReportDialog';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { toast } from '@/hooks/use-toast';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { DocumentListViewer } from './MachineDetailDialog';
import { DocumentFolderViewer } from './DocumentFolderViewer';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from '@/lib/date-utils';
import { Calendar, CalendarDays, User, MapPin, CheckCircle, Clock, Camera, ExternalLink } from 'lucide-react';

// Lazy load del visor 3D - solo se carga cuando se accede a la pestaña 3D
const Machine3DViewer = dynamic(
  () => import('./Machine3DViewer').then(mod => mod.Machine3DViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[400px] bg-muted/20 rounded-lg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando visor 3D...</p>
        </div>
      </div>
    )
  }
);

// Interfaz para registros de historial (igual que en MachineDetailDialog)
interface HistoryRecord {
  id: string;
  title: string;
  type: string;
  date: string;
  machine: {
    id: number;
    name: string;
  };
  component?: {
    id: number;
    name: string;
  } | null;
  subcomponent?: {
    id: number;
    name: string;
  } | null;
  supervisor: {
    id: number;
    name: string;
  };
  toolsUsed: string[];
  detailedDescription: string;
  photoUrls: string[];
  sector: string;
  plantStopId: string;
  createdAt: string;
}



// Componente para mostrar las fallas relacionadas con un componente
const ComponentFailuresContent: React.FC<{
  componentId: string | number;
  componentName: string;
}> = ({ componentId, componentName }) => {
  const [failures, setFailures] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFailure, setSelectedFailure] = useState<any>(null);
  const [isFailureDetailOpen, setIsFailureDetailOpen] = useState(false);

  useEffect(() => {
    fetchFailures();
  }, [componentId]);

  const fetchFailures = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/components/${componentId}/failures`);
      
      if (response.ok) {
        const data = await response.json();
        setFailures(data.failures || []);
      } else {
        setError('Error al cargar las fallas');
      }
    } catch (error) {
      setError('Error al cargar las fallas');
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      LOW: 'bg-success-muted text-success',
      MEDIUM: 'bg-warning-muted text-warning-muted-foreground',
      HIGH: 'bg-warning-muted text-warning-muted-foreground',
      CRITICAL: 'bg-destructive/10 text-destructive'
    };
    const labels = {
      LOW: 'BAJA',
      MEDIUM: 'MEDIA',
      HIGH: 'ALTA',
      CRITICAL: 'CRÍTICA'
    };
    return (
      <Badge className={colors[priority as keyof typeof colors] || colors.MEDIUM}>
        {labels[priority as keyof typeof labels] || priority}
      </Badge>
    );
  };

  const getStatusBadge = (failure: any) => {
    // Si tiene solución aplicada, mostrar como solucionada
    if (failure.solution && failure.solution.trim() !== '') {
      return (
        <Badge className="bg-success-muted text-success">
          Solucionada
        </Badge>
      );
    }
    
    // Si no tiene solución, usar el status original
    const colors = {
      PENDING: 'bg-warning-muted text-warning-muted-foreground',
      IN_PROGRESS: 'bg-info-muted text-info-muted-foreground',
      COMPLETED: 'bg-success-muted text-success',
      CANCELLED: 'bg-muted text-foreground'
    };
    const labels = {
      PENDING: 'Sin solución',
      IN_PROGRESS: 'En progreso',
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada'
    };
    return (
      <Badge className={colors[failure.status as keyof typeof colors] || colors.PENDING}>
        {labels[failure.status as keyof typeof labels] || failure.status}
      </Badge>
    );
  };

  const getFailureTypeBadge = (type: string) => {
    const colors = {
      MECANICA: 'bg-info-muted text-info-muted-foreground',
      ELECTRICA: 'bg-primary/10 text-primary',
      HIDRAULICA: 'bg-info-muted text-info-muted-foreground',
      NEUMATICA: 'bg-primary/10 text-primary',
      OTRO: 'bg-muted text-foreground'
    };
    return (
      <Badge className={colors[type as keyof typeof colors] || colors.OTRO}>
        {type}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewFailureDetails = (failure: any) => {
    setSelectedFailure(failure);
    setIsFailureDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Cargando fallas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-destructive">
        <AlertTriangle className="h-6 w-6 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  if (failures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">No hay fallas registradas</h3>
        <p className="text-sm text-center mb-4">
          No se han encontrado fallas relacionadas con este componente o sus subcomponentes.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFailures}
          >
            <Eye className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Fallas relacionadas ({failures.length})
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFailures}
          >
            <Eye className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {failures.map((failure) => (
          <Card 
            key={failure.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleViewFailureDetails(failure)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-base">{failure.title}</h4>
                    {getPriorityBadge(failure.priority)}
                    {getStatusBadge(failure)}
                    {getFailureTypeBadge(failure.failureType)}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                    {stripHtmlTags(failure.description)}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Máquina:</span>
                      <p className="font-medium">{failure.machine?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Reportada:</span>
                      <p className="font-medium">{formatDate(failure.reportedDate)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Por:</span>
                      <p className="font-medium">{failure.reportedBy?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Documentos:</span>
                      <p className="font-medium">
                        {failure.attachments?.length || 0} + {failure.solutionAttachments?.length || 0}
                      </p>
                    </div>
                  </div>

                  {failure.involvedComponentsInfo && failure.involvedComponentsInfo.length > 0 && (
                    <div className="mt-2">
                      <span className="text-sm text-muted-foreground">Componentes involucrados:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {failure.involvedComponentsInfo.map((comp: any) => (
                          <Badge key={comp.id} variant="outline" className="text-xs">
                            {comp.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de detalle de falla */}
      {selectedFailure && (
        <FailureDetailModal
          failure={selectedFailure}
          isOpen={isFailureDetailOpen}
          onClose={() => {
            setIsFailureDetailOpen(false);
            setSelectedFailure(null);
          }}
          onEditFailure={() => {}}
          onEditSolution={() => {}}
          onFailureOccurred={() => {}}
          components={[]}
        />
      )}
    </div>
  );
};

// Componente para mostrar el historial de componentes
const ComponentHistoryContent: React.FC<{
  machineId: number;
  machineName: string;
  componentId: string | number;
  componentName: string;
}> = ({ machineId, machineName, componentId, componentName }) => {
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [machineId, componentId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const url = `/api/machines/${machineId}/history?componentId=${componentId}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setHistoryRecords(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching component history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PLANT_RESUME':
        return 'bg-success-muted text-success';
      case 'MAINTENANCE':
        return 'bg-info-muted text-info-muted-foreground';
      case 'REPAIR':
        return 'bg-warning-muted text-warning-muted-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PLANT_RESUME':
        return <CheckCircle className="h-4 w-4" />;
      case 'MAINTENANCE':
        return <Wrench className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
    } catch {
      return dateString;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PLANT_RESUME':
        return 'Resumen de Parada';
      case 'MAINTENANCE':
        return 'Mantenimiento';
      case 'REPAIR':
        return 'Reparación';
      case 'INSPECTION':
        return 'Inspección';
      case 'CLEANING':
        return 'Limpieza';
      default:
        return type.replace('_', ' ');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando historial...</span>
      </div>
    );
  }

  if (historyRecords.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-medium text-lg mb-2">No hay registros de mantenimiento</h3>
          <p className="text-muted-foreground mb-4">
            Los registros aparecerán aquí cuando se realicen trabajos de mantenimiento en este componente
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {historyRecords.map((record) => (
        <Card key={record.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {getTypeIcon(record.type)}
                  {record.title}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(record.date)}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {record.supervisor.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {record.sector}
                  </div>
                </div>
              </div>
              <Badge className={getTypeColor(record.type)}>
                {getTypeLabel(record.type)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-sm mb-1">Descripción del Trabajo Realizado:</h4>
                <p className="text-sm text-white">{record.detailedDescription}</p>
              </div>

              {record.toolsUsed && record.toolsUsed.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Herramientas Utilizadas del Pañol:</h4>
                  <div className="flex flex-wrap gap-2">
                    {record.toolsUsed.map((tool, index) => (
                      <Badge key={index} variant="outline" className="bg-info-muted text-info-muted-foreground border-info-muted">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {(record.component || record.subcomponent) && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Componentes Trabajados:</h4>
                  <div className="flex flex-wrap gap-2">
                    {record.component && (
                      <Badge variant="outline">{record.component.name}</Badge>
                    )}
                    {record.subcomponent && (
                      <Badge variant="outline">{record.subcomponent.name}</Badge>
                    )}
                  </div>
                </div>
              )}

              {record.photoUrls.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                    <Camera className="h-4 w-4" />
                    Fotos del Trabajo ({record.photoUrls.length})
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {record.photoUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => window.open(url, '_blank')}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all flex items-center justify-center">
                          <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Modal de detalles de falla simplificado
const FailureDetailModal: React.FC<{
  failure: any;
  isOpen: boolean;
  onClose: () => void;
  onEditFailure: (failure: any) => void;
  onEditSolution: (failure: any) => void;
  onFailureOccurred: (failure: any) => void;
  components: any[];
}> = ({ failure, isOpen, onClose, onEditFailure, onEditSolution, onFailureOccurred, components }) => {
  const [activeTab, setActiveTab] = useState<'falla' | 'solucion'>('falla');
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);

  // Función para obtener las ocurrencias de la falla
  const fetchOccurrences = async () => {
    if (!failure?.id) return;
    
    setLoadingOccurrences(true);
    try {
      const response = await fetch(`/api/failures/${failure.id}/occurrences`);
      if (response.ok) {
        const data = await response.json();
        setOccurrences(data.occurrences || []);
      }
    } catch (error) {
      console.error('Error fetching occurrences:', error);
    } finally {
      setLoadingOccurrences(false);
    }
  };

  // Cargar ocurrencias cuando se abre el modal
  useEffect(() => {
    if (isOpen && failure?.id) {
      fetchOccurrences();
    }
  }, [isOpen, failure?.id]);

  // Función para obtener la fecha de la última ocurrencia
  const getLastOccurrenceDate = () => {
    if (occurrences.length > 0) {
      // Si hay ocurrencias registradas, usar la más reciente
      const sortedOccurrences = [...occurrences].sort((a, b) => 
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
      );
      return new Date(sortedOccurrences[0].reportedAt);
    } else {
      // Si no hay ocurrencias adicionales, usar la fecha de la falla original
      return new Date(failure.reportedDate);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return <Badge variant="destructive">Alta</Badge>;
      case 'MEDIUM':
        return <Badge variant="secondary">Media</Badge>;
      case 'LOW':
        return <Badge variant="outline">Baja</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (failure: any) => {
    // Si tiene solución aplicada, mostrar como solucionada
    if (failure.solution && failure.solution.trim() !== '') {
      return <Badge variant="default">Solucionada</Badge>;
    }
    
    // Si no tiene solución, usar el status original
    switch (failure.status) {
      case 'PENDING':
        return <Badge variant="outline">Sin solución</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="secondary">En Proceso</Badge>;
      case 'COMPLETED':
        return <Badge variant="default">Completada</Badge>;
      default:
        return <Badge variant="outline">{failure.status}</Badge>;
    }
  };

  const getFailureTypeBadge = (type: string) => {
    switch (type) {
      case 'MECANICA':
        return <Badge variant="outline">Mecánica</Badge>;
      case 'ELECTRICA':
        return <Badge variant="outline">Eléctrica</Badge>;
      case 'HIDRAULICA':
        return <Badge variant="outline">Hidráulica</Badge>;
      case 'AUTOMATIZACION':
        return <Badge variant="outline" className="border-success text-success">Automatización</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!failure) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <span>Detalles de Falla</span>
          </DialogTitle>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-lg font-semibold">{failure.title}</span>
            {getPriorityBadge(failure.priority)}
            {getStatusBadge(failure)}
            {getFailureTypeBadge(failure.failureType)}
          </div>
        </DialogHeader>

        <DialogBody>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'falla' | 'solucion')}>
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="falla" className="h-7">Falla</TabsTrigger>
            <TabsTrigger value="solucion" className="h-7">Solución</TabsTrigger>
          </TabsList>

          <TabsContent value="falla" className="space-y-4">
            {/* Descripción */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Descripción</h3>
                </div>
                <div
                  className="text-sm text-muted-foreground prose prose-sm max-w-none prose-p:my-1 prose-img:max-w-full prose-img:rounded-md"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(failure.description || 'Sin descripción disponible') }}
                />
              </CardContent>
            </Card>

            {/* Componentes Afectados */}
            {failure.involvedComponentsInfo && failure.involvedComponentsInfo.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Componentes Afectados</h3>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Componentes Principales:</p>
                    <div className="flex flex-wrap gap-2">
                      {failure.involvedComponentsInfo.map((comp: any) => (
                        <Badge key={comp.id} variant="outline">
                          {comp.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ubicación */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Ubicación</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {failure.title}
                </p>
              </CardContent>
            </Card>

            {/* Última vez */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Última vez</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(getLastOccurrenceDate().toISOString())}
                </p>
              </CardContent>
            </Card>

            {/* Reportado por */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Reportado por</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {failure.reportedBy?.name || 'N/A'}
                </p>
              </CardContent>
            </Card>

            {/* Historial de Ocurrencias */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Historial de Ocurrencias</h3>
                  <Badge variant="outline" className="ml-auto">
                    {occurrences.length + 1} vez{occurrences.length + 1 !== 1 ? 'es' : ''}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {occurrences.length > 0 ? (
                    occurrences.map((occurrence, index) => (
                      <div key={occurrence.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {formatDate(occurrence.reportedAt)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            - {occurrence.reportedBy?.name || 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Primera ocurrencia de esta falla
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Documentos de la Falla */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Documentos de la Falla</h3>
                </div>
                {failure.attachments && failure.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {failure.attachments.map((attachment: any) => (
                      <div key={attachment.id} className="flex items-center gap-2 p-2 border rounded">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{attachment.fileName}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    No hay documentos adjuntos a la falla
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="solucion" className="space-y-4">
            {/* Solución */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Solución</h3>
                </div>
                {failure.solution ? (
                  <p className="text-sm text-muted-foreground">
                    {stripHtmlTags(failure.solution)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay solución registrada para esta falla
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Documentos de la Solución */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Documentos de la Solución</h3>
                </div>
                {failure.solutionAttachments && failure.solutionAttachments.length > 0 ? (
                  <div className="space-y-2">
                    {failure.solutionAttachments.map((attachment: any) => (
                      <div key={attachment.id} className="flex items-center gap-2 p-2 border rounded">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{attachment.fileName}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    No hay documentos adjuntos a la solución
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

interface ComponentDetailsModalProps {
  component: MachineComponent | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function ComponentDetailsModal({ 
  component, 
  isOpen, 
  onClose,
  onDeleted
}: ComponentDetailsModalProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('overview');
  const [machineStatus, setMachineStatus] = useState<string>('');
  const [machineName, setMachineName] = useState<string>('');
  
  // Permisos - usar los mismos permisos que para máquinas
  const { hasPermission: canDeleteComponent } = usePermissionRobust('machines.delete_component');
  const { hasPermission: canEditComponent } = usePermissionRobust('editar_maquina');
  const { hasPermission: canCreateComponent } = usePermissionRobust('crear_maquina');
  const { hasPermission: canAddDocument } = usePermissionRobust('machines.add_document');
  const { hasPermission: canPromoteComponent } = usePermissionRobust('machines.promote_component');
  
  // Para agregar/editar componentes y subcomponentes, usar el mismo permiso que para máquinas
  const canManageComponents = canEditComponent || canCreateComponent;
  const [selectedSubcomponent, setSelectedSubcomponent] = useState<MachineComponent | null>(null);
  const [isSubcomponentModalOpen, setIsSubcomponentModalOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [subcomponents, setSubcomponents] = useState(component?.children || []);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editComponent, setEditComponent] = useState<MachineComponent | null>(null);
  const [isEditSubDialogOpen, setIsEditSubDialogOpen] = useState(false);
  const [editSubcomponent, setEditSubcomponent] = useState<MachineComponent | null>(null);
  // Estado para promover componente a máquina
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  // Documentación de componentes
  const [componentDocuments, setComponentDocuments] = useState<any[]>([]);
  const [loadingComponentDocs, setLoadingComponentDocs] = useState(false);
  const [uploadingComponentDoc, setUploadingComponentDoc] = useState(false);
  const [errorComponentDocs, setErrorComponentDocs] = useState<string | null>(null);
  const [successComponentDoc, setSuccessComponentDoc] = useState<string | null>(null);

  // ✨ Estado para copiar al clipboard
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ✨ Estado para stats del componente (KPIs del header)
  const [componentStats, setComponentStats] = useState<{
    failuresCount: number;
    openFailuresCount: number;
    workOrdersCount: number;
    pendingWorkOrdersCount: number;
    lastMaintenance: string | null;
    isActive: boolean;
  }>({
    failuresCount: 0,
    openFailuresCount: 0,
    workOrdersCount: 0,
    pendingWorkOrdersCount: 0,
    lastMaintenance: null,
    isActive: true,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Estado para mostrar/ocultar KPIs en móvil (cerradas por defecto)
  const [showKpis, setShowKpis] = useState(false);

  // Estado para el dialog de eliminación
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Estados para dialogs de creación de mantenimiento
  const [showPreventiveDialog, setShowPreventiveDialog] = useState(false);
  const [showWorkOrderWizard, setShowWorkOrderWizard] = useState(false);
  const [workOrderWizardType, setWorkOrderWizardType] = useState<string | null>(null);
  const [showFailureReportDialog, setShowFailureReportDialog] = useState(false);

  // Estados para sugerencias de IA de modelos 3D
  const [aiSuggestions, setAiSuggestions] = useState<{
    suggestions: Array<{
      source: string;
      sourceName: string;
      sourceIcon: string;
      url: string;
      searchQuery: string;
      confidence: 'high' | 'medium' | 'low';
      description: string;
      isPaid: boolean;
    }>;
    searchQueries: string[];
    aiAnalysis?: {
      componentType?: string;
      standardPart?: boolean;
      possibleManufacturers?: string[];
      specifications?: Record<string, string>;
    };
    tips?: string[];
  } | null>(null);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [aiSuggestionsError, setAiSuggestionsError] = useState<string | null>(null);

  // Estados para guardar/editar URL del modelo 3D
  const [showSetModelUrlDialog, setShowSetModelUrlDialog] = useState(false);
  const [newModelUrl, setNewModelUrl] = useState('');

  // PATCH: Guardar URL del modelo 3D
  const saveModelUrlMutation = useApiMutation<any, { model3dUrl: string | null }>({
    mutationFn: async (vars) => {
      const response = await fetch(`/api/components/${component?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar');
      }
      return response.json();
    },
    successMessage: 'Modelo 3D asignado correctamente',
    errorMessage: 'No se pudo guardar el modelo 3D',
    invalidateKeys: [['machines'], ['components']],
    onSuccess: () => {
      setShowSetModelUrlDialog(false);
      setNewModelUrl('');
      // Recargar para ver cambios
      window.location.reload();
    },
  });

  // Estados para generación de 3D desde foto
  const [showGenerateFromPhotoDialog, setShowGenerateFromPhotoDialog] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [generatingModel, setGeneratingModel] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
    message: string;
    progress?: number;
    resultUrl?: string;
  }>({ status: 'idle', message: '' });

  // Función para guardar URL del modelo 3D
  const handleSaveModelUrl = (url: string) => {
    if (!component) return;
    saveModelUrlMutation.mutate({ model3dUrl: url || null });
  };

  // Función para manejar selección de foto
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Función para generar modelo 3D desde foto
  const handleGenerateFromPhoto = async () => {
    if (!photoFile || !component) return;

    setGeneratingModel(true);
    setGenerationProgress({ status: 'uploading', message: 'Subiendo imagen...' });

    try {
      // Convertir imagen a base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(photoFile);
      });

      setGenerationProgress({ status: 'processing', message: 'Generando modelo 3D con IA...', progress: 10 });

      const response = await fetch('/api/ai/generate-3d-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          fileName: photoFile.name,
          componentName: component.name,
          componentId: component.id,
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en la generación');
      }

      const data = await response.json();

      if (data.status === 'processing') {
        setGenerationProgress({
          status: 'processing',
          message: 'El modelo se está generando. Esto puede tomar unos minutos...',
          progress: 30
        });

        // Polling cada 10 segundos
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/ai/generate-3d-model/status?taskId=${data.taskId}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'completed') {
              clearInterval(pollInterval);
              setGenerationProgress({
                status: 'completed',
                message: 'Modelo generado exitosamente',
                resultUrl: statusData.modelUrl
              });
              setGeneratingModel(false);
            } else if (statusData.status === 'failed') {
              clearInterval(pollInterval);
              setGenerationProgress({
                status: 'error',
                message: statusData.error || 'Error en la generación'
              });
              setGeneratingModel(false);
            }
          } catch {
            // Continue polling
          }
        }, 10000);

        // Timeout después de 5 minutos
        setTimeout(() => clearInterval(pollInterval), 300000);

      } else if (data.modelUrl) {
        setGenerationProgress({
          status: 'completed',
          message: 'Modelo generado exitosamente',
          resultUrl: data.modelUrl
        });
        setGeneratingModel(false);
      }

    } catch (error) {
      console.error('Error generating 3D model:', error);
      setGenerationProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Error al generar el modelo 3D'
      });
      setGeneratingModel(false);
    }
  };

  // Función para usar URL del modelo generado
  const handleUseGeneratedModel = async () => {
    if (generationProgress.resultUrl) {
      await handleSaveModelUrl(generationProgress.resultUrl);
    }
  };

  // Función para obtener sugerencias de IA para modelos 3D
  const fetchAiSuggestions = async () => {
    if (!component) return;

    setLoadingAiSuggestions(true);
    setAiSuggestionsError(null);

    try {
      const response = await fetch('/api/ai/suggest-3d-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          component: {
            name: component.name,
            type: component.type,
            code: component.code,
            description: component.description || component.technicalInfo,
            system: component.system,
          }
        })
      });

      if (!response.ok) {
        throw new Error('Error al obtener sugerencias');
      }

      const data = await response.json();
      setAiSuggestions(data);
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
      setAiSuggestionsError('No se pudieron obtener sugerencias. Intenta de nuevo.');
    } finally {
      setLoadingAiSuggestions(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(label);
      toast({ title: 'Copiado', description: `${label} copiado al portapapeles` });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo copiar al portapapeles', variant: 'destructive' });
    }
  };

  // useEffect para documentación de componentes, estado de máquina y stats
  useEffect(() => {
    if (component?.id) {
      fetchComponentDocuments();
      fetchMachineStatus();
      fetchComponentStats();
    }
  }, [component?.id]);

  // Función para obtener stats del componente
  const fetchComponentStats = async () => {
    if (!component?.id) return;
    setLoadingStats(true);

    try {
      // Obtener fallas del componente
      const failuresRes = await fetch(`/api/components/${component.id}/failures`);
      let failuresData = { failures: [] };
      if (failuresRes.ok) {
        failuresData = await failuresRes.json();
      }

      // Obtener work orders del componente
      const workOrdersRes = await fetch(`/api/components/${component.id}/work-orders`);
      let workOrdersData: any[] = [];
      if (workOrdersRes.ok) {
        const woData = await workOrdersRes.json();
        workOrdersData = woData.workOrders || woData || [];
      }

      // Calcular stats
      const failures = failuresData.failures || [];
      const openFailures = failures.filter((f: any) =>
        f.status === 'OPEN' || f.status === 'IN_PROGRESS' || f.status === 'PENDING'
      );

      const pendingWOs = workOrdersData.filter((wo: any) =>
        wo.status === 'PENDING' || wo.status === 'IN_PROGRESS' || wo.status === 'SCHEDULED'
      );

      // Encontrar último mantenimiento completado
      const completedWOs = workOrdersData
        .filter((wo: any) => wo.status === 'COMPLETED')
        .sort((a: any, b: any) =>
          new Date(b.completedDate || b.updatedAt).getTime() -
          new Date(a.completedDate || a.updatedAt).getTime()
        );

      setComponentStats({
        failuresCount: failures.length,
        openFailuresCount: openFailures.length,
        workOrdersCount: workOrdersData.length,
        pendingWorkOrdersCount: pendingWOs.length,
        lastMaintenance: completedWOs[0]?.completedDate || completedWOs[0]?.updatedAt || null,
        isActive: component.isActive !== false,
      });
    } catch (error) {
      console.error('Error fetching component stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Función para recargar subcomponentes desde la base de datos
  const reloadSubcomponents = async () => {
    if (!component?.id) return;
    try {
      const response = await fetch(`/api/components/${component.id}/subcomponents`);
      if (response.ok) {
        const data = await response.json();
        setSubcomponents(data);
      }
    } catch (error) {
      console.error('Error al recargar subcomponentes:', error);
    }
  };

  useEffect(() => {
    if (isOpen && component?.id) {
      reloadSubcomponents();
    } else {
      setSubcomponents(component?.children || []);
    }
  }, [component, isOpen]);

  if (!component) return null;

  // Log para depuración
  const getComponentTypeBadge = (type: string) => {
    const normalizedType = type.toLowerCase();
    switch (normalizedType) {
      case 'part':
        return <Badge variant="default" className="bg-info">Parte Principal</Badge>;
      case 'piece':
        return <Badge variant="outline" className="bg-success-muted text-success border-success-muted">Pieza</Badge>;
      case 'subpiece':
        return <Badge variant="outline" className="bg-warning-muted text-warning-muted-foreground border-warning-muted">Subpieza</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getComponentIcon = (type: string) => {
    const normalizedType = type.toLowerCase();
    switch (normalizedType) {
      case 'part':
        return <Settings className="h-6 w-6 text-info" />;
      case 'piece':
        return <Wrench className="h-6 w-6 text-success" />;
      case 'subpiece':
        return <Settings className="h-6 w-6 text-warning-muted-foreground" />;
      default:
        return <Wrench className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getComponentTypeLabel = (type: string) => {
    const normalizedType = type.toLowerCase();
    switch (normalizedType) {
      case 'part':
        return 'Parte Principal';
      case 'piece':
        return 'Pieza';
      case 'subpiece':
        return 'Subpieza';
      default:
        return type;
    }
  };

  // ✨ Helper para mostrar el badge de criticidad
  const getCriticalityBadge = (criticality: number | undefined) => {
    if (criticality === undefined || criticality === null) return null;

    let bgColor = 'bg-muted text-muted-foreground';
    let label = 'Sin datos';

    if (criticality >= 8) {
      bgColor = 'bg-destructive/10 text-destructive';
      label = 'Crítico';
    } else if (criticality >= 5) {
      bgColor = 'bg-warning-muted text-warning-muted-foreground';
      label = 'Medio';
    } else {
      bgColor = 'bg-success-muted text-success';
      label = 'Bajo';
    }

    return (
      <Badge className={cn(bgColor, 'flex items-center gap-1 text-xs border-0')}>
        <Gauge className="h-3 w-3" />
        {criticality}/10
      </Badge>
    );
  };

  // ✨ Helper para el badge de seguridad crítica
  const getSafetyCriticalBadge = (isSafetyCritical: boolean | undefined) => {
    if (!isSafetyCritical) return null;

    return (
      <Badge className="bg-destructive text-destructive-foreground flex items-center gap-1 text-xs border-0 shadow-sm">
        <Shield className="h-3 w-3" />
        Crítico Seguridad
      </Badge>
    );
  };

  const getSystemLabel = (system: string) => {
    const normalizedSystem = system.toLowerCase();
    switch (normalizedSystem) {
      case 'electrico':
        return 'Sistema Eléctrico';
      case 'hidraulico':
        return 'Sistema Hidráulico';
      case 'neumatico':
        return 'Sistema Neumático';
      case 'automatizacion':
        return 'Automatización';
      case 'mecanico':
        return 'Sistema Mecánico';
      case 'refrigeracion':
        return 'Sistema de Refrigeración';
      case 'lubricacion':
        return 'Sistema de Lubricación';
      case 'combustible':
        return 'Sistema de Combustible';
      case 'control':
        return 'Sistema de Control';
      case 'seguridad':
        return 'Sistema de Seguridad';
      case 'otro':
        return 'Otro Sistema';
      default:
        return system;
    }
  };

  const handleViewSubcomponentDetails = (subcomponent: MachineComponent) => {
    setSelectedSubcomponent(subcomponent);
    setIsSubcomponentModalOpen(true);
  };

  const handleCloseSubcomponentModal = () => {
    setIsSubcomponentModalOpen(false);
    setSelectedSubcomponent(null);
  };

  const handleAddSubcomponent = async (data: any) => {
    try {
      const payload = {
        ...data,
        parentId: component?.id,
        machineId: component?.machineId,
      };
      const response = await fetch('/api/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Error al crear el subcomponente');
      
      // Recargar subcomponentes desde la base de datos
      const subcomponentsResponse = await fetch(`/api/components/${component?.id}/subcomponents`);
      if (subcomponentsResponse.ok) {
        const updatedSubcomponents = await subcomponentsResponse.json();
        setSubcomponents(updatedSubcomponents);
      }
      
      setIsAddDialogOpen(false);
      toast({ title: 'Subcomponente creado', description: 'El subcomponente fue creado correctamente.' });
    } catch (error) {
      setIsAddDialogOpen(false);
      toast({ title: 'Error', description: 'No se pudo crear el subcomponente', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!component) return;
    try {
      const res = await fetch(`/api/components/${component.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar el componente');
      
      const result = await res.json();
      
      // Mostrar mensaje personalizado si se eliminaron repuestos
      const message = result.message || 'El componente fue eliminado correctamente.';
      toast({ title: 'Componente eliminado', description: message });
      onClose();
      if (onDeleted) onDeleted();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el componente', variant: 'destructive' });
    }
  };

  const handleDeleteSubcomponent = async (subcomponent: MachineComponent) => {
    try {
      const res = await fetch(`/api/components/${subcomponent.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar el subcomponente');
      
      const result = await res.json();
      
      // Mostrar mensaje personalizado si se eliminaron repuestos
      const message = result.message || 'El subcomponente fue eliminado correctamente.';
      toast({ title: 'Subcomponente eliminado', description: message });
      reloadSubcomponents(); // Recargar la lista de subcomponentes
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el subcomponente', variant: 'destructive' });
    }
  };

  const handleEditComponent = async (data: any) => {
    if (!component) return;
    try {
      const res = await fetch(`/api/components/${component.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.details || 'Error al actualizar el componente');
      }
      
      const result = await res.json();
      
      toast({
        title: 'Componente actualizado',
        description: result.spare ?
          `Componente actualizado. ${result.spare.action === 'created' ? 'Repuesto creado automáticamente.' : result.spare.action === 'linked' ? 'Repuesto vinculado exitosamente.' : ''}` :
          'El componente fue actualizado correctamente.'
      });
      setIsEditDialogOpen(false);
      onClose();
      if (onDeleted) onDeleted();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el componente', variant: 'destructive' });
    }
  };

  const handleEditSubcomponent = async (data: any) => {
    if (!editSubcomponent) return;
    try {
      const res = await fetch(`/api/components/${editSubcomponent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error al actualizar el subcomponente');
      toast({ title: 'Subcomponente actualizado', description: 'El subcomponente fue actualizado correctamente.' });
      setIsEditSubDialogOpen(false);
      reloadSubcomponents();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar el subcomponente', variant: 'destructive' });
    }
  };

  const fetchComponentDocuments = async () => {
    setLoadingComponentDocs(true);
    setErrorComponentDocs(null);
    try {
      const res = await fetch(`/api/documents?entityType=component&entityId=${component.id}`);
      if (!res.ok) throw new Error('Error al obtener documentos');
      const data = await res.json();
      setComponentDocuments(data);
    } catch (err) {
      setErrorComponentDocs('No se pudieron cargar los documentos');
    } finally {
      setLoadingComponentDocs(false);
    }
  };

  const fetchMachineStatus = async () => {
    if (!component?.machineId) return;
    
    try {
      const response = await fetch(`/api/maquinas/${component.machineId}`);
      if (response.ok) {
        const machine = await response.json();
        setMachineStatus(machine.status || 'ACTIVE');
        setMachineName(machine.name || 'Máquina desconocida');
      }
    } catch (error) {
      console.error('Error fetching machine status:', error);
      setMachineStatus('ACTIVE');
      setMachineName('Máquina desconocida');
    }
  };

  const getMachineStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'OUT_OF_SERVICE':
        return 'Fuera de servicio';
      case 'DECOMMISSIONED':
        return 'Baja';
      case 'MAINTENANCE':
        return 'Mantenimiento';
      default:
        return 'Activo';
    }
  };

  const handleComponentDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Limpiar mensajes previos
    setUploadingComponentDoc(true);
    setErrorComponentDocs(null);
    setSuccessComponentDoc(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'component');
      formData.append('entityId', component.id.toString());
      formData.append('fileType', 'document');

      // 1. Subir a S3
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || 'Error al subir el documento');
      }
      const uploadData = await uploadRes.json();

      // 2. Guardar referencia en la base de datos
      const saveRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'component',
          entityId: Number(component.id),
          url: uploadData.url,
          fileName: uploadData.fileName || file.name,
          originalName: uploadData.originalName || file.name,
        }),
      });
      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || 'Error al guardar el documento');
      }

      // Refetch y esperar antes de mostrar éxito
      await fetchComponentDocuments();
      setSuccessComponentDoc(`Documento "${file.name}" subido correctamente`);
      toast({ title: 'Documento subido', description: `"${file.name}" se guardó correctamente.` });

      // Limpiar mensaje de éxito después de 5 segundos
      setTimeout(() => setSuccessComponentDoc(null), 5000);
    } catch (err: any) {
      setErrorComponentDocs(err.message || 'Error desconocido');
      toast({ title: 'Error', description: err.message || 'No se pudo subir el documento', variant: 'destructive' });
    } finally {
      setUploadingComponentDoc(false);
      // Resetear el input para permitir subir el mismo archivo de nuevo
      event.target.value = '';
    }
  };

  const handleDeleteComponentDocument = async (docId: string | number) => {
    const ok = await confirm({
      title: 'Eliminar documento',
      description: '¿Seguro que deseas eliminar este documento?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    if (!user) {
      setErrorComponentDocs('Debes estar autenticado para eliminar documentos');
      return;
    }

    setErrorComponentDocs(null);
    setSuccessComponentDoc(null);
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al eliminar el documento');
      // Refetch y esperar antes de mostrar éxito
      await fetchComponentDocuments();
      setSuccessComponentDoc('Documento eliminado');
    } catch (err: any) {
      setErrorComponentDocs(err.message || 'Error desconocido');
    }
  };

  const handleMoveComponentDocToFolder = async (docId: string | number, folder: string | null) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ folder }),
      });
      if (!res.ok) throw new Error('Error al mover el documento');
      await fetchComponentDocuments();
      setSuccessComponentDoc(folder ? `Documento movido a "${folder}"` : 'Documento removido de carpeta');
      setTimeout(() => setSuccessComponentDoc(null), 3000);
    } catch (err: any) {
      setErrorComponentDocs(err.message || 'Error al mover');
    }
  };

  const handleEditClick = () => {
    if (!component) return;
    setEditComponent(component);
    setIsEditDialogOpen(true);
  };

  const handleViewFailureDetails = (failure: any) => {
    // Placeholder for future implementation
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          size="lg"
          className="p-0"
          hideCloseButton
        >
          {/* Header idéntico a MachineDetailDialog */}
          <DialogHeader className="p-3 md:p-4 flex-shrink-0 border-b space-y-0">
            <DialogTitle className="sr-only">{component.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Detalles del componente {component.name}
            </DialogDescription>

            <div className="w-full space-y-3">
              {/* Primera fila: Info de componente + botones */}
              <div className="flex items-center gap-4">
                {/* Component Photo/Icon */}
                <div className="relative shrink-0">
                  {component.logo ? (
                    <img
                      src={component.logo}
                      alt={component.name}
                      className="w-12 h-12 rounded-lg object-cover border border-border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center border border-border">
                      {getComponentIcon(component.type)}
                    </div>
                  )}
                  {/* Status indicator */}
                  <div className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background',
                    component.isActive !== false ? 'bg-success' : 'bg-muted-foreground'
                  )} />
                </div>

                {/* Name + Meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold truncate">{component.name}</h2>
                    {getComponentTypeBadge(component.type)}
                    {getCriticalityBadge(component.criticality)}
                    {getSafetyCriticalBadge(component.isSafetyCritical)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {(component.machineName || machineName) && (
                      <span className="flex items-center gap-0.5">
                        <Layers className="h-3 w-3" />
                        {component.machineName || machineName}
                      </span>
                    )}
                    {component.system && <span>• {getSystemLabel(component.system)}</span>}
                    {component.brand && <span>• {component.brand}</span>}
                    {component.model && <span className="font-mono">• {component.model}</span>}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Botón Nuevo para crear mantenimientos/fallas */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="default" size="sm" className="h-7 text-xs px-2 sm:px-3">
                        <Plus className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Nuevo</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowPreventiveDialog(true)}>
                        <CalendarDays className="h-4 w-4 mr-2 text-info" />
                        Nuevo Preventivo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setWorkOrderWizardType('CORRECTIVE'); setShowWorkOrderWizard(true); }}>
                        <Wrench className="h-4 w-4 mr-2 text-warning" />
                        Nuevo Correctivo
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setWorkOrderWizardType(null); setShowWorkOrderWizard(true); }}>
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Nueva OT
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowFailureReportDialog(true)}>
                        <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
                        Nueva Falla
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Menú de 3 puntitos para editar/convertir/eliminar */}
                  {(canEditComponent || canPromoteComponent || canDeleteComponent) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEditComponent && (
                          <DropdownMenuItem onClick={handleEditClick}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        {canPromoteComponent && (
                          <DropdownMenuItem onClick={() => setIsPromoteDialogOpen(true)}>
                            <Cog className="h-4 w-4 mr-2" />
                            Convertir en Máquina
                          </DropdownMenuItem>
                        )}
                        {(canEditComponent || canPromoteComponent) && canDeleteComponent && <DropdownMenuSeparator />}
                        {canDeleteComponent && (
                          <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Botón toggle KPIs - solo visible en móvil */}
              <div className="sm:hidden">
                <button
                  onClick={() => setShowKpis(!showKpis)}
                  className="w-full flex items-center justify-between px-2 py-1 bg-muted/30 rounded-md border border-border/50 text-xs text-muted-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" />
                    KPIs
                  </span>
                  {showKpis ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Segunda fila: KPIs en grid responsivo */}
              <div className={cn('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2', !showKpis ? 'hidden sm:grid' : '')}>
                {/* Subcomponentes */}
                <Card className="p-3 bg-info-muted border-info-muted">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-info-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">Subcomponentes</p>
                      <p className="text-xl font-bold text-info-muted-foreground leading-tight">
                        {subcomponents.length}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Fallas Abiertas */}
                <Card className={cn('p-3',
                  componentStats.openFailuresCount > 0
                    ? 'bg-destructive/10 border-destructive/20'
                    : 'bg-muted/30 border-border/50'
                )}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={cn('h-5 w-5', componentStats.openFailuresCount > 0 ? 'text-destructive' : 'text-muted-foreground')} />
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">Fallas Abiertas</p>
                      <p className={cn('text-xl font-bold leading-tight', componentStats.openFailuresCount > 0 ? 'text-destructive' : 'text-foreground')}>
                        {componentStats.openFailuresCount}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* OT Pendientes */}
                <Card className={cn('p-3',
                  componentStats.pendingWorkOrdersCount > 0
                    ? 'bg-warning-muted border-warning-muted'
                    : 'bg-muted/30 border-border/50'
                )}>
                  <div className="flex items-center gap-2">
                    <ClipboardList className={cn('h-5 w-5', componentStats.pendingWorkOrdersCount > 0 ? 'text-warning-muted-foreground' : 'text-muted-foreground')} />
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">OT Pendientes</p>
                      <p className={cn('text-xl font-bold leading-tight', componentStats.pendingWorkOrdersCount > 0 ? 'text-warning-muted-foreground' : 'text-foreground')}>
                        {componentStats.pendingWorkOrdersCount}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Total OTs */}
                <Card className="p-3 bg-muted/30 border-border/50">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">Total OTs</p>
                      <p className="text-xl font-bold text-foreground leading-tight">{componentStats.workOrdersCount}</p>
                    </div>
                  </div>
                </Card>

                {/* Último Mantenimiento */}
                <Card className="p-3 bg-muted/30 border-border/50">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">Últ. Mantenimiento</p>
                      <p className="text-sm font-bold text-foreground leading-tight">
                        {componentStats.lastMaintenance
                          ? formatDate(componentStats.lastMaintenance)
                          : 'Sin registro'}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            {/* TabsList responsive como MachineDetailDialog */}
            <div className="px-2 md:px-4 py-2 flex-shrink-0 flex justify-center">
              <TabsList className="inline-flex h-8 bg-muted/40 border border-border rounded-lg p-0.5 overflow-x-auto max-w-full gap-0.5">
                <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Resumen</span>
                </TabsTrigger>
                <TabsTrigger value="info" className="flex items-center gap-1.5 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                  <Info className="h-3.5 w-3.5" />
                  <span>Información</span>
                </TabsTrigger>
                <TabsTrigger value="subcomponents" className="flex items-center gap-1.5 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Subcomponentes</span>
                  {subcomponents.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs bg-info-muted text-info-muted-foreground">
                      {subcomponents.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="maintenance" className="flex items-center gap-1.5 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Mantenimiento</span>
                  {componentStats.pendingWorkOrdersCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs bg-info-muted text-info-muted-foreground">
                      {componentStats.pendingWorkOrdersCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="failures" className="flex items-center gap-1.5 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Fallas</span>
                  {componentStats.openFailuresCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs bg-destructive/10 text-destructive">
                      {componentStats.openFailuresCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-1.5 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                  <History className="h-3.5 w-3.5" />
                  <span>Historial</span>
                </TabsTrigger>
                <TabsTrigger value="3d" className="flex items-center gap-1.5 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                  <Box className="h-3.5 w-3.5" />
                  <span>3D</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto px-2 md:px-4 pb-4">
              <TabsContent value="overview" className="mt-0">
                <ComponentOverviewTab
                  component={component}
                  onTabChange={setActiveTab}
                />
              </TabsContent>

              <TabsContent value="info" className="space-y-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {/* Información General */}
                  <Card>
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                        <Info className="h-4 w-4" />
                        <span>Información General</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Nombre</p>
                        <p className="font-medium text-sm md:text-base">{component.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Tipo</p>
                          <p className="font-medium text-sm">{getComponentTypeLabel(component.type)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Sistema</p>
                          <p className="font-medium text-sm">{component.system ? getSystemLabel(component.system) : 'No especificado'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Descripción</p>
                        <p className="text-sm mt-0.5 line-clamp-3">
                          {typeof component.technicalInfo === 'string'
                            ? component.technicalInfo
                            : component.technicalInfo
                              ? JSON.stringify(component.technicalInfo)
                              : 'Sin descripción disponible'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">ID</p>
                          <div className="flex items-center gap-1">
                            <p className="font-medium text-sm font-mono">{component.id}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => copyToClipboard(String(component.id), 'ID')}
                              title="Copiar ID"
                            >
                              {copiedId === 'ID' ? (
                                <Check className="h-3 w-3 text-success" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Estado máquina</p>
                          <p className="font-medium text-sm">{getMachineStatusText(machineStatus)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Jerarquía */}
                  <Card>
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                        <Settings className="h-4 w-4" />
                        <span>Jerarquía</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Máquina</p>
                        <p className="font-medium text-sm">{machineName || `ID: ${component.machineId}`}</p>
                      </div>
                      {component.parentId && (
                        <div>
                          <p className="text-xs text-muted-foreground">Componente Padre</p>
                          <p className="font-medium text-sm">ID: {component.parentId}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Subcomponentes</p>
                        <p className="font-medium text-sm">{component.children?.length || 0} elementos</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ✨ Criticidad y Seguridad */}
                  <Card className="md:col-span-2">
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                        <Gauge className="h-4 w-4" />
                        <span>Criticidad y Seguridad</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Score de Criticidad */}
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-center mb-2">
                            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
                              (component.criticality ?? 0) >= 8 ? 'bg-destructive/10 text-destructive' :
                              (component.criticality ?? 0) >= 5 ? 'bg-warning-muted text-warning-muted-foreground' :
                              'bg-success-muted text-success'
                            )}>
                              {component.criticality ?? '—'}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">Criticidad</p>
                          <p className="text-sm font-medium">
                            {(component.criticality ?? 0) >= 8 ? 'Alta' :
                             (component.criticality ?? 0) >= 5 ? 'Media' :
                             component.criticality ? 'Baja' : 'No definida'}
                          </p>
                        </div>

                        {/* Seguridad Crítica */}
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-center mb-2">
                            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center',
                              component.isSafetyCritical
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-success-muted text-success'
                            )}>
                              <Shield className="h-6 w-6" />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">Seguridad</p>
                          <p className="text-sm font-medium">
                            {component.isSafetyCritical ? 'Crítico' : 'Normal'}
                          </p>
                        </div>

                        {/* Fallas Registradas */}
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-center mb-2">
                            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center',
                              (component.failureCount ?? 0) > 5
                                ? 'bg-destructive/10 text-destructive'
                                : (component.failureCount ?? 0) > 0
                                  ? 'bg-warning-muted text-warning-muted-foreground'
                                  : 'bg-success-muted text-success'
                            )}>
                              <AlertTriangle className="h-6 w-6" />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">Fallas</p>
                          <p className="text-sm font-medium">{component.failureCount ?? 0} registradas</p>
                        </div>

                        {/* OTs Asociadas */}
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-center mb-2">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-info-muted text-info-muted-foreground">
                              <Wrench className="h-6 w-6" />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">Órdenes</p>
                          <p className="text-sm font-medium">{component.workOrderCount ?? 0} OTs</p>
                        </div>
                      </div>

                      {/* Nota sobre criticidad */}
                      {component.isSafetyCritical && (
                        <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                          <div className="flex items-start gap-2">
                            <Shield className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-destructive">
                                Componente crítico para la seguridad
                              </p>
                              <p className="text-xs text-destructive mt-1">
                                Este componente requiere atención especial durante el mantenimiento.
                                Asegúrese de seguir todos los procedimientos LOTO y de seguridad.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Documentación */}
                  <Card className="md:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 md:h-5 md:w-5" />
                          <span className="text-sm md:text-base">Documentación</span>
                          <Badge variant="outline" className="text-xs">
                            {componentDocuments.length}
                          </Badge>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1 h-8 text-xs"
                          disabled={uploadingComponentDoc}
                          onClick={() => document.getElementById('component-doc-upload')?.click()}
                        >
                          {uploadingComponentDoc ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span className="hidden sm:inline">Subiendo...</span>
                            </>
                          ) : (
                            <>
                              <FilePlus className="h-3 w-3" />
                              <span className="hidden sm:inline">Subir documento</span>
                              <span className="sm:hidden">Subir</span>
                            </>
                          )}
                        </Button>
                        <input
                          id="component-doc-upload"
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                          onChange={handleComponentDocumentUpload}
                          className="hidden"
                          disabled={uploadingComponentDoc}
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {errorComponentDocs && (
                        <div className="text-destructive text-xs mb-2 p-2 bg-destructive/10 rounded">
                          {errorComponentDocs}
                        </div>
                      )}
                      {successComponentDoc && (
                        <div className="text-success text-xs mb-2 p-2 bg-success-muted rounded">
                          {successComponentDoc}
                        </div>
                      )}
                      <DocumentFolderViewer
                        documents={componentDocuments}
                        loading={loadingComponentDocs}
                        error={null}
                        canEdit={canEditComponent || canDeleteComponent}
                        onDelete={(canEditComponent || canDeleteComponent) ? handleDeleteComponentDocument : undefined}
                        onMoveToFolder={(canEditComponent || canDeleteComponent) ? handleMoveComponentDocToFolder : undefined}
                        storageKey={`component_${component?.id}`}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="subcomponents" className="space-y-4 mt-0">
                {subcomponents && subcomponents.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <h3 className="text-sm md:text-lg font-semibold">
                        Subcomponentes ({subcomponents.length})
                      </h3>
                      {canManageComponents && (
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Agregar subcomponente</span>
                        <span className="sm:hidden">Agregar</span>
                      </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {subcomponents.map((subcomponent) => (
                        <Card
                          key={subcomponent.id}
                          className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/30"
                          onClick={() => handleViewSubcomponentDetails(subcomponent)}
                        >
                          <CardHeader className="p-3 pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-sm md:text-base flex items-center gap-2 min-w-0">
                                <span className="flex-shrink-0">{getComponentIcon(subcomponent.type)}</span>
                                <span className="truncate">{subcomponent.name}</span>
                              </CardTitle>
                              <div className="flex-shrink-0">{getComponentTypeBadge(subcomponent.type)}</div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-0">
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {typeof subcomponent.technicalInfo === 'string'
                                ? subcomponent.technicalInfo
                                : subcomponent.technicalInfo
                                  ? JSON.stringify(subcomponent.technicalInfo)
                                  : 'Sin descripción'}
                            </p>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs text-muted-foreground">
                                ID: {subcomponent.id}
                              </div>
                              <div className="flex gap-1">
                                {canManageComponents && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditSubcomponent(subcomponent);
                                    setIsEditSubDialogOpen(true);
                                  }}
                                  className="h-7 w-7 p-0"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                )}
                                {canDeleteComponent && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-7 w-7 p-0"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará permanentemente el subcomponente &quot;{subcomponent.name}&quot; y todos sus subcomponentes.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteSubcomponent(subcomponent)}>
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                )}
                              </div>
                            </div>
                            {subcomponent.children && subcomponent.children.length > 0 && (
                              <div className="pt-2 border-t">
                                <p className="text-xs text-muted-foreground mb-1">
                                  {subcomponent.children.length} subpiezas
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {subcomponent.children.slice(0, 3).map((subpiece) => (
                                    <Badge
                                      key={subpiece.id}
                                      variant="outline"
                                      className="text-xs cursor-pointer hover:bg-secondary/80"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewSubcomponentDetails(subpiece);
                                      }}
                                    >
                                      {subpiece.name}
                                    </Badge>
                                  ))}
                                  {subcomponent.children.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{subcomponent.children.length - 3} más
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="font-medium text-lg mb-2">No hay subcomponentes</h3>
                      <p className="text-muted-foreground mb-4">
                        Este componente no tiene subcomponentes registrados.
                      </p>
                      {canManageComponents && (
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar subcomponente
                      </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
                {isAddDialogOpen && component && component.machineId && canManageComponents && (
                  <ComponentDialog
                    isOpen={isAddDialogOpen}
                    onClose={() => setIsAddDialogOpen(false)}
                    onSave={handleAddSubcomponent}
                    machineId={Number(component.machineId)}
                    machineName={component.machineName}
                    parentComponent={{
                      id: Number(component.id),
                      name: component.name,
                      breadcrumb: component.breadcrumb || [component.name],
                      depth: component.depth || 0
                    }}
                    initialValues={{
                      name: '',
                      type: 'PART',
                      technicalInfo: '',
                      machineId: Number(component.machineId),
                      logo: '',
                      photo: ''
                    }}
                  />
                )}
                {isEditSubDialogOpen && editSubcomponent && editSubcomponent.id && canManageComponents && (
                  <ComponentDialog
                    isOpen={isEditSubDialogOpen}
                    onClose={() => setIsEditSubDialogOpen(false)}
                    onSave={handleEditSubcomponent}
                    machineId={editSubcomponent.machineId ? Number(editSubcomponent.machineId) : 0}
                    initialValues={{
                      id: editSubcomponent.id,
                      name: editSubcomponent.name,
                      type: editSubcomponent.type,
                      machineId: editSubcomponent.machineId ? Number(editSubcomponent.machineId) : 0,
                      technicalInfo: typeof editSubcomponent.technicalInfo === 'string'
                        ? editSubcomponent.technicalInfo
                        : editSubcomponent.technicalInfo
                          ? JSON.stringify(editSubcomponent.technicalInfo)
                          : '',
                      logo: editSubcomponent.logo || '',
                      // Información del repuesto vinculado
                      spareAction: editSubcomponent.tools && editSubcomponent.tools.length > 0 ? 'link' : 'none',
                      existingSpareId: editSubcomponent.tools && editSubcomponent.tools.length > 0
                        ? editSubcomponent.tools[0].toolId
                        : undefined,
                      // Si hay repuesto vinculado, mostrar información adicional
                      spareName: editSubcomponent.tools && editSubcomponent.tools.length > 0
                        ? editSubcomponent.tools[0].tool?.name
                        : '',
                      spareDescription: editSubcomponent.tools && editSubcomponent.tools.length > 0
                        ? editSubcomponent.tools[0].tool?.description
                        : '',
                      initialStock: editSubcomponent.tools && editSubcomponent.tools.length > 0
                        ? editSubcomponent.tools[0].tool?.stockQuantity || 0
                        : 0,
                      spareMinStock: editSubcomponent.tools && editSubcomponent.tools.length > 0
                        ? editSubcomponent.tools[0].minStockLevel || 0
                        : 0,
                    }}
                  />
                )}
              </TabsContent>

              {isEditDialogOpen && editComponent && editComponent.id && (
                <ComponentDialog
                  isOpen={isEditDialogOpen}
                  onClose={() => setIsEditDialogOpen(false)}
                  onSave={handleEditComponent}
                  machineId={editComponent.machineId ? Number(editComponent.machineId) : 0}
                  initialValues={{
                    id: editComponent.id,
                    name: editComponent.name,
                    type: editComponent.type,
                    machineId: editComponent.machineId ? Number(editComponent.machineId) : 0,
                    technicalInfo: typeof editComponent.technicalInfo === 'string'
                      ? editComponent.technicalInfo
                      : editComponent.technicalInfo
                        ? JSON.stringify(editComponent.technicalInfo)
                        : '',
                    logo: editComponent.logo || '',
                    // Información del repuesto vinculado
                    spareAction: editComponent.tools && editComponent.tools.length > 0 ? 'link' : 'none',
                    existingSpareId: editComponent.tools && editComponent.tools.length > 0
                      ? editComponent.tools[0].toolId
                      : undefined,
                    // Si hay repuesto vinculado, mostrar información adicional
                    spareName: editComponent.tools && editComponent.tools.length > 0
                      ? editComponent.tools[0].tool?.name
                      : '',
                    spareDescription: editComponent.tools && editComponent.tools.length > 0
                      ? editComponent.tools[0].tool?.description
                      : '',
                    initialStock: editComponent.tools && editComponent.tools.length > 0
                      ? editComponent.tools[0].tool?.stockQuantity || 0
                      : 0,
                    spareMinStock: editComponent.tools && editComponent.tools.length > 0
                      ? editComponent.tools[0].minStockLevel || 0
                      : 0,
                  }}
                />
              )}



              <TabsContent value="maintenance" className="mt-0">
                {activeTab === 'maintenance' && component && (
                  <div className="h-full min-h-[500px]">
                    <MachineMaintenanceTab
                      machineId={
                        typeof component.machineId === 'number'
                          ? component.machineId
                          : parseInt(String(component.machineId || '0'), 10)
                      }
                      machineName={machineName || component.machineName || component.name}
                      companyId={currentCompany?.id || 0}
                      componentId={component.id}
                      componentName={component.name}
                      parentComponentId={component.parentId}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="failures" className="mt-0">
                <ComponentFailuresContent
                  componentId={component.id}
                  componentName={component.name}
                />
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <ComponentHistoryContent
                  machineId={typeof component.machineId === 'string' ? parseInt(component.machineId, 10) : component.machineId}
                  machineName={`Máquina ID: ${component.machineId}`}
                  componentId={component.id}
                  componentName={component.name}
                />
              </TabsContent>

              {/* Pestaña 3D - Lazy loading: solo se carga cuando se accede */}
              <TabsContent value="3d" className="mt-0">
                {activeTab === '3d' && (
                  <div className="space-y-4">
                    {/* Visor 3D o estado vacío */}
                    <Card>
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                          <Box className="h-4 w-4" />
                          <span>Modelo 3D del Componente</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        {component.model3dUrl ? (
                          <Machine3DViewer
                            modelUrl={component.model3dUrl}
                            height="450px"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[250px] bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20">
                            <Box className="h-12 w-12 text-muted-foreground/30 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">
                              Sin modelo 3D asignado
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1 text-center max-w-xs mb-4">
                              Usa la IA para buscar modelos 3D disponibles para este componente
                            </p>
                            <Button
                              variant="default"
                              size="sm"
                              className="gap-2"
                              onClick={fetchAiSuggestions}
                              disabled={loadingAiSuggestions}
                            >
                              {loadingAiSuggestions ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Buscando...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4" />
                                  Buscar con IA
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Info del modelo si existe */}
                    {component.model3dUrl && (
                      <Card>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">URL del modelo</p>
                              <p className="text-sm font-mono truncate max-w-[400px]">
                                {component.model3dUrl}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchAiSuggestions}
                                disabled={loadingAiSuggestions}
                              >
                                {loadingAiSuggestions ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(component.model3dUrl, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Abrir
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Error de sugerencias */}
                    {aiSuggestionsError && (
                      <Card className="border-destructive/50 bg-destructive/5">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <p className="text-sm">{aiSuggestionsError}</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Sugerencias de IA */}
                    {aiSuggestions && (
                      <Card className="border-primary/30 bg-primary/5">
                        <CardHeader className="p-3 pb-2">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <Sparkles className="h-4 w-4 text-warning" />
                            <span>Sugerencias de la IA</span>
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {aiSuggestions.suggestions.length} fuentes encontradas
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-3">
                          {/* Análisis de IA */}
                          {aiSuggestions.aiAnalysis && (
                            <div className="p-2 bg-background rounded-lg border space-y-2">
                              <div className="flex items-center gap-2 text-xs font-medium">
                                <Lightbulb className="h-3.5 w-3.5 text-warning" />
                                Análisis del componente
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {aiSuggestions.aiAnalysis.componentType && (
                                  <div>
                                    <span className="text-muted-foreground">Tipo detectado:</span>
                                    <span className="ml-1 font-medium capitalize">{aiSuggestions.aiAnalysis.componentType}</span>
                                  </div>
                                )}
                                {aiSuggestions.aiAnalysis.standardPart !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Pieza estándar:</span>
                                    <span className="ml-1 font-medium">{aiSuggestions.aiAnalysis.standardPart ? 'Sí' : 'No'}</span>
                                  </div>
                                )}
                                {aiSuggestions.aiAnalysis.possibleManufacturers && aiSuggestions.aiAnalysis.possibleManufacturers.length > 0 && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Fabricantes:</span>
                                    <span className="ml-1 font-medium">{aiSuggestions.aiAnalysis.possibleManufacturers.join(', ')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Términos de búsqueda sugeridos */}
                          {aiSuggestions.searchQueries && aiSuggestions.searchQueries.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs text-muted-foreground mr-1">Búsquedas:</span>
                              {aiSuggestions.searchQueries.slice(0, 3).map((query, i) => (
                                <Badge key={i} variant="outline" className="text-xs font-mono">
                                  {query}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Lista de fuentes */}
                          <div className="space-y-2">
                            {aiSuggestions.suggestions.map((suggestion, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-2 rounded-lg bg-background border hover:border-primary/50 transition-colors group"
                              >
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-lg">
                                  {suggestion.sourceIcon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{suggestion.sourceName}</p>
                                    <Badge
                                      variant={suggestion.confidence === 'high' ? 'default' : suggestion.confidence === 'medium' ? 'secondary' : 'outline'}
                                      className="text-[9px] h-4"
                                    >
                                      {suggestion.confidence === 'high' ? 'Alta' : suggestion.confidence === 'medium' ? 'Media' : 'Baja'}
                                    </Badge>
                                    {suggestion.isPaid && (
                                      <Badge variant="outline" className="text-[9px] h-4 text-warning-muted-foreground">
                                        Pago
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {suggestion.description}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => copyToClipboard(suggestion.url, 'URL')}
                                    title="Copiar URL"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    onClick={() => window.open(suggestion.url, '_blank')}
                                  >
                                    <Globe className="h-3.5 w-3.5" />
                                    Buscar
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Tips */}
                          {aiSuggestions.tips && aiSuggestions.tips.length > 0 && (
                            <div className="p-2 bg-info-muted rounded-lg border border-info-muted">
                              <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-info-muted-foreground space-y-0.5">
                                  {aiSuggestions.tips.map((tip, i) => (
                                    <p key={i}>• {tip}</p>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Botón para nueva búsqueda */}
                          <div className="flex justify-center pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 text-xs"
                              onClick={fetchAiSuggestions}
                              disabled={loadingAiSuggestions}
                            >
                              {loadingAiSuggestions ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Buscando...
                                </>
                              ) : (
                                <>
                                  <Search className="h-3.5 w-3.5" />
                                  Nueva búsqueda
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Si no hay modelo y no hay sugerencias aún, mostrar opciones */}
                    {!component.model3dUrl && !aiSuggestions && !loadingAiSuggestions && (
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <h4 className="text-sm font-medium mb-2">¿Cómo funciona?</h4>
                            <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
                              La IA analizará el nombre del componente <span className="font-medium text-foreground">"{component.name}"</span> y
                              buscará modelos 3D disponibles en catálogos industriales.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground mb-4">
                              <span className="px-2 py-1 bg-muted rounded">🔧 TraceParts</span>
                              <span className="px-2 py-1 bg-muted rounded">📐 GrabCAD</span>
                              <span className="px-2 py-1 bg-muted rounded">⚙️ SKF</span>
                              <span className="px-2 py-1 bg-muted rounded">💨 FESTO</span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setShowGenerateFromPhotoDialog(true)}
                              >
                                <Camera className="h-4 w-4" />
                                Generar desde foto
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                  setNewModelUrl('');
                                  setShowSetModelUrlDialog(true);
                                }}
                              >
                                <Link2 className="h-4 w-4" />
                                Agregar URL manualmente
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Acciones rápidas cuando hay sugerencias pero no modelo */}
                    {!component.model3dUrl && aiSuggestions && (
                      <Card>
                        <CardContent className="p-3">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 text-xs"
                              onClick={() => setShowGenerateFromPhotoDialog(true)}
                            >
                              <Camera className="h-3.5 w-3.5" />
                              Generar desde foto
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 text-xs"
                              onClick={() => {
                                setNewModelUrl('');
                                setShowSetModelUrlDialog(true);
                              }}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              URL manual
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal para promover componente a máquina */}
      <PromoteToMachineDialog
        component={component ? {
          id: typeof component.id === 'string' ? parseInt(component.id, 10) : component.id,
          name: component.name,
          code: component.code,
          type: component.type,
          description: component.description,
          criticality: component.criticality,
          isSafetyCritical: component.isSafetyCritical,
        } : null}
        originMachine={component?.machineId ? {
          id: typeof component.machineId === 'string' ? parseInt(component.machineId, 10) : component.machineId,
          name: machineName || `Máquina ID: ${component.machineId}`,
        } : null}
        isOpen={isPromoteDialogOpen}
        onClose={() => setIsPromoteDialogOpen(false)}
        onSuccess={(newMachine) => {
          setIsPromoteDialogOpen(false);
          onClose();
          // Recargar la página para reflejar cambios
          window.location.reload();
        }}
      />

      {/* Modal recursivo para subcomponentes */}
      <ComponentDetailsModal
        component={selectedSubcomponent}
        isOpen={isSubcomponentModalOpen}
        onClose={handleCloseSubcomponentModal}
      />

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el componente &quot;{component?.name}&quot; y todos sus subcomponentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para establecer URL de modelo 3D */}
      <Dialog open={showSetModelUrlDialog} onOpenChange={setShowSetModelUrlDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Agregar modelo 3D
            </DialogTitle>
            <DialogDescription>
              Ingresa la URL de un modelo 3D en formato GLB o GLTF
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">URL del modelo</label>
              <Input
                placeholder="https://ejemplo.com/modelo.glb"
                value={newModelUrl}
                onChange={(e) => setNewModelUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Formatos soportados: .glb, .gltf
              </p>
            </div>
            <div className="p-3 bg-warning-muted rounded-lg border border-warning-muted">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-warning mt-0.5" />
                <div className="text-xs text-warning-muted-foreground">
                  <p className="font-medium mb-1">¿Dónde obtener la URL?</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-xs">
                    <li>Descarga el modelo de TraceParts, GrabCAD, etc.</li>
                    <li>Súbelo a tu almacenamiento (S3, Google Drive, etc.)</li>
                    <li>Copia la URL pública directa del archivo</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetModelUrlDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleSaveModelUrl(newModelUrl)}
              disabled={saveModelUrlMutation.isPending || !newModelUrl.trim()}
            >
              {saveModelUrlMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs de creación de mantenimiento */}
      {showPreventiveDialog && component && (() => {
        // Si tiene parentId es subcomponente → el componente a pasar es el padre
        const isSubcomponent = !!component.parentId;
        const machineIdNum = typeof component.machineId === 'number'
          ? component.machineId
          : parseInt(String(component.machineId || '0'), 10);
        return (
          <PreventiveMaintenanceDialog
            isOpen={showPreventiveDialog}
            onClose={() => setShowPreventiveDialog(false)}
            preselectedMachineId={machineIdNum}
            preselectedComponentId={isSubcomponent ? component.parentId : component.id}
            preselectedSubcomponentId={isSubcomponent ? component.id : undefined}
            onSave={() => setShowPreventiveDialog(false)}
          />
        );
      })()}

      {showWorkOrderWizard && component && (() => {
        const isSubcomponent = !!component.parentId;
        const machineIdNum = typeof component.machineId === 'number'
          ? component.machineId
          : parseInt(String(component.machineId || '0'), 10);
        return (
          <WorkOrderWizard
            isOpen={showWorkOrderWizard}
            onClose={() => { setShowWorkOrderWizard(false); setWorkOrderWizardType(null); }}
            preselectedMachine={{
              id: machineIdNum,
              name: machineName || component.machineName || '',
            }}
            preselectedType={workOrderWizardType}
            preselectedComponentId={isSubcomponent ? component.parentId : component.id}
            preselectedSubcomponentId={isSubcomponent ? component.id : undefined}
            onSubmit={async () => { setShowWorkOrderWizard(false); setWorkOrderWizardType(null); }}
          />
        );
      })()}

      {component && (() => {
        const isSubcomponent = !!component.parentId;
        const machineIdNum = typeof component?.machineId === 'number'
          ? component.machineId
          : parseInt(String(component?.machineId || '0'), 10);
        return (
          <FailureQuickReportDialog
            open={showFailureReportDialog}
            onOpenChange={setShowFailureReportDialog}
            preselectedMachineId={machineIdNum}
            preselectedComponentId={isSubcomponent ? component.parentId : component.id}
          />
        );
      })()}

      {/* Dialog para generar modelo 3D desde foto */}
      <Dialog open={showGenerateFromPhotoDialog} onOpenChange={(open) => {
        if (!open) {
          setPhotoFile(null);
          setPhotoPreview(null);
          setGenerationProgress({ status: 'idle', message: '' });
        }
        setShowGenerateFromPhotoDialog(open);
      }}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Generar modelo 3D desde foto
            </DialogTitle>
            <DialogDescription>
              Sube una foto del componente y la IA generará un modelo 3D aproximado
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Estado inicial o selección de foto */}
            {generationProgress.status === 'idle' && (
              <>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  {photoPreview ? (
                    <div className="space-y-3">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="max-h-48 mx-auto rounded-lg object-contain"
                      />
                      <p className="text-xs text-muted-foreground">{photoFile?.name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                      >
                        Cambiar foto
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-sm font-medium">Haz clic para seleccionar una foto</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG o WEBP (máx. 10MB)
                      </p>
                    </label>
                  )}
                </div>
                <div className="p-3 bg-info-muted rounded-lg border border-info-muted">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-info mt-0.5" />
                    <div className="text-xs text-info-muted-foreground">
                      <p className="font-medium mb-1">Recomendaciones para mejores resultados:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>Usa una foto clara con buena iluminación</li>
                        <li>El componente debe ocupar la mayor parte de la imagen</li>
                        <li>Evita fondos complejos</li>
                        <li>El modelo generado es aproximado, no exacto</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Estado de procesamiento */}
            {(generationProgress.status === 'uploading' || generationProgress.status === 'processing') && (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                <p className="text-sm font-medium">{generationProgress.message}</p>
                {generationProgress.progress && (
                  <div className="mt-4 max-w-xs mx-auto">
                    <Progress value={generationProgress.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {generationProgress.progress}% completado
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4">
                  Este proceso puede tomar varios minutos...
                </p>
              </div>
            )}

            {/* Estado completado */}
            {generationProgress.status === 'completed' && (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
                <p className="text-sm font-medium text-success">
                  {generationProgress.message}
                </p>
                {generationProgress.resultUrl && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">URL del modelo generado:</p>
                    <p className="text-xs font-mono truncate">{generationProgress.resultUrl}</p>
                  </div>
                )}
              </div>
            )}

            {/* Estado de error */}
            {generationProgress.status === 'error' && (
              <div className="text-center py-6">
                <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
                <p className="text-sm font-medium text-destructive">
                  {generationProgress.message}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setGenerationProgress({ status: 'idle', message: '' })}
                >
                  Intentar de nuevo
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            {generationProgress.status === 'idle' && (
              <>
                <Button variant="outline" onClick={() => setShowGenerateFromPhotoDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleGenerateFromPhoto}
                  disabled={!photoFile || generatingModel}
                >
                  {generatingModel ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generar modelo 3D
                    </>
                  )}
                </Button>
              </>
            )}
            {generationProgress.status === 'completed' && generationProgress.resultUrl && (
              <>
                <Button variant="outline" onClick={() => setShowGenerateFromPhotoDialog(false)}>
                  Cerrar
                </Button>
                <Button onClick={handleUseGeneratedModel} disabled={saveModelUrlMutation.isPending}>
                  {saveModelUrlMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Usar este modelo'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 