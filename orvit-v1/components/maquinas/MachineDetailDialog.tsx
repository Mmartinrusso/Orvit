'use client';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false;
const log = DEBUG ? (...args: unknown[]) => { /* debug */ } : () => {};

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Machine, MachineComponent, MachineStatus, MachineType } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate, formatDateTime, formatTime } from '@/lib/date-utils';
import EnhancedMaintenancePanel from '@/components/maintenance/EnhancedMaintenancePanel';
import MachineMaintenanceTab from '@/components/maintenance/MachineMaintenanceTab';
import { debugLog } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cog, Info, FileText, History, Network, Tag, Building, Wrench, X, Eye, Plus, Loader2, FilePlus, Calendar, Download, CheckCircle, Clock, User, MapPin, Camera, ExternalLink, Settings, AlertTriangle, ClipboardList, File, Pencil, Trash2, Package, List, Grid, Shield, Hand, MousePointer, ZoomIn, ZoomOut, Home, RotateCcw, Maximize2, Search, UploadCloud, ChevronsUpDown, Check, AlertCircle, ImageIcon, ChevronUp, ChevronDown, Lightbulb, BarChart3, Box, Sparkles } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn, formatNumber } from '@/lib/utils';
import ComponentDialog from './ComponentDialog';
import AIComponentImportDialog from './AIComponentImportDialog';
import ComponentDetailsModal from './ComponentDetailsModal';
import { DocumentFolderViewer } from './DocumentFolderViewer';
import { GoogleDrivePicker } from '@/components/ui/google-drive-picker';
import MachineSchemaView from './MachineSchemaView';
import MachineHistoryDialog from './MachineHistoryDialog';
import MachineOverviewTab from './tabs/MachineOverviewTab';
import Machine3DViewerTab from './tabs/Machine3DViewerTab';
import PreventiveMaintenanceDialog from '../work-orders/PreventiveMaintenanceDialog';
import CorrectiveMaintenanceDialog from '../work-orders/CorrectiveMaintenanceDialog';
import PreventiveMaintenanceDetailModal from '../work-orders/PreventiveMaintenanceDetailModal';
import WorkOrderWizard from '../work-orders/WorkOrderWizard';
import { MachineDetailsSection } from './MachineDetailsSection';
import { MachineDetailHeader } from './MachineDetailHeader';
import DisassembleMachineDialog from './DisassembleMachineDialog';
import MachineFailuresTab from './MachineFailuresTab';
import { FailureQuickReportDialog } from '@/components/corrective/failures/FailureQuickReportDialog';
import { SolutionCard, Solution } from '@/components/solutions/SolutionCard';
import { SolutionDetailDialog } from '@/components/solutions/SolutionDetailDialog';
import { toast } from 'sonner';
import { 
  Dialog as PdfDialog, 
  DialogContent as PdfDialogContent,
} from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation, createFetchMutation } from '@/hooks/use-api-mutation';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/hooks/use-auth';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { useMachineDetail } from '@/hooks/use-machine-detail';
import { useMachineWorkOrders, useMachineFailures, useDocuments } from '@/hooks/mantenimiento'; // ✨ OPTIMIZACIÓN: Hooks centralizados
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import CreatableSelect from '@/components/panol/CreatableSelect';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';


// Interfaz para registros de historial
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

