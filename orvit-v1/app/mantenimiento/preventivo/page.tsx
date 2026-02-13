'use client';

import { Suspense, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, CheckCircle, FileText, Bell, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useMaintenanceAlerts } from '@/hooks/use-maintenance-alerts';
import { useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import {
  PreventivoViewSelector,
  usePreventivoView,
  PreventivoHoyView,
  PreventivoCalendarioView,
  PreventivoPlanesView,
  PreventivoChecklistsView,
  PreventivoMetricasView,
} from '@/components/maintenance/preventive';
import PreventiveMaintenanceDialog from '@/components/work-orders/PreventiveMaintenanceDialog';
import ChecklistManagementDialog from '@/components/maintenance/ChecklistManagementDialog';
import ChecklistDetailDialog from '@/components/maintenance/ChecklistDetailDialog';
import ChecklistExecutionTableDialog from '@/components/maintenance/ChecklistExecutionTableDialog';
import ExecuteMaintenanceDialog from '@/components/maintenance/ExecuteMaintenanceDialog';
import MaintenanceDetailDialog from '@/components/maintenance/MaintenanceDetailDialog';
import { DeleteConfirmationDialog } from '@/components/maintenance/DeleteConfirmationDialog';
import MaintenanceFilterModal from '@/components/maintenance/MaintenanceFilterModal';
import ManualMaintenanceCompletionDialog from '@/components/maintenance/ManualServiceCompletionDialog';
import MaintenanceScreenView from '@/components/maintenance/MaintenanceScreenView';
import { toast } from '@/hooks/use-toast';

/**
 * Página unificada de Mantenimiento Preventivo V2
 *
 * Tabs (URL-driven con ?view=):
 * - Hoy (default): Tareas vencidas + hoy + mañana
 * - Calendario: Vista calendario de instancias
 * - Planes: CRUD de planes preventivos
 * - Checklists: Librería de plantillas con versionado
 * - Métricas: KPIs + Ejecuciones + Auditoría
 */

function PreventivoPageContent() {
  const currentView = usePreventivoView();
  const queryClient = useQueryClient();
  const { currentCompany, currentSector } = useCompany();

  const companyId = currentCompany?.id ? parseInt(currentCompany.id.toString()) : null;
  const sectorId = currentSector?.id ? parseInt(currentSector.id.toString()) : null;

  // Alertas de mantenimiento
  const { data: alertsData } = useMaintenanceAlerts({
    companyId,
    daysAhead: 7,
    enabled: !!companyId,
  });
  const alertsSummary = alertsData?.summary;
  const criticalAlerts = alertsData?.alerts?.filter(a => a.priority === 'CRITICAL' || a.priority === 'HIGH') || [];

  // Estados de diálogos
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isChecklistDialogOpen, setIsChecklistDialogOpen] = useState(false);
  const [isChecklistDetailOpen, setIsChecklistDetailOpen] = useState(false);
  const [isChecklistExecuteOpen, setIsChecklistExecuteOpen] = useState(false);
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteChecklistDialogOpen, setIsDeleteChecklistDialogOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isMassExecutionOpen, setIsMassExecutionOpen] = useState(false);
  const [isScreenViewOpen, setIsScreenViewOpen] = useState(false);
  const [screenViewData, setScreenViewData] = useState<any>(null);

  // Elementos seleccionados
  const [selectedMaintenance, setSelectedMaintenance] = useState<any>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [maintenanceToEdit, setMaintenanceToEdit] = useState<any>(null);
  const [maintenanceToDelete, setMaintenanceToDelete] = useState<any>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<any>(null);

  // Refrescar datos
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['maintenance-pending'] });
    queryClient.invalidateQueries({ queryKey: ['checklists'] });
    toast({
      title: 'Actualizando',
      description: 'Recargando datos de mantenimiento...',
    });
  }, [queryClient]);

  // Handlers de acciones para mantenimientos
  const handleViewMaintenance = useCallback((maintenance: any) => {
    setSelectedMaintenance(maintenance);
    setIsDetailDialogOpen(true);
  }, []);

  const handleEditMaintenance = useCallback((maintenance: any) => {
    setMaintenanceToEdit(maintenance);
    setIsCreateDialogOpen(true);
  }, []);

  const handleExecuteMaintenance = useCallback((maintenance: any) => {
    setSelectedMaintenance(maintenance);
    setIsExecuteDialogOpen(true);
  }, []);

  const handleDeleteMaintenance = useCallback((maintenance: any) => {
    setMaintenanceToDelete(maintenance);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDuplicateMaintenance = useCallback((maintenance: any) => {
    const duplicated = { ...maintenance, id: undefined, title: `${maintenance.title} (copia)` };
    setMaintenanceToEdit(duplicated);
    setIsCreateDialogOpen(true);
  }, []);

  const handleCreatePlan = useCallback(() => {
    setMaintenanceToEdit(null);
    setIsCreateDialogOpen(true);
  }, []);

  // Handlers de acciones para checklists
  const handleCreateChecklist = useCallback(() => {
    setSelectedChecklist(null);
    setIsChecklistDialogOpen(true);
  }, []);

  const handleViewChecklist = useCallback((checklist: any) => {
    setSelectedChecklist(checklist);
    setIsChecklistDetailOpen(true);
  }, []);

  const handleEditChecklist = useCallback((checklist: any) => {
    setSelectedChecklist(checklist);
    setIsChecklistDialogOpen(true);
  }, []);

  const handleDuplicateChecklist = useCallback((checklist: any) => {
    const duplicated = { ...checklist, id: undefined, title: `${checklist.title || checklist.nombre} (copia)` };
    setSelectedChecklist(duplicated);
    setIsChecklistDialogOpen(true);
  }, []);

  const handleExecuteChecklist = useCallback((checklist: any) => {
    setSelectedChecklist(checklist);
    setIsChecklistExecuteOpen(true);
  }, []);

  const handleDeleteChecklist = useCallback((checklist: any) => {
    setChecklistToDelete(checklist);
    setIsDeleteChecklistDialogOpen(true);
  }, []);

  // Cerrar diálogos y refrescar
  const handleDialogClose = useCallback(() => {
    setIsCreateDialogOpen(false);
    setIsChecklistDialogOpen(false);
    setIsChecklistDetailOpen(false);
    setIsChecklistExecuteOpen(false);
    setIsExecuteDialogOpen(false);
    setIsDetailDialogOpen(false);
    setIsDeleteDialogOpen(false);
    setIsDeleteChecklistDialogOpen(false);
    setSelectedMaintenance(null);
    setSelectedChecklist(null);
    setMaintenanceToEdit(null);
    setMaintenanceToDelete(null);
    setChecklistToDelete(null);
    queryClient.invalidateQueries({ queryKey: ['maintenance-pending'] });
    queryClient.invalidateQueries({ queryKey: ['checklists'] });
  }, [queryClient]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!maintenanceToDelete) return;

    try {
      const response = await fetch(`/api/maintenance/${maintenanceToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Error al eliminar');

      toast({
        title: 'Eliminado',
        description: 'Mantenimiento eliminado correctamente',
      });
      handleDialogClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el mantenimiento',
        variant: 'destructive',
      });
    }
  }, [maintenanceToDelete, handleDialogClose]);

  const handleDeleteChecklistConfirm = useCallback(async () => {
    if (!checklistToDelete) return;

    try {
      const response = await fetch(`/api/maintenance/checklists/${checklistToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error('Error al eliminar');

      toast({
        title: 'Eliminado',
        description: 'Checklist eliminada correctamente',
      });
      handleDialogClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la checklist',
        variant: 'destructive',
      });
    }
  }, [checklistToDelete, handleDialogClose]);

  // Handler para ver en pantalla desde el modal de filtros
  const handleViewScreen = useCallback(async (filters: {
    machineIds: number[];
    unidadMovilIds: number[];
    maintenanceTypes: string[];
    componentIds?: number[];
    subcomponentIds?: number[];
  }) => {
    try {
      // Construir parámetros para el API
      const params = new URLSearchParams({
        companyId: companyId!.toString(),
        maintenanceTypes: filters.maintenanceTypes.join(',')
      });

      if (sectorId) {
        params.append('sectorId', sectorId.toString());
      }

      if (filters.machineIds.length > 0) {
        params.append('machineIds', filters.machineIds.join(','));
      }

      if (filters.unidadMovilIds.length > 0) {
        params.append('unidadMovilIds', filters.unidadMovilIds.join(','));
      }

      if (filters.componentIds && filters.componentIds.length > 0) {
        params.append('componentIds', filters.componentIds.join(','));
      }

      if (filters.subcomponentIds && filters.subcomponentIds.length > 0) {
        params.append('subcomponentIds', filters.subcomponentIds.join(','));
      }

      // Fetch de datos de mantenimientos
      const response = await fetch(`/api/maintenance/pdf-data?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Error al obtener datos');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener datos');
      }

      // Guardar datos y mostrar vista
      setScreenViewData({
        ...result.data,
        machineIds: filters.machineIds,
        unidadMovilIds: filters.unidadMovilIds,
        maintenanceTypes: filters.maintenanceTypes,
        componentIds: filters.componentIds,
        subcomponentIds: filters.subcomponentIds
      });
      setIsFilterModalOpen(false);
      setIsScreenViewOpen(true);

      toast({
        title: 'Listado generado',
        description: 'Mostrando mantenimientos en pantalla',
      });
    } catch (error) {
      console.error('Error mostrando mantenimientos:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el listado de mantenimientos',
        variant: 'destructive',
      });
    }
  }, [companyId, sectorId, toast]);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header sticky */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 gap-4">
          {/* Lado izquierdo: Título */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">
                Preventivo
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Mantenimiento programado
              </p>
            </div>
          </div>

          {/* Centro: View selector */}
          <div className="hidden md:flex flex-1 justify-center">
            <PreventivoViewSelector />
          </div>

          {/* Lado derecho: Acciones */}
          <div className="flex gap-2 items-center">
            {/* Badge de alertas */}
            {alertsSummary && (alertsSummary.overdue > 0 || alertsSummary.dueToday > 0) && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className={alertsSummary.overdue > 0
                      ? "border-red-300 bg-red-50 hover:bg-red-100 text-red-700"
                      : "border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700"
                    }
                  >
                    {alertsSummary.overdue > 0 ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                    <span className="ml-1.5 font-medium">
                      {alertsSummary.overdue + alertsSummary.dueToday}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-3 border-b">
                    <h4 className="font-medium text-sm">Alertas de Mantenimiento</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alertsSummary.overdue > 0 && `${alertsSummary.overdue} vencido${alertsSummary.overdue !== 1 ? 's' : ''}`}
                      {alertsSummary.overdue > 0 && alertsSummary.dueToday > 0 && ' · '}
                      {alertsSummary.dueToday > 0 && `${alertsSummary.dueToday} para hoy`}
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {criticalAlerts.slice(0, 5).map((alert) => (
                      <div
                        key={`${alert.id}-${alert.type}`}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                        onClick={() => {
                          const maintenance = { id: alert.id, title: alert.title };
                          handleViewMaintenance(maintenance);
                        }}
                      >
                        <div className={`h-2 w-2 rounded-full shrink-0 ${
                          alert.type === 'OVERDUE' ? 'bg-red-500' : 'bg-orange-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{alert.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {alert.machineName} · {alert.daysUntilDue < 0
                              ? `${Math.abs(alert.daysUntilDue)}d atrasado`
                              : 'Hoy'
                            }
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {criticalAlerts.length > 5 && (
                    <div className="p-2 border-t text-center">
                      <span className="text-xs text-muted-foreground">
                        +{criticalAlerts.length - 5} más
                      </span>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}

            {/* Acciones específicas por vista */}
            {(currentView === 'hoy' || currentView === 'calendario' || currentView === 'planes') && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsFilterModalOpen(true)}
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Listar</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  onClick={() => setIsMassExecutionOpen(true)}
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Ejecución</span>
                </Button>
              </>
            )}

            {(currentView === 'hoy' || currentView === 'calendario' || currentView === 'planes') && (
              <Button
                size="sm"
                className="bg-black hover:bg-gray-800 text-white"
                onClick={handleCreatePlan}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Nuevo</span>
              </Button>
            )}

            {currentView === 'checklists' && (
              <Button
                size="sm"
                className="bg-black hover:bg-gray-800 text-white"
                onClick={handleCreateChecklist}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Nueva</span>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile view selector */}
        <div className="md:hidden px-4 pb-3">
          <PreventivoViewSelector className="w-full justify-center" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 md:px-6 py-4 pb-24 md:pb-4">
          {currentView === 'hoy' && (
            <PreventivoHoyView
              onViewMaintenance={handleViewMaintenance}
              onEditMaintenance={handleEditMaintenance}
              onExecuteMaintenance={handleExecuteMaintenance}
              onDeleteMaintenance={handleDeleteMaintenance}
              onDuplicateMaintenance={handleDuplicateMaintenance}
            />
          )}
          {currentView === 'calendario' && (
            <PreventivoCalendarioView
              onEventClick={handleViewMaintenance}
              onEdit={handleEditMaintenance}
            />
          )}
          {currentView === 'planes' && (
            <PreventivoPlanesView
              hideCreateButton={true}
              onViewPlan={handleViewMaintenance}
              onEditPlan={handleEditMaintenance}
              onExecutePlan={handleExecuteMaintenance}
              onDeletePlan={handleDeleteMaintenance}
              onDuplicatePlan={handleDuplicateMaintenance}
            />
          )}
          {currentView === 'checklists' && (
            <PreventivoChecklistsView
              hideCreateButton={true}
              onCreateChecklist={handleCreateChecklist}
              onViewChecklist={handleViewChecklist}
              onEditChecklist={handleEditChecklist}
              onExecuteChecklist={handleExecuteChecklist}
              onDuplicateChecklist={handleDuplicateChecklist}
              onDeleteChecklist={handleDeleteChecklist}
            />
          )}
          {currentView === 'metricas' && <PreventivoMetricasView />}
        </div>
      </div>

      {/* Diálogos */}
      {companyId && (
        <>
          {/* Diálogo de crear/editar mantenimiento preventivo */}
          <PreventiveMaintenanceDialog
            isOpen={isCreateDialogOpen}
            onClose={handleDialogClose}
            editingMaintenance={maintenanceToEdit}
            mode={maintenanceToEdit?.id ? 'edit' : 'create'}
          />

          {/* Diálogo de gestión de checklists */}
          <ChecklistManagementDialog
            isOpen={isChecklistDialogOpen}
            onClose={handleDialogClose}
            companyId={companyId}
            sectorId={sectorId || undefined}
            editingChecklist={selectedChecklist}
            mode={selectedChecklist?.id ? 'edit' : 'create'}
            onSave={() => {
              handleDialogClose();
              queryClient.invalidateQueries({ queryKey: ['checklists'] });
            }}
          />

          {/* Diálogo de detalle de checklist */}
          {selectedChecklist && (
            <ChecklistDetailDialog
              isOpen={isChecklistDetailOpen}
              onClose={() => {
                setIsChecklistDetailOpen(false);
                setSelectedChecklist(null);
              }}
              checklist={selectedChecklist}
              companyId={companyId}
              onEdit={() => {
                setIsChecklistDetailOpen(false);
                handleEditChecklist(selectedChecklist);
              }}
            />
          )}

          {/* Diálogo de ejecución de checklist (tabla completa) */}
          <ChecklistExecutionTableDialog
            isOpen={isChecklistExecuteOpen}
            onClose={handleDialogClose}
            checklist={selectedChecklist}
            onChecklistCompleted={() => {
              handleDialogClose();
            }}
          />

          {/* Diálogo de ejecución */}
          {selectedMaintenance && (
            <ExecuteMaintenanceDialog
              isOpen={isExecuteDialogOpen}
              onClose={handleDialogClose}
              maintenance={selectedMaintenance}
              companyId={companyId}
            />
          )}

          {/* Diálogo de detalle de mantenimiento */}
          {selectedMaintenance && (
            <MaintenanceDetailDialog
              isOpen={isDetailDialogOpen}
              onClose={handleDialogClose}
              maintenance={selectedMaintenance}
              companyId={companyId}
              canEdit={true}
              onEdit={() => {
                setIsDetailDialogOpen(false);
                handleEditMaintenance(selectedMaintenance);
              }}
            />
          )}

          {/* Diálogo de confirmación de eliminación de mantenimiento */}
          <DeleteConfirmationDialog
            isOpen={isDeleteDialogOpen}
            onClose={() => setIsDeleteDialogOpen(false)}
            onConfirm={handleDeleteConfirm}
            title="Eliminar mantenimiento"
            description={`¿Estás seguro de eliminar "${maintenanceToDelete?.title}"? Esta acción no se puede deshacer.`}
          />

          {/* Diálogo de confirmación de eliminación de checklist */}
          <DeleteConfirmationDialog
            isOpen={isDeleteChecklistDialogOpen}
            onClose={() => setIsDeleteChecklistDialogOpen(false)}
            onConfirm={handleDeleteChecklistConfirm}
            title="Eliminar checklist"
            description={`¿Estás seguro de eliminar "${checklistToDelete?.title || checklistToDelete?.nombre}"? Esta acción no se puede deshacer.`}
          />

          {/* Modal de filtros para Listado */}
          <MaintenanceFilterModal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            onViewScreen={handleViewScreen}
            companyId={companyId}
            sectorId={sectorId}
            initialFilters={{
              machineIds: [],
              unidadMovilIds: [],
              maintenanceTypes: ['PREVENTIVE']
            }}
          />

          {/* Modal de ejecución masiva */}
          <ManualMaintenanceCompletionDialog
            isOpen={isMassExecutionOpen}
            onClose={() => {
              setIsMassExecutionOpen(false);
              handleRefresh();
            }}
            companyId={companyId}
            sectorId={sectorId || 0}
            onMaintenanceCompleted={handleRefresh}
          />

          {/* Vista de pantalla del listado */}
          {isScreenViewOpen && screenViewData && (
            <MaintenanceScreenView
              isOpen={isScreenViewOpen}
              onClose={() => {
                setIsScreenViewOpen(false);
                setScreenViewData(null);
              }}
              data={{
                machines: screenViewData.machines || [],
                preventiveMaintenances: screenViewData.preventiveMaintenances || [],
                correctiveMaintenances: screenViewData.correctiveMaintenances || [],
                unidadesMoviles: screenViewData.unidadesMoviles || []
              }}
              filters={{
                machineIds: screenViewData.machineIds || [],
                maintenanceTypes: screenViewData.maintenanceTypes || ['PREVENTIVE'],
                orientation: 'vertical',
                displayType: 'screen'
              }}
              companyName={currentCompany?.name || ''}
            />
          )}
        </>
      )}
    </div>
  );
}

// Loading skeleton
function PreventivoSkeleton() {
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="sticky top-0 z-20 border-b border-border/60 bg-card/95">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-96 hidden md:block" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="flex-1 px-4 md:px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export default function PreventivoPage() {
  return (
    <Suspense fallback={<PreventivoSkeleton />}>
      <PreventivoPageContent />
    </Suspense>
  );
}