// Componente para mostrar el historial integrado en el tab
const MachineHistoryContent: React.FC<{
  machineId: number;
  machineName: string;
  componentId?: number;
  componentName?: string;
}> = ({ machineId, machineName, componentId, componentName }) => {
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [machineId, componentId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const url = `/api/machines/${machineId}/history${componentId ? `?componentId=${componentId}` : ''}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setHistoryRecords(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
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
        <span className="ml-2 text-sm text-muted-foreground">Cargando historial...</span>
      </div>
    );
  }

  if (historyRecords.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-sm font-medium mb-2">No hay registros de mantenimiento</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Los registros aparecerán aquí cuando se realicen trabajos de mantenimiento
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
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {getTypeIcon(record.type)}
                  {record.title}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(record.date)}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {record.supervisor.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
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
                <h4 className="text-xs text-muted-foreground mb-1">Descripción del Trabajo Realizado:</h4>
                <p className="text-xs text-muted-foreground">{record.detailedDescription}</p>
              </div>

              {record.toolsUsed && record.toolsUsed.length > 0 && (
                <div>
                  <h4 className="text-xs text-muted-foreground mb-1">Herramientas Utilizadas del Pañol:</h4>
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
                  <h4 className="text-xs text-muted-foreground mb-1">Componentes Trabajados:</h4>
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
                  <h4 className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Camera className="h-3 w-3" />
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

// Componente para la pestaña de Soluciones
const MachineSolutionsContent: React.FC<{
  machineId: number;
  machineName: string;
  companyId?: number;
}> = ({ machineId, machineName, companyId }) => {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSolutions();
  }, [machineId, companyId]);

  const fetchSolutions = async () => {
    if (!machineId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        type: 'CORRECTIVE',
        status: 'COMPLETED',
        machineId: machineId.toString()
      });
      if (companyId) {
        params.append('companyId', companyId.toString());
      }

      const response = await fetch(`/api/work-orders?${params.toString()}`);
      if (response.ok) {
        const workOrders = await response.json();
        // Transform work orders to solutions
        const solutionsData = workOrders
          .filter((wo: any) => wo.solution || wo.rootCause || wo.correctiveActions)
          .map((wo: any) => ({
            id: wo.id,
            title: wo.title,
            description: wo.description,
            rootCause: wo.rootCause,
            solution: wo.solution,
            correctiveActions: wo.correctiveActions,
            preventiveActions: wo.preventiveActions,
            failureDescription: wo.failureDescription,
            machineId: wo.machineId,
            machineName: wo.machine?.name || machineName,
            componentId: wo.componentId,
            componentName: wo.component?.name,
            completedDate: wo.completedDate,
            createdAt: wo.createdAt,
            executedBy: wo.assignedTo || wo.assignedWorker,
            assignedTo: wo.assignedTo,
            priority: wo.priority,
            status: wo.status,
            attachments: wo.attachments || [],
            _workOrder: wo
          }));
        setSolutions(solutionsData);
      }
    } catch (error) {
      console.error('Error fetching solutions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSolutions = useMemo(() => {
    if (!searchTerm) return solutions;
    const term = searchTerm.toLowerCase();
    return solutions.filter((sol) =>
      sol.title?.toLowerCase().includes(term) ||
      sol.rootCause?.toLowerCase().includes(term) ||
      sol.solution?.toLowerCase().includes(term) ||
      sol.componentName?.toLowerCase().includes(term)
    );
  }, [solutions, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (solutions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="p-4 rounded-full bg-warning-muted mb-4">
            <Lightbulb className="h-10 w-10 text-warning" />
          </div>
          <h3 className="text-base font-semibold mb-2">Sin soluciones documentadas</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Las soluciones se crean automáticamente cuando se completan mantenimientos correctivos
            con información de diagnóstico y solución para esta máquina.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4 p-4">
        {/* Search and count */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar solución..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredSolutions.length} solución{filteredSolutions.length !== 1 ? 'es' : ''}
          </div>
        </div>

        {/* Solutions grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredSolutions.map((solution) => (
            <SolutionCard
              key={solution.id}
              solution={solution}
              onClick={setSelectedSolution}
              variant="compact"
              showMachine={false}
            />
          ))}
        </div>
      </div>

      {/* Solution Detail Dialog */}
      <SolutionDetailDialog
        solution={selectedSolution}
        isOpen={!!selectedSolution}
        onOpenChange={(open) => {
          if (!open) setSelectedSolution(null);
        }}
      />
    </>
  );
};

// Componente para la pestaña de Mantenimiento
const MachineMaintenanceContent: React.FC<{
  machineId: number;
  machineName: string;
}> = ({ machineId, machineName }) => {
  // Obtener companyId del localStorage o contexto
  const companyId = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem('currentCompany') || '{}').id 
    : null;

  // ✨ OPTIMIZACIÓN: Usar hooks React Query para evitar duplicados
  const workOrdersQuery = useMachineWorkOrders({
    machineId,
    enabled: !companyId && !!machineId, // Solo si no hay companyId (si hay, usa EnhancedMaintenancePanel)
    staleTime: 30 * 1000
  });

  // Fallback para cuando no hay companyId - hooks deben estar antes de cualquier return
  const [preventiveMaintenance, setPreventiveMaintenance] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  // ✨ Sincronizar estado local con datos del hook
  useEffect(() => {
    if (workOrdersQuery.data) {
      setWorkOrders(workOrdersQuery.data);
    }
  }, [workOrdersQuery.data]);

  const fetchMaintenanceData = async () => {
    setIsLoading(true);
    try {
      // Obtener mantenimientos preventivos programados (requiere companyId)
      const companyId = localStorage.getItem('currentCompany') ? JSON.parse(localStorage.getItem('currentCompany') || '{}').id : null;
      
      if (companyId) {
        const preventiveResponse = await fetch(`/api/maintenance/preventive?companyId=${companyId}`);
        if (preventiveResponse.ok) {
          const preventiveData = await preventiveResponse.json();
          // Filtrar por esta máquina específica
          const machinePreventive = preventiveData.filter((maintenance: any) => 
            maintenance.machineId === machineId
          );
          setPreventiveMaintenance(machinePreventive);
        }
      }

      // ✨ Work orders ahora vienen del hook, no hacer fetch manual

      // Calcular estadísticas después de cargar los datos
      setTimeout(() => calculateStats(), 100);
    } catch (error) {
      console.error('Error fetching maintenance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = () => {
    // Aquí podríamos calcular estadísticas más detalladas
    setStats({
      totalPreventive: preventiveMaintenance.length,
      pendingOrders: workOrders.filter(wo => wo.status === 'pendiente').length,
      completedOrders: workOrders.filter(wo => wo.status === 'completado').length
    });
  };

  useEffect(() => {
    if (companyId) return; // No hacer nada si hay companyId
    fetchMaintenanceData();
  }, [machineId, companyId]);

  if (companyId) {
    return (
      <div className="space-y-6">
        <EnhancedMaintenancePanel 
          machineId={machineId}
          machineName={machineName}
          companyId={companyId}
        />
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-muted text-foreground';
      case 'MEDIUM':
        return 'bg-warning-muted text-warning-muted-foreground';
      case 'HIGH':
        return 'bg-warning-muted text-warning-muted-foreground';
      case 'URGENT':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente':
        return 'bg-warning-muted text-warning-muted-foreground';
      case 'en_progreso':
        return 'bg-info-muted text-info-muted-foreground';
      case 'completado':
        return 'bg-success-muted text-success';
      case 'cancelado':
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'a las' HH:mm", { locale: es });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando información de mantenimiento...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-[calc(90vh-300px)] overflow-y-auto pr-2">
      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mantenimientos Preventivos</p>
                <p className="text-2xl font-bold text-info-muted-foreground">{preventiveMaintenance.length}</p>
              </div>
              <Settings className="h-8 w-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Órdenes Pendientes</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">{workOrders.filter(wo => wo.status === 'pendiente').length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Órdenes Completadas</p>
                <p className="text-2xl font-bold text-success">{workOrders.filter(wo => wo.status === 'completado').length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mantenimientos Preventivos Programados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-info-muted-foreground" />
            Mantenimientos Preventivos Programados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {preventiveMaintenance.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Settings className="h-16 w-16 mx-auto mb-6 opacity-50" />
              <p className="text-xl font-medium mb-3">No hay mantenimientos preventivos programados</p>
              <p className="text-sm max-w-md mx-auto">Los mantenimientos programados aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-4">
              {preventiveMaintenance.map((maintenance) => (
                <div key={maintenance.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{maintenance.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{maintenance.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getPriorityColor(maintenance.priority)}>
                        {maintenance.priority}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Cada {maintenance.frequencyDays} días
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Próximo: {formatDate(maintenance.nextMaintenanceDate || maintenance.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Duración: {maintenance.estimatedHours || 'No especificado'}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Técnico: {maintenance.assignedTo?.name || (maintenance.assignedToId ? `ID: ${maintenance.assignedToId}` : 'Sin asignar')}</span>
                    </div>
                  </div>

                  {maintenance.toolsRequired && maintenance.toolsRequired.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">Herramientas requeridas:</p>
                      <div className="flex flex-wrap gap-2">
                        {maintenance.toolsRequired.map((tool: any, index: number) => (
                          <Badge key={index} variant="outline" className="bg-info-muted text-info-muted-foreground border-info-muted">
                            {tool.name} x{tool.quantity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Órdenes de Trabajo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-warning-muted-foreground" />
            Órdenes de Trabajo de Mantenimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <ClipboardList className="h-16 w-16 mx-auto mb-6 opacity-50" />
              <p className="text-xl font-medium mb-3">No hay órdenes de trabajo registradas</p>
              <p className="text-sm max-w-md mx-auto">Las órdenes de trabajo aparecerán aquí cuando se creen</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{order.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{order.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge className={getPriorityColor(order.priority)}>
                        {order.priority}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Creado: {formatDateTime(order.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Asignado: {order.assignedTo || 'Sin asignar'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span>Tipo: {order.type}</span>
                    </div>
                  </div>

                  {order.component && (
                    <div className="mt-3">
                      <p className="text-sm">
                        <span className="font-medium">Componente:</span> {order.component}
                        {order.subcomponent && ` → ${order.subcomponent}`}
                      </p>
                    </div>
                  )}

                  {order.estimatedHours && (
                    <div className="mt-2">
                      <p className="text-sm">
                        <span className="font-medium">Duración estimada:</span> {order.estimatedHours} horas
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Componente para la pestaña de Mantenimientos Preventivos
const MachinePreventiveMaintenanceContent: React.FC<{
  machineId: number;
  machineName: string;
}> = ({ machineId, machineName }) => {
  const [preventiveMaintenances, setPreventiveMaintenances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // Estados para selector de tipo de mantenimiento
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isCorrectiveDialogOpen, setIsCorrectiveDialogOpen] = useState(false);
  const { currentCompany } = useCompany();
  const { user } = useAuth();

  // ── Mutation: Completar mantenimiento preventivo ──
  const completeMaintenanceMutation = useApiMutation<any, { maintenanceId: number; executionData: any }>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/maintenance/preventive/${vars.maintenanceId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionData: vars.executionData }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al completar el mantenimiento');
      }
      return res.json();
    },
    invalidateKeys: [
      ['preventive-maintenance', 'machine', machineId],
      ['work-orders', 'machine', machineId],
    ],
    successMessage: 'Mantenimiento completado exitosamente',
    errorMessage: 'No se pudo completar el mantenimiento',
    onSuccess: () => {
      fetchPreventiveMaintenances();
    },
  });

  useEffect(() => {
    fetchPreventiveMaintenances();
  }, [machineId, currentCompany]);

  const fetchPreventiveMaintenances = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/maintenance/preventive?companyId=${currentCompany.id}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        // Filtrar por esta máquina específica
        const machinePreventive = data.filter((maintenance: any) =>
          maintenance.machineId === machineId
        );
        setPreventiveMaintenances(machinePreventive);
      }
    } catch (error) {
      console.error('Error fetching preventive maintenances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMaintenance = () => {
    setIsTypeSelectorOpen(true);
  };

  const handleSelectMaintenanceType = (type: 'preventive' | 'corrective') => {
    setIsTypeSelectorOpen(false);
    if (type === 'preventive') {
      setIsCreateDialogOpen(true);
    } else {
      setIsCorrectiveDialogOpen(true);
    }
  };

  const handleViewDetails = (maintenance: any) => {
    setSelectedMaintenance(maintenance);
    setIsDetailModalOpen(true);
  };

  const handleSaveMaintenance = () => {
    setIsCreateDialogOpen(false);
    fetchPreventiveMaintenances();
  };

  const handleSaveCorrectiveMaintenance = (data: any) => {
    log('Nuevo mantenimiento correctivo para máquina:', data);
    setIsCorrectiveDialogOpen(false);
  };

  const handleCompleteMaintenance = (maintenance: any) => {
    completeMaintenanceMutation.mutate({
      maintenanceId: maintenance.id,
      executionData: {
        userId: user?.id,
        notes: `Mantenimiento completado por ${user?.name}`,
        actualHours: maintenance.estimatedHours,
        executedAt: new Date().toISOString(),
      },
    });
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return <Badge variant="destructive">Alta</Badge>;
      case 'MEDIUM':
        return <Badge variant="default" className="bg-info">Media</Badge>;
      case 'LOW':
        return <Badge variant="secondary">Baja</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (maintenance: any) => {
    const nextDate = new Date(maintenance.nextMaintenanceDate);
    const now = new Date();
    const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (!maintenance.isActive) {
      return <Badge variant="secondary">Inactivo</Badge>;
    }
    
    if (nextDate < now) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    
    if (diffDays <= 7) {
      return <Badge variant="default" className="bg-warning">Próximo</Badge>;
    }
    
    return <Badge variant="default" className="bg-success">Programado</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Mantenimientos</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona los mantenimientos preventivos y correctivos para {machineName}
          </p>
        </div>
        <Button onClick={handleCreateMaintenance}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Mantenimiento
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando mantenimientos...</span>
        </div>
      ) : preventiveMaintenances.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium text-lg mb-2">No hay mantenimientos preventivos</h3>
            <p className="text-muted-foreground mb-4">
              Esta máquina no tiene mantenimientos preventivos programados.
            </p>
            <Button onClick={handleCreateMaintenance}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primer mantenimiento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {preventiveMaintenances.map((maintenance) => (
            <Card key={maintenance.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-lg">{maintenance.title}</h4>
                      {getPriorityBadge(maintenance.priority)}
                      {getStatusBadge(maintenance)}
                    </div>
                    <p className="text-muted-foreground text-sm mb-2">
                      {maintenance.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {maintenance.frequencyDays} días
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Próximo: {formatDate(maintenance.nextMaintenanceDate)}
                      </span>
                      {maintenance.estimatedHours && (
                        <span className="flex items-center gap-1">
                          <Settings className="h-4 w-4" />
                          {maintenance.estimatedHours}h estimadas
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(maintenance)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {maintenance.isActive && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleCompleteMaintenance(maintenance)}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para crear mantenimiento preventivo */}
      {isCreateDialogOpen && (
        <PreventiveMaintenanceDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onSave={handleSaveMaintenance}
          editingMaintenance={null}
          mode="create"
          preselectedMachineId={machineId}
        />
      )}

      {/* Modal de detalles */}
      {isDetailModalOpen && selectedMaintenance && (
        <PreventiveMaintenanceDetailModal
          maintenance={selectedMaintenance}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedMaintenance(null);
          }}
        />
      )}

      {/* Selector de Tipo de Mantenimiento */}
      <Dialog open={isTypeSelectorOpen} onOpenChange={setIsTypeSelectorOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="text-xl">Tipo de Mantenimiento</DialogTitle>
            <DialogDescription>
              Selecciona el tipo de mantenimiento que deseas crear para {machineName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 mt-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-success-muted hover:border-success-muted"
              onClick={() => handleSelectMaintenanceType('preventive')}
            >
              <div className="bg-success-muted p-2 rounded-lg">
                <Settings className="h-6 w-6 text-success" />
              </div>
              <div className="text-center">
                <div className="font-semibold">Preventivo</div>
                <div className="text-xs text-muted-foreground">Mantenimiento programado</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-warning-muted hover:border-warning-muted"
              onClick={() => handleSelectMaintenanceType('corrective')}
            >
              <div className="bg-warning-muted p-2 rounded-lg">
                <Wrench className="h-6 w-6 text-warning-muted-foreground" />
              </div>
              <div className="text-center">
                <div className="font-semibold">Correctivo</div>
                <div className="text-xs text-muted-foreground">Reparación por falla</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Mantenimiento Correctivo */}
      <CorrectiveMaintenanceDialog
        isOpen={isCorrectiveDialogOpen}
        onClose={() => setIsCorrectiveDialogOpen(false)}
        onSave={handleSaveCorrectiveMaintenance}
        preselectedMachineId={machineId}
      />
    </div>
  );
};

// Componente para gestionar fallas de la máquina
const MachineFailuresContent: React.FC<{
  machineId: number;
  machineName: string;
  components: MachineComponent[];
}> = ({ machineId, machineName, components }) => {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  // 🔍 PERMISOS
  const { hasPermission: canRegisterFailure } = usePermissionRobust('registrar_falla');

  const [failures, setFailures] = useState<any[]>([]);
  const [loadingFailures, setLoadingFailures] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedFailure, setSelectedFailure] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterComponent, setFilterComponent] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'status'>('date');
  const { user } = useAuth();

  // ✨ OPTIMIZACIÓN: Usar hook React Query para evitar duplicados
  const failuresQuery = useMachineFailures({
    machineId,
    companyId: currentCompany?.id || null,
    enabled: !!machineId && !!currentCompany?.id,
    staleTime: 30 * 1000
  });

  // ✨ Sincronizar estado local con datos del hook
  useEffect(() => {
    if (failuresQuery.data) {
      setFailures(failuresQuery.data);
      setLoadingFailures(failuresQuery.isLoading);
    }
  }, [failuresQuery.data, failuresQuery.isLoading]);

  const failuresInvalidateKeys = [['machine-failures', Number(machineId), Number(currentCompany?.id)]];

  const fetchFailures = async () => {
    // ✨ Ya no se necesita fetch manual, el hook lo maneja
    // Mantener función por compatibilidad con handleSaveFailure
    if (failuresQuery.refetch) {
      await failuresQuery.refetch();
    }
  };

  const [editingFailure, setEditingFailure] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSolution, setEditingSolution] = useState<any>(null);
  const [isSolutionEditModalOpen, setIsSolutionEditModalOpen] = useState(false);

  // ── Mutations (useApiMutation) ──
  const updateFailureMutation = useApiMutation<any, any>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/failures/${editingFailure?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al actualizar la falla');
      }
      return res.json();
    },
    invalidateKeys: failuresInvalidateKeys,
    successMessage: 'Falla actualizada correctamente',
    errorMessage: 'Error al actualizar la falla',
    onSuccess: () => {
      handleCloseEditModal();
    },
  });

  const updateSolutionMutation = useApiMutation<any, any>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/failures/${editingSolution?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al actualizar la solución');
      }
      return res.json();
    },
    invalidateKeys: failuresInvalidateKeys,
    successMessage: 'Solución actualizada correctamente',
    errorMessage: 'Error al actualizar la solución',
    onSuccess: () => {
      handleCloseSolutionEditModal();
    },
  });

  const deleteFailureMutation = useApiMutation<any, { id: number; title: string }>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/failures/${vars.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al eliminar la falla');
      }
      return res.json();
    },
    invalidateKeys: failuresInvalidateKeys,
    successMessage: null, // Custom message below
    errorMessage: 'No se pudo eliminar la falla.',
    onSuccess: (_data, vars) => {
      toast.success(`La falla "${vars.title}" ha sido eliminada exitosamente.`);
    },
  });

  const failureOccurrenceMutation = useApiMutation<any, { id: number; notes: string }>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/failures/${vars.id}/occurrences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: vars.notes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al registrar la ocurrencia');
      }
      return res.json();
    },
    invalidateKeys: failuresInvalidateKeys,
    successMessage: 'Ocurrencia registrada correctamente',
    errorMessage: 'Error al registrar la ocurrencia',
  });

  const handleCreateFailure = () => {
    setIsCreateDialogOpen(true);
  };

  const handleViewDetails = (failure: any) => {
    setSelectedFailure(failure);
    setIsDetailModalOpen(true);
  };

  const handleSaveFailure = () => {
    setIsCreateDialogOpen(false);
    fetchFailures();
  };

  const handleEditFailure = (failure: any) => {
    setEditingFailure(failure);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingFailure(null);
  };

  const handleEditSolution = (failure: any) => {
    setEditingSolution(failure);
    setIsSolutionEditModalOpen(true);
  };

  const handleCloseSolutionEditModal = () => {
    setIsSolutionEditModalOpen(false);
    setEditingSolution(null);
  };

  const handleSaveEditedFailure = (updatedData: any) => {
    updateFailureMutation.mutate(updatedData);
  };

  const handleSaveEditedSolution = (updatedData: any) => {
    log('💾 Guardando solución:', updatedData);
    updateSolutionMutation.mutate(updatedData);
  };

  const handleDeleteFailure = (failure: any) => {
    log('Eliminando falla:', failure.id);
    deleteFailureMutation.mutate({ id: failure.id, title: failure.title });
  };

  const handleFailureOccurred = (failure: any) => {
    failureOccurrenceMutation.mutate({
      id: failure.id,
      notes: `Ocurrencia registrada el ${formatDateTime(new Date())}`,
    });
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return <Badge variant="destructive">Alta</Badge>;
      case 'MEDIUM':
        return <Badge variant="default" className="bg-info">Media</Badge>;
      case 'LOW':
        return <Badge variant="secondary">Baja</Badge>;
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
      case 'COMPLETED':
        return <Badge variant="default">Completada</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="secondary">En Proceso</Badge>;
      case 'PENDING':
        return <Badge variant="outline">Sin solución</Badge>;
      default:
        return <Badge variant="outline">{failure.status}</Badge>;
    }
  };

  const getFailureTypeBadge = (type: string) => {
    switch (type) {
      case 'MECANICA':
        return <Badge variant="outline" className="border-info text-info">Mecánica</Badge>;
      case 'ELECTRICA':
        return <Badge variant="outline" className="border-warning text-warning">Eléctrica</Badge>;
      case 'HIDRAULICA':
        return <Badge variant="outline" className="border-primary text-primary">Hidráulica</Badge>;
      case 'NEUMATICA':
        return <Badge variant="outline" className="border-info text-info">Neumática</Badge>;
      case 'AUTOMATIZACION':
        return <Badge variant="outline" className="border-success text-success">Automatización</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };


  
  const filteredFailures = failures.filter(failure => {
    const matchesSearch = failure.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         failure.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         failure.componentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         failure.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesComponent = filterComponent === 'all' || 
                           failure.componentId.toString() === filterComponent;
    
    const matchesStatus = filterStatus === 'all' || failure.status === filterStatus;
    const matchesType = filterType === 'all' || failure.failureType === filterType;
    
    return matchesSearch && matchesComponent && matchesStatus && matchesType;
  });

  const sortedFailures = [...filteredFailures].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime();
      case 'priority':
        const priorityOrder: { [key: string]: number } = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      case 'status':
        const statusOrder: { [key: string]: number } = { 'PENDING': 3, 'IN_PROGRESS': 2, 'COMPLETED': 1 };
        return (statusOrder[b.status] || 0) - (statusOrder[a.status] || 0);
      default:
        return 0;
    }
  });

  const stats = {
    total: failures.length,
    resolved: failures.filter(f => f.status === 'COMPLETED').length,
    pending: failures.filter(f => f.status === 'PENDING').length,
    inProgress: failures.filter(f => f.status === 'IN_PROGRESS').length,
    totalDowntime: failures.filter(f => f.downtime).reduce((sum, f) => sum + (f.downtime || 0), 0)
  };

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Fallas</p>
                <p className="text-sm font-medium">{stats.total}</p>
              </div>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Resueltas</p>
                <p className="text-sm font-medium">{stats.resolved}</p>
              </div>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pendientes</p>
                <p className="text-sm font-medium">{stats.pending}</p>
              </div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header con controles */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-sm font-medium">Fallas y Problemas</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Registro completo de fallas y problemas de {machineName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canRegisterFailure && (
            <Button onClick={handleCreateFailure}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar Falla
            </Button>
          )}
        </div>
      </div>

      {/* Filtros avanzados */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Buscar</label>
              <Input
                placeholder="Buscar fallas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Componente</label>
              <Select value={filterComponent} onValueChange={setFilterComponent}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los componentes</SelectItem>
                  {components.map((component) => (
                    <SelectItem key={component.id} value={component.id.toString()}>
                      {component.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="EN_PROCESO">En Proceso</SelectItem>
                  <SelectItem value="RESUELTA">Resuelta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="MECANICA">Mecánica</SelectItem>
                  <SelectItem value="ELECTRICA">Eléctrica</SelectItem>
                  <SelectItem value="HIDRAULICA">Hidráulica</SelectItem>
                  <SelectItem value="NEUMATICA">Neumática</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ordenar por</label>
              <Select value={sortBy} onValueChange={(value: 'date' | 'priority' | 'status') => setSortBy(value)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Fecha</SelectItem>
                  <SelectItem value="priority">Prioridad</SelectItem>
                  <SelectItem value="status">Estado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadingFailures ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando fallas...</span>
        </div>
      ) : filteredFailures.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-sm font-medium mb-2">No hay fallas registradas</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm || filterComponent !== 'all' 
                ? 'No se encontraron fallas con los filtros aplicados.'
                : 'Esta máquina no tiene fallas registradas en el sistema.'}
            </p>
            {canRegisterFailure && (
              <Button onClick={handleCreateFailure}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar primera falla
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {sortedFailures.map((failure) => (
            <Card 
              key={failure.id} 
              className="hover:shadow-lg transition-all duration-200 hover:border-primary/30 group cursor-pointer"
              onClick={() => handleViewDetails(failure)}
            >
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">
                        {failure.title}
                      </h4>
                      {getPriorityBadge(failure.priority)}
                      {getStatusBadge(failure)}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                      {failure.description}
                    </p>
                    
                    <div className="space-y-1 text-xs text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        <span className="truncate">{failure.componentName}</span>
                      </div>
                      
                      {/* Componentes afectados */}
                      {failure.selectedComponents && failure.selectedComponents.length > 0 && (
                        <div className="flex items-start gap-1">
                          <Cog className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            {failure.selectedComponents.slice(0, 2).map((componentId: number, index: number) => {
                              const component = components.find(comp => Number(comp.id) === componentId);
                              return component ? (
                                <Badge key={index} variant="outline" className="text-xs px-1 py-0.5">
                                  {component.name}
                                </Badge>
                              ) : null;
                            })}
                            {failure.selectedComponents.length > 2 && (
                              <Badge variant="outline" className="text-xs px-1 py-0.5">
                                +{failure.selectedComponents.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(failure.reportedDate)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">{failure.reportedBy?.name || 'Usuario no especificado'}</span>
                      </div>
                    </div>

                    {/* Información adicional compacta */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      {failure.estimatedHours && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{failure.estimatedHours}h</span>
                        </div>
                      )}
                      {failure.downtime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{failure.downtime}h muerto</span>
                        </div>
                      )}
                      {failure.documents && failure.documents.length > 0 && (
                        <div className="flex items-center gap-1">
                          <File className="h-3 w-3" />
                          <span>{failure.documents.length}</span>
                        </div>
                      )}
                    </div>

                    {/* Tags compactos */}
                    {failure.tags && failure.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {failure.tags.slice(0, 2).map((tag: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs px-1 py-0.5">
                            {tag}
                          </Badge>
                        ))}
                        {failure.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs px-1 py-0.5">
                            +{failure.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Solución aplicada compacta */}
                    {failure.solution && (
                      <div className="mt-2 p-2 bg-muted/50 rounded border">
                        <div className="flex items-center gap-1 mb-1">
                          <CheckCircle className="h-3 w-3" />
                          <p className="text-xs font-medium">Solución:</p>
                        </div>
                        <p className="text-xs line-clamp-2">
                          {failure.solution}
                        </p>
                      </div>
                    )}
                  </div>
                  
                                      <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFailureOccurred(failure);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted"
                        title="Ocurrió falla"
                      >
                        <AlertTriangle className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({
                            title: 'Eliminar falla',
                            description: `¿Estás seguro de que quieres eliminar la falla "${failure.title}"?`,
                            confirmText: 'Eliminar',
                            variant: 'destructive',
                          });
                          if (!ok) return;
                          handleDeleteFailure(failure);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive h-7 w-7 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>

                    </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para crear/editar falla */}
      {isCreateDialogOpen && (
        <FailureDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onSave={handleSaveFailure}
          machineId={machineId}
          machineName={machineName}
          components={components}
        />
      )}

      {/* Modal de detalles */}
      {isDetailModalOpen && selectedFailure && (
        <FailureDetailModal
          failure={selectedFailure}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedFailure(null);
          }}
          onEditFailure={handleEditFailure}
          onEditSolution={handleEditSolution}
          onFailureOccurred={handleFailureOccurred}
          components={components}
          onRefresh={fetchFailures}
        />
      )}

      {/* Modal de edición de falla */}
      {editingFailure && (
        <FailureEditDialog
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleSaveEditedFailure}
          failure={editingFailure}
          machineId={machineId}
          machineName={machineName}
          components={components}
        />
      )}

      {/* Modal de edición de solución */}
      {editingSolution && (
        <SolutionEditDialog
          isOpen={isSolutionEditModalOpen}
          onClose={handleCloseSolutionEditModal}
          onSave={handleSaveEditedSolution}
          failure={editingSolution}
          machineId={machineId}
          machineName={machineName}
        />
      )}
    </div>
  );
};



interface MachineDetailDialogProps {
  machine: Machine | null;
  components: MachineComponent[];
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (machine: Machine) => void;
  onDelete?: (machine: Machine) => void;
  initialTab?: string;
  selectedComponentId?: number;
}

// Versión personalizada de DialogContent sin el botón de cerrar estándar
const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { noScroll?: boolean }
>(({ className, children, noScroll = false, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Posicionamiento centrado
        'fixed left-[50%] top-[50%] z-[150] translate-x-[-50%] translate-y-[-50%]',
        // Grid y espaciado básico
        'grid gap-4 border bg-background shadow-lg duration-200',
        // Scroll condicional
        noScroll ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden',
        // Responsividad de ancho - full en móvil, limitado en desktop
        'w-[96vw] max-w-[96vw] sm:w-[99vw] sm:max-w-[99vw] md:w-[90vw] md:max-w-[1200px] lg:max-w-[1400px]',
        // Altura fija - siempre la misma altura
        'h-[90vh] md:h-[85vh]',
        // Padding responsive
        'p-3 sm:p-4 lg:p-6',
        // Animaciones
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        // Bordes redondeados
        'sm:rounded-lg',
        className
      )}
      aria-describedby="custom-dialog-description"
      {...props}
    >
      <span id="custom-dialog-description" className="sr-only">
        Modal de detalles de máquina
      </span>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
CustomDialogContent.displayName = 'CustomDialogContent';

// Componente reutilizable para mostrar lista de documentos y visor PDF/DOCX
export const DocumentListViewer: React.FC<{
  documents: any[];
  loading?: boolean;
  error?: string | null;
  showDelete?: boolean;
  onDelete?: (id: string) => void;
}> = ({ documents, loading, error, showDelete = true, onDelete }) => {
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedDocumentUrl, setSelectedDocumentUrl] = useState<string | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<'pdf' | 'docx' | null>(null);

  const getFileType = (fileName: string): 'pdf' | 'docx' | 'other' => {
    const extension = fileName.toLowerCase().split('.').pop();
    if (extension === 'pdf') return 'pdf';
    if (extension === 'docx' || extension === 'doc') return 'docx';
    return 'other';
  };

  const handleViewDocument = (url: string, fileName: string) => {
    const fileType = getFileType(fileName);
    if (fileType === 'other') {
      // Para otros tipos de archivo, abrir en nueva pestaña para descarga
      window.open(url, '_blank');
      return;
    }
    setSelectedDocumentUrl(url);
    setSelectedDocumentType(fileType);
    setShowDocumentModal(true);
  };

  const getFileIcon = (fileName: string) => {
    const fileType = getFileType(fileName);
    switch (fileType) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-destructive" />;
      case 'docx':
        return <File className="h-4 w-4 text-info" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="animate-spin h-4 w-4" />
          <span className="ml-2 text-xs text-muted-foreground">Cargando máquina...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-8 w-8 md:h-12 md:w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <h3 className="text-xs md:text-sm font-medium mb-1">No hay documentos</h3>
          <p className="text-xs text-muted-foreground">
            Se mostrarán aquí cuando se agreguen
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {documents.map(doc => (
            <li key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 p-2 border rounded-lg hover:bg-muted/30 transition group">
              {/* Fila principal: icono + nombre */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="flex-shrink-0">{getFileIcon(doc.originalName || doc.fileName)}</span>
                <button
                  className="flex-1 text-left underline text-primary text-xs md:text-sm font-medium hover:text-primary/80 transition truncate"
                  onClick={() => handleViewDocument(doc.url, doc.originalName || doc.fileName)}
                  title={doc.originalName || doc.fileName}
                >
                  {doc.originalName || doc.fileName}
                </button>
              </div>
              {/* Fila secundaria: fecha + acciones */}
              <div className="flex items-center justify-between sm:justify-end gap-2 pl-6 sm:pl-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {doc.uploadDate ? formatDate(doc.uploadDate) : '-'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    className="text-muted-foreground hover:text-primary transition p-1 rounded hover:bg-muted"
                    title="Ver"
                    onClick={() => handleViewDocument(doc.url, doc.originalName || doc.fileName)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  {showDelete && onDelete && (
                    <button
                      className="text-destructive hover:text-destructive transition p-1 rounded hover:bg-destructive/10"
                      title="Eliminar"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(doc.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="text-xs text-destructive mt-2">{error}</div>}
      <PdfDialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <PdfDialogContent size="full" className="p-3 md:p-6" aria-describedby="document-viewer-description">
          <span id="document-viewer-description" className="sr-only">
            Visor de documentos PDF y DOCX en pantalla completa
          </span>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 pb-2 border-b">
            <div>
              <h3 className="text-sm md:text-lg font-semibold">Visor de Documento</h3>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {selectedDocumentType?.toUpperCase()}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(selectedDocumentUrl || '', '_blank')}
              className="gap-1.5 h-8 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Abrir en nueva pestaña</span>
              <span className="sm:hidden">Abrir</span>
            </Button>
          </div>
          {selectedDocumentUrl && (
            <div className="flex-1 flex items-center justify-center bg-muted rounded-lg overflow-hidden min-h-0">
              {selectedDocumentType === 'pdf' ? (
                <embed
                  src={selectedDocumentUrl}
                  type="application/pdf"
                  width="100%"
                  height="100%"
                  className="rounded-lg shadow-lg"
                />
              ) : selectedDocumentType === 'docx' ? (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(selectedDocumentUrl)}&embedded=true`}
                  width="100%"
                  height="100%"
                  className="rounded-lg shadow-lg"
                  title="Visor de documento DOCX"
                />
              ) : null}
            </div>
          )}
        </PdfDialogContent>
      </PdfDialog>
    </>
  );
};

const DocumentacionTab: React.FC<{ machineId: string; canEditMachine: boolean }> = ({ machineId, canEditMachine }) => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ✨ OPTIMIZACIÓN: Usar hook React Query para evitar duplicados
  const documentsQuery = useDocuments({
    entityType: 'machine',
    entityId: machineId,
    enabled: !!machineId,
    staleTime: 60 * 1000
  });

  const documentsInvalidateKeys = [['documents', 'machine', String(machineId)]];

  // ── Mutations: Documentos ──
  const deleteDocumentMutation = useApiMutation<any, { docId: string | number }>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/documents/${vars.docId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al eliminar el documento');
      return res.json();
    },
    invalidateKeys: documentsInvalidateKeys,
    successMessage: 'Documento eliminado',
    errorMessage: 'Error al eliminar el documento',
    onSuccess: () => {
      documentsQuery.refetch();
    },
  });

  const moveDocumentMutation = useApiMutation<any, { docId: string | number; folder: string | null }>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/documents/${vars.docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ folder: vars.folder }),
      });
      if (!res.ok) throw new Error('Error al mover el documento');
      return res.json();
    },
    invalidateKeys: documentsInvalidateKeys,
    successMessage: null, // Custom message in onSuccess
    errorMessage: 'Error al mover el documento',
    onSuccess: (_data, vars) => {
      documentsQuery.refetch();
      toast.success(vars.folder ? `Documento movido a "${vars.folder}"` : 'Documento removido de carpeta');
    },
  });

  // ✨ Sincronizar estado local con datos del hook
  useEffect(() => {
    if (documentsQuery.data) {
      setDocuments(documentsQuery.data);
      setLoading(documentsQuery.isLoading);
    }
    if (documentsQuery.error) {
      setError('No se pudieron cargar los documentos');
    }
  }, [documentsQuery.data, documentsQuery.isLoading, documentsQuery.error]);

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'machine');
      formData.append('entityId', machineId);
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

      // 2. Guardar referencia en la base de datos con carpeta seleccionada
      const saveRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'machine',
          entityId: machineId,
          url: uploadData.url,
          fileName: uploadData.fileName || file.name,
          originalName: uploadData.originalName || file.name,
          folder: selectedFolder, // Sistema de carpetas
        }),
      });
      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || 'Error al guardar el documento');
      }
      // Refetch y esperar antes de mostrar éxito
      await documentsQuery.refetch();
      setSuccess('Documento subido correctamente');
      setSelectedFolder(null);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string | number) => {
    const ok = await confirm({
      title: 'Eliminar documento',
      description: '¿Seguro que deseas eliminar este documento?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    if (!user) {
      setError('Debes estar autenticado para eliminar documentos');
      return;
    }

    setError(null);
    setSuccess(null);
    deleteDocumentMutation.mutate({ docId });
  };

  const handleMoveToFolder = (docId: string | number, folder: string | null) => {
    moveDocumentMutation.mutate({ docId, folder });
  };

  // Handler para archivos importados desde Google Drive
  const handleGoogleDriveImport = async (importedFiles: { url: string; name: string; size: number; type: string }[]) => {
    setError(null);
    setSuccess(null);
    try {
      for (const file of importedFiles) {
        // Guardar referencia en la base de datos
        const saveRes = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: 'machine',
            entityId: machineId,
            url: file.url,
            fileName: file.name,
            originalName: file.name,
            folder: selectedFolder,
          }),
        });
        if (!saveRes.ok) {
          const errData = await saveRes.json();
          throw new Error(errData.error || 'Error al guardar el documento');
        }
      }
      await documentsQuery.refetch();
      setSuccess(`${importedFiles.length} documento(s) importado(s) desde Google Drive`);
      setSelectedFolder(null);
    } catch (err: any) {
      setError(err.message || 'Error al importar desde Google Drive');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-sm font-medium">Documentación</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organiza documentos en carpetas
          </p>
        </div>
        {canEditMachine && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition h-9">
              <FilePlus className="h-4 w-4" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                onChange={handleDocumentUpload}
                className="hidden"
                disabled={uploading}
              />
              <span className="text-xs font-medium">
                {uploading ? 'Subiendo...' : 'Subir documento'}
              </span>
            </label>
            <GoogleDrivePicker
              onFilesSelected={() => {}}
              onImportComplete={handleGoogleDriveImport}
              autoImport
              entityType="machine"
              entityId={machineId}
              multiSelect
              buttonVariant="outline"
              buttonSize="sm"
              buttonClassName="h-9"
            />
          </div>
        )}
      </div>

      <DocumentFolderViewer
        documents={documents}
        loading={loading}
        error={error}
        canEdit={canEditMachine}
        onDelete={canEditMachine ? handleDeleteDocument : undefined}
        onMoveToFolder={canEditMachine ? handleMoveToFolder : undefined}
        storageKey={`machine_${machineId}`}
      />
      {success && <div className="text-xs text-success mt-2">{success}</div>}
    </div>
  );
};

export const MachineInfoDocuments: React.FC<{ machineId: string }> = ({ machineId }) => {
  // ✨ OPTIMIZACIÓN: Usar hook React Query para evitar duplicados
  // Mismo queryKey que DocumentacionTab = mismo cache = 1 sola request
  const documentsQuery = useDocuments({
    entityType: 'machine',
    entityId: machineId,
    enabled: !!machineId,
    staleTime: 60 * 1000
  });

  return <DocumentListViewer 
    documents={documentsQuery.data || []} 
    loading={documentsQuery.isLoading} 
    error={documentsQuery.error ? 'No se pudieron cargar los documentos' : null} 
    showDelete={false} 
  />;
};

export default function MachineDetailDialog({ 
  machine, 
  components = [], 
  isOpen, 
  onClose,
  onEdit,
  onDelete,
  initialTab = 'overview',
  selectedComponentId
}: MachineDetailDialogProps) {
  const { sectors } = useCompany();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  // 🔍 PERMISOS DE MÁQUINAS
  const { hasPermission: canCreateMachine } = usePermissionRobust('crear_maquina');
  const { hasPermission: canEditMachine } = usePermissionRobust('editar_maquina');
  const { hasPermission: canDeleteMachine } = usePermissionRobust('eliminar_maquina');
  const { hasPermission: canDisassembleMachine } = usePermissionRobust('machines.disassemble');
  const { hasPermission: canViewMachineHistory } = usePermissionRobust('ver_historial_maquina');
  const { hasPermission: canRegisterFailure } = usePermissionRobust('registrar_falla');
  const { hasPermission: canCreateMaintenance } = usePermissionRobust('crear_mantenimiento');

  // 📱 Android back button: interceptar para cerrar el modal en vez de navegar
  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState({ machineDialog: true }, '');
    const handlePopState = () => { onClose(); };
    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); };
  }, [isOpen, onClose]);

  // ✨ Hook para obtener workOrders para el header
  const { data: headerWorkOrders = [] } = useMachineWorkOrders({
    machineId: machine?.id,
    enabled: !!machine?.id && isOpen,
    staleTime: 30 * 1000
  });

  // ✨ Hook para obtener failures para el header
  const companyIdForFailures = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('currentCompany') || '{}').id
    : null;
  const { data: headerFailures = [] } = useMachineFailures({
    machineId: machine?.id,
    companyId: companyIdForFailures,
    enabled: !!machine?.id && isOpen && !!companyIdForFailures,
    staleTime: 30 * 1000
  });

  // ✨ Hook para obtener documentos (incluyendo modelos 3D)
  const machineDocumentsQuery = useDocuments({
    entityType: 'machine',
    entityId: machine?.id?.toString() || '',
    enabled: !!machine?.id && isOpen,
    staleTime: 60 * 1000
  });

  // Handler para subir modelo 3D
  const handleUpload3DModel = useCallback(async (file: File) => {
    if (!machine?.id) throw new Error('No machine ID');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'machine');
    formData.append('entityId', machine.id.toString());
    formData.append('fileType', '3d-model');

    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    if (!uploadRes.ok) {
      const errData = await uploadRes.json();
      throw new Error(errData.error || 'Error al subir el modelo 3D');
    }
    const uploadData = await uploadRes.json();

    const saveRes = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'machine',
        entityId: machine.id.toString(),
        url: uploadData.url,
        fileName: file.name,
        originalName: file.name,
        folder: '3d-models',
      }),
    });
    if (!saveRes.ok) {
      const errData = await saveRes.json();
      throw new Error(errData.error || 'Error al guardar el modelo 3D');
    }
    await machineDocumentsQuery.refetch();
  }, [machine?.id, machineDocumentsQuery]);

  // Handler para vincular modelo 3D por URL
  const handleLink3DModel = useCallback(async (url: string, fileName: string) => {
    if (!machine?.id) throw new Error('No machine ID');

    const saveRes = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'machine',
        entityId: machine.id.toString(),
        url: url,
        fileName: fileName,
        originalName: fileName,
        folder: '3d-models',
      }),
    });
    if (!saveRes.ok) {
      const errData = await saveRes.json();
      throw new Error(errData.error || 'Error al vincular el modelo 3D');
    }
    await machineDocumentsQuery.refetch();
  }, [machine?.id, machineDocumentsQuery]);

  const [activeTab, setActiveTab] = useState(initialTab);
  // ✨ LAZY LOADING: Solo renderizar contenido de tabs visitados
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([initialTab]));

  // Actualizar tabs visitados cuando cambia el tab activo
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      const newSet = new Set(prev);
      newSet.add(tab);
      return newSet;
    });
  }, []);

  const [showPreventiveDialog, setShowPreventiveDialog] = useState(false);
  const [showCorrectiveDialog, setShowCorrectiveDialog] = useState(false);
  const [showWorkOrderWizard, setShowWorkOrderWizard] = useState(false);
  const [workOrderWizardType, setWorkOrderWizardType] = useState<string | null>(null);
  const [showFailureReportDialog, setShowFailureReportDialog] = useState(false);
  const [showDisassembleDialog, setShowDisassembleDialog] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<MachineComponent | null>(null);
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [componentList, setComponentList] = useState<MachineComponent[]>(components);
  const [isAddComponentDialogOpen, setIsAddComponentDialogOpen] = useState(false);
  const [isAIComponentDialogOpen, setIsAIComponentDialogOpen] = useState(false);
  const [isEditComponentDialogOpen, setIsEditComponentDialogOpen] = useState(false);
  const [componentToEdit, setComponentToEdit] = useState<MachineComponent | null>(null);
  const [componentOrder, setComponentOrder] = useState<{[key: string]: number}>({});
  const [subcomponentOrder, setSubcomponentOrder] = useState<Record<string, Record<string, number>>>({});
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // ✨ Estados para búsqueda y filtrado de componentes
  const [componentSearchTerm, setComponentSearchTerm] = useState('');
  const [componentSystemFilter, setComponentSystemFilter] = useState<string>('all');

  // ✨ OPTIMIZADO: Usar hook con React Query para cargar datos de la máquina
  const { data: machineDetailData, isLoading: isLoadingDetail, refetch: refetchMachineDetail } = useMachineDetail(
    machine?.id,
    { enabled: !!machine?.id && isOpen }
  );

  // ✨ Sincronizar componentes del hook con estado local
  useEffect(() => {
    if (machineDetailData?.components && !isLoadingDetail) {
      // Cast para compatibilidad con el tipo local MachineComponent
      setComponentList(machineDetailData.components as unknown as MachineComponent[]);
    }
  }, [machineDetailData?.components, isLoadingDetail]);

  // Función para recargar componentes (ahora usa refetch del hook)
  const fetchComponents = useCallback(() => {
    if (machine?.id) {
      refetchMachineDetail();
    }
  }, [machine?.id, refetchMachineDetail]);

  const machineDetailInvalidateKeys = machine?.id ? [['machine-detail', Number(machine.id)]] : [];

  // ── Mutations: Componentes ──
  const saveComponentOrderMutation = useApiMutation<any, { order: {[key: string]: number} }>({
    mutationFn: createFetchMutation({
      url: () => `/api/maquinas/${machine?.id}/component-order`,
      method: 'PUT',
    }),
    successMessage: null,
    errorMessage: 'Error al guardar el orden de componentes',
    onError: () => {
      // El orden ya está guardado en localStorage, así que no es crítico
    },
  });

  const deleteComponentMutation = useApiMutation<any, { componentId: number }>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/components/${vars.componentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar el componente');
      return res.json();
    },
    invalidateKeys: machineDetailInvalidateKeys,
    successMessage: null, // Custom message in onSuccess
    errorMessage: 'No se pudo eliminar el componente',
    onSuccess: (result, vars) => {
      setComponentList(prev => prev.filter(c => Number(c.id) !== Number(vars.componentId)));
      const message = result.message || 'El componente fue eliminado correctamente.';
      toast.success(message);
    },
  });

  const updateComponentMutation = useApiMutation<any, any>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/components/${componentToEdit?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error('Error al actualizar el componente');
      return res.json();
    },
    invalidateKeys: machineDetailInvalidateKeys,
    successMessage: 'El componente fue actualizado correctamente.',
    errorMessage: 'No se pudo actualizar el componente',
    onSuccess: (result) => {
      const updatedComponent = result.component;
      log(`🔍 [FRONTEND] Resultado de la API:`, result);
      log(`🔍 [FRONTEND] Componente actualizado:`, updatedComponent);
      log(`🔍 [FRONTEND] Tools del componente:`, updatedComponent?.tools);

      setComponentList(prev =>
        prev.map(c => c.id === componentToEdit?.id ? updatedComponent : c)
      );
      setIsEditComponentDialogOpen(false);
      setComponentToEdit(null);
      if (machine?.id) {
        fetchComponents();
      }
    },
  });

  const addComponentMutation = useApiMutation<any, any>({
    mutationFn: async (vars) => {
      const payload = { ...vars, machineId: machine?.id };
      log('🔍 [MACHINE DETAIL] Payload a enviar:', payload);
      const res = await fetch('/api/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      log('🔍 [MACHINE DETAIL] Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('🔍 [MACHINE DETAIL] Error response:', errorText);
        throw new Error(`Error al crear el componente: ${res.status} ${errorText}`);
      }
      return res.json();
    },
    invalidateKeys: machineDetailInvalidateKeys,
    successMessage: null, // Custom message in onSuccess
    errorMessage: 'No se pudo crear el componente',
    onSuccess: (result) => {
      const newComponent = result.component;
      if (!newComponent || !newComponent.id) {
        toast.error('El componente creado no tiene un ID válido');
        return;
      }
      setComponentList(prev => [...prev, newComponent]);
      setIsAddComponentDialogOpen(false);
      const spareMessage = result.spareCreated ? ' y se creó su repuesto automáticamente' : '';
      toast.success(`El componente fue creado correctamente${spareMessage}.`);
    },
    onError: () => {
      setIsAddComponentDialogOpen(false);
    },
  });

  // Función para cargar el orden de subcomponentes
  const loadSubcomponentOrder = useCallback(async (parentComponentId: string) => {
    if (!machine?.id) return;
    
    // Cargar desde localStorage
    const localStorageKey = `machine_${machine.id}_subcomponent_order_${parentComponentId}`;
    const savedOrder = localStorage.getItem(localStorageKey);
    
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        setSubcomponentOrder(prev => ({
          ...prev,
          [parentComponentId]: parsedOrder
        }));
        return;
      } catch {
        localStorage.removeItem(localStorageKey);
      }
    }
    
    // Si no hay orden guardado, usar orden por defecto
    const parentComponent = componentList.find(c => c.id.toString() === parentComponentId);
    if (parentComponent?.children && parentComponent.children.length > 0) {
      const initialOrder = parentComponent.children.reduce((acc, subcomponent, index) => {
        acc[subcomponent.id.toString()] = index;
        return acc;
      }, {} as Record<string, number>);
      
      setSubcomponentOrder(prev => ({
        ...prev,
        [parentComponentId]: initialOrder
      }));
    }
  }, [machine?.id, componentList]);

  // Cargar orden de componentes desde la base de datos
  const loadComponentOrder = useCallback(async () => {
    if (!machine?.id) return;
    
    debugLog('LOAD ORDER', 'Iniciando carga para máquina:', machine.id, 'Componentes:', componentList.length);
    
    // Primero intentar cargar desde localStorage (solución temporal)
    const localStorageKey = `machine_${machine.id}_component_order`;
    const savedOrder = localStorage.getItem(localStorageKey);
    
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        setComponentOrder(parsedOrder);
        return;
      } catch {
        localStorage.removeItem(localStorageKey);
      }
    }
    
    // Si no hay en localStorage, intentar desde la API
    try {
      const response = await fetch(`/api/maquinas/${machine.id}/component-order`);
      if (response.ok) {
        const data = await response.json();
        if (data.order) {
          localStorage.setItem(localStorageKey, JSON.stringify(data.order));
          setComponentOrder(data.order);
          return;
        }
      }
    } catch {
      // Usar orden por defecto si falla
    }
    
    // Si no hay orden guardado, usar orden por defecto
    if (componentList.length > 0) {
      const initialOrder = componentList.reduce((acc, component, index) => {
        acc[component.id.toString()] = index;
        return acc;
      }, {} as {[key: string]: number});
      setComponentOrder(initialOrder);
    }
  }, [machine?.id, componentList]);

  // Inicializar orden de componentes cuando se cargan los componentes
  useEffect(() => {
    if (componentList.length > 0) {
      loadComponentOrder();
      
      // Cargar orden de subcomponentes para cada componente padre
      componentList.forEach(component => {
        if (component.children && component.children.length > 0) {
          loadSubcomponentOrder(component.id.toString());
        }
      });
    }
  }, [componentList, loadComponentOrder, loadSubcomponentOrder]);

  // Función para guardar el orden de componentes en la base de datos
  const saveComponentOrder = useCallback((newOrder: {[key: string]: number}) => {
    if (!machine?.id) return;

    debugLog('SAVE ORDER', 'Guardando orden:', newOrder);
    setIsSavingOrder(true);

    // Guardar en localStorage inmediatamente (solución temporal)
    const localStorageKey = `machine_${machine.id}_component_order`;
    localStorage.setItem(localStorageKey, JSON.stringify(newOrder));
    log('💾 [SAVE ORDER] Orden guardado en localStorage');

    saveComponentOrderMutation.mutate(
      { order: newOrder },
      { onSettled: () => setIsSavingOrder(false) }
    );
  }, [machine?.id, saveComponentOrderMutation]);

  // Funciones para reordenar componentes (logs reducidos)
  const moveComponentUp = useCallback((componentId: string) => {
    setComponentOrder(prev => {
      const newOrder = { ...prev };
      const currentIndex = newOrder[componentId];
      
      if (currentIndex > 0) {
        const componentAbove = Object.keys(newOrder).find(id => newOrder[id] === currentIndex - 1);
        if (componentAbove) {
          newOrder[componentId] = currentIndex - 1;
          newOrder[componentAbove] = currentIndex;
          saveComponentOrder(newOrder);
        }
      }
      
      return newOrder;
    });
  }, [saveComponentOrder]);

  const moveComponentDown = useCallback((componentId: string) => {
    setComponentOrder(prev => {
      const newOrder = { ...prev };
      const currentIndex = newOrder[componentId];
      const maxIndex = Math.max(...Object.values(newOrder));
      
      if (currentIndex < maxIndex) {
        const componentBelow = Object.keys(newOrder).find(id => newOrder[id] === currentIndex + 1);
        if (componentBelow) {
          newOrder[componentId] = currentIndex + 1;
          newOrder[componentBelow] = currentIndex;
          saveComponentOrder(newOrder);
        }
      }
      
      return newOrder;
    });
  }, [saveComponentOrder]);

  // Funciones para reordenar subcomponentes (logs reducidos)
  const moveSubcomponentUp = useCallback((parentComponentId: string, subcomponentId: string) => {
    setSubcomponentOrder(prev => {
      const newOrder = { ...prev };
      const parentOrder = newOrder[parentComponentId] || {};
      const currentIndex = parentOrder[subcomponentId];
      
      if (currentIndex > 0) {
        const subcomponentAbove = Object.keys(parentOrder).find(id => parentOrder[id] === currentIndex - 1);
        if (subcomponentAbove) {
          parentOrder[subcomponentId] = currentIndex - 1;
          parentOrder[subcomponentAbove] = currentIndex;
          newOrder[parentComponentId] = parentOrder;
          saveSubcomponentOrder(parentComponentId, parentOrder);
        }
      }
      
      return newOrder;
    });
  }, []);

  const moveSubcomponentDown = useCallback((parentComponentId: string, subcomponentId: string) => {
    setSubcomponentOrder(prev => {
      const newOrder = { ...prev };
      const parentOrder = newOrder[parentComponentId] || {};
      const currentIndex = parentOrder[subcomponentId];
      const maxIndex = Math.max(...Object.values(parentOrder));
      
      if (currentIndex < maxIndex) {
        const subcomponentBelow = Object.keys(parentOrder).find(id => parentOrder[id] === currentIndex + 1);
        if (subcomponentBelow) {
          parentOrder[subcomponentId] = currentIndex + 1;
          parentOrder[subcomponentBelow] = currentIndex;
          newOrder[parentComponentId] = parentOrder;
          saveSubcomponentOrder(parentComponentId, parentOrder);
        }
      }
      
      return newOrder;
    });
  }, []);

  // Función para guardar el orden de subcomponentes
  const saveSubcomponentOrder = useCallback(async (parentComponentId: string, order: Record<string, number>) => {
    if (!machine?.id) return;
    
    const localStorageKey = `machine_${machine.id}_subcomponent_order_${parentComponentId}`;
    localStorage.setItem(localStorageKey, JSON.stringify(order));
  }, [machine?.id]);

  // Forzar cierre del modal si la máquina es null
  useEffect(() => {
    if (!machine && isOpen) {
      onClose();
    }
  }, [machine, isOpen, onClose]);

  // Efecto para manejar la selección inicial de componente
  useEffect(() => {
    if (selectedComponentId && componentList.length > 0) {
      const foundComponent = componentList.find(c => c.id === selectedComponentId.toString());
      if (foundComponent) {
        setSelectedComponent(foundComponent);
        setActiveTab('components');
      }
    }
  }, [selectedComponentId, componentList]);

  // Efecto para manejar el tab inicial
  useEffect(() => {
    if (initialTab && initialTab !== 'overview') {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  if (!machine) return null;

  // ✨ OPTIMIZADO: Memoizar sortedComponents para evitar recálculos innecesarios
  const sortedComponents = useMemo(() => {
    let filtered = [...componentList];

    // Filtrar por búsqueda de nombre
    if (componentSearchTerm) {
      const searchLower = componentSearchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(searchLower) ||
        c.brand?.toLowerCase().includes(searchLower) ||
        c.model?.toLowerCase().includes(searchLower) ||
        c.code?.toLowerCase().includes(searchLower)
      );
    }

    // Filtrar por sistema
    if (componentSystemFilter && componentSystemFilter !== 'all') {
      filtered = filtered.filter(c => c.system?.toLowerCase() === componentSystemFilter.toLowerCase());
    }

    // Ordenar
    return filtered.sort((a, b) => {
      const orderA = componentOrder[a.id.toString()] ?? 0;
      const orderB = componentOrder[b.id.toString()] ?? 0;
      return orderA - orderB;
    });
  }, [componentList, componentOrder, componentSearchTerm, componentSystemFilter]);

  const getMachineStatusBadge = (status: MachineStatus) => {
    switch (status) {
      case MachineStatus.ACTIVE:
        return <Badge variant="default" className="bg-success">Activo</Badge>;
      case MachineStatus.OUT_OF_SERVICE:
        return <Badge variant="secondary" className="bg-warning">Fuera de servicio</Badge>;
      case MachineStatus.DECOMMISSIONED:
        return <Badge variant="destructive">Baja</Badge>;
      default:
        return null;
    }
  };

  const getMachineTypeLabel = (type: MachineType) => {
    switch (type) {
      case MachineType.PRODUCTION:
        return 'Producción';
      case MachineType.MAINTENANCE:
        return 'Mantenimiento';
      case MachineType.UTILITY:
        return 'Utilidad';
      case MachineType.PACKAGING:
        return 'Empaque';
      case MachineType.TRANSPORTATION:
        return 'Transporte';
      case MachineType.OTHER:
        return 'Otro tipo';
      default:
        return type || 'Sin especificar';
    }
  };

  const getComponentTypeLabel = (type: string) => {
    const normalizedType = type?.toLowerCase();
    switch (normalizedType) {
      case 'part':
        return 'Parte Principal';
      case 'piece':
        return 'Pieza';
      case 'subpiece':
        return 'Subpieza';
      default:
        return type || 'Pieza';
    }
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

  const handleViewComponentDetails = (component: MachineComponent) => {
    log('🔍 [MACHINE DETAIL] handleViewComponentDetails llamado con:', component);
    log('🔍 [MACHINE DETAIL] Component ID:', component.id);
    log('🔍 [MACHINE DETAIL] Component name:', component.name);
    setSelectedComponent(component);
    setIsComponentModalOpen(true);
    log('🔍 [MACHINE DETAIL] Modal abierto para componente:', component.name);
  };

  const handleEditComponent = (component: MachineComponent) => {
    log('🔍 [EDIT] Editando componente:', component.name);
    setComponentToEdit(component);
    setIsEditComponentDialogOpen(true);
  };

  const handleCloseComponentModal = () => {
    setIsComponentModalOpen(false);
    setSelectedComponent(null);
    // ✨ OPTIMIZADO: Usar refetch del hook
    fetchComponents();
  };

  const handleDeleteComponent = async (componentId: number) => {
    const ok = await confirm({
      title: 'Eliminar componente',
      description: '¿Seguro que deseas eliminar este componente y todos sus subcomponentes?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    deleteComponentMutation.mutate({ componentId });
  };

  const handleUpdateComponent = (data: any) => {
    if (!componentToEdit) return;
    updateComponentMutation.mutate(data);
  };

  const handleAddComponent = (data: any) => {
    log('🔍 [MACHINE DETAIL] handleAddComponent llamado con datos:', data);
    addComponentMutation.mutate(data);
  };

  const handleDeleteMachine = async (machineToDelete: Machine) => {
    log('🔍 [MACHINE DETAIL] handleDeleteMachine llamado con:', machineToDelete.id);

    // Confirmar eliminación
    const ok = await confirm({
      title: 'Eliminar máquina',
      description: `¿Estás seguro de que quieres eliminar la máquina "${machineToDelete.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    
    try {
      // Cerrar el modal inmediatamente para evitar conflictos
      onClose();
      
      // Llamar a la función de eliminación
      if (onDelete) {
        await onDelete(machineToDelete);
      }
    } catch (error) {
      console.error('Error al eliminar máquina:', error);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <CustomDialogContent noScroll={activeTab === 'schema'}>
          <div className="flex flex-col h-full overflow-x-hidden">
            <DialogHeader className="p-2 px-4 flex-shrink-0 space-y-0 overflow-hidden border-none">
              <DialogTitle className="sr-only">{machine.name}</DialogTitle>
              <DialogDescription className="sr-only">
                Detalle de la máquina {machine.name}
              </DialogDescription>
              <div className="flex items-center w-full overflow-hidden">
                <MachineDetailHeader
                machine={machine}
                sectorName={sectors.find(s => String(s.id) === String(machine.sectorId))?.name}
                stats={(() => {
                  const oneWeekAgo = new Date();
                  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                  const isLastWeek = (date: any) => date && new Date(date) >= oneWeekAgo;

                  return {
                    pendingOrders: headerWorkOrders.filter((wo: any) => wo.status === 'PENDING' || wo.status === 'IN_PROGRESS').length,
                    openFailures: headerFailures.filter((f: any) => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length,
                    completedOrders: headerWorkOrders.filter((wo: any) => wo.status === 'COMPLETED' && isLastWeek(wo.completedDate || wo.updatedAt)).length,
                    preventiveOrders: headerWorkOrders.filter((wo: any) => wo.type === 'PREVENTIVE' && isLastWeek(wo.scheduledDate || wo.createdAt)).length,
                    lastMaintenance: headerWorkOrders.filter((wo: any) => wo.status === 'COMPLETED').sort((a: any, b: any) =>
                      new Date(b.completedDate || b.updatedAt).getTime() - new Date(a.completedDate || a.updatedAt).getTime()
                    )[0]?.completedDate || null,
                  };
                })()}
                onEdit={onEdit && canEditMachine ? () => onEdit(machine) : undefined}
                onDelete={onDelete && canDeleteMachine ? () => handleDeleteMachine(machine) : undefined}
                onDisassemble={canDisassembleMachine ? () => setShowDisassembleDialog(true) : undefined}
                onNewPreventive={() => setShowPreventiveDialog(true)}
                onNewCorrective={() => { setWorkOrderWizardType('CORRECTIVE'); setShowWorkOrderWizard(true); }}
                onNewOrder={() => { setWorkOrderWizardType(null); setShowWorkOrderWizard(true); }}
                onReportFailure={() => setShowFailureReportDialog(true)}
                canEdit={canEditMachine}
                canDelete={canDeleteMachine}
                canDisassemble={canDisassembleMachine}
                canCreateOrder={canCreateMaintenance}
                canReportFailure={canRegisterFailure}
                onClose={onClose}
              />
              </div>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col flex-1 overflow-x-hidden">
              <div className="mb-2 flex-shrink-0 px-1 sm:flex sm:justify-center">
                <TabsList className="relative items-center justify-start text-muted-foreground w-full sm:w-fit gap-0.5 inline-flex h-9 bg-muted/40 border border-border rounded-lg p-0.5 overflow-x-auto overflow-y-hidden hide-scrollbar">
                  <TabsTrigger value="overview" className="flex items-center gap-1 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                    <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                    <span>Resumen</span>
                  </TabsTrigger>
                  <TabsTrigger value="info" className="flex items-center gap-1 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>Info</span>
                  </TabsTrigger>
                  <TabsTrigger value="schema" className="flex items-center gap-1 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                    <Network className="h-3.5 w-3.5 shrink-0" />
                    <span>Esquema</span>
                  </TabsTrigger>
                  <TabsTrigger value="3d-viewer" className="flex items-center gap-1 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                    <Box className="h-3.5 w-3.5 shrink-0" />
                    <span>3D</span>
                  </TabsTrigger>
                  <TabsTrigger value="maintenance" className="flex items-center gap-1 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                    <Settings className="h-3.5 w-3.5 shrink-0" />
                    <span>Mantenimiento</span>
                    {headerWorkOrders?.length > 0 ? (
                      <Badge variant="secondary" className="ml-0.5 h-5 px-1 text-xs bg-info-muted text-info-muted-foreground">
                        {headerWorkOrders.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="failures" className="flex items-center gap-1 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Fallas</span>
                    {headerFailures?.length > 0 ? (
                      <Badge variant="secondary" className="ml-0.5 h-5 px-1 text-xs bg-destructive/10 text-destructive">
                        {headerFailures.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="solutions" className="flex items-center gap-1 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                    <span>Soluciones</span>
                  </TabsTrigger>
                  <TabsTrigger value="components" className="flex items-center gap-1 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                    <Wrench className="h-3.5 w-3.5 shrink-0" />
                    <span>Componentes</span>
                    {componentList?.length ? (
                      <Badge variant="secondary" className="ml-0.5 h-5 px-1 text-xs">
                        {componentList.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                  {canViewMachineHistory && (
                    <TabsTrigger value="history" className="flex items-center gap-1 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                      <History className="h-3.5 w-3.5 shrink-0" />
                      <span>Historial</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="docs" className="flex items-center gap-1 text-xs font-medium h-7 px-2.5 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md whitespace-nowrap">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span>Documentos</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className={cn('flex-1 min-h-0', activeTab === 'schema' ? 'overflow-hidden' : 'overflow-y-auto')}>
              <TabsContent value="overview" className="mt-0">
                {visitedTabs.has('overview') && (
                  <MachineOverviewTab
                    machine={machine}
                    companyId={machine.companyId || companyIdForFailures || 0}
                    onTabChange={handleTabChange}
                  />
                )}
              </TabsContent>

              <TabsContent value="info" className="mt-0 p-4">
                <MachineDetailsSection machine={machine} sectors={sectors} />
              </TabsContent>

              <TabsContent value="schema" className="mt-0">
                <MachineSchemaView
                  machine={machine}
                  components={componentList}
                  onComponentClick={handleViewComponentDetails}
                  componentOrder={componentOrder}
                  subcomponentOrder={subcomponentOrder}
                />
              </TabsContent>

              <TabsContent value="3d-viewer" className="mt-0">
                <Machine3DViewerTab
                  machine={{ ...machine, components: componentList }}
                  companyId={machine.companyId || companyIdForFailures || 0}
                  documents={machineDocumentsQuery.data || []}
                  onUpload3DModel={handleUpload3DModel}
                  onLinkModel={handleLink3DModel}
                />
              </TabsContent>

                              <TabsContent value="components" className="mt-0">
                  <div className="space-y-4 max-h-[calc(90vh-180px)] overflow-y-auto pr-2">
                    {/* Toolbar de búsqueda y filtros */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center sm:justify-between">
                      <div className="flex flex-1 items-center gap-1.5 sm:gap-2">
                        {/* Búsqueda */}
                        <div className="relative flex-1 max-w-sm">
                          <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 w-3.5 sm:w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar..."
                            value={componentSearchTerm}
                            onChange={(e) => setComponentSearchTerm(e.target.value)}
                            className="pl-8 sm:pl-10 h-7 sm:h-9 text-xs sm:text-sm"
                          />
                          {componentSearchTerm && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-0.5 sm:right-1 top-1/2 -translate-y-1/2 h-6 sm:h-7 w-6 sm:w-7 p-0"
                              onClick={() => setComponentSearchTerm('')}
                            >
                              <X className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                            </Button>
                          )}
                        </div>
                        {/* Filtro por sistema */}
                        <Select value={componentSystemFilter} onValueChange={setComponentSystemFilter}>
                          <SelectTrigger className="w-[100px] sm:w-[160px] h-7 sm:h-9 text-xs sm:text-sm">
                            <SelectValue placeholder="Sistema" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los sistemas</SelectItem>
                            <SelectItem value="electrico">Eléctrico</SelectItem>
                            <SelectItem value="hidraulico">Hidráulico</SelectItem>
                            <SelectItem value="neumatico">Neumático</SelectItem>
                            <SelectItem value="mecanico">Mecánico</SelectItem>
                            <SelectItem value="automatizacion">Automatización</SelectItem>
                            <SelectItem value="refrigeracion">Refrigeración</SelectItem>
                            <SelectItem value="lubricacion">Lubricación</SelectItem>
                            <SelectItem value="combustible">Combustible</SelectItem>
                            <SelectItem value="control">Control</SelectItem>
                            <SelectItem value="seguridad">Seguridad</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                          {sortedComponents.length} de {componentList.length}
                        </span>
                        {canCreateMachine && (
                          <>
                            <Button
                              variant="outline"
                              className="h-7 sm:h-9 text-xs px-2 sm:px-3"
                              onClick={() => setIsAIComponentDialogOpen(true)}
                            >
                              <Sparkles className="h-3 w-3 sm:mr-1.5" />
                              <span className="hidden sm:inline">Agregar con IA</span>
                              <span className="sm:hidden">IA</span>
                            </Button>
                            <Button
                              variant="outline"
                              className="h-7 sm:h-9 text-xs px-2 sm:px-3"
                              onClick={() => {
                                log('🔍 [MACHINE DETAIL] Botón "Agregar componente" presionado');
                                log('🔍 [MACHINE DETAIL] canCreateMachine:', canCreateMachine);
                                log('🔍 [MACHINE DETAIL] machine.id:', machine?.id);
                                log('🔍 [MACHINE DETAIL] isAddComponentDialogOpen antes:', isAddComponentDialogOpen);
                                setIsAddComponentDialogOpen(true);
                                log('🔍 [MACHINE DETAIL] setIsAddComponentDialogOpen(true) ejecutado');
                              }}
                            >
                              <Plus className="h-3 w-3 sm:mr-1.5" />
                              <span className="hidden sm:inline">Agregar componente</span>
                              <span className="sm:hidden">Agregar</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {sortedComponents.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sortedComponents.map((component) => (
                          <Card
                            key={component.id}
                            className="overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30 group"
                            onClick={() => handleViewComponentDetails(component)}
                          >
                            {/* Imagen/Icono arriba */}
                            <div className="relative h-24 sm:h-28 bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center">
                              {component.logo ? (
                                <img
                                  src={component.logo}
                                  alt={`Logo de ${component.name}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Wrench className="h-10 w-10 text-muted-foreground/50" />
                              )}
                              {/* Input de orden en esquina - editable */}
                              <input
                                type="number"
                                min="1"
                                max={componentList.length}
                                defaultValue={(componentOrder[component.id.toString()] || 0) + 1}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => {
                                  e.stopPropagation();
                                  const inputValue = parseInt(e.target.value);
                                  const maxPosition = componentList.length;
                                  if (inputValue < 1) e.target.value = '1';
                                  else if (inputValue > maxPosition) e.target.value = maxPosition.toString();
                                  const newPosition = parseInt(e.target.value) - 1;
                                  if (newPosition >= 0 && newPosition < componentList.length) {
                                    setComponentOrder(prev => {
                                      const newOrder = { ...prev };
                                      const currentPosition = newOrder[component.id.toString()] || 0;
                                      if (currentPosition === newPosition) return prev;
                                      const componentIds = Object.keys(newOrder).filter(id => id !== component.id.toString());
                                      if (newPosition > currentPosition) {
                                        componentIds.forEach(id => {
                                          const pos = newOrder[id];
                                          if (pos > currentPosition && pos <= newPosition) newOrder[id] = pos - 1;
                                        });
                                      } else {
                                        componentIds.forEach(id => {
                                          const pos = newOrder[id];
                                          if (pos >= newPosition && pos < currentPosition) newOrder[id] = pos + 1;
                                        });
                                      }
                                      newOrder[component.id.toString()] = newPosition;
                                      saveComponentOrder(newOrder);
                                      return newOrder;
                                    });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  }
                                }}
                                onFocus={(e) => e.stopPropagation()}
                                className="absolute top-2 left-2 h-6 w-8 text-center text-xs font-medium rounded bg-background/90 backdrop-blur-sm border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
                                title="Cambiar posición"
                              />
                              {/* Acciones en esquina derecha */}
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {canEditMachine && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditComponent(component);
                                    }}
                                    className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                {canDeleteMachine && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteComponent(Number(component.id));
                                    }}
                                    className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            {/* Contenido abajo */}
                            <CardContent className="p-3">
                              <h3 className="text-sm font-semibold text-foreground truncate">{component.name}</h3>
                              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 px-1.5 py-0">
                                  {component.parentId === null || component.parentId === undefined ? 'Parte Principal' : getComponentTypeLabel(component.type)}
                                </Badge>
                                {component.system && (
                                  <Badge variant="outline" className="text-xs bg-info-muted text-info-muted-foreground border-info-muted px-1.5 py-0">
                                    {getSystemLabel(component.system)}
                                  </Badge>
                                )}
                              </div>
                              {component.technicalInfo && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                                  {typeof component.technicalInfo === 'string'
                                    ? component.technicalInfo
                                    : ''}
                                </p>
                              )}
                              {/* Indicador de subcomponentes */}
                              {component.children && component.children.length > 0 && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                  <Wrench className="h-3 w-3" />
                                  <span>{component.children.length} pieza{component.children.length !== 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="text-center py-12">
                          <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                          <h3 className="text-sm font-medium mb-2">No hay componentes registrados</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Esta máquina no tiene componentes registrados en el sistema.
                          </p>
                          {canCreateMachine && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="h-9 text-xs"
                                onClick={() => setIsAIComponentDialogOpen(true)}
                              >
                                <Sparkles className="h-3 w-3 mr-2" />
                                Agregar con IA
                              </Button>
                              <Button
                                variant="outline"
                                className="h-9 text-xs"
                                onClick={() => {
                                  log('🔍 [MACHINE DETAIL] Botón "Agregar componente" (sin componentes) presionado');
                                  log('🔍 [MACHINE DETAIL] canCreateMachine:', canCreateMachine);
                                  log('🔍 [MACHINE DETAIL] machine.id:', machine?.id);
                                  setIsAddComponentDialogOpen(true);
                                }}
                              >
                                <Plus className="h-3 w-3 mr-2" />
                                Agregar componente
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>



              <TabsContent value="maintenance" className="mt-0">
                {visitedTabs.has('maintenance') && (
                  <div className="h-full">
                    {/* ✨ LAZY LOADING: Solo carga cuando se visita el tab */}
                    <MachineMaintenanceTab
                      machineId={machine.id}
                      machineName={machine.name}
                      sectorId={machine.sectorId || undefined}
                      companyId={machine.companyId}
                      sectorName={machine.sector?.name}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="failures" className="mt-0">
                {visitedTabs.has('failures') && (
                  <MachineFailuresTab
                    machineId={machine.id}
                    machineName={machine.name}
                    components={componentList}
                  />
                )}
              </TabsContent>

              <TabsContent value="solutions" className="mt-0">
                {visitedTabs.has('solutions') && (
                  <MachineSolutionsContent
                    machineId={machine.id}
                    machineName={machine.name}
                    companyId={machine.companyId}
                  />
                )}
              </TabsContent>

              {canViewMachineHistory && (
                <TabsContent value="history" className="mt-0">
                  {visitedTabs.has('history') && (
                    <MachineHistoryContent
                      machineId={machine.id}
                      machineName={machine.name}
                    />
                  )}
                </TabsContent>
              )}

              <TabsContent value="docs">
                <DocumentacionTab machineId={String(machine.id)} canEditMachine={canEditMachine} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
        </CustomDialogContent>
      </Dialog>

      {/* Modal de detalles del componente */}
      <ComponentDetailsModal
        component={selectedComponent}
        isOpen={isComponentModalOpen}
        onClose={handleCloseComponentModal}
        onDeleted={() => {
          setIsComponentModalOpen(false);
          // ✨ OPTIMIZADO: Usar refetch del hook
          fetchComponents();
        }}
      />

      {canEditMachine && (
        <ComponentDialog
          isOpen={isAddComponentDialogOpen}
          onClose={() => {
            log('🔍 [MACHINE DETAIL] Cerrando ComponentDialog');
            setIsAddComponentDialogOpen(false);
          }}
          onSave={handleAddComponent}
          machineId={machine.id}
        />
      )}

      <AIComponentImportDialog
        isOpen={isAIComponentDialogOpen}
        onClose={() => setIsAIComponentDialogOpen(false)}
        onSuccess={() => {
          setIsAIComponentDialogOpen(false);
          fetchComponents();
        }}
        machineId={machine.id}
        machineName={machine.name}
      />

      {canEditMachine && componentToEdit && (
        <>
          {log('🔍 [MACHINE DETAIL] componentToEdit completo:', componentToEdit)}
          {log('🔍 [MACHINE DETAIL] componentToEdit.tools:', componentToEdit.tools)}
          {log('🔍 [MACHINE DETAIL] componentToEdit.tools?.length:', componentToEdit.tools?.length)}
          <ComponentDialog
          isOpen={isEditComponentDialogOpen}
          onClose={() => {
            setIsEditComponentDialogOpen(false);
            setComponentToEdit(null);
          }}
          onSave={handleUpdateComponent}
          machineId={machine.id}
          initialValues={{
            id: componentToEdit.id,
            name: componentToEdit.name,
            type: componentToEdit.type,
            technicalInfo: typeof componentToEdit.technicalInfo === 'string' 
              ? componentToEdit.technicalInfo 
              : JSON.stringify(componentToEdit.technicalInfo),
            logo: componentToEdit.logo,
            machineId: machine.id,
            // Información del repuesto vinculado
            spareAction: componentToEdit.tools && componentToEdit.tools.length > 0 ? 'link' : 'none',
            existingSpareId: componentToEdit.tools && componentToEdit.tools.length > 0 
              ? componentToEdit.tools[0].toolId 
              : undefined,
            // Si hay repuesto vinculado, mostrar información adicional
            spareName: componentToEdit.tools && componentToEdit.tools.length > 0 
              ? componentToEdit.tools[0].tool?.name 
              : '',
            spareDescription: componentToEdit.tools && componentToEdit.tools.length > 0 
              ? componentToEdit.tools[0].tool?.description 
              : '',
            initialStock: componentToEdit.tools && componentToEdit.tools.length > 0 
              ? componentToEdit.tools[0].tool?.stockQuantity || 0 
              : 0,
            spareMinStock: componentToEdit.tools && componentToEdit.tools.length > 0 
              ? componentToEdit.tools[0].minStockLevel || 0 
              : 0,
          }}
        />
        </>
      )}

      {/* Diálogo de Nuevo Preventivo */}
      {showPreventiveDialog && (
        <PreventiveMaintenanceDialog
          isOpen={showPreventiveDialog}
          onClose={() => setShowPreventiveDialog(false)}
          preselectedMachineId={machine.id}
          onSave={() => {
            setShowPreventiveDialog(false);
            queryClient.invalidateQueries({ queryKey: ['preventive-maintenance', 'machine', machine.id] });
            queryClient.invalidateQueries({ queryKey: ['work-orders', 'machine', machine.id] });
          }}
        />
      )}

      {/* Diálogo de Nueva OT Correctiva */}
      {showCorrectiveDialog && (
        <CorrectiveMaintenanceDialog
          isOpen={showCorrectiveDialog}
          onClose={() => setShowCorrectiveDialog(false)}
          preselectedMachineId={machine.id}
          onSave={() => {
            setShowCorrectiveDialog(false);
            queryClient.invalidateQueries({ queryKey: ['work-orders', 'machine', machine.id] });
          }}
        />
      )}

      {/* Work Order Wizard */}
      {showWorkOrderWizard && (
        <WorkOrderWizard
          isOpen={showWorkOrderWizard}
          onClose={() => { setShowWorkOrderWizard(false); setWorkOrderWizardType(null); }}
          preselectedMachine={{ id: machine.id, name: machine.name }}
          preselectedType={workOrderWizardType}
          onSubmit={async (data) => {
            setShowWorkOrderWizard(false);
            setWorkOrderWizardType(null);
            refetchMachineDetail?.();
          }}
        />
      )}

      {/* Diálogo de Reportar Falla */}
      <FailureQuickReportDialog
        open={showFailureReportDialog}
        onOpenChange={setShowFailureReportDialog}
        preselectedMachineId={machine.id}
      />

      {/* Diálogo de Desarmar Máquina */}
      <DisassembleMachineDialog
        machine={machine ? { id: machine.id, name: machine.name } : null}
        isOpen={showDisassembleDialog}
        onClose={() => setShowDisassembleDialog(false)}
        onSuccess={() => {
          setShowDisassembleDialog(false);
          onClose();
          // Recargar la página para reflejar cambios
          window.location.reload();
        }}
      />
    </>
  );
}

// Modal para crear/editar fallas
const FailureDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  machineId: number;
  machineName: string;
  components: MachineComponent[];
}> = ({ isOpen, onClose, onSave, machineId, machineName, components }) => {
  const { currentCompany } = useCompany();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    selectedComponents: [] as number[],
    selectedSubcomponents: [] as number[],
    failureType: 'MECANICA',
    priority: 'MEDIUM',
    estimatedHours: '',
    estimatedTimeUnit: 'hours' as 'hours' | 'minutes',
    isHistorical: false,
    reportedDate: new Date().toISOString().split('T')[0],
    solution: '',
    toolsUsed: [] as any[],
    sparePartsUsed: [] as any[],
    isRecurring: false,
    previousOccurrences: 0,
    totalCost: '',
    actualHours: '',
    actualTimeUnit: 'hours' as 'hours' | 'minutes'
  });

  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [availableSpareParts, setAvailableSpareParts] = useState<any[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [loadingSpareParts, setLoadingSpareParts] = useState(false);
  const [componentSpareParts, setComponentSpareParts] = useState<any[]>([]);
  const [loadingComponentSpareParts, setLoadingComponentSpareParts] = useState(false);
  const [solutionAttachments, setSolutionAttachments] = useState<any[]>([]);
  const [failureAttachments, setFailureAttachments] = useState<any[]>([]);
  const [uploadingSolutionFiles, setUploadingSolutionFiles] = useState(false);
  const [uploadingFailureFiles, setUploadingFailureFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [viewingFile, setViewingFile] = useState<any>(null);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [showCreateToolDialog, setShowCreateToolDialog] = useState(false);
  const [newToolData, setNewToolData] = useState({
    name: '',
    description: '',
    category: '',
    location: '',
    quantity: 1,
    photo: null as File | null
  });
  const [uploadingToolPhoto, setUploadingToolPhoto] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [showSchemaSelector, setShowSchemaSelector] = useState(false);
  
  // Estado para pan y zoom
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan');
  const [showExpandedModal, setShowExpandedModal] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [searchTerm, setSearchTerm] = useState('');

  // Nuevos estados para el flujo de dos pasos
  const [failureId, setFailureId] = useState<number | null>(null);
  const [showSolutionDialog, setShowSolutionDialog] = useState(false);
  const [isSavingFailure, setIsSavingFailure] = useState(false);
  const [isSavingSolution, setIsSavingSolution] = useState(false);

  // ── Mutations: Fallas y Soluciones ──
  const createFailureMutation = useApiMutation<any, any>({
    mutationFn: createFetchMutation({ url: '/api/failures', method: 'POST' }),
    successMessage: null, // Custom messages per usage
    errorMessage: 'Error al registrar la falla',
  });

  const saveSolutionMutation = useApiMutation<any, { failureId: number; data: any }>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/failures/${vars.failureId}/solution`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars.data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar la solución');
      }
      return res.json();
    },
    successMessage: 'Solución cargada exitosamente',
    errorMessage: 'Error al guardar la solución',
    onSuccess: () => {
      onSave();
      onClose();
    },
  });

  // Funciones para obtener datos del pañol
  const fetchTools = async () => {
    if (!currentCompany) return;
    
    setLoadingTools(true);
    try {
      // Obtener solo herramientas (TOOL), excluir repuestos (SUPPLY)
      const response = await fetch(`/api/tools?companyId=${currentCompany.id}&itemType=TOOL`);
      if (response.ok) {
        const data = await response.json();
        setAvailableTools(data.tools || []);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
      setAvailableTools([]);
    } finally {
      setLoadingTools(false);
    }
  };

  const fetchSpareParts = async () => {
    if (!currentCompany) return;
    
    setLoadingSpareParts(true);
    try {
      // Obtener solo repuestos (SUPPLY), excluir herramientas (TOOL)
      const response = await fetch(`/api/tools?companyId=${currentCompany.id}&itemType=SUPPLY`);
      if (response.ok) {
        const data = await response.json();
        setAvailableSpareParts(data.tools || []);
      }
    } catch (error) {
      console.error('Error fetching spare parts:', error);
      setAvailableSpareParts([]);
    } finally {
      setLoadingSpareParts(false);
    }
  };

  const fetchCategories = async () => {
    if (!currentCompany) {
      log('❌ No currentCompany available');
      return;
    }
    
    log('🔄 Fetching categories for company:', currentCompany.id);
    setLoadingCategories(true);
    
    try {
      const response = await fetch(`/api/tools/categories?companyId=${currentCompany.id}`);
      log('📡 API Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        log('📦 Categories received:', data.categories);
        setCategories(data.categories || []);
      } else {
        console.error('❌ Error response:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error details:', errorText);
      }
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
      log('✅ Fetch categories completed');
    }
  };

  const fetchComponentSpareParts = async (componentIds: number[]) => {
    if (!currentCompany || componentIds.length === 0) {
      setComponentSpareParts([]);
      return;
    }
    
    setLoadingComponentSpareParts(true);
    try {
      // Obtener repuestos de todos los componentes seleccionados
      const promises = componentIds.map(async (componentId) => {
        const response = await fetch(`/api/components/${componentId}/tools`);
        if (response.ok) {
          const data = await response.json();
          return data.map((item: any) => ({
            ...item.tool,
            componentId: componentId,
            componentName: item.component.name,
            quantityNeeded: item.quantityNeeded,
            isOptional: item.isOptional,
            notes: item.notes
          }));
        }
        return [];
      });
      
      const results = await Promise.all(promises);
      const allSpareParts = results.flat();
      
      // Eliminar duplicados basándose en el ID del repuesto
      const uniqueSpareParts = allSpareParts.filter((part, index, self) => 
        index === self.findIndex(p => p.id === part.id)
      );
      
      setComponentSpareParts(uniqueSpareParts);
    } catch (error) {
      console.error('Error fetching component spare parts:', error);
      setComponentSpareParts([]);
    } finally {
      setLoadingComponentSpareParts(false);
    }
  };

  // Función para obtener repuestos filtrados por componentes seleccionados
  const getFilteredSpareParts = () => {
    const selectedComponentIds = [...formData.selectedComponents, ...formData.selectedSubcomponents];
    
    if (selectedComponentIds.length === 0) {
      return []; // Sin componentes seleccionados, no mostrar repuestos
    }
    
    // Solo mostrar repuestos de componentes seleccionados
    const filteredSpareParts = [];
    
    // Agregar repuestos de componentes seleccionados
    componentSpareParts.forEach(componentPart => {
      if (selectedComponentIds.includes(componentPart.componentId)) {
        filteredSpareParts.push({
          ...componentPart,
          name: `${componentPart.name} (${componentPart.componentName})`,
          componentInfo: componentPart.componentName
        });
      }
    });
    
    // Si no hay repuestos específicos de componentes, mostrar todos los repuestos del pañol
    if (filteredSpareParts.length === 0) {
      return availableSpareParts;
    }
    
    return filteredSpareParts;
  };

  // Cargar datos del pañol cuando se abre el modal
  useEffect(() => {
    if (isOpen && currentCompany) {
      log('🚀 Loading data for modal, company:', currentCompany.id);
      fetchTools();
      fetchSpareParts();
      fetchCategories();
    }
  }, [isOpen, currentCompany]);

  // Cargar repuestos de componentes cuando cambian los componentes o subcomponentes seleccionados
  useEffect(() => {
    const selectedIds = [...formData.selectedComponents, ...formData.selectedSubcomponents];
    if (selectedIds.length > 0) {
      fetchComponentSpareParts(selectedIds);
    } else {
      setComponentSpareParts([]);
    }
  }, [formData.selectedComponents, formData.selectedSubcomponents]);

  // Funciones para manejar archivos de solución
  const handleSolutionFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingSolutionFiles(true);
    setUploadProgress({});

    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const fileId = `file-${Date.now()}-${index}`;
        
        // Validar tipo de archivo
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'text/plain'
        ];

        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Tipo de archivo no permitido: ${file.name}`);
        }

        // Validar tamaño (máximo 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`El archivo ${file.name} es demasiado grande. Máximo 10MB`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', 'failure');
        formData.append('entityId', machineId.toString());
        formData.append('fileType', 'solution');

        // Simular progreso
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: Math.min((prev[fileId] || 0) + 10, 90)
          }));
        }, 100);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error al subir ${file.name}`);
        }

        const data = await response.json();
        
        // Completar progreso
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: 100
        }));

        return {
          url: data.url,
          name: data.originalName,
          size: data.size,
          type: file.type,
          fileName: data.fileName
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setSolutionAttachments(prev => [...prev, ...uploadedFiles]);

      // Limpiar progreso después de un momento
      setTimeout(() => {
        setUploadProgress({});
      }, 1000);

    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error(error instanceof Error ? error.message : 'Error al subir archivos');
    } finally {
      setUploadingSolutionFiles(false);
    }
  };

  const removeSolutionFile = (index: number) => {
    setSolutionAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleFailureFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setUploadingFailureFiles(true);
    const newFiles: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validar tamaño del archivo (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`El archivo ${file.name} excede el tamaño máximo de 10MB`);
        continue;
      }

      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(`El archivo ${file.name} no es un tipo de archivo válido`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'failure');
      formData.append('entityId', machineId.toString());
      formData.append('fileType', 'failure');

      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          newFiles.push({
            name: file.name,
            url: data.url,
            size: file.size,
            type: file.type
          });
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        } else {
          toast.error(`Error al subir ${file.name}`);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error(`Error al subir ${file.name}`);
      }
    }

    setFailureAttachments(prev => [...prev, ...newFiles]);
    setUploadingFailureFiles(false);
    setUploadProgress({});
  };

  const removeFailureFile = (index: number) => {
    setFailureAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleViewFile = (file: any) => {
    setViewingFile(file);
    setShowFileViewer(true);
  };

  const handleCreateTool = async () => {
    if (!newToolData.name.trim()) {
      toast.error('El nombre de la herramienta es obligatorio');
      return;
    }

    if (!currentCompany) {
      toast.error('No hay empresa seleccionada');
      return;
    }

    try {
      setUploadingToolPhoto(true);
      
      let photoUrl = null;
      
      // Subir foto si existe
      if (newToolData.photo) {
        const formData = new FormData();
        formData.append('file', newToolData.photo);
        formData.append('entityType', 'tools');
        formData.append('entityId', 'new');
        formData.append('fileType', 'photo');
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          photoUrl = uploadResult.url;
          log('✅ Foto subida exitosamente:', photoUrl);
        } else {
          const errorText = await uploadResponse.text();
          console.error('❌ Error uploading photo:', errorText);
          toast.error('Error al subir la foto');
          setUploadingToolPhoto(false);
          return;
        }
      }

      const toolData = {
        name: newToolData.name,
        description: newToolData.description,
        category: newToolData.category,
        location: newToolData.location,
        stockQuantity: newToolData.quantity,
        itemType: 'TOOL',
        companyId: currentCompany.id
      };
      
      // TODO: Cuando se agregue el campo photoUrl al esquema de Prisma,
      // agregar photoUrl al toolData
      
      log('🛠️ Creating tool with data:', toolData);
      
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toolData),
      });

      if (response.ok) {
        const newTool = await response.json();
        
        // Recargar las herramientas para asegurar que aparezca en el selector
        await fetchTools();
        
        // Agregar automáticamente a las herramientas utilizadas
        setFormData(prev => ({
          ...prev,
          toolsUsed: [...prev.toolsUsed, newTool]
        }));

        // Limpiar el formulario
        setNewToolData({
          name: '',
          description: '',
          category: '',
          location: '',
          quantity: 1,
          photo: null
        });

        setShowCreateToolDialog(false);

        const successMessage = photoUrl 
          ? 'La herramienta se ha creado y agregado al pañol (con foto)'
          : 'La herramienta se ha creado y agregado al pañol';
        toast.success(successMessage);
      } else {
        const errorData = await response.json();
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.error || 'Error al crear la herramienta');
      }
    } catch (error) {
      console.error('Error creating tool:', error);
      toast.error('No se pudo crear la herramienta');
    } finally {
      setUploadingToolPhoto(false);
    }
  };

  // Funciones para pan y zoom
  const handleZoomIn = () => {
    setZoom(z => Math.min(z + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(z => Math.max(z - 0.2, 0.3));
  };

  const handleCenter = () => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (interactionMode === 'pan') {
      setDragging(true);
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging && interactionMode === 'pan') {
      setOffset(prev => ({
        x: prev.x + (e.clientX - lastPos.x),
        y: prev.y + (e.clientY - lastPos.y),
      }));
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.3, Math.min(3, z + delta)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Esta función ya no se usa, se reemplazó por las funciones específicas
    // handleSaveFailureOnly() y handleCreateFailureAndLoadSolution()
  };

  // Función para guardar solo la falla (sin solución)
  const handleSaveFailureOnly = () => {
    const failureData = {
      title: formData.title,
      description: formData.description,
      machineId: machineId,
      selectedComponents: formData.selectedComponents,
      selectedSubcomponents: formData.selectedSubcomponents,
      failureType: formData.failureType,
      priority: formData.priority,
      estimatedHours: formData.estimatedHours,
      reportedDate: formData.reportedDate,
      failureAttachments: failureAttachments
    };

    log('📝 Enviando falla a la API (sin solución):', failureData);
    setIsSavingFailure(true);

    createFailureMutation.mutate(failureData, {
      onSuccess: (result) => {
        log('✅ Falla guardada exitosamente (sin solución):', result);
        toast.success('Falla registrada exitosamente sin solución');
        onSave();
        onClose();
      },
      onSettled: () => {
        setIsSavingFailure(false);
      },
    });
  };

  // Función para crear falla y abrir modal de solución
  const handleCreateFailureAndLoadSolution = () => {
    const failureData = {
      title: formData.title,
      description: formData.description,
      machineId: machineId,
      selectedComponents: formData.selectedComponents,
      selectedSubcomponents: formData.selectedSubcomponents,
      failureType: formData.failureType,
      priority: formData.priority,
      estimatedHours: formData.estimatedHours,
      reportedDate: formData.reportedDate,
      failureAttachments: failureAttachments
    };

    log('📝 Enviando falla a la API para luego cargar solución:', failureData);
    setIsSavingFailure(true);

    createFailureMutation.mutate(failureData, {
      onSuccess: (result) => {
        log('✅ Falla creada exitosamente, abriendo modal de solución:', result);

        const newFailureId = result.id || result.failure?.id;
        log('🔍 ID de falla obtenido:', newFailureId);
        log('🔍 Resultado completo de la API:', result);

        setFailureId(newFailureId);

        setTimeout(() => {
          log('🔍 failureId después de setState:', newFailureId);
          if (newFailureId) {
            toast.success('Falla creada exitosamente. Ahora carga la solución.');
            setShowSolutionDialog(true);
          } else {
            toast.error('Error: No se pudo obtener el ID de la falla');
          }
        }, 100);
      },
      onSettled: () => {
        setIsSavingFailure(false);
      },
    });
  };

  // Nueva función para guardar la solución
  const handleSaveSolution = () => {
    if (!failureId) {
      toast.error('No hay una falla guardada para agregar la solución');
      return;
    }

    const solutionData = {
      failureId: failureId,
      solution: formData.solution,
      toolsUsed: formData.toolsUsed,
      sparePartsUsed: formData.sparePartsUsed,
      actualHours: formData.actualHours,
      solutionAttachments: solutionAttachments
    };

    log('📝 Enviando solución a la API:', solutionData);
    setIsSavingSolution(true);

    saveSolutionMutation.mutate(
      { failureId, data: solutionData },
      {
        onSettled: () => {
          setIsSavingSolution(false);
        },
      }
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Registrar Nueva Falla</DialogTitle>
          <DialogDescription>
            Registra una falla o problema para {machineName}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información básica */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Título de la falla</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Ej: Falla en motor principal"
                className="bg-background border-border"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Fecha de reporte</label>
              <DatePicker
                value={formData.reportedDate}
                onChange={(date) => setFormData({...formData, reportedDate: date})}
                placeholder="Seleccionar fecha..."
                className="bg-background border-border"
              />
            </div>
          </div>

                    {/* Componentes afectados */}
          <div>
            <label className="text-sm font-medium mb-3 block">Componentes afectados</label>
            <div className="space-y-4">
              {/* Componentes principales seleccionados */}
              {formData.selectedComponents.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-info rounded-full"></div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Componentes Principales ({formData.selectedComponents.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.selectedComponents.map((componentId) => {
                      const component = components.find(c => Number(c.id) === componentId);
                      return component ? (
                        <div key={componentId} className="group flex items-center gap-2 bg-info-muted border border-info-muted text-info-muted-foreground px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200">
                          <Cog className="h-3 w-3 text-info-muted-foreground" />
                          <span>{component.name}</span>
                          <button
                            type="button"
                            onClick={() => setFormData({
                              ...formData,
                              selectedComponents: formData.selectedComponents.filter(id => id !== componentId),
                              selectedSubcomponents: formData.selectedSubcomponents.filter(id => {
                                const subcomponent = component.children?.find(child => Number(child.id) === id);
                                return !subcomponent;
                              })
                            })}
                            className="opacity-0 group-hover:opacity-100 hover:bg-info-muted rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 text-info-muted-foreground hover:text-info-muted-foreground"
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Subcomponentes de nivel 1 seleccionados */}
              {(() => {
                const level1Subcomponents = formData.selectedSubcomponents.filter(subcomponentId => {
                  return components.some(comp => 
                    comp.children?.some(child => Number(child.id) === subcomponentId)
                  );
                });
                
                return level1Subcomponents.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-success rounded-full"></div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subcomponentes ({level1Subcomponents.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {level1Subcomponents.map((subcomponentId) => {
                        const subcomponent = components
                          .flatMap(comp => comp.children || [])
                          .find(child => Number(child.id) === subcomponentId);

                        return subcomponent ? (
                          <div key={subcomponentId} className="group flex items-center gap-2 bg-success-muted border border-success-muted text-success px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200">
                            <Wrench className="h-3 w-3 text-success" />
                            <span>{subcomponent.name}</span>
                            <button
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                selectedSubcomponents: formData.selectedSubcomponents.filter(id => id !== subcomponentId)
                              })}
                              className="opacity-0 group-hover:opacity-100 hover:bg-success-muted rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 text-success hover:text-success"
                            >
                              ×
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Sub-subcomponentes de nivel 2 seleccionados */}
              {(() => {
                const level2Subcomponents = formData.selectedSubcomponents.filter(subcomponentId => {
                  return components.some(comp => 
                    comp.children?.some(subcomp => 
                      subcomp.children?.some(subSubcomp => Number(subSubcomp.id) === subcomponentId)
                    )
                  );
                });
                
                return level2Subcomponents.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-primary rounded-full"></div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sub-subcomponentes ({level2Subcomponents.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {level2Subcomponents.map((subcomponentId) => {
                        const subSubcomponent = components
                          .flatMap(comp => comp.children || [])
                          .flatMap(subcomp => subcomp.children || [])
                          .find(child => Number(child.id) === subcomponentId);
                        
                        // Encontrar el subcomponente padre
                        const parentSubcomponent = components
                          .flatMap(comp => comp.children || [])
                          .find(subcomp => 
                            subcomp.children?.some(subSubcomp => Number(subSubcomp.id) === subcomponentId)
                          );
                        
                        return subSubcomponent ? (
                          <div key={subcomponentId} className="group flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200">
                            <Wrench className="h-3 w-3 text-primary" />
                            <span>{subSubcomponent.name}</span>
                            <span className="text-xs opacity-70">({parentSubcomponent?.name})</span>
                            <button
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                selectedSubcomponents: formData.selectedSubcomponents.filter(id => id !== subcomponentId)
                              })}
                              className="opacity-0 group-hover:opacity-100 hover:bg-primary/15 rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 text-primary hover:text-primary"
                            >
                              ×
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                ) : null;
              })()}
              
              {/* Botón para abrir selector de esquema */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSchemaSelector(true)}
                className="w-full"
              >
                <Network className="h-4 w-4 mr-2" />
                Seleccionar
              </Button>
            </div>
          </div>



          <div>
            <label className="text-sm font-medium">Descripción detallada</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe el problema en detalle..."
              className="w-full min-h-[100px] p-3 border rounded-md bg-background border-border"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Tipo de falla</label>
              <Select value={formData.failureType} onValueChange={(value) => setFormData({...formData, failureType: value})}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MECANICA">Mecánica</SelectItem>
                  <SelectItem value="ELECTRICA">Eléctrica</SelectItem>
                  <SelectItem value="HIDRAULICA">Hidráulica</SelectItem>
                  <SelectItem value="NEUMATICA">Neumática</SelectItem>
                  <SelectItem value="AUTOMATIZACION">Automatización</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Prioridad</label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Tiempo estimado</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={formData.estimatedHours}
                  onChange={(e) => setFormData({...formData, estimatedHours: e.target.value})}
                  placeholder="0"
                  min="0"
                  step="0.5"
                  className="bg-background border-border flex-1"
                />
                <Select 
                  value={formData.estimatedTimeUnit || 'hours'} 
                  onValueChange={(value) => setFormData({...formData, estimatedTimeUnit: value as 'hours' | 'minutes'})}
                >
                  <SelectTrigger className="w-24 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Archivos de falla */}
          <div>
            <label className="text-sm font-medium">Archivos de falla</label>
            <div className="mt-2">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                onChange={handleFailureFileUpload}
                className="hidden"
                id="failure-files-input"
              />
              <label
                htmlFor="failure-files-input"
                className="flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-muted-foreground transition-colors bg-background"
              >
                <div className="text-center">
                  <UploadCloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Haz clic o arrastra archivos aquí
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, DOC, XLS, imágenes hasta 10MB
                  </p>
                </div>
              </label>
            </div>
            
            {/* Archivos subidos */}
            {failureAttachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {failureAttachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFailureFile(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>



          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="button"
              onClick={handleSaveFailureOnly}
              disabled={isSavingFailure}
              variant="outline"
            >
              {isSavingFailure ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                'Guardar Falla sin Solución'
              )}
            </Button>
            <Button 
              type="button"
              onClick={handleCreateFailureAndLoadSolution}
              disabled={isSavingFailure}
            >
              {isSavingFailure ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creando...
                </>
              ) : (
                'Cargar Solución de Falla'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Modal para cargar solución */}
      <Dialog open={showSolutionDialog} onOpenChange={setShowSolutionDialog}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Cargar Solución para la Falla</DialogTitle>
            <DialogDescription>
              Carga la solución aplicada para la falla: {formData.title}
            </DialogDescription>
          </DialogHeader>
          
          {/* Validación de failureId */}
          {!failureId && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <span className="font-medium text-destructive">Error: No hay falla seleccionada</span>
              </div>
              <p className="text-sm text-destructive mt-2">
                No se pudo obtener el ID de la falla. Por favor, cierra este modal y vuelve a intentar.
              </p>
            </div>
          )}
          
          <div className="space-y-6">
            {/* Solución aplicada */}
            <div>
              <label className="text-sm font-medium">Solución aplicada</label>
              <textarea
                value={formData.solution}
                onChange={(e) => setFormData({...formData, solution: e.target.value})}
                placeholder="Describe cómo se solucionó el problema..."
                className="w-full min-h-[80px] p-3 border rounded-md bg-background border-border"
                required
              />
            </div>

            {/* Archivos de solución */}
            <div>
              <label className="text-sm font-medium">Archivos de solución</label>
              <div className="mt-2">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                  onChange={handleSolutionFileUpload}
                  className="hidden"
                  id="solution-files-input"
                />
                <label
                  htmlFor="solution-files-input"
                  className="flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-muted-foreground transition-colors bg-background"
                >
                  <div className="text-center">
                    <UploadCloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Haz clic o arrastra archivos aquí
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOC, XLS, imágenes hasta 10MB
                    </p>
                  </div>
                </label>
              </div>
              
              {/* Archivos subidos */}
              {solutionAttachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  {solutionAttachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeSolutionFile(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tiempo real */}
            <div>
              <label className="text-sm font-medium">Tiempo real</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={formData.actualHours}
                  onChange={(e) => setFormData({...formData, actualHours: e.target.value})}
                  placeholder="0"
                  min="0"
                  step="0.5"
                  className="bg-background border-border flex-1"
                />
                <Select 
                  value={formData.actualTimeUnit || 'hours'} 
                  onValueChange={(value) => setFormData({...formData, actualTimeUnit: value as 'hours' | 'minutes'})}
                >
                  <SelectTrigger className="w-24 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Herramientas utilizadas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Herramientas utilizadas</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateToolDialog(true)}
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Crear herramienta
                </Button>
              </div>
              <div className="space-y-3">
                {/* Herramientas seleccionadas */}
                {formData.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.toolsUsed.map((tool) => (
                      <div key={tool.id} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                        <span>{tool.name}</span>
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            toolsUsed: formData.toolsUsed.filter(t => t.id !== tool.id)
                          })}
                          className="ml-1 hover:bg-primary/20 rounded-full w-4 h-4 flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Selector de herramientas con búsqueda */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between bg-background border-border"
                    >
                      {loadingTools ? "Cargando herramientas..." : "Seleccionar herramientas..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Buscar herramientas..." />
                      <CommandEmpty>No se encontraron herramientas.</CommandEmpty>
                      <CommandGroup>
                        {availableTools
                          .filter(tool => tool.id && !formData.toolsUsed.some(t => t.id === tool.id))
                          .map((tool) => (
                            <CommandItem
                              key={tool.id}
                              value={tool.name}
                              onSelect={() => {
                                if (!formData.toolsUsed.some(t => t.id === tool.id)) {
                                  setFormData({
                                    ...formData,
                                    toolsUsed: [...formData.toolsUsed, tool]
                                  });
                                }
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.toolsUsed.some(t => t.id === tool.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {tool.name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Repuestos utilizados */}
            <div>
              <label className="text-sm font-medium mb-2 block">Repuestos utilizados</label>
              <div className="space-y-3">
                {/* Repuestos seleccionados */}
                {formData.sparePartsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.sparePartsUsed.map((part) => (
                      <div key={part.id} className="flex items-center gap-1 bg-destructive/10 text-destructive px-2 py-1 rounded-full text-xs">
                        <span>{part.name}</span>
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            sparePartsUsed: formData.sparePartsUsed.filter(p => p.id !== part.id)
                          })}
                          className="ml-1 hover:bg-destructive/20 rounded-full w-4 h-4 flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Selector de repuestos filtrados por componentes con búsqueda */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    🔧 Repuestos utilizados {formData.selectedComponents.length > 0 || formData.selectedSubcomponents.length > 0 ? '(solo repuestos de componentes seleccionados)' : '(selecciona componentes primero)'}
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between bg-background border-border"
                      >
                        {loadingSpareParts ? "Cargando repuestos..." : 
                         (formData.selectedComponents.length > 0 || formData.selectedSubcomponents.length > 0) ? 
                         "Seleccionar repuestos de componentes..." : 
                         "Selecciona componentes primero..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Buscar repuestos..." />
                        <CommandEmpty>No se encontraron repuestos.</CommandEmpty>
                        <CommandGroup>
                          {getFilteredSpareParts()
                            .filter(part => part.id && !formData.sparePartsUsed.some(p => p.id === part.id))
                            .map((part) => (
                              <CommandItem
                                key={part.id}
                                value={part.name}
                                onSelect={() => {
                                  if (!formData.sparePartsUsed.some(p => p.id === part.id)) {
                                    setFormData({
                                      ...formData,
                                      sparePartsUsed: [...formData.sparePartsUsed, part]
                                    });
                                  }
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.sparePartsUsed.some(p => p.id === part.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {part.name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowSolutionDialog(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveSolution}
                disabled={isSavingSolution || !failureId}
                className={!failureId ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {isSavingSolution ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Guardando Solución...
                  </>
                ) : !failureId ? (
                  'Sin Falla Válida'
                ) : (
                  'Guardar Solución'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal del selector de esquema */}
      <Dialog open={showSchemaSelector} onOpenChange={setShowSchemaSelector}>
        <DialogContent size="full">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Network className="h-6 w-6 text-primary" />
                  </div>
                  Seleccionar Componentes
                </DialogTitle>
                <DialogDescription className="text-base mt-2">
                  Selecciona los componentes y subcomponentes afectados por la falla. 
                  Haz clic en un componente padre para seleccionar automáticamente todos sus subcomponentes.
                </DialogDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {formData.selectedComponents.length + formData.selectedSubcomponents.length}
                </div>
                <div className="text-sm text-muted-foreground">Seleccionados</div>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Estadísticas rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-background border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Componentes</p>
                      <p className="text-2xl font-bold text-foreground">{components.length}</p>
                    </div>
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-background border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Componentes Padre</p>
                      <p className="text-2xl font-bold text-foreground">{formData.selectedComponents.length}</p>
                    </div>
                    <Cog className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-background border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Subcomponentes</p>
                      <p className="text-2xl font-bold text-foreground">{formData.selectedSubcomponents.length}</p>
                    </div>
                    <Wrench className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-background border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Seleccionados</p>
                      <p className="text-2xl font-bold text-foreground">{formData.selectedComponents.length + formData.selectedSubcomponents.length}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Grid de Tarjetas de Componentes Organizados */}
            <Card className="border border-border">
              <CardHeader className="bg-muted/30 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Building className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Componentes de {machineName}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Haz clic en los componentes para seleccionarlos. Los componentes seleccionados se mostrarán resaltados.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {components.length} componentes disponibles
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {/* Barra de búsqueda */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar componentes..."
                      className="pl-10 bg-background border-border"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Tarjeta de la máquina principal */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Máquina Principal</h3>
                    <Card 
                      key="machine-root"
                      className="col-span-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 max-w-sm mx-auto"
                    >
                      <CardContent className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Cog className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-sm">Bloquera Gervasi</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Máquina Principal</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Componentes principales */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Componentes Principales</h3>
                    <div className="grid grid-cols-8 gap-3">
                      {components
                        .filter(component => 
                          searchTerm === '' || 
                          component.name.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((component) => (
                          <Card 
                            key={component.id}
                            className={cn('cursor-pointer transition-all hover:shadow-lg hover:scale-105',
                              formData.selectedComponents.includes(Number(component.id))
                                ? 'ring-2 ring-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => {
                              const componentId = Number(component.id);
                              if (formData.selectedComponents.includes(componentId)) {
                                const subcomponentIds = component.children?.map((child: any) => Number(child.id)) || [];
                                setFormData({
                                  ...formData,
                                  selectedComponents: formData.selectedComponents.filter(id => id !== componentId),
                                  selectedSubcomponents: formData.selectedSubcomponents.filter(id => !subcomponentIds.includes(id))
                                });
                              } else {
                                const subcomponentIds = component.children?.map((child: any) => Number(child.id)) || [];
                                setFormData({
                                  ...formData,
                                  selectedComponents: [...formData.selectedComponents, componentId],
                                  selectedSubcomponents: [...formData.selectedSubcomponents, ...subcomponentIds]
                                });
                              }
                            }}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Cog className="h-4 w-4 text-foreground" />
                                <h4 className="font-medium text-xs line-clamp-2">{component.name}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground">Componente</p>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>

                  {/* Subcomponentes */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Subcomponentes</h3>
                    <div className="grid grid-cols-8 gap-3">
                      {components
                        .flatMap((component) => 
                          component.children?.map((child: any) => ({
                            ...child,
                            parentName: component.name,
                            level: 0
                          })) || []
                        )
                        .filter(child => 
                          searchTerm === '' || 
                          child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          child.parentName.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((child: any) => (
                          <Card 
                            key={`${child.parentName}-${child.id}-${child.level}`}
                            className={cn('cursor-pointer transition-all hover:shadow-lg hover:scale-105',
                              formData.selectedSubcomponents.includes(Number(child.id))
                                ? 'ring-2 ring-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => {
                              const subcomponentId = Number(child.id);
                              if (formData.selectedSubcomponents.includes(subcomponentId)) {
                                setFormData({
                                  ...formData,
                                  selectedSubcomponents: formData.selectedSubcomponents.filter(id => id !== subcomponentId)
                                });
                              } else {
                                const parentComponentId = Number(child.parentId);
                                setFormData({
                                  ...formData,
                                  selectedComponents: formData.selectedComponents.includes(parentComponentId) 
                                    ? formData.selectedComponents 
                                    : [...formData.selectedComponents, parentComponentId],
                                  selectedSubcomponents: [...formData.selectedSubcomponents, subcomponentId]
                                });
                              }
                            }}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Wrench className="h-3 w-3 text-foreground" />
                                <h4 className="font-medium text-xs line-clamp-2">{child.name}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground">Subcomponente</p>
                              <p className="text-xs text-muted-foreground/70">de {child.parentName}</p>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>

                  {/* Sub-subcomponentes */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Sub-subcomponentes</h3>
                    <div className="grid grid-cols-8 gap-3">
                      {components
                        .flatMap((component) => 
                          component.children?.flatMap((subcomponent: any) => 
                            subcomponent.children?.map((subSubcomponent: any) => ({
                              ...subSubcomponent,
                              parentName: subcomponent.name,
                              grandParentName: component.name,
                              level: 1
                            })) || []
                          ) || []
                        )
                        .filter(child => 
                          searchTerm === '' || 
                          child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          child.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          child.grandParentName.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((child: any) => (
                          <Card 
                            key={`${child.grandParentName}-${child.parentName}-${child.id}-${child.level}`}
                            className={cn('cursor-pointer transition-all hover:shadow-lg hover:scale-105',
                              formData.selectedSubcomponents.includes(Number(child.id))
                                ? 'ring-2 ring-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => {
                              const subcomponentId = Number(child.id);
                              if (formData.selectedSubcomponents.includes(subcomponentId)) {
                                setFormData({
                                  ...formData,
                                  selectedSubcomponents: formData.selectedSubcomponents.filter(id => id !== subcomponentId)
                                });
                              } else {
                                // Encontrar el ID del componente principal
                                const grandParentComponentId = components.find(comp => 
                                  comp.children?.some(subcomp => 
                                    subcomp.id === child.parentId
                                  )
                                )?.id;
                                
                                // Encontrar el ID del subcomponente padre
                                const parentSubcomponentId = child.parentId;
                                
                                setFormData({
                                  ...formData,
                                  selectedComponents: grandParentComponentId && !formData.selectedComponents.includes(Number(grandParentComponentId))
                                    ? [...formData.selectedComponents, Number(grandParentComponentId)]
                                    : formData.selectedComponents,
                                  selectedSubcomponents: [
                                    ...formData.selectedSubcomponents,
                                    Number(parentSubcomponentId),
                                    subcomponentId
                                  ].filter((id, index, arr) => arr.indexOf(id) === index) // Eliminar duplicados
                                });
                              }
                            }}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Wrench className="h-3 w-3 text-foreground" />
                                <h4 className="font-medium text-xs line-clamp-2">{child.name}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground">Sub-subcomponente</p>
                              <p className="text-xs text-muted-foreground/70">de {child.parentName}</p>
                              <p className="text-xs text-muted-foreground/50">({child.grandParentName})</p>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumen de selección */}
            <Card className="border border-border bg-muted/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Resumen de Selección
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Componentes seleccionados */}
                {formData.selectedComponents.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Cog className="h-4 w-4 text-primary" />
                      Componentes Principales ({formData.selectedComponents.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {formData.selectedComponents.map((componentId) => {
                        const component = components.find(c => Number(c.id) === componentId);
                        return component ? (
                          <div key={componentId} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg text-sm font-medium shadow-sm">
                            <Cog className="h-4 w-4" />
                            <span>{component.name}</span>
                            <button
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                selectedComponents: formData.selectedComponents.filter(id => id !== componentId),
                                selectedSubcomponents: formData.selectedSubcomponents.filter(id => {
                                  const subcomponent = component.children?.find(child => Number(child.id) === id);
                                  return !subcomponent;
                                })
                              })}
                              className="ml-2 hover:bg-primary/20 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
                
                {/* Subcomponentes seleccionados */}
                {(() => {
                  const level1Subcomponents = formData.selectedSubcomponents.filter(subcomponentId => {
                    return components.some(comp => 
                      comp.children?.some(child => Number(child.id) === subcomponentId)
                    );
                  });
                  
                  return level1Subcomponents.length > 0 ? (
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-primary" />
                        Subcomponentes ({level1Subcomponents.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {level1Subcomponents.map((subcomponentId) => {
                          const subcomponent = components
                            .flatMap(comp => comp.children || [])
                            .find(child => Number(child.id) === subcomponentId);
                          return subcomponent ? (
                            <div key={subcomponentId} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg text-sm font-medium shadow-sm">
                              <Wrench className="h-4 w-4" />
                              <span>{subcomponent.name}</span>
                              <button
                                type="button"
                                onClick={() => setFormData({
                                  ...formData,
                                  selectedSubcomponents: formData.selectedSubcomponents.filter(id => id !== subcomponentId)
                                })}
                                className="ml-2 hover:bg-primary/20 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Sub-subcomponentes seleccionados */}
                {(() => {
                  const level2Subcomponents = formData.selectedSubcomponents.filter(subcomponentId => {
                    return components.some(comp => 
                      comp.children?.some(subcomp => 
                        subcomp.children?.some(subSubcomp => Number(subSubcomp.id) === subcomponentId)
                      )
                    );
                  });
                  
                  return level2Subcomponents.length > 0 ? (
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-primary" />
                        Sub-subcomponentes ({level2Subcomponents.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {level2Subcomponents.map((subcomponentId) => {
                          const subSubcomponent = components
                            .flatMap(comp => comp.children || [])
                            .flatMap(subcomp => subcomp.children || [])
                            .find(child => Number(child.id) === subcomponentId);
                          
                          // Encontrar el subcomponente padre
                          const parentSubcomponent = components
                            .flatMap(comp => comp.children || [])
                            .find(subcomp => 
                              subcomp.children?.some(subSubcomp => Number(subSubcomp.id) === subcomponentId)
                            );
                          
                          return subSubcomponent ? (
                            <div key={subcomponentId} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg text-sm font-medium shadow-sm">
                              <Wrench className="h-4 w-4" />
                              <span>{subSubcomponent.name}</span>
                              <span className="text-xs opacity-70">({parentSubcomponent?.name})</span>
                              <button
                                type="button"
                                onClick={() => setFormData({
                                  ...formData,
                                  selectedSubcomponents: formData.selectedSubcomponents.filter(id => id !== subcomponentId)
                                })}
                                className="ml-2 hover:bg-primary/20 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Mensaje cuando no hay selecciones */}
                {formData.selectedComponents.length === 0 && formData.selectedSubcomponents.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No hay componentes seleccionados</p>
                    <p className="text-sm">Haz clic en los componentes del esquema para comenzar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{formData.selectedComponents.length + formData.selectedSubcomponents.length}</span> elementos seleccionados
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setFormData({
                    ...formData,
                    selectedComponents: [],
                    selectedSubcomponents: []
                  });
                }}
              >
                Limpiar Selección
              </Button>
              <Button onClick={() => setShowSchemaSelector(false)}>
                Confirmar Selección
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>

    {/* Modal para visualizar archivos */}
    <Dialog open={showFileViewer} onOpenChange={setShowFileViewer}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info-muted rounded-lg flex items-center justify-center">
              <File className="h-5 w-5 text-info-muted-foreground" />
            </div>
            <div>
              <div className="text-lg font-bold">{viewingFile?.name}</div>
              <div className="text-sm text-muted-foreground">
                Visualizando archivo de solución
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          {viewingFile && (
            <div className="bg-muted rounded-xl p-6">
              {/* PDF */}
              {viewingFile.type === 'application/pdf' && (
                <div className="bg-background rounded-lg shadow-lg overflow-hidden">
                  <iframe
                    src={viewingFile.url}
                    className="w-full h-[70vh] border-0"
                    title={viewingFile.name}
                  />
                </div>
              )}
              
              {/* Imágenes */}
              {(viewingFile.type.startsWith('image/')) && (
                <div className="flex items-center justify-center h-[70vh] bg-background rounded-lg shadow-lg">
                  <img
                    src={viewingFile.url}
                    alt={viewingFile.name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
              )}
              
              {/* Otros documentos */}
              {!viewingFile.type.startsWith('image/') && 
               viewingFile.type !== 'application/pdf' && (
                <div className="flex flex-col items-center justify-center h-[70vh] bg-background rounded-lg shadow-lg p-12">
                  <div className="w-20 h-20 bg-info-muted rounded-full flex items-center justify-center mb-6">
                    <File className="h-10 w-10 text-info-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{viewingFile.name}</h3>
                  <p className="text-muted-foreground mb-6 text-center max-w-md">
                    Este tipo de archivo no se puede previsualizar directamente. 
                    Puedes descargarlo para verlo en tu aplicación predeterminada.
                  </p>
                  <Button
                    onClick={() => window.open(viewingFile.url, '_blank')}
                    className="flex items-center gap-3 px-6 py-3 bg-foreground hover:bg-foreground/90 text-background"
                  >
                    <Download className="h-5 w-5" />
                    Descargar archivo
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center pt-6 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {viewingFile && (
              <span>
                Tamaño: {formatNumber(viewingFile.size / 1024 / 1024, 2)} MB • 
                Tipo: {viewingFile.type}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowFileViewer(false)}
              className="px-6"
            >
              Cerrar
            </Button>
            {viewingFile && (
              <Button
                onClick={() => window.open(viewingFile.url, '_blank')}
                className="flex items-center gap-2 px-6 bg-foreground hover:bg-foreground/90 text-background"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir en nueva pestaña
              </Button>
            )}
          </div>
        </div>
              </DialogContent>
      </Dialog>

      {/* Modal para crear herramienta */}
      <Dialog open={showCreateToolDialog} onOpenChange={setShowCreateToolDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Crear Nueva Herramienta
            </DialogTitle>
            <DialogDescription>
              Agrega una nueva herramienta al pañol rápidamente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                value={newToolData.name}
                onChange={(e) => setNewToolData({...newToolData, name: e.target.value})}
                placeholder="Ej: Llave inglesa 12mm"
                className="bg-background border-border"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input
                value={newToolData.description}
                onChange={(e) => setNewToolData({...newToolData, description: e.target.value})}
                placeholder="Descripción opcional"
                className="bg-background border-border"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Categoría</label>
                <CreatableSelect
                  value={newToolData.category}
                  onValueChange={(value) => setNewToolData({...newToolData, category: value})}
                  options={categories}
                  onRefresh={fetchCategories}
                  placeholder="Selecciona una categoría"
                  createLabel="Nueva Categoría"
                  apiEndpoint="/api/tools/categories"
                  createFields={[
                    { name: 'name', label: 'Nombre', required: true },
                    { name: 'description', label: 'Descripción', required: false }
                  ]}
                />
                {categories.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No hay categorías disponibles. Crea una nueva.
                  </p>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium">Ubicación</label>
                <Input
                  value={newToolData.location}
                  onChange={(e) => setNewToolData({...newToolData, location: e.target.value})}
                  placeholder="Ej: Estante A-1"
                  className="bg-background border-border"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Cantidad</label>
              <Input
                type="number"
                value={newToolData.quantity}
                onChange={(e) => setNewToolData({...newToolData, quantity: parseInt(e.target.value) || 1})}
                min="1"
                className="bg-background border-border"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Foto de la herramienta</label>
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewToolData({...newToolData, photo: file});
                    }
                  }}
                  className="hidden"
                  id="tool-photo-upload"
                />
                <label
                  htmlFor="tool-photo-upload"
                  className="flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-muted-foreground transition-colors bg-background"
                >
                  {newToolData.photo ? (
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-2 relative">
                        <img
                          src={URL.createObjectURL(newToolData.photo)}
                          alt="Preview"
                          className="w-full h-full object-cover rounded"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setNewToolData({...newToolData, photo: null});
                          }}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-destructive/90"
                        >
                          ×
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground">{newToolData.photo.name}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <UploadCloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Haz clic para subir una foto
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG hasta 5MB
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setShowCreateToolDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateTool}
              disabled={uploadingToolPhoto}
              className="flex items-center gap-2"
            >
              {uploadingToolPhoto ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Crear Herramienta
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
  components: MachineComponent[];
  onRefresh?: () => void;
}> = ({ failure, isOpen, onClose, onEditFailure, onEditSolution, onFailureOccurred, components, onRefresh }) => {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'falla' | 'soluciones'>('falla');
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [loadingSolutions, setLoadingSolutions] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<any>(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);

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

  // Función para obtener las soluciones (mantenimientos correctivos) de la falla
  const fetchSolutions = async () => {
    if (!failure?.id) return;
    
    setLoadingSolutions(true);
    try {
      const response = await fetch(`/api/failures/${failure.id}/solutions`);
      if (response.ok) {
        const data = await response.json();
        setSolutions(data.solutions || []);
        log('✅ Solutions loaded for failure:', failure.id, data.solutions);
      } else {
        console.error('Error fetching solutions:', await response.text());
        setSolutions([]);
      }
    } catch (error) {
      console.error('Error fetching solutions:', error);
      setSolutions([]);
    } finally {
      setLoadingSolutions(false);
    }
  };

  // Cargar ocurrencias y soluciones cuando se abre el modal
  useEffect(() => {
    if (isOpen && failure?.id) {
      fetchOccurrences();
      fetchSolutions();
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

  const handleViewDocument = (document: any) => {
    setViewingDocument(document);
    setShowDocumentViewer(true);
  };

  const handleCloseDocumentViewer = () => {
    setShowDocumentViewer(false);
    setViewingDocument(null);
  };

  const handleDownloadDocument = (doc: any) => {
    try {
      // Usar nuestro endpoint proxy para evitar CORS
      const downloadUrl = `/api/download?url=${encodeURIComponent(doc.url)}&fileName=${encodeURIComponent(doc.fileName || doc.name || 'documento')}`;
      
      // Crear enlace de descarga
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.fileName || doc.name || 'documento';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Mostrar éxito después de un pequeño delay
      setTimeout(() => {
        toast.success('Descarga iniciada correctamente');
      }, 500);
      
    } catch (error) {
      console.error('Error al descargar documento:', error);
      toast.error('Error al iniciar la descarga');
    }
  };

  const deleteFailureDocumentMutation = useApiMutation<any, { document: any }>({
    mutationFn: async (vars) => {
      const url = vars.document.id
        ? `/api/failures/${failure.id}/attachments/${vars.document.id}`
        : `/api/upload/delete?url=${encodeURIComponent(vars.document.url)}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al eliminar el documento');
      }
      return res.json();
    },
    successMessage: 'Documento eliminado correctamente',
    errorMessage: 'Error al eliminar el documento',
    onSuccess: () => {
      handleCloseDocumentViewer();
      if (onRefresh) {
        onRefresh();
      } else {
        onClose();
      }
    },
  });

  const handleDeleteDocument = async (document: any) => {
    const ok = await confirm({
      title: 'Eliminar documento',
      description: `¿Estás seguro de que quieres eliminar el documento "${document.name}"?`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    log('Eliminando documento:', document);
    deleteFailureDocumentMutation.mutate({ document });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Detalles de Falla
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header con título y badges */}
          <div className="text-center border-b pb-4">
            <h3 className="text-xl font-semibold text-foreground mb-3">{failure.title}</h3>
            <div className="flex items-center justify-center gap-2">
              {getPriorityBadge(failure.priority)}
                                {getStatusBadge(failure)}
              {getFailureTypeBadge(failure.failureType)}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'falla' | 'solucion')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="falla" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Falla
              </TabsTrigger>
              <TabsTrigger value="soluciones" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Soluciones ({solutions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="falla" className="space-y-4 mt-4">
              {/* Descripción */}
              {failure.description && (
                <div className="bg-muted/50 border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Descripción</h4>
                      <p className="text-muted-foreground text-sm">{failure.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Información básica */}
              {/* Componentes afectados */}
              {(failure.selectedComponents && failure.selectedComponents.length > 0) || (failure.selectedSubcomponents && failure.selectedSubcomponents.length > 0) ? (
                <div className="bg-muted/30 border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cog className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Componentes Afectados</span>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Componentes principales */}
                    {failure.selectedComponents && failure.selectedComponents.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Cog className="h-3 w-3 text-info-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">Componentes Principales:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {failure.selectedComponents.map((componentId: number, index: number) => {
                            const component = components.find(comp => Number(comp.id) === componentId);
                            return component ? (
                              <Badge key={index} variant="outline" className="text-xs bg-info-muted border-info-muted text-info-muted-foreground">
                                {component.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Subcomponentes */}
                    {failure.selectedSubcomponents && failure.selectedSubcomponents.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Wrench className="h-3 w-3 text-success" />
                          <span className="text-xs font-medium text-foreground">Subcomponentes:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {failure.selectedSubcomponents.map((subcomponentId: number, index: number) => {
                            const subcomponent = components
                              .flatMap(comp => comp.children || [])
                              .find(child => Number(child.id) === subcomponentId);
                            return subcomponent ? (
                              <Badge key={index} variant="outline" className="text-xs bg-success-muted border-success-muted text-success">
                                {subcomponent.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Ubicación</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{failure.componentName}</p>
                </div>

                <div className="bg-muted/30 border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Última vez</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDate(getLastOccurrenceDate())}</p>
                </div>

                <div className="bg-muted/30 border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Reportado por</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{failure.reportedBy?.name || 'No especificado'}</p>
                </div>

                {failure.actualHours && (
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Tiempo invertido</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{failure.actualHours} horas</p>
                  </div>
                )}
              </div>

              {/* Historial de ocurrencias */}
              <div className="bg-muted/30 border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Historial de Ocurrencias</span>
                  <Badge variant="secondary" className="ml-auto">
                    {occurrences.length + 1} {(occurrences.length + 1) > 1 ? 'veces' : 'vez'}
                  </Badge>
                </div>
                
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {loadingOccurrences ? (
                    <div className="text-center py-2">
                      <span className="text-xs text-muted-foreground">Cargando ocurrencias...</span>
                    </div>
                  ) : (
                    <>
                      {/* Ocurrencia actual (la falla original) */}
                      <div className="flex items-center justify-between p-2 bg-background rounded border">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(failure.reportedDate)} - {formatTime(failure.reportedDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{failure.reportedBy?.name || 'No especificado'}</span>
                        </div>
                      </div>

                      {/* Ocurrencias registradas */}
                      {occurrences.map((occurrence: any, index: number) => (
                        <div key={occurrence.id} className="flex items-center justify-between p-2 bg-background rounded border">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatDate(occurrence.reportedAt)} - {formatTime(occurrence.reportedAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{occurrence.reportedBy || 'No especificado'}</span>
                          </div>
                        </div>
                      ))}

                      {/* Mensaje si no hay ocurrencias adicionales */}
                      {occurrences.length === 0 && (
                        <div className="text-center py-2">
                          <span className="text-xs text-muted-foreground">Primera ocurrencia de esta falla</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Documentos de la falla */}
              <div className="bg-muted/30 border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Documentos de la Falla</span>
                  {failure.attachments && failure.attachments.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {failure.attachments.length} {failure.attachments.length > 1 ? 'documentos' : 'documento'}
                    </Badge>
                  )}
                </div>
                
                {failure.attachments && failure.attachments.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {/* Mostrar attachments si existen */}
                    {failure.attachments.map((attachment: any, index: number) => (
                      <div key={`attachment-${index}`} className="flex items-center justify-between p-2 bg-background rounded border">
                        <div className="flex items-center gap-2">
                          {attachment.fileType?.includes('pdf') ? (
                            <FileText className="h-3 w-3 text-destructive" />
                          ) : attachment.fileType?.includes('image') ? (
                            <ImageIcon className="h-3 w-3 text-success" />
                          ) : (
                            <File className="h-3 w-3 text-info" />
                          )}
                          <span className="text-xs text-muted-foreground truncate max-w-32">
                            {attachment.fileName || attachment.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleViewDocument(attachment)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleDownloadDocument(attachment)}
                            title="Descargar documento"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteDocument(attachment)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}


                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">No hay documentos adjuntos a la falla</span>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="soluciones" className="space-y-4 mt-4">
              {/* Lista de soluciones aplicadas */}
              {loadingSolutions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : solutions.length > 0 ? (
                <div className="space-y-4">
                  {solutions.map((solution, index) => (
                    <div key={solution.id} className="bg-muted/30 border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-medium text-foreground mb-1">
                              Mantenimiento Correctivo #{index + 1}
                            </h4>
                            <div className="text-xs text-muted-foreground mb-2">
                              Aplicado el {formatDate(solution.completedDate)} por {solution.appliedBy || 'No especificado'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="bg-success-muted text-success text-xs px-2 py-1 rounded-full">
                            Completado
                          </span>
                        </div>
                      </div>
                      
                      {/* Descripción de la solución */}
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground">
                          {solution.solution || solution.description}
                        </p>
                      </div>

                      {/* Tiempo real vs estimado */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Tiempo estimado:</span>
                          <span className="ml-1 font-medium">
                            {solution.estimatedHours ? `${solution.estimatedHours}h` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tiempo real:</span>
                          <span className="ml-1 font-medium">
                            {solution.actualHours ? `${solution.actualHours}${solution.solutionTimeUnit === 'minutes' ? ' min' : 'h'}` : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Herramientas y repuestos si existen */}
                      {(solution.toolsUsed?.length > 0 || solution.sparePartsUsed?.length > 0) && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          {solution.toolsUsed?.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Wrench className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium text-foreground">Herramientas:</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {solution.toolsUsed.map((tool: any, toolIndex: number) => (
                                  <span key={toolIndex} className="bg-background border px-2 py-1 rounded text-xs">
                                    {tool.name} {tool.quantity && `(${tool.quantity})`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {solution.sparePartsUsed?.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Package className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium text-foreground">Repuestos:</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {solution.sparePartsUsed.map((part: any, partIndex: number) => (
                                  <span key={partIndex} className="bg-background border px-2 py-1 rounded text-xs">
                                    {part.name} {part.quantity && `(${part.quantity})`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/30 border rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">No hay soluciones registradas para esta falla</span>
                  </div>
                </div>
              )}

              {/* Herramientas y repuestos */}
              {(failure.toolsUsed?.length > 0 || failure.sparePartsUsed?.length > 0) && (
                <div className="space-y-3">
                  {failure.toolsUsed?.length > 0 && (
                    <div className="bg-muted/30 border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Herramientas utilizadas</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {failure.toolsUsed.map((tool: any, index: number) => (
                          <span key={index} className="bg-background border px-2 py-1 rounded text-xs">
                            {tool.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {failure.sparePartsUsed?.length > 0 && (
                    <div className="bg-muted/30 border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Repuestos utilizados</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {failure.sparePartsUsed.map((part: any, index: number) => (
                          <span key={index} className="bg-background border px-2 py-1 rounded text-xs">
                            {part.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mensaje si no hay herramientas ni repuestos */}
              {(!failure.toolsUsed?.length && !failure.sparePartsUsed?.length) && (
                <div className="bg-muted/30 border rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span className="text-sm">No hay herramientas ni repuestos registrados</span>
                  </div>
                </div>
              )}

              {/* Documentos relacionados */}
              <div className="bg-muted/30 border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Documentos Relacionados</span>
                  {failure.solutionAttachments?.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {failure.solutionAttachments.length} documento{failure.solutionAttachments.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                
                {failure.solutionAttachments?.length > 0 ? (
                  <div className="space-y-2">
                    {failure.solutionAttachments.map((attachment: any, index: number) => (
                      <div key={`solution-attachment-${index}`} className="flex items-center justify-between p-2 bg-background rounded border">
                        <div className="flex items-center gap-2">
                          {attachment.fileType?.includes('pdf') ? (
                            <FileText className="h-3 w-3 text-destructive" />
                          ) : attachment.fileType?.includes('image') ? (
                            <ImageIcon className="h-3 w-3 text-success" />
                          ) : (
                            <File className="h-3 w-3 text-info" />
                          )}
                          <span className="text-xs text-muted-foreground truncate max-w-32">
                            {attachment.fileName || attachment.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleViewDocument(attachment)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleDownloadDocument(attachment)}
                            title="Descargar documento"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteDocument(attachment)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">No hay documentos cargados</span>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Botones de acción */}
          <div className="pt-3 border-t space-y-2">
            <Button 
              variant="default" 
              size="sm" 
              className="w-full"
              onClick={() => onFailureOccurred(failure)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Ocurrió falla
            </Button>
            
                        <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm" 
                className="w-full"
                onClick={() => onEditFailure(failure)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar Falla
              </Button>
              <Button
                variant="outline"
                size="sm" 
                className="w-full"
                onClick={() => onEditSolution(failure)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Editar Solución
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Visor de documentos integrado */}
      <Dialog open={showDocumentViewer} onOpenChange={handleCloseDocumentViewer}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingDocument?.name || 'Documento'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0">
            {viewingDocument && (
              <div className="w-full h-full">
                {(viewingDocument.type?.includes('pdf') || viewingDocument.fileType?.includes('pdf') || viewingDocument.name?.toLowerCase().endsWith('.pdf')) ? (
                  <iframe
                    src={viewingDocument.url}
                    className="w-full h-[70vh] border rounded-lg"
                    title={viewingDocument.name}
                  />
                ) : (viewingDocument.type?.includes('image') || viewingDocument.fileType?.includes('image') || 
                    viewingDocument.name?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) ? (
                  <div className="flex items-center justify-center">
                    <img
                      src={viewingDocument.url}
                      alt={viewingDocument.name}
                      className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    />
                  </div>
                ) : (viewingDocument.type?.includes('text') || viewingDocument.fileType?.includes('text') ||
                    viewingDocument.name?.toLowerCase().match(/\.(txt|md|json|xml|html|css|js|ts|jsx|tsx)$/i)) ? (
                  <div className="w-full h-[70vh] border rounded-lg bg-background p-4 overflow-auto">
                    <pre className="text-sm text-foreground whitespace-pre-wrap">
                      {/* Aquí se cargaría el contenido del archivo de texto */}
                      Contenido del archivo de texto
                    </pre>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[70vh]">
                    <div className="text-center">
                      <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Este tipo de archivo no se puede previsualizar
                      </p>
                      <Button
                        onClick={() => window.open(viewingDocument.url, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Descargar archivo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <div className="flex items-center gap-2">
              {viewingDocument && (
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteDocument(viewingDocument)}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {viewingDocument && (
                <Button
                  onClick={() => handleDownloadDocument(viewingDocument)}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Descargar
                </Button>
              )}
              <Button variant="outline" onClick={handleCloseDocumentViewer}>
                Cerrar
              </Button>
              {viewingDocument && (
                <Button
                  onClick={() => window.open(viewingDocument.url, '_blank')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir en nueva pestaña
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

// Componente para editar soluciones
const SolutionEditDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  failure: any;
  machineId: number;
  machineName: string;
}> = ({ isOpen, onClose, onSave, failure, machineId, machineName }) => {
  const [formData, setFormData] = useState({
    solution: failure?.solution || '',
    actualHours: failure?.actualHours || '',
    estimatedHours: failure?.estimatedHours || '',
    status: failure?.status || 'PENDING',
    toolsUsed: failure?.toolsUsed || [],
    sparePartsUsed: failure?.sparePartsUsed || [],
  });
  const [solutionFiles, setSolutionFiles] = useState<any[]>(failure?.solutionFiles || []);
  const [tools, setTools] = useState<any[]>([]);
  const [spareParts, setSpareParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar herramientas y repuestos al abrir el modal
  useEffect(() => {
    if (isOpen) {
      fetchTools();
      fetchSpareParts();
    }
  }, [isOpen]);

  const fetchTools = async () => {
    try {
      const response = await fetch('/api/tools');
      if (response.ok) {
        const data = await response.json();
        setTools(data.tools || []);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
    }
  };

  const fetchSpareParts = async () => {
    try {
      const response = await fetch('/api/spare-parts');
      if (response.ok) {
        const data = await response.json();
        setSpareParts(data.spareParts || []);
      }
    } catch (error) {
      console.error('Error fetching spare parts:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      solutionAttachments: solutionFiles.map(file => ({
        name: file.name,
        url: file.url,
        type: file.type,
        size: file.size
      }))
    });
  };

  const handleSolutionFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'failure');
      formData.append('entityId', machineId.toString());
      formData.append('fileType', 'solution');

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setSolutionFiles(prev => [...prev, {
            name: file.name,
            url: data.url,
            size: file.size,
            type: file.type
          }]);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error('Error al subir el archivo');
      }
    }
  };

  const removeSolutionFile = (index: number) => {
    setSolutionFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Editar Solución</DialogTitle>
          <DialogDescription>
            Modifica la solución aplicada a la falla
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="solution">Solución Aplicada</Label>
            <Textarea
              id="solution"
              value={formData.solution}
              onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
              placeholder="Descripción detallada de la solución aplicada"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedHours">Horas Estimadas</Label>
              <Input
                id="estimatedHours"
                type="number"
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actualHours">Horas Reales</Label>
              <Input
                id="actualHours"
                type="number"
                value={formData.actualHours}
                onChange={(e) => setFormData({ ...formData, actualHours: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Sin solución</SelectItem>
                <SelectItem value="IN_PROGRESS">En Proceso</SelectItem>
                <SelectItem value="COMPLETED">Completada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Herramientas utilizadas */}
          <div className="space-y-2">
            <Label>Herramientas Utilizadas</Label>
            <Select
              onValueChange={(value) => {
                const tool = tools.find((t: any) => t.id.toString() === value);
                if (tool && !formData.toolsUsed.find((t: any) => t.id === tool.id)) {
                  setFormData({
                    ...formData,
                    toolsUsed: [...formData.toolsUsed, tool]
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar herramienta" />
              </SelectTrigger>
              <SelectContent>
                {tools.map((tool: any) => (
                  <SelectItem key={tool.id} value={tool.id.toString()}>
                    {tool.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {formData.toolsUsed.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.toolsUsed.map((tool: any, index: number) => (
                  <Badge key={tool.id} variant="secondary" className="flex items-center gap-1">
                    {tool.name}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => setFormData({
                        ...formData,
                        toolsUsed: formData.toolsUsed.filter((_: any, i: number) => i !== index)
                      })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Repuestos utilizados */}
          <div className="space-y-2">
            <Label>Repuestos Utilizados</Label>
            <Select
              onValueChange={(value) => {
                const part = spareParts.find((p: any) => p.id.toString() === value);
                if (part && !formData.sparePartsUsed.find((p: any) => p.id === part.id)) {
                  setFormData({
                    ...formData,
                    sparePartsUsed: [...formData.sparePartsUsed, part]
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar repuesto" />
              </SelectTrigger>
              <SelectContent>
                {spareParts.map((part: any) => (
                  <SelectItem key={part.id} value={part.id.toString()}>
                    {part.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {formData.sparePartsUsed.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.sparePartsUsed.map((part: any, index: number) => (
                  <Badge key={part.id} variant="secondary" className="flex items-center gap-1">
                    {part.name}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => setFormData({
                        ...formData,
                        sparePartsUsed: formData.sparePartsUsed.filter((_: any, i: number) => i !== index)
                      })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Archivos de solución */}
          <div className="space-y-2">
            <Label>Archivos de Solución</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <UploadCloud className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Arrastra archivos aquí o haz clic para seleccionar
                  </p>
                  <Input
                    type="file"
                    multiple
                    onChange={handleSolutionFileUpload}
                    className="hidden"
                    id="solution-files"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('solution-files')?.click()}
                  >
                    Seleccionar Archivos
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de archivos */}
            {solutionFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Archivos cargados:</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {solutionFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(file.url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSolutionFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              Guardar Solución
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Componente para editar fallas
const FailureEditDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  failure: any;
  machineId: number;
  machineName: string;
  components: MachineComponent[];
}> = ({ isOpen, onClose, onSave, failure, machineId, machineName, components }) => {
  const [formData, setFormData] = useState({
    title: failure?.title || '',
    description: failure?.description || '',
    selectedComponents: failure?.selectedComponents || [],
    selectedSubcomponents: failure?.selectedSubcomponents || [],
    failureType: failure?.failureType || 'MECANICA',
    priority: failure?.priority || 'MEDIUM',
    status: failure?.status || 'PENDING',
    actualHours: failure?.actualHours || '',
    actualTimeUnit: 'hours' as 'hours' | 'minutes',
    estimatedHours: failure?.estimatedHours || '',
    estimatedTimeUnit: 'hours' as 'hours' | 'minutes',
    componentName: failure?.componentName || '',
  });
  const [failureFiles, setFailureFiles] = useState<any[]>(failure?.failureFiles || []);
  const [showSchemaSelector, setShowSchemaSelector] = useState(false);

  // Inicializar componentes seleccionados cuando se abre el modal
  useEffect(() => {
    if (failure && components.length > 0) {
      // Buscar el componente que coincide con componentName
      const selectedComponent = components.find(comp => comp.name === failure.componentName);
      
      if (selectedComponent) {
        setFormData(prev => ({
          ...prev,
          selectedComponents: [Number(selectedComponent.id)],
          selectedSubcomponents: selectedComponent.children?.map(child => Number(child.id)) || []
        }));
      }
    }
  }, [failure, components]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      failureFiles
    });
  };

  const handleFailureFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'failure');
      formData.append('entityId', machineId.toString());
      formData.append('fileType', 'failure');

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setFailureFiles(prev => [...prev, {
            name: file.name,
            url: data.url,
            size: file.size,
            type: file.type
          }]);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error('Error al subir el archivo');
      }
    }
  };

  const removeFailureFile = (index: number) => {
    setFailureFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Editar Falla</DialogTitle>
          <DialogDescription>
            Modifica los detalles de la falla
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Título de la falla"
              />
            </div>

            <div className="space-y-2">
              <Label>Componentes afectados</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={(() => {
                    if (formData.selectedComponents.length === 0) {
                      return 'Ningún componente seleccionado';
                    }
                    
                    const selectedComponentNames = formData.selectedComponents.map(compId => {
                      const component = components.find(comp => Number(comp.id) === compId);
                      return component?.name || '';
                    }).filter(name => name);
                    
                    const selectedSubcomponentNames = formData.selectedSubcomponents.map(subCompId => {
                      const subcomponent = components
                        .flatMap(comp => comp.children || [])
                        .find(child => Number(child.id) === subCompId);
                      return subcomponent?.name || '';
                    }).filter(name => name);
                    
                    const allNames = [...selectedComponentNames, ...selectedSubcomponentNames];
                    return allNames.length > 0 ? allNames.join(', ') : 'Ningún componente seleccionado';
                  })()}
                  readOnly
                  placeholder="Selecciona los componentes afectados"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSchemaSelector(true)}
                  className="flex-shrink-0"
                >
                  <Network className="h-4 w-4 mr-2" />
                  Seleccionar
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción detallada de la falla"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="failureType">Tipo de Falla</Label>
              <Select value={formData.failureType} onValueChange={(value) => setFormData({ ...formData, failureType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MECANICA">Mecánica</SelectItem>
                  <SelectItem value="ELECTRICA">Eléctrica</SelectItem>
                  <SelectItem value="HIDRAULICA">Hidráulica</SelectItem>
                  <SelectItem value="NEUMATICA">Neumática</SelectItem>
                  <SelectItem value="AUTOMATIZACION">Automatización</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridad</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Sin solución</SelectItem>
                  <SelectItem value="IN_PROGRESS">En Proceso</SelectItem>
                  <SelectItem value="COMPLETED">Completada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>



          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedHours">Tiempo Estimado</Label>
              <div className="flex gap-2">
                <Input
                  id="estimatedHours"
                  type="number"
                  value={formData.estimatedHours}
                  onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                  placeholder="0"
                  className="flex-1"
                />
                <Select 
                  value={formData.estimatedTimeUnit || 'hours'} 
                  onValueChange={(value) => setFormData({ ...formData, estimatedTimeUnit: value as 'hours' | 'minutes' })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="actualHours">Tiempo Real</Label>
              <div className="flex gap-2">
                <Input
                  id="actualHours"
                  type="number"
                  value={formData.actualHours}
                  onChange={(e) => setFormData({ ...formData, actualHours: e.target.value })}
                  placeholder="0"
                  className="flex-1"
                />
                <Select 
                  value={formData.actualTimeUnit || 'hours'} 
                  onValueChange={(value) => setFormData({ ...formData, actualTimeUnit: value as 'hours' | 'minutes' })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Archivos de falla */}
          <div className="space-y-2">
            <Label>Archivos de Falla</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <UploadCloud className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Arrastra archivos aquí o haz clic para seleccionar
                  </p>
                  <Input
                    type="file"
                    multiple
                    onChange={handleFailureFileUpload}
                    className="hidden"
                    id="failure-files"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('failure-files')?.click()}
                  >
                    Seleccionar Archivos
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de archivos */}
            {failureFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Archivos cargados:</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {failureFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(file.url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFailureFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

                            {/* Modal de selección de componentes */}
                      <ComponentSelectionModal
                        isOpen={showSchemaSelector}
                        onClose={() => setShowSchemaSelector(false)}
                        components={components}
                        selectedComponents={formData.selectedComponents}
                        selectedSubcomponents={formData.selectedSubcomponents}
                        onSelectionChange={(components, subcomponents) => {
                          setFormData({
                            ...formData,
                            selectedComponents: components,
                            selectedSubcomponents: subcomponents
                          });
                        }}
                        machineName={machineName}
                      />
    </Dialog>
  );
};

// Componente reutilizable para selección de componentes
const ComponentSelectionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  components: MachineComponent[];
  selectedComponents: number[];
  selectedSubcomponents: number[];
  onSelectionChange: (components: number[], subcomponents: number[]) => void;
  machineName: string;
}> = ({ isOpen, onClose, components, selectedComponents, selectedSubcomponents, onSelectionChange, machineName }) => {
  const handleComponentToggle = (componentId: number) => {
    if (selectedComponents.includes(componentId)) {
      // Deseleccionar componente y todos sus subcomponentes
      const component = components.find(comp => Number(comp.id) === componentId);
      const subcomponentIds = component?.children?.map(child => Number(child.id)) || [];
      onSelectionChange(
        selectedComponents.filter(id => id !== componentId),
        selectedSubcomponents.filter(id => !subcomponentIds.includes(id))
      );
    } else {
      // Seleccionar componente y todos sus subcomponentes
      const component = components.find(comp => Number(comp.id) === componentId);
      const subcomponentIds = component?.children?.map(child => Number(child.id)) || [];
      onSelectionChange(
        [...selectedComponents, componentId],
        [...selectedSubcomponents, ...subcomponentIds]
      );
    }
  };

  const handleSubcomponentToggle = (subcomponentId: number) => {
    if (selectedSubcomponents.includes(subcomponentId)) {
      onSelectionChange(
        selectedComponents,
        selectedSubcomponents.filter(id => id !== subcomponentId)
      );
    } else {
      onSelectionChange(
        selectedComponents,
        [...selectedSubcomponents, subcomponentId]
      );
    }
  };

  const handleClearSelection = () => {
    onSelectionChange([], []);
  };

  const handleConfirmSelection = () => {
    onClose();
  };

  const totalSelected = selectedComponents.length + selectedSubcomponents.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="full">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-semibold flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Network className="h-6 w-6 text-primary" />
                </div>
                Seleccionar Componentes
              </DialogTitle>
              <DialogDescription className="text-base mt-2">
                Selecciona los componentes y subcomponentes afectados por la falla. Haz clic en un componente padre para seleccionar automáticamente todos sus subcomponentes.
              </DialogDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{totalSelected}</div>
              <div className="text-sm text-muted-foreground">Seleccionados</div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border text-card-foreground shadow-sm bg-background border-border">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Componentes</p>
                    <p className="text-2xl font-bold text-foreground">{components.length}</p>
                  </div>
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="rounded-lg border text-card-foreground shadow-sm bg-background border-border">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Componentes Padre</p>
                    <p className="text-2xl font-bold text-foreground">{selectedComponents.length}</p>
                  </div>
                  <Cog className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="rounded-lg border text-card-foreground shadow-sm bg-background border-border">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Subcomponentes</p>
                    <p className="text-2xl font-bold text-foreground">{selectedSubcomponents.length}</p>
                  </div>
                  <Wrench className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="rounded-lg border text-card-foreground shadow-sm bg-background border-border">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Seleccionados</p>
                    <p className="text-2xl font-bold text-foreground">{totalSelected}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Información de la máquina y búsqueda */}
          <div className="rounded-lg bg-card text-card-foreground shadow-sm border border-border">
            <div className="flex flex-col space-y-1.5 p-6 bg-muted/30 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight text-lg">Componentes de {machineName}</h3>
                    <p className="text-sm text-muted-foreground">Haz clic en los componentes para seleccionarlos. Los componentes seleccionados se mostrarán resaltados.</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-sm">
                  {components.length} componentes disponibles
                </Badge>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar componentes..."
                    className="pl-10"
                    onChange={(e) => {
                      // Implementar búsqueda si es necesario
                    }}
                  />
                </div>
              </div>

              <div className="space-y-8">
                {/* Máquina Principal */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Máquina Principal</h3>
                  <div className="rounded-lg border bg-card text-card-foreground shadow-sm col-span-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 max-w-sm mx-auto">
                    <div className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Cog className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm">{machineName}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">Máquina Principal</p>
                    </div>
                  </div>
                </div>

                {/* Componentes Principales */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Componentes Principales</h3>
                  <div className="grid grid-cols-12 gap-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.75rem' }}>
                    {components.map((component) => {
                      const isSelected = selectedComponents.includes(Number(component.id));
                      return (
                        <div
                          key={component.id}
                          className={cn('rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:bg-muted/50',
                            isSelected && 'ring-2 ring-primary border-primary bg-primary/10'
                          )}
                          onClick={() => handleComponentToggle(Number(component.id))}
                        >
                          <div className="p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Cog className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-foreground')} />
                              <h4 className="font-medium text-xs line-clamp-2">{component.name}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground">Componente</p>
                            {component.system && (
                              <p className="text-xs text-info-muted-foreground font-medium mt-1">
                                {getSystemLabel(component.system)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Subcomponentes */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Subcomponentes</h3>
                  <div className="grid grid-cols-12 gap-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.75rem' }}>
                    {components.flatMap(component => 
                      component.children?.map(subcomponent => {
                        const isSelected = selectedSubcomponents.includes(Number(subcomponent.id));
                        return (
                          <div
                            key={subcomponent.id}
                            className={cn('rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:bg-muted/50',
                              isSelected && 'ring-2 ring-primary border-primary bg-primary/10'
                            )}
                            onClick={() => handleSubcomponentToggle(Number(subcomponent.id))}
                          >
                            <div className="p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Wrench className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-foreground')} />
                                <h4 className="font-medium text-xs line-clamp-2">{subcomponent.name}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground">de {component.name}</p>
                              {subcomponent.system && (
                                <p className="text-xs text-info-muted-foreground font-medium mt-1">
                                  {getSystemLabel(subcomponent.system)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }) || []
                    )}
                  </div>
                </div>

                {/* Sub-subcomponentes */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Sub-subcomponentes</h3>
                  <div className="grid grid-cols-12 gap-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.75rem' }}>
                    {/* Aquí irían los sub-subcomponentes si existieran */}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resumen de Selección */}
          <div className="rounded-lg text-card-foreground shadow-sm border border-border bg-muted/20">
            <div className="flex flex-col space-y-1.5 p-6 pb-3">
              <h3 className="font-semibold tracking-tight text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Resumen de Selección
              </h3>
            </div>
            <div className="p-6 pt-0 space-y-4">
              {totalSelected > 0 ? (
                <div className="space-y-3">
                  {selectedComponents.map(componentId => {
                    const component = components.find(c => Number(c.id) === componentId);
                    return component ? (
                      <div key={componentId} className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
                        <Cog className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{component.name}</span>
                        <Badge variant="secondary" className="text-xs">Componente</Badge>
                      </div>
                    ) : null;
                  })}
                  {selectedSubcomponents.map(subcomponentId => {
                    const subcomponent = components.flatMap(c => c.children || []).find(s => Number(s.id) === subcomponentId);
                    const parentComponent = components.find(c => c.children?.some(s => Number(s.id) === subcomponentId));
                    return subcomponent ? (
                      <div key={subcomponentId} className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
                        <Wrench className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{subcomponent.name}</span>
                        <Badge variant="secondary" className="text-xs">de {parentComponent?.name}</Badge>
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No hay componentes seleccionados</p>
                  <p className="text-sm">Haz clic en los componentes del esquema para comenzar</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <div className="flex justify-between items-center w-full">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{totalSelected}</span> elementos seleccionados
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleClearSelection}>
                Limpiar Selección
              </Button>
              <Button type="button" onClick={handleConfirmSelection}>
                Confirmar Selección
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
